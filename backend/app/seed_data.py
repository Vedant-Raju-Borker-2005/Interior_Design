"""Seed the database with sample packages, products, and vendors."""
import os
import re
import urllib.parse
import uuid
from sqlalchemy.orm import Session
from .models import Package, Product, Vendor, VendorProduct, ProductVariant, Inventory, InteriorMaterial

BASE_CATALOG_URL = "http://localhost:8000/static/assets/catalog"

PACKAGE_THUMBNAILS = {
    ("1BHK", "basic"):    f"{BASE_CATALOG_URL}/Sofa%20Set%20Warm%20Beige.png",
    ("1BHK", "premium"):  f"{BASE_CATALOG_URL}/Sofa%20Set%20Emerald%20Green.png",
    ("1BHK", "luxury"):   f"{BASE_CATALOG_URL}/Sofa%20Set%20Royal%20Navy%20Blue.png",
    ("2BHK", "basic"):    f"{BASE_CATALOG_URL}/Coffee%20Table%20Warm%20Beige.png",
    ("2BHK", "premium"):  f"{BASE_CATALOG_URL}/Master%20Bed%20Set%20Blush%20Pink.png",
    ("2BHK", "luxury"):   f"{BASE_CATALOG_URL}/Master%20Bed%20Set%20Royal%20Navy%20Blue.png",
    ("3BHK", "basic"):    f"{BASE_CATALOG_URL}/Area%20Rug%20Royal%20Navy%20Blue.png",
    ("3BHK", "premium"):  f"{BASE_CATALOG_URL}/Base%20Cabinets%20Royal%20Navy%20Blue.jpeg",
    ("3BHK", "luxury"):   f"{BASE_CATALOG_URL}/Master%20Bed%20Set%20Warm%20Beige.png",
    ("4BHK", "basic"):    f"{BASE_CATALOG_URL}/Wardrobe%20Closet%20Charcoal%20Grey.png",
    ("4BHK", "premium"):  f"{BASE_CATALOG_URL}/Wardrobe%20Closet%20Royal%20Navy%20Blue.png",
    ("4BHK", "luxury"):   f"{BASE_CATALOG_URL}/Sofa%20Set%20Charcoal%20Grey.png",
    ("5BHK", "basic"):    f"{BASE_CATALOG_URL}/Accent%20Chair%20Emerald%20Green.png",
    ("5BHK", "premium"):  f"{BASE_CATALOG_URL}/Accent%20Chair%20Royal%20Navy%20Blue.png",
    ("5BHK", "luxury"):   f"{BASE_CATALOG_URL}/Sofa%20Set%20Blush%20Pink.png",
}

