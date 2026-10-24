"""
Package to Product Deterministic Mapping Service
Aligns BHK + Package Tier -> Standard Rooms -> Preselected Default Products.
Ensures the sum of default items across all rooms matches the package price.
"""

from typing import Dict, List, Any, Optional
import uuid
from sqlalchemy.orm import Session
from ..models import Project, Room, RoomItem, Product, Package, PackageItems
from .business_rules import normalize_bhk

# Minimum realistic starting budget and budget tiers per BHK
BHK_BUDGET_CONFIG = {
    "1BHK": {
        "min_budget": 300000,
        "rooms": ["living_room", "bedroom_master", "kitchen", "bathroom"],
        "ranges": [
            {"id": "300000", "label": "₹3L – ₹5L", "min": 300000, "max": 500000},
            {"id": "500000", "label": "₹5L – ₹8L", "min": 500000, "max": 800000},
            {"id": "800000", "label": "₹8L – ₹12L", "min": 800000, "max": 1200000},
        ],
    },
    "2BHK": {
        "min_budget": 480000,
        "rooms": ["living_room", "bedroom_master", "bedroom_2", "kitchen", "bathroom", "bathroom_2"],
        "ranges": [
            {"id": "500000", "label": "₹5L – ₹8L", "min": 500000, "max": 800000},
            {"id": "800000", "label": "₹8L – ₹12L", "min": 800000, "max": 1200000},
            {"id": "1200000", "label": "₹12L – ₹18L", "min": 1200000, "max": 1800000},
        ],
    },
    "3BHK": {
        "min_budget": 680000,
        "rooms": ["living_room", "bedroom_master", "bedroom_2", "bedroom_3", "kitchen", "bathroom", "bathroom_2"],
        "ranges": [
            {"id": "700000", "label": "₹7L – ₹10L", "min": 700000, "max": 1000000},
            {"id": "1000000", "label": "₹10L – ₹15L", "min": 1000000, "max": 1500000},
            {"id": "1500000", "label": "₹15L – ₹25L", "min": 1500000, "max": 2500000},
        ],
    },
    "4BHK": {
        "min_budget": 950000,
        "rooms": ["living_room", "bedroom_master", "bedroom_2", "bedroom_3", "bedroom_4", "kitchen", "bathroom", "bathroom_2", "bathroom_3"],
        "ranges": [
            {"id": "1000000", "label": "₹10L – ₹15L", "min": 1000000, "max": 1500000},
            {"id": "1500000", "label": "₹15L – ₹22L", "min": 1500000, "max": 2200000},
            {"id": "2200000", "label": "₹22L – ₹35L", "min": 2200000, "max": 3500000},
        ],
    },
    "5BHK": {
        "min_budget": 1400000,
        "rooms": ["living_room", "bedroom_master", "bedroom_2", "bedroom_3", "bedroom_4", "bedroom_5", "kitchen", "bathroom", "bathroom_2", "bathroom_3", "bathroom_4"],
        "ranges": [
            {"id": "1400000", "label": "₹14L – ₹20L", "min": 1400000, "max": 2000000},
            {"id": "2000000", "label": "₹20L – ₹30L", "min": 2000000, "max": 3000000},
            {"id": "3000000", "label": "₹30L – ₹50L", "min": 3000000, "max": 5000000},
        ],
    },
}

# Standard room item templates by category
ROOM_TEMPLATE_CATEGORIES = {
    "living_room": ["sofas", "coffee_tables", "side_tables", "lighting"],
    "living_room_premium": ["sofas", "coffee_tables", "side_tables", "lighting", "chairs", "rugs"],
    "bedroom": ["beds", "wardrobe", "bedside_tables", "lighting"],
    "bedroom_premium": ["beds", "wardrobe", "bedside_tables", "lighting", "study_desk"],
    "kitchen": ["kitchen_base", "kitchen_wall"],
    "bathroom": ["vanity", "fixtures"],
}


