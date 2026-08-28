from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from ..db import get_db
from ..models import Package, Product, ColorAnalytics, InteriorMaterial
from ..schemas import PackageOut, ProductOut

router = APIRouter()


@router.get("/packages", summary="List packages filtered by BHK, tier, budget")
def list_packages(
    bhk: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    budget: Optional[float] = Query(None),
    style: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Package)
    if bhk:
        q = q.filter(Package.bhk == bhk)
    if tier:
        q = q.filter(Package.tier == tier)
    if budget:
        q = q.filter(Package.base_price <= budget)
    pkgs = q.all()

    # Style tag filter (Python-side since SQLite JSON)
    if style:
        pkgs = [p for p in pkgs if style.lower() in (p.style_tags or [])]

    # Sort: featured first, then price
    pkgs.sort(key=lambda p: (not p.featured, p.base_price))

    return {
        "packages": [_pkg_out(p) for p in pkgs],
        "total": len(pkgs),
    }


@router.get("/packages/{pkg_id}", summary="Get single package detail")
def get_package(pkg_id: str, db: Session = Depends(get_db)):
    pkg = db.query(Package).filter(Package.id == pkg_id).first()
    if not pkg:
        raise HTTPException(404, "Package not found")
    return _pkg_out(pkg)


COLOR_FAMILIES = {
    "Pink": ["Pink", "Rose", "Blush", "Peach", "Red", "Maroon", "Blush Pink", "Rosewood"],
    "White": ["White", "Off White", "Off-white", "Cream", "Beige", "Ivory White"],
    "Grey": ["Grey", "Gray", "Charcoal", "Black", "Charcoal Black", "Matte Black", "Midnight Black"],
    "Brown": ["Brown", "Walnut", "Oak", "Dark Brown", "Natural Walnut", "Warm Honey", "Teak Finish", "Honey Oak", "Light Oak"],
}
NEUTRALS = ["white", "off white", "off-white", "cream", "beige", "grey", "gray", "charcoal", "black", "ivory white", "charcoal black", "matte black", "midnight black"]

def get_color_match_priority(prod_colors: List[str], user_colors: List[str]) -> int:
    if not prod_colors or not user_colors:
        return 4
    prod_colors_lower = [c.lower().strip() for c in prod_colors]
    user_colors_lower = [c.lower().strip() for c in user_colors]
    
    # Priority 1: Exact color match
    for uc in user_colors_lower:
        if uc in prod_colors_lower:
            return 1
            
    # Priority 2: Closest color family match
    for uc in user_colors_lower:
        family = []
        for fam, members in COLOR_FAMILIES.items():
            if uc == fam.lower() or any(uc == m.lower() for m in members):
                family = [fam.lower()] + [m.lower() for m in members]
                break
        for pc in prod_colors_lower:
            if pc in family:
                return 2
                
    # Priority 3: Neutral colors
    for pc in prod_colors_lower:
         if pc in NEUTRALS:
             return 3
             
    return 4


def classify_color_family(name: str) -> str:
    lower = name.lower().strip()
    neutral_kws = ['white', 'beige', 'cream', 'ivory', 'champagne', 'glass', 'frosted']
    earthy_kws = ['walnut', 'brown', 'oak', 'terracotta', 'wood', 'mahogany', 'teak', 'rattan', 'honey', 'cognac']
    luxury_kws = ['charcoal', 'black', 'dark grey', 'dark gray', 'graphite', 'slate', 'wenge', 'concrete', 'grey', 'gray', 'gold', 'bronze', 'silver', 'chrome', 'metal', 'marquina']
    
    if any(k in lower for k in neutral_kws):
        return "Neutral"
    if any(k in lower for k in earthy_kws):
        return "Earthy"
    if any(k in lower for k in luxury_kws):
        return "Luxury / Premium"
    return "Accent"