PACKAGES = [
    # 1 BHK
    dict(bhk="1BHK", tier="basic",   base_price=  295000, style_tags=["modern", "minimalist"],        description="Clean, functional interiors for a compact 1BHK. Every sq ft optimised."),
    dict(bhk="1BHK", tier="premium", base_price=  520000, style_tags=["scandinavian", "modern"],       description="Light woods, neutral palette, Scandinavian calm for your 1BHK."),
    dict(bhk="1BHK", tier="luxury",  base_price=  850000, style_tags=["luxury", "contemporary"],       description="Premium finishes, designer lighting, bespoke furniture for the discerning few."),
    # 2 BHK
    dict(bhk="2BHK", tier="basic",   base_price=  480000, style_tags=["modern", "functional"],         description="Complete 2BHK solution with durable quality furniture and stylish finishes."),
    dict(bhk="2BHK", tier="premium", base_price=  750000, style_tags=["contemporary", "warm"],         description="Indian Contemporary style with warm tones, brass accents and smart storage."),
    dict(bhk="2BHK", tier="luxury",  base_price= 1250000, style_tags=["luxury", "italian"],            description="Luxury Italian design philosophy with handcrafted bespoke pieces."),
    # 3 BHK
    dict(bhk="3BHK", tier="basic",   base_price=  680000, style_tags=["modern"],                      description="Spacious modern living with budget-friendly yet classy interiors."),
    dict(bhk="3BHK", tier="premium", base_price= 1100000, style_tags=["scandinavian", "earthy"],       description="Earthy Scandinavian warmth — natural textures, calming greens, smart layout."),
    dict(bhk="3BHK", tier="luxury",  base_price= 1900000, style_tags=["luxury", "art-deco"],           description="Art-Deco glam: metallic accents, velvet upholstery, statement ceilings."),
    # 4 BHK
    dict(bhk="4BHK", tier="basic",   base_price=  950000, style_tags=["modern", "practical"],          description="Large family interiors designed for everyday elegance."),
    dict(bhk="4BHK", tier="premium", base_price= 1600000, style_tags=["tropical", "contemporary"],     description="Tropical Contemporary with lush greens, natural stone and open volumes."),
    dict(bhk="4BHK", tier="luxury",  base_price= 2800000, style_tags=["luxury", "neoclassical"],       description="Neoclassical grandeur — mouldings, marble, and masterpiece lighting."),
    # 5 BHK
    dict(bhk="5BHK", tier="basic",   base_price= 1400000, style_tags=["modern", "villa"],              description="Villa-scale modern interiors with cohesive room-to-room flow."),
    dict(bhk="5BHK", tier="luxury",  base_price= 4200000, style_tags=["luxury", "bespoke"],            description="Truly bespoke luxury — every element custom designed and hand-finished."),
]

MAPPING = {
    "accent chair": {
        "category": "chairs",
        "subcategory": "Accent Chair",
        "room_type": "living_room",
        "price": 18500.0,
        "vendor_name": "ElegantTile Works",
        "style_tags": ["modern", "contemporary", "scandinavian"]
    },
    "area rug": {
        "category": "rugs",
        "subcategory": "Area Rug",
        "room_type": "living_room",
        "price": 11200.0,
        "vendor_name": "ElegantTile Works",
        "style_tags": ["modern", "contemporary", "scandinavian", "warm"]
    },
    "base cabinets": {
        "category": "Kitchen",
        "subcategory": "Modular Cabinets",
        "room_type": "kitchen",
        "price": 45000.0,
        "vendor_name": "HomeCraft Carpentry Pvt Ltd",
        "style_tags": ["modern", "contemporary"]
    },
    "wall cabinets": {
        "category": "Kitchen",
        "subcategory": "Modular Cabinets",
        "room_type": "kitchen",
        "price": 32000.0,
        "vendor_name": "HomeCraft Carpentry Pvt Ltd",
        "style_tags": ["modern", "contemporary"]
    },
    "bedside lighting": {
        "category": "Lighting",
        "subcategory": "Lighting",
        "room_type": "bedroom_master",
        "price": 5500.0,
        "vendor_name": "BrightSpark Electricals",
        "style_tags": ["modern", "contemporary", "scandinavian"]
    },
    "lighting": {
        "category": "lighting",
        "subcategory": "Lighting",
        "room_type": "living_room",
        "price": 8500.0,
        "vendor_name": "BrightSpark Electricals",
        "style_tags": ["modern", "contemporary", "scandinavian"]
    },
    "bedside tables": {
        "category": "Furniture",
        "subcategory": "Bedside Tables",
        "room_type": "bedroom_master",
        "price": 7500.0,
        "vendor_name": "HomeCraft Carpentry Pvt Ltd",
        "style_tags": ["modern", "contemporary", "scandinavian"]
    },
    "coffee table": {
        "category": "coffee_tables",
        "subcategory": "Coffee Table",
        "room_type": "living_room",
        "price": 12500.0,
        "vendor_name": "HomeCraft Carpentry Pvt Ltd",
        "style_tags": ["modern", "contemporary", "scandinavian"]
    },
    "side tables": {
        "category": "side_tables",
        "subcategory": "Side Tables",
        "room_type": "living_room",
        "price": 6200.0,
        "vendor_name": "HomeCraft Carpentry Pvt Ltd",
        "style_tags": ["modern", "contemporary", "scandinavian"]
    },
    "sofa set": {
        "category": "sofas",
        "subcategory": "Sofa",
        "room_type": "living_room",
        "price": 52000.0,
        "vendor_name": "HomeCraft Carpentry Pvt Ltd",
        "style_tags": ["modern", "contemporary", "scandinavian", "luxury"]
    },
    "study desk": {
        "category": "Furniture",
        "subcategory": "Study Desk",
        "room_type": "bedroom_master",
        "price": 14500.0,
        "vendor_name": "HomeCraft Carpentry Pvt Ltd",
        "style_tags": ["modern", "contemporary", "scandinavian"]
    },
    "towel racks & accessories": {
        "category": "Décor",
        "subcategory": "Fixtures",
        "room_type": "bathroom",
        "price": 4200.0,
        "vendor_name": "ElegantTile Works",
        "style_tags": ["modern", "contemporary"]
    },
    "vanity counter": {
        "category": "Furniture",
        "subcategory": "Vanity Counter",
        "room_type": "bathroom",
        "price": 19500.0,
        "vendor_name": "HomeCraft Carpentry Pvt Ltd",
        "style_tags": ["modern", "contemporary"]
    },
    "vanity": {
        "category": "Furniture",
        "subcategory": "Vanity Counter",
        "room_type": "bathroom",
        "price": 18500.0,
        "vendor_name": "HomeCraft Carpentry Pvt Ltd",
        "style_tags": ["modern", "contemporary"]
    },
    "wardrobe closet": {
        "category": "Furniture",
        "subcategory": "Wardrobe",
        "room_type": "bedroom_master",
        "price": 38000.0,
        "vendor_name": "HomeCraft Carpentry Pvt Ltd",
        "style_tags": ["modern", "contemporary", "scandinavian"]
    },
    "master bed set": {
        "category": "Furniture",
        "subcategory": "Master Bed",
        "room_type": "bedroom_master",
        "price": 58000.0,
        "vendor_name": "HomeCraft Carpentry Pvt Ltd",
        "style_tags": ["modern", "contemporary", "scandinavian", "luxury"]
    }
}


