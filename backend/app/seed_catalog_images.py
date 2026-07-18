import os
import re
import sqlite3
import urllib.parse
import uuid
import json

def seed_images_to_db():
    db_path = 'backend/interior_ai.db'
    if not os.path.exists(db_path):
        db_path = 'interior_ai.db'

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Fetch vendor mapping (business_name or name -> id)
    cursor.execute("SELECT id, name, business_name FROM vendors")
    vendors = cursor.fetchall()
    vendor_map = {}
    for v_id, name, b_name in vendors:
        if name:
            vendor_map[name.lower().strip()] = v_id
        if b_name:
            vendor_map[b_name.lower().strip()] = v_id

    # Fallback to first vendor if not found
    fallback_vendor_id = vendors[0][0] if vendors else None

    # 2. Cleanup all products, variants, inventory, and vendor products
    # This removes components whose images do not exist (only text data)
    cursor.execute("DELETE FROM product_variants")
    cursor.execute("DELETE FROM inventory")
    cursor.execute("DELETE FROM vendor_products")
    cursor.execute("DELETE FROM products")
    conn.commit()
    print("Cleaned up all existing catalog, variant, inventory, and vendor products.")

    # 3. Product type mapping dictionary
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

    catalog_dir = 'backend/pdfs/catalog'
    if not os.path.exists(catalog_dir):
        print(f"Catalog directory '{catalog_dir}' not found!")
        return

    files = os.listdir(catalog_dir)
    seeded_count = 0

    for filename in files:
        if not filename.lower().endswith(('.png', '.jpeg', '.jpg')):
            continue

        # Extract base name and color
        base_name = ""
        color = ""
        for c in ["Royal Navy Blue", "Emerald Green", "Blush Pink", "Warm Beige", "Charcoal Grey", "Charcoal Gray"]:
            if c.lower() in filename.lower():
                color = "Charcoal Grey" if "charcoal" in c.lower() else c
                # Remove color and extension
                pattern = re.compile(re.escape(c), re.IGNORECASE)
                base_name = pattern.sub("", filename)
                base_name = base_name.rsplit('.', 1)[0].strip()
                base_name = re.sub(r'\s+', ' ', base_name).strip()
                break

        if not base_name or not color:
            print(f"Could not parse filename: {filename}")
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
                print(f"No component mapping found for base name: '{base_name}' (file: {filename})")
                continue

        meta = MAPPING[match_key]
        vendor_id = vendor_map.get(meta["vendor_name"].lower().strip(), fallback_vendor_id)

        # Build properties
        prod_id = str(uuid.uuid4())
        sku = f"CAT-{base_name.upper().replace(' ', '-')}-{color.upper().replace(' ', '-')}"
        prod_name = f"{color} {base_name}"
        thumbnail_url = f"http://localhost:8000/static/pdfs/catalog/{urllib.parse.quote(filename)}"
        
        # Color variants and dictionary
        color_variants = json.dumps([color])
        variants = json.dumps({
            "color": [color],
            "fabric": ["Velvet", "Cotton", "Leather"] if meta["category"] in ["sofas", "chairs"] else [],
            "wood_finish": ["Matte", "Glossy", "Teak"] if meta["category"] in ["Furniture", "coffee_tables", "side_tables"] else [],
            "size": ["Standard"],
            "texture": ["Matte"],
            "cushion_style": ["Tufted"] if meta["category"] == "sofas" else [],
            "images": [thumbnail_url]
        })
        style_tags = json.dumps(meta["style_tags"])

        # 1. Insert into unified customer-facing Product table (Master Room Type)
        cursor.execute("""
            INSERT INTO products (
                id, sku, name, category, subcategory, vendor_id, room_type, price,
                color_variants, variants, thumbnail_url, style_tags, description, images
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            prod_id, sku, prod_name, meta["category"], meta["subcategory"], vendor_id, meta["room_type"], meta["price"],
            color_variants, variants, thumbnail_url, style_tags, f"Premium {prod_name} designed for home renovations.",
            json.dumps([thumbnail_url])
        ))
        
        # 2. Insert into VendorProduct table (ONCE per unique item)
        cursor.execute("""
            INSERT INTO vendor_products (
                id, vendor_id, name, category, subcategory, sku, description, base_price, images, is_archived,
                primary_material, width, height, depth, weight, weight_capacity, style, finish, mounting_type,
                assembly_required, suitable_room
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            prod_id, vendor_id, prod_name, meta["category"], meta["subcategory"], sku, f"Premium {prod_name}", meta["price"],
            json.dumps([thumbnail_url]), False, "Solid Wood", 1200.0, 750.0, 600.0, 15.0, 120.0, "Modern", "Matte",
            "Floor Standing", "No", meta["room_type"].replace("_", " ").title()
        ))

        # 3. Insert into ProductVariant table (ONCE)
        cursor.execute("""
            INSERT INTO product_variants (
                id, product_id, color, material, size, price_adjustment, sku_suffix
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            str(uuid.uuid4()), prod_id, color, "Velvet" if meta["category"] in ["sofas", "chairs"] else "Wood", "Standard", 0.0, color.upper().replace(' ', '-')
        ))

        # 4. Insert into Inventory table (ONCE)
        cursor.execute("""
            INSERT INTO inventory (
                id, product_id, available_qty, reserved_qty, incoming_qty
            ) VALUES (?, ?, ?, ?, ?)
        """, (
            str(uuid.uuid4()), prod_id, 100, 0, 0
        ))

        seeded_count += 1

        # 5. Handle bedroom_2 copying rule (Customer catalog ONLY, to avoid vendor duplicates)
        if meta["room_type"] == "bedroom_master":
            subcat = meta["subcategory"]
            cat = meta["category"]
            if subcat == "Master Bed":
                subcat = "Bed set"
                cat = "Furniture"
            
            prod_id_2 = str(uuid.uuid4())
            sku_2 = f"CAT-B2-{base_name.upper().replace(' ', '-')}-{color.upper().replace(' ', '-')}"
            
            # Customer product (Room Type: bedroom_2)
            cursor.execute("""
                INSERT INTO products (
                    id, sku, name, category, subcategory, vendor_id, room_type, price,
                    color_variants, variants, thumbnail_url, style_tags, description, images
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                prod_id_2, sku_2, prod_name, cat, subcat, vendor_id, "bedroom_2", meta["price"],
                color_variants, variants, thumbnail_url, style_tags, f"Premium {prod_name} designed for bedroom renovations.",
                json.dumps([thumbnail_url])
            ))
            seeded_count += 1

    conn.commit()
    conn.close()
    print(f"Successfully seeded {seeded_count} products to the database.")

if __name__ == '__main__':
    seed_images_to_db()