STYLE_RECOMMENDED_COLORS = {
    "modern": ["White", "Off White", "Grey", "Charcoal", "Black", "Cream"],
    "scandinavian": ["White", "Beige", "Oak", "Cream", "Sage Green", "Natural Wood"],
    "indian_contemporary": ["Terracotta", "Walnut", "Teak", "Brushed Gold", "Cream", "Burnt Orange"],
    "luxury": ["Black Marquina", "Charcoal Black", "Brushed Gold", "Bronze", "Walnut", "Wenge"],
    "mediterranean": ["Terracotta", "Sky Blue", "Navy Blue", "Beige", "Champagne Gold", "White"],
    "boho": ["Rattan", "Walnut", "Beige", "Terracotta", "Mustard", "Sage Green"],
}

DEFAULT_SEEDS = {
    # Neutral
    "White": 50, "Beige": 45, "Cream": 40, "Grey": 35, "Off White": 30, "Ivory": 25,
    # Earthy
    "Walnut": 50, "Oak": 45, "Brown": 40, "Teak": 35, "Terracotta": 30, "Warm Honey": 25,
    # Luxury / Premium
    "Charcoal": 50, "Black": 45, "Champagne Gold": 40, "Bronze": 35, "Brushed Gold": 30, "Marble Black": 25,
    # Accent
    "Pink": 50, "Navy Blue": 45, "Sage": 40, "Olive": 35, "Mustard": 30, "Burnt Orange": 25, "Red": 20, "Green": 15
}


@router.get("/colors", summary="Get master list of unique colors from products catalog")
def get_master_colors(
    style: Optional[str] = Query(None),
    grouped: bool = Query(False),
    db: Session = Depends(get_db)
):
    prods = db.query(Product).all()
    unique_colors = set()
    for p in prods:
        colors = p.color_variants or []
        if not colors and p.variants and isinstance(p.variants, dict):
            colors = p.variants.get("color", [])
        for c in colors:
            if c:
                unique_colors.add(c.strip().title())
                
    unique_list = list(unique_colors)
    
    # Ensure ColorAnalytics entries exist for all unique colors
    for c in unique_list:
        analytics = db.query(ColorAnalytics).filter(ColorAnalytics.color_name == c).first()
        if not analytics:
            cat = classify_color_family(c)
            seed_val = DEFAULT_SEEDS.get(c, 0)
            analytics = ColorAnalytics(
                color_name=c,
                selection_count=seed_val,
                category=cat
            )
            db.add(analytics)
    db.commit()

    if grouped:
        categories = {
            "Neutral": [],
            "Earthy": [],
            "Luxury / Premium": [],
            "Accent": []
        }
        
        # Query active unique colors ordered by selection count descending
        for item in db.query(ColorAnalytics).filter(ColorAnalytics.color_name.in_(unique_list)).order_by(ColorAnalytics.selection_count.desc()).all():
            categories[item.category].append({
                "name": item.color_name,
                "selection_count": item.selection_count,
                "category": item.category
            })
            
        # Compile recommendations by design style
        recommended = []
        if style:
            rec_names = STYLE_RECOMMENDED_COLORS.get(style.lower().strip(), [])
            for rname in rec_names:
                match = next((uc for uc in unique_list if rname.lower() in uc.lower()), None)
                if match and match not in recommended:
                    recommended.append(match)
                    
        # Fallback to general popular colors if list is too short
        if len(recommended) < 4:
            populars = db.query(ColorAnalytics).filter(ColorAnalytics.color_name.in_(unique_list)).order_by(ColorAnalytics.selection_count.desc()).all()
            for p in populars:
                if p.color_name not in recommended:
                    recommended.append(p.color_name)
                    if len(recommended) >= 6:
                        break
                        
        return {
            "categories": categories,
            "recommended": recommended
        }
        
    return sorted(unique_list)