def find_product_for_category(db: Session, room_type: str, category_key: str, color_pref: Optional[str] = None) -> Optional[Product]:
    """Find the best matching product in catalog for a room category."""
    q = db.query(Product)
    
    # Map category_key to database category / name pattern
    if category_key == "sofas":
        q = q.filter(Product.category.ilike("%sofa%"))
    elif category_key == "coffee_tables":
        q = q.filter(Product.category.ilike("%coffee%"))
    elif category_key == "side_tables":
        q = q.filter(Product.category.ilike("%side%"))
    elif category_key == "chairs":
        q = q.filter(Product.category.ilike("%chair%"))
    elif category_key == "rugs":
        q = q.filter(Product.category.ilike("%rug%"))
    elif category_key == "lighting":
        if "bedroom" in room_type:
            q = q.filter(Product.room_type.ilike("%bedroom%"), Product.category.ilike("%lighting%"))
        else:
            q = q.filter(Product.room_type.ilike("%living%"), Product.category.ilike("%lighting%"))
    elif category_key == "beds":
        q = q.filter(Product.name.ilike("%Bed Set%"))
    elif category_key == "wardrobe":
        q = q.filter(Product.name.ilike("%Wardrobe%"))
    elif category_key == "bedside_tables":
        q = q.filter(Product.name.ilike("%Bedside Table%"))
    elif category_key == "study_desk":
        q = q.filter(Product.name.ilike("%Study Desk%"))
    elif category_key == "kitchen_base":
        q = q.filter(Product.name.ilike("%Base Cabinets%"))
    elif category_key == "kitchen_wall":
        q = q.filter(Product.name.ilike("%Wall Cabinets%"))
    elif category_key == "vanity":
        q = q.filter(Product.name.ilike("%Vanity%"))
    elif category_key == "fixtures":
        q = q.filter(Product.name.ilike("%Towel Rack%") | Product.category.ilike("%Dcor%"))

    products = q.all()
    if not products:
        return None

    # Pick product matching user color preference if possible
    if color_pref:
        for p in products:
            if color_pref.lower() in p.name.lower():
                return p
            p_colors = [c.lower() for c in (p.variants or {}).get("color", [])]
            if any(color_pref.lower() in c for c in p_colors):
                return p

    # Fallback to Warm Beige or first
    for p in products:
        if "warm beige" in p.name.lower():
            return p
    return products[0]


def get_default_room_categories(room_type: str, tier: str) -> List[str]:
    """Return the list of mandatory category keys for a given room and package tier."""
    is_premium_or_luxury = tier.lower() in ["premium", "luxury"]
    
    if room_type == "living_room":
        return ROOM_TEMPLATE_CATEGORIES["living_room_premium"] if is_premium_or_luxury else ROOM_TEMPLATE_CATEGORIES["living_room"]
    elif room_type.startswith("bedroom"):
        return ROOM_TEMPLATE_CATEGORIES["bedroom_premium"] if is_premium_or_luxury else ROOM_TEMPLATE_CATEGORIES["bedroom"]
    elif room_type == "kitchen":
        return ROOM_TEMPLATE_CATEGORIES["kitchen"]
    elif room_type.startswith("bathroom"):
        return ROOM_TEMPLATE_CATEGORIES["bathroom"]
    return ["sofas", "lighting"]