def load_catalog_products():
    catalog_dir = 'backend/assets/catalog'
    if not os.path.exists(catalog_dir):
        catalog_dir = 'assets/catalog'

    if not os.path.exists(catalog_dir):
        return []

    files = os.listdir(catalog_dir)
    products = []

    for filename in files:
        if not filename.lower().endswith(('.png', '.jpeg', '.jpg')):
            continue

        base_name = ""
        color = ""
        for c in ["Royal Navy Blue", "Emerald Green", "Blush Pink", "Warm Beige", "Charcoal Grey", "Charcoal Gray"]:
            if c.lower() in filename.lower():
                color = "Charcoal Grey" if "charcoal" in c.lower() else c
                pattern = re.compile(re.escape(c), re.IGNORECASE)
                base_name = pattern.sub("", filename)
                base_name = base_name.rsplit('.', 1)[0].strip()
                base_name = re.sub(r'\s+', ' ', base_name).strip()
                break

        if not base_name or not color:
            continue

        match_key = base_name.lower()
        if match_key not in MAPPING:
            found = False
            for key in MAPPING:
                if key in match_key:
                    match_key = key
                    found = True
                    break
            if not found:
                continue

        meta = MAPPING[match_key]
        sku = f"CAT-{base_name.upper().replace(' ', '-')}-{color.upper().replace(' ', '-')}"
        prod_name = f"{color} {base_name}"
        thumbnail_url = f"{BASE_CATALOG_URL}/{urllib.parse.quote(filename)}"

        color_variants = [color]
        variants_dict = {
            "color": [color],
            "fabric": ["Velvet", "Cotton", "Leather"] if meta["category"] in ["sofas", "chairs"] else [],
            "wood_finish": ["Matte", "Glossy", "Teak"] if meta["category"] in ["Furniture", "coffee_tables", "side_tables"] else [],
            "size": ["Standard"],
            "texture": ["Matte"],
            "cushion_style": ["Tufted"] if meta["category"] == "sofas" else [],
            "images": [thumbnail_url]
        }

        prod_def = {
            "sku": sku,
            "name": prod_name,
            "category": meta["category"],
            "subcategory": meta["subcategory"],
            "vendor_name": meta["vendor_name"],
            "room_type": meta["room_type"],
            "price": meta["price"],
            "thumbnail_url": thumbnail_url,
            "materials": ["Velvet"] if meta["category"] in ["sofas", "chairs"] else ["Solid Wood"],
            "color_variants": color_variants,
            "variants": variants_dict,
            "style_tags": meta["style_tags"],
            "primary_material": "Solid Wood",
            "width": 1200.0,
            "height": 750.0,
            "depth": 600.0,
            "weight": 15.0,
            "weight_capacity": 120.0,
            "style": "Modern",
            "finish": "Matte",
            "mounting_type": "Floor Standing",
            "assembly_required": "No",
            "suitable_room": meta["room_type"].replace("_", " ").title(),
            "description": f"Premium {prod_name} designed for home renovations.",
            "is_bedroom_master": (meta["room_type"] == "bedroom_master"),
            "base_name": base_name,
            "color": color
        }
        products.append(prod_def)

    return products