@router.get("/products", summary="List products filtered by room_type or category")
def list_products(
    room_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    style: Optional[str] = Query(None),
    max_price: Optional[float] = Query(None),
    pincode: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    project_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    from sqlalchemy import or_, func
    from ..models import Vendor

    # Normalize room_type for custom BHK types
    target_room_type = room_type if isinstance(room_type, str) else None
    if isinstance(room_type, str) and room_type:
        if room_type.startswith("bedroom_") and room_type != "bedroom_master":
            target_room_type = "bedroom_2"
        elif room_type.startswith("bathroom_") and room_type != "bathroom":
            target_room_type = "bathroom"
        elif room_type == "balcony":
            target_room_type = "living_room"

    # ── Base query ─────────────────────────────────────────────────────────────
    q = db.query(Product)
    if isinstance(target_room_type, str) and target_room_type:
        q = q.filter(Product.room_type == target_room_type)
    if isinstance(category, str) and category:
        cat_raw = category.lower().replace("_", " ").strip()
        
        if 'bedside' in cat_raw:
            q = q.filter(or_(Product.subcategory.ilike('%bedside%'), Product.name.ilike('%bedside%')))
        elif 'bed' in cat_raw:
            q = q.filter(
                or_(
                    Product.subcategory.ilike('%bed%'),
                    Product.category.ilike('%bed%'),
                    Product.name.ilike('%bed%')
                )
            ).filter(
                ~Product.subcategory.ilike('%bedside%'),
                ~Product.name.ilike('%bedside%')
            )
        elif 'desk' in cat_raw or 'study' in cat_raw:
            q = q.filter(or_(Product.subcategory.ilike('%desk%'), Product.subcategory.ilike('%study%'), Product.name.ilike('%desk%'), Product.name.ilike('%study%')))
        elif 'shoe' in cat_raw:
            q = q.filter(or_(Product.subcategory.ilike('%shoe%'), Product.name.ilike('%shoe%')))
        elif 'sofa' in cat_raw:
            q = q.filter(or_(Product.subcategory.ilike('%sofa%'), Product.category.ilike('%sofa%'), Product.name.ilike('%sofa%')))
        elif 'coffee' in cat_raw:
            q = q.filter(or_(Product.subcategory.ilike('%coffee%'), Product.category.ilike('%coffee%'), Product.name.ilike('%coffee%')))
        elif 'side' in cat_raw:
            q = q.filter(or_(Product.subcategory.ilike('%side%'), Product.category.ilike('%side%'), Product.name.ilike('%side%'))).filter(~Product.name.ilike('%bedside%'))
        elif 'chair' in cat_raw:
            q = q.filter(or_(Product.subcategory.ilike('%chair%'), Product.category.ilike('%chair%'), Product.name.ilike('%chair%')))
        elif 'rug' in cat_raw:
            q = q.filter(or_(Product.subcategory.ilike('%rug%'), Product.category.ilike('%rug%'), Product.name.ilike('%rug%')))
        elif 'light' in cat_raw:
            q = q.filter(or_(Product.subcategory.ilike('%light%'), Product.category.ilike('%light%'), Product.name.ilike('%light%')))
        elif 'vanity' in cat_raw:
            q = q.filter(or_(Product.subcategory.ilike('%vanity%'), Product.name.ilike('%vanity%')))
        elif 'fixture' in cat_raw or 'decor' in cat_raw:
            q = q.filter(or_(Product.subcategory.ilike('%fixture%'), Product.category.ilike('%decor%'), Product.name.ilike('%fixture%'), Product.name.ilike('%towel%')))
        else:
            q = q.filter(
                or_(
                    func.lower(func.replace(Product.category, "_", " ")).contains(cat_raw),
                    func.lower(func.replace(Product.subcategory, "_", " ")).contains(cat_raw),
                    func.lower(Product.name).contains(cat_raw)
                )
            )
    if max_price:
        q = q.filter(Product.price <= max_price)

    all_prods = q.all()

    # Load project details
    color_prefs = []
    material_pref = None
    fabric_pref = None
    project_budget = 500000.0
    
    if project_id:
        from ..models import Project
        project = db.query(Project).filter(Project.id == project_id).first()
        if project:
            if project.color_preferences:
                color_prefs = project.color_preferences
            if project.interior_material_preference:
                material_pref = project.interior_material_preference
            if getattr(project, 'fabric_preference', None):
                fabric_pref = project.fabric_preference
            if project.budget:
                project_budget = project.budget

    # Max product price limit table mapping
    def get_max_product_price_limit(budget: float) -> float:
        if budget <= 500000:
            return 75000.0
        elif budget <= 800000:
            return 125000.0
        elif budget <= 1200000:
            return 200000.0
        elif budget <= 2000000:
            return 350000.0
        else:
            return 500000.0

    max_price_limit = get_max_product_price_limit(project_budget)

    # We will build a list of products with their individual match metadata
    products_with_flags = []
    
    ignore_words = {'and', 'or', 'with', 'set', 'table', 'chair', 'bed', 'sofa', 'rug', 'lighting', 'vanity', 'cabinet'}
    pref_tokens = set()
    for pref in color_prefs:
        for word in pref.lower().split():
            if len(word) > 2 and word not in ignore_words:
                pref_tokens.add(word)
    if 'gray' in pref_tokens:
        pref_tokens.add('grey')
    if 'grey' in pref_tokens:
        pref_tokens.add('gray')

    for p in all_prods:
        # 1. Price match
        is_price_match = p.price <= max_price_limit

        # 2. Material match
        is_material_match = True
        if material_pref:
            mat_tokens = [w.lower() for w in material_pref.split() if len(w) > 2]
            if mat_tokens:
                p_mat = (p.primary_material or "").lower()
                p_materials = [m.lower() for m in (p.materials or [])]
                p_desc = (p.description or "").lower()
                p_name = (p.name or "").lower()
                is_material_match = any(
                    token in p_mat or any(token in m for m in p_materials) or token in p_name or token in p_desc
                    for token in mat_tokens
                )

        # 3. Fabric match
        is_fabric_match = True
        if fabric_pref:
            fab_token = fabric_pref.lower().strip()
            if fab_token:
                p_materials = [m.lower() for m in (p.materials or [])]
                p_vars = p.variants if isinstance(p.variants, dict) else {}
                p_fabrics = [f.lower() for f in p_vars.get('fabric', [])]
                p_desc = (p.description or "").lower()
                p_name = (p.name or "").lower()
                is_fabric_match = (
                    fab_token in p_materials or
                    any(fab_token in f for f in p_fabrics) or
                    fab_token in p_name or
                    fab_token in p_desc
                )

        # 4. Color match
        is_color_match = True
        if color_prefs:
            is_color_match = False
            p_colors = p.color_variants or []
            if not p_colors and p.variants and isinstance(p.variants, dict):
                p_colors = p.variants.get("color", [])
            p_colors_lower = [c.lower().strip() for c in p_colors]
            
            # Exact match check
            for uc in color_prefs:
                uc_clean = uc.lower().strip()
                if uc_clean in p_colors_lower or uc_clean in p.name.lower():
                    is_color_match = True
                    break
                    
            # Token match check
            if not is_color_match and pref_tokens:
                for pc in p_colors_lower:
                    for word in pc.split():
                        if word in pref_tokens:
                            is_color_match = True
                            break
                    if is_color_match:
                        break
                if not is_color_match:
                    for word in p.name.lower().split():
                        if word in pref_tokens:
                            is_color_match = True
                            break

        products_with_flags.append({
            "product": p,
            "is_price_match": is_price_match,
            "is_material_match": is_material_match,
            "is_fabric_match": is_fabric_match,
            "is_color_match": is_color_match
        })

    # Pincode priority vendor sets
    exact_ids = set()
    nearby_ids = set()
    if pincode and all_prods:
        all_vendors = db.query(Vendor).filter(Vendor.active == True).all()
        exact_ids = {
            v.id for v in all_vendors
            if pincode in (v.serviceable_pincodes or [])
        }
        pin_prefix = pincode[:3]
        nearby_ids = {
            v.id for v in all_vendors
            if any(p.startswith(pin_prefix) for p in (v.serviceable_pincodes or []))
        } - exact_ids

    # Sorting logic combining match quality & pincode priority
    def get_match_rank(item: dict) -> int:
        is_color = item["is_color_match"]
        is_mat = item["is_material_match"]
        is_fab = item["is_fabric_match"]
        is_price = item["is_price_match"]
        
        # Perfect Match
        if is_color and is_mat and is_fab and is_price:
            return 0
        # Exceeds budget
        elif is_color and is_mat and is_fab and not is_price:
            return 1
        # Misses material
        elif is_color and is_price and (not is_mat or not is_fab):
            return 2
        # Misses color
        elif is_mat and is_fab and is_price and not is_color:
            return 3
        # Matches budget only
        elif is_price:
            return 4
        # Others
        else:
            return 5

    def combined_sort_key(item: dict):
        p = item["product"]
        match_rank = get_match_rank(item)
        
        pin_tier = 2
        if p.vendor_id in exact_ids:
            pin_tier = 0
        elif p.vendor_id in nearby_ids:
            pin_tier = 1
            
        return (match_rank, pin_tier)

    products_with_flags.sort(key=combined_sort_key)

    # Style tag filtering
    if style:
        products_with_flags = [item for item in products_with_flags if style.lower() in (item["product"].style_tags or [])]

    # Helper for label
    def tier_label(p: Product):
        if p.vendor_id in exact_ids:
            return "local"
        if p.vendor_id in nearby_ids:
            return "nearby"
        return "national"

    exact_color_match_found = any(item["is_color_match"] for item in products_with_flags)

    paginated = products_with_flags[skip: skip + limit]
    return {
        "items": [
            _prod_out(
                item["product"], 
                tier_label(item["product"]),
                is_color_match=item["is_color_match"],
                is_material_match=item["is_material_match"],
                is_fabric_match=item["is_fabric_match"],
                is_price_match=item["is_price_match"]
            )
            for item in paginated
        ],
        "total": len(products_with_flags),
        "exact_color_match_found": exact_color_match_found
    }



@router.get("/products/{prod_id}", summary="Get single product")
def get_product(prod_id: str, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == prod_id).first()
    if not prod:
        raise HTTPException(404, "Product not found")
    return _prod_out(prod)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _pkg_out(p: Package) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "tier": p.tier,
        "bhk": p.bhk,
        "base_price": p.base_price,
        "style_tags": p.style_tags or [],
        "thumbnail_url": p.thumbnail_url,
        "images": p.images or [],
        "featured": p.featured,
        "description": p.description,
    }