def provision_package_defaults_for_project(project: Project, package: Package, db: Session, target_budget: Optional[float] = None) -> Dict[str, Any]:
    """
    Provisions standard rooms and default products for a customer project.
    Calibrates individual item allowances so that sum(item_allowances) == package.base_price.
    """
    bhk_norm = normalize_bhk(project.bhk_type or package.bhk or "1BHK")
    config = BHK_BUDGET_CONFIG.get(bhk_norm, BHK_BUDGET_CONFIG["1BHK"])
    expected_rooms = config["rooms"]
    tier = (package.tier or "basic").lower()
    
    target_total = float(target_budget or package.base_price or config["min_budget"])

    # 1. Ensure all expected rooms exist
    existing_rooms = {r.room_type: r for r in project.rooms}
    active_rooms = []
    
    for rtype in expected_rooms:
        if rtype in existing_rooms:
            room = existing_rooms[rtype]
        else:
            room = Room(
                id=str(uuid.uuid4()),
                project_id=project.id,
                room_type=rtype,
            )
            db.add(room)
            db.flush()
        active_rooms.append(room)

    # 2. Collect default items required across all rooms
    user_pref_color = None
    if project.color_preferences and len(project.color_preferences) > 0:
        user_pref_color = project.color_preferences[0]

    planned_items = []  # list of (room, product, category_key, base_price)
    catalog_total = 0.0

    # 2a. Check if master package_items table in Supabase has mapped products
    saved_pkg_items = db.query(PackageItems).filter(PackageItems.package_id == package.id).all()
    room_by_type = {r.room_type: r for r in active_rooms}

    if saved_pkg_items:
        for pi in saved_pkg_items:
            room = room_by_type.get(pi.room_type)
            if not room:
                continue
            prod = pi.product
            if prod:
                price = float(prod.price or 0.0)
                planned_items.append({
                    "room": room,
                    "product": prod,
                    "cat_key": prod.category,
                    "catalog_price": price
                })
                catalog_total += price

    # 2b. Fallback to algorithmic mapping if package_items table is empty for this package
    if not planned_items:
        for room in active_rooms:
            cat_keys = get_default_room_categories(room.room_type, tier)
            for cat_key in cat_keys:
                prod = find_product_for_category(db, room.room_type, cat_key, user_pref_color)
                if prod:
                    price = float(prod.price or 0.0)
                    planned_items.append({
                        "room": room,
                        "product": prod,
                        "cat_key": cat_key,
                        "catalog_price": price
                    })
                    catalog_total += price

    if not planned_items:
        return {"success": False, "message": "No catalog products found to map"}

    # 3. Mathematically scale item prices so the sum EXACTLY equals target_total
    scale_factor = target_total / catalog_total if catalog_total > 0 else 1.0
    accumulated = 0.0

    calibrated_items = []
    for i, it in enumerate(planned_items):
        if i == len(planned_items) - 1:
            # Last item absorbs any rounding difference to ensure 100% exact match
            final_price = round(target_total - accumulated, 2)
        else:
            raw_scaled = it["catalog_price"] * scale_factor
            final_price = round(raw_scaled / 100.0) * 100.0  # clean rounded numbers
            accumulated += final_price
        
        calibrated_items.append({
            **it,
            "calibrated_unit_price": final_price,
        })

    # 4. Remove previous default items in rooms to prevent duplicates
    for room in active_rooms:
        # Delete items marked as package default
        for item in list(room.items):
            custom_attrs = item.custom_attributes or {}
            if custom_attrs.get("is_package_default") or getattr(item, 'is_package_default', False):
                db.delete(item)
    db.flush()

    # 5. Insert newly calibrated default items
    created_items = []
    for it in calibrated_items:
        room = it["room"]
        prod = it["product"]
        price = it["calibrated_unit_price"]

        # Default color choice
        default_color = user_pref_color or (prod.variants or {}).get("color", ["Warm Beige"])[0] if (prod.variants or {}).get("color") else "Warm Beige"
        default_finish = (prod.variants or {}).get("wood_finish", ["Matte"])[0] if (prod.variants or {}).get("wood_finish") else "Matte"
        default_fabric = (prod.variants or {}).get("fabric", ["Premium Upholstery"])[0] if (prod.variants or {}).get("fabric") else "Premium Upholstery"

        custom_attrs = {
            "is_package_default": True,
            "package_allowance": price,
            "locked_tier": tier,
            "color": default_color,
            "wood_finish": default_finish,
            "fabric": default_fabric,
        }

        ri = RoomItem(
            id=str(uuid.uuid4()),
            room_id=room.id,
            product_id=prod.id,
            qty=1,
            unit_price=price,
            custom_color=default_color,
            custom_material=prod.primary_material or "Solid Wood",
            custom_wood_finish=default_finish,
            custom_fabric=default_fabric,
            custom_attributes=custom_attrs,
        )
        # Set database columns if they exist on model
        if hasattr(ri, "is_package_default"):
            setattr(ri, "is_package_default", True)
        if hasattr(ri, "package_allowance"):
            setattr(ri, "package_allowance", price)

        db.add(ri)
        created_items.append(ri)

    # 6. Update project budget and package_id
    project.package_id = package.id
    project.budget = target_total
    db.commit()

    return {
        "success": True,
        "package_id": package.id,
        "package_name": package.name,
        "tier": tier,
        "total_budget": target_total,
        "rooms_count": len(active_rooms),
        "items_count": len(created_items),
        "exact_sum_matches": round(sum(it["calibrated_unit_price"] for it in calibrated_items), 2) == round(target_total, 2),
    }