PRODUCTS = load_catalog_products()

VENDORS = [
    dict(name="HomeCraft Carpentry Pvt Ltd", phone="+919900001111", gst_no="29AABCS1429B1Z1",
         categories=["Furniture", "Wardrobes", "Kitchen Cabinets"], rating=4.7, active=True,
         serviceable_pincodes=["560001", "560002", "560078", "560100"]),
    dict(name="BrightSpark Electricals", phone="+919900002222", gst_no="29AADCE1234C1Z2",
         categories=["Lighting", "Appliances"], rating=4.5, active=True,
         serviceable_pincodes=["560001", "560010", "400001", "400050"]),
    dict(name="ElegantTile Works", phone="+919900003333", gst_no="29AAFCT5678D1Z3",
         categories=["Flooring", "Decor", "Bathroom Fixtures", "Curtains", "Doors & Windows"], rating=4.8, active=True,
         serviceable_pincodes=["560001", "560078", "110001", "110050"]),
]


def seed_database(db: Session):
    # Seed interior materials independently
    if db.query(InteriorMaterial).count() == 0:
        materials = ["Oak Laminate", "Teak Laminate", "Walnut Laminate"]
        for m in materials:
            db.add(InteriorMaterial(id=str(uuid.uuid4()), name=m))
        db.commit()

    if db.query(Package).count() > 0:
        return  # already seeded

    # First-ever seed: clear any stale pre-seeded data
    db.query(Product).delete()
    db.query(VendorProduct).delete()
    db.commit()

    # Seed packages
    pkg_tier_names = {"basic": "Basic", "premium": "Premium", "luxury": "Luxury"}
    fallback_thumb = f"{BASE_CATALOG_URL}/Sofa%20Set%20Warm%20Beige.png"
    for p in PACKAGES:
        thumb = PACKAGE_THUMBNAILS.get((p["bhk"], p["tier"]), fallback_thumb)
        pkg = Package(
            id=str(uuid.uuid4()),
            name=f"{pkg_tier_names[p['tier']]} {p['bhk']}",
            tier=p["tier"],
            bhk=p["bhk"],
            base_price=p["base_price"],
            style_tags=p["style_tags"],
            description=p["description"],
            thumbnail_url=thumb,
            images=[thumb],
            featured=(p["tier"] == "premium"),
        )
        db.add(pkg)

    # Seed vendors first to map their IDs
    vendor_map = {}
    for v in VENDORS:
        vendor_id = str(uuid.uuid4())
        vendor = Vendor(id=vendor_id, **v)
        db.add(vendor)
        vendor_map[v["name"]] = vendor_id
    db.commit()

    # Load catalog products dynamically
    products_to_seed = load_catalog_products()

    for p in products_to_seed:
        vendor_id = vendor_map.get(p["vendor_name"])
        if not vendor_id:
            vendor_id = list(vendor_map.values())[0] if vendor_map else None

        prod_id = str(uuid.uuid4())

        # 1. VendorProduct
        vendor_prod = VendorProduct(
            id=prod_id,
            vendor_id=vendor_id,
            name=p["name"],
            category=p["category"],
            subcategory=p["subcategory"],
            sku=p["sku"],
            description=p["description"],
            base_price=p["price"],
            images=[p["thumbnail_url"]],
            is_archived=False,
            primary_material=p["primary_material"],
            width=p["width"],
            height=p["height"],
            depth=p["depth"],
            weight=p["weight"],
            weight_capacity=p["weight_capacity"],
            style=p["style"],
            finish=p["finish"],
            mounting_type=p["mounting_type"],
            assembly_required=p["assembly_required"],
            suitable_room=p["suitable_room"]
        )
        db.add(vendor_prod)

        # 2. ProductVariant
        v_rec = ProductVariant(
            id=str(uuid.uuid4()),
            product_id=prod_id,
            color=p["color"],
            material=p["materials"][0] if p["materials"] else "Wood",
            size="Standard",
            price_adjustment=0.0,
            sku_suffix=p["color"].upper().replace(' ', '-')
        )
        db.add(v_rec)

        # 3. Inventory
        inv = Inventory(
            id=str(uuid.uuid4()),
            product_id=prod_id,
            available_qty=100,
            reserved_qty=0,
            incoming_qty=0
        )
        db.add(inv)

        # 4. Customer Product
        cust_prod = Product(
            id=prod_id,
            sku=p["sku"],
            name=p["name"],
            category=p["category"],
            subcategory=p["subcategory"],
            vendor_id=vendor_id,
            room_type=p["room_type"],
            price=p["price"],
            thumbnail_url=p["thumbnail_url"],
            materials=p["materials"],
            color_variants=p["color_variants"],
            variants=p["variants"],
            style_tags=p["style_tags"],
            primary_material=p["primary_material"],
            width=p["width"],
            height=p["height"],
            depth=p["depth"],
            weight=p["weight"],
            weight_capacity=p["weight_capacity"],
            style=p["style"],
            finish=p["finish"],
            mounting_type=p["mounting_type"],
            assembly_required=p["assembly_required"],
            suitable_room=p["suitable_room"],
            description=p["description"],
            images=[p["thumbnail_url"]]
        )
        db.add(cust_prod)

        # 5. Handle bedroom_2 copying rule (Customer catalog ONLY)
        if p["is_bedroom_master"]:
            subcat = p["subcategory"]
            cat = p["category"]
            if subcat == "Master Bed":
                subcat = "Bed set"
                cat = "Furniture"

            prod_id_2 = str(uuid.uuid4())
            sku_2 = f"CAT-B2-{p['base_name'].upper().replace(' ', '-')}-{p['color'].upper().replace(' ', '-')}"

            cust_prod_2 = Product(
                id=prod_id_2,
                sku=sku_2,
                name=p["name"],
                category=cat,
                subcategory=subcat,
                vendor_id=vendor_id,
                room_type="bedroom_2",
                price=p["price"],
                thumbnail_url=p["thumbnail_url"],
                materials=p["materials"],
                color_variants=p["color_variants"],
                variants=p["variants"],
                style_tags=p["style_tags"],
                primary_material=p["primary_material"],
                width=p["width"],
                height=p["height"],
                depth=p["depth"],
                weight=p["weight"],
                weight_capacity=p["weight_capacity"],
                style=p["style"],
                finish=p["finish"],
                mounting_type=p["mounting_type"],
                assembly_required=p["assembly_required"],
                suitable_room="Bedroom 2",
                description=f"Premium {p['name']} designed for bedroom renovations.",
                images=[p["thumbnail_url"]]
            )
            db.add(cust_prod_2)

    db.commit()
    print("[DB] Database seeded with packages, vendors, catalog products, variants, and inventory.")