def _prod_out(
    p: Product, 
    availability_tier: str = "national",
    is_color_match: bool = True,
    is_material_match: bool = True,
    is_fabric_match: bool = True,
    is_price_match: bool = True
) -> dict:
    return {
        "id": p.id,
        "sku": p.sku,
        "name": p.name,
        "category": p.category,
        "subcategory": p.subcategory,
        "room_type": p.room_type,
        "price": p.price,
        "materials": p.materials or [],
        "color_variants": p.color_variants or [],
        "variants": p.variants or {},
        "thumbnail_url": p.thumbnail_url,
        "style_tags": p.style_tags or [],
        "availability_tier": availability_tier,
        "primary_material": p.primary_material,
        "width": p.width,
        "height": p.height,
        "depth": p.depth,
        "weight": p.weight,
        "weight_capacity": p.weight_capacity,
        "style": p.style,
        "finish": p.finish,
        "mounting_type": p.mounting_type,
        "assembly_required": p.assembly_required,
        "suitable_room": p.suitable_room,
        "description": p.description,
        "is_color_match": is_color_match,
        "is_material_match": is_material_match,
        "is_fabric_match": is_fabric_match,
        "is_price_match": is_price_match
    }


@router.get("/materials", summary="Get master list of interior material options")
def get_interior_materials(db: Session = Depends(get_db)):
    materials = db.query(InteriorMaterial).all()
    return [m.name for m in materials]

