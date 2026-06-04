"""Seed the database with sample packages, products, and vendors."""
import uuid
from sqlalchemy.orm import Session
from .models import Package, Product, Vendor


UNSPLASH = "https://images.unsplash.com"

PACKAGE_THUMBNAILS = {
    ("1BHK", "basic"):    f"{UNSPLASH}/photo-1493809842364-78817add7ffb?w=800&q=80&fit=crop",
    ("1BHK", "premium"):  f"{UNSPLASH}/photo-1616486338812-3dadae4b4ace?w=800&q=80&fit=crop",
    ("1BHK", "luxury"):   f"{UNSPLASH}/photo-1613977257363-707ba9348227?w=800&q=80&fit=crop",
    ("2BHK", "basic"):    f"{UNSPLASH}/photo-1556909114-f6e7ad7d3136?w=800&q=80&fit=crop",
    ("2BHK", "premium"):  f"{UNSPLASH}/photo-1600585154340-be6161a56a0c?w=800&q=80&fit=crop",
    ("2BHK", "luxury"):   f"{UNSPLASH}/photo-1618220179428-22790b461013?w=800&q=80&fit=crop",
    ("3BHK", "basic"):    f"{UNSPLASH}/photo-1598928506311-c55ded91a20c?w=800&q=80&fit=crop",
    ("3BHK", "premium"):  f"{UNSPLASH}/photo-1616046229478-9901c5536a45?w=800&q=80&fit=crop",
    ("3BHK", "luxury"):   f"{UNSPLASH}/photo-1613977257363-707ba9348227?w=800&q=80&fit=crop",
    ("4BHK", "basic"):    f"{UNSPLASH}/photo-1560185007-c5ca9d2c014d?w=800&q=80&fit=crop",
    ("4BHK", "premium"):  f"{UNSPLASH}/photo-1600607686527-6fb886090705?w=800&q=80&fit=crop",
    ("4BHK", "luxury"):   f"{UNSPLASH}/photo-1617806118233-18e1de247200?w=800&q=80&fit=crop",
    ("5BHK", "basic"):    f"{UNSPLASH}/photo-1578683010236-d716f9a3f461?w=800&q=80&fit=crop",
    ("5BHK", "premium"):  f"{UNSPLASH}/photo-1600566753086-00f18fb6b3ea?w=800&q=80&fit=crop",
    ("5BHK", "luxury"):   f"{UNSPLASH}/photo-1616594039964-ae9021a400a0?w=800&q=80&fit=crop",
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
    dict(bhk="5BHK", tier="premium", base_price= 2400000, style_tags=["mediterranean"],                description="Mediterranean elegance with arches, terracotta and sea-inspired palette."),
    dict(bhk="5BHK", tier="luxury",  base_price= 4200000, style_tags=["luxury", "bespoke"],            description="Truly bespoke luxury — every element custom designed and hand-finished."),
]

PRODUCT_IMG = {
    "sofa":       f"{UNSPLASH}/photo-1555041469-a586c61ea9bc?w=400&q=80&fit=crop",
    "bed":        f"{UNSPLASH}/photo-1616594039964-ae9021a400a0?w=400&q=80&fit=crop",
    "wardrobe":   f"{UNSPLASH}/photo-1558618666-fcd25c85cd64?w=400&q=80&fit=crop",
    "kitchen":    f"{UNSPLASH}/photo-1556909114-f6e7ad7d3136?w=400&q=80&fit=crop",
    "table":      f"{UNSPLASH}/photo-1555041469-a586c61ea9bc?w=400&q=80&fit=crop",
    "lamp":       f"{UNSPLASH}/photo-1507003211169-0a1dd7228f2d?w=400&q=80&fit=crop",
    "tiles":      f"{UNSPLASH}/photo-1600585154340-be6161a56a0c?w=400&q=80&fit=crop",
    "curtain":    f"{UNSPLASH}/photo-1493809842364-78817add7ffb?w=400&q=80&fit=crop",
    "ceiling":    f"{UNSPLASH}/photo-1600210492486-724fe5c67fb3?w=400&q=80&fit=crop",
    "outdoor":    f"{UNSPLASH}/photo-1520250497591-112f2f40a3f4?w=400&q=80&fit=crop",
    "bathroom":   f"{UNSPLASH}/photo-1552321554-5fefe8c9ef14?w=400&q=80&fit=crop",
    "generic":    f"{UNSPLASH}/photo-1586023492125-27b2c045efd7?w=400&q=80&fit=crop",
}

PRODUCTS = [
    # Living Room
    dict(sku="LR001", name="L-Shape Modular Sofa", category="seating", room_type="living_room", price=47500, thumbnail_url=PRODUCT_IMG["sofa"], materials=["fabric", "wood"], color_variants=["grey", "beige", "navy"], style_tags=["modern", "contemporary"]),
    dict(sku="LR002", name="3-Seater Sectional Sofa", category="seating", room_type="living_room", price=62000, thumbnail_url=PRODUCT_IMG["sofa"], materials=["leather", "wood"], color_variants=["brown", "black", "white"], style_tags=["luxury", "modern"]),
    dict(sku="LR003", name="Center Coffee Table – Walnut", category="tables", room_type="living_room", price=13500, thumbnail_url=PRODUCT_IMG["table"], materials=["walnut wood", "tempered glass"], color_variants=["natural", "dark walnut"], style_tags=["scandinavian", "modern"]),
    dict(sku="LR004", name="TV Unit with Storage", category="storage", room_type="living_room", price=19500, thumbnail_url=PRODUCT_IMG["generic"], materials=["MDF", "lacquer"], color_variants=["white", "grey", "oak"], style_tags=["modern", "functional"]),
    dict(sku="LR005", name="6-Shelf Bookshelf", category="storage", room_type="living_room", price=8500, thumbnail_url=PRODUCT_IMG["generic"], materials=["engineered wood"], color_variants=["white", "mahogany"], style_tags=["scandinavian"]),
    dict(sku="LR006", name="Arc Floor Lamp – Brushed Gold", category="lighting", room_type="living_room", price=5200, thumbnail_url=PRODUCT_IMG["lamp"], materials=["metal", "fabric shade"], color_variants=["gold", "chrome", "matte black"], style_tags=["modern", "luxury"]),
    dict(sku="LR007", name="Ring Chandelier – Copper", category="lighting", room_type="living_room", price=14800, thumbnail_url=PRODUCT_IMG["lamp"], materials=["metal", "LED"], color_variants=["copper", "gold", "silver"], style_tags=["luxury", "contemporary"]),
    dict(sku="LR008", name="Blackout Curtains – Pair 9ft", category="window", room_type="living_room", price=6800, thumbnail_url=PRODUCT_IMG["curtain"], materials=["polyester blend"], color_variants=["charcoal", "ivory", "forest green"], style_tags=["modern"]),
    dict(sku="LR009", name="Hand-tufted Wool Area Rug 8×10", category="flooring", room_type="living_room", price=18000, thumbnail_url=PRODUCT_IMG["tiles"], materials=["wool", "cotton backing"], color_variants=["cream", "terracotta", "sage"], style_tags=["contemporary", "warm"]),
    dict(sku="LR010", name="Side Table – Marble Top", category="tables", room_type="living_room", price=5800, thumbnail_url=PRODUCT_IMG["table"], materials=["marble", "brass"], color_variants=["white marble", "black marble"], style_tags=["luxury"]),
    dict(sku="LR011", name="Accent Armchair – Boucle", category="seating", room_type="living_room", price=22000, thumbnail_url=PRODUCT_IMG["sofa"], materials=["boucle fabric"], color_variants=["cream", "blush", "sage"], style_tags=["scandinavian", "boho"]),
    dict(sku="LR012", name="Smart LED Strip 5m", category="lighting", room_type="living_room", price=3500, thumbnail_url=PRODUCT_IMG["lamp"], materials=["LED"], color_variants=["RGBW"], style_tags=["modern", "smart"]),

    # Bedroom Master
    dict(sku="MB001", name="King Size Bed Frame – Upholstered", category="bed", room_type="bedroom_master", price=48000, thumbnail_url=PRODUCT_IMG["bed"], materials=["fabric", "solid wood"], color_variants=["charcoal grey", "beige", "navy"], style_tags=["modern", "luxury"]),
    dict(sku="MB002", name="Pocket Spring King Mattress", category="mattress", room_type="bedroom_master", price=36000, thumbnail_url=PRODUCT_IMG["bed"], materials=["pocket springs", "memory foam"], color_variants=["white"], style_tags=["comfort"]),
    dict(sku="MB003", name="Walk-in Wardrobe 6-Door Sliding", category="storage", room_type="bedroom_master", price=65000, thumbnail_url=PRODUCT_IMG["wardrobe"], materials=["MDF", "mirror", "polyester finish"], color_variants=["white", "latte", "graphite"], style_tags=["modern", "luxury"]),
    dict(sku="MB004", name="Dressing Table with Lighted Mirror", category="vanity", room_type="bedroom_master", price=24000, thumbnail_url=PRODUCT_IMG["generic"], materials=["MDF", "LED mirror"], color_variants=["white", "rose gold accent"], style_tags=["glam", "contemporary"]),
    dict(sku="MB005", name="Bedside Tables – Pair", category="tables", room_type="bedroom_master", price=12500, thumbnail_url=PRODUCT_IMG["table"], materials=["wood", "metal legs"], color_variants=["oak", "walnut", "white"], style_tags=["scandinavian", "modern"]),
    dict(sku="MB006", name="Pendant Lights Pair – Rattan", category="lighting", room_type="bedroom_master", price=9200, thumbnail_url=PRODUCT_IMG["lamp"], materials=["rattan", "LED bulb"], color_variants=["natural", "black"], style_tags=["boho", "scandinavian"]),
    dict(sku="MB007", name="Study Desk & Ergonomic Chair", category="workspace", room_type="bedroom_master", price=17500, thumbnail_url=PRODUCT_IMG["generic"], materials=["MDF", "mesh fabric"], color_variants=["white/black", "oak/white"], style_tags=["functional"]),
    dict(sku="MB008", name="Ottoman Storage Bench", category="seating", room_type="bedroom_master", price=11000, thumbnail_url=PRODUCT_IMG["sofa"], materials=["velvet", "wood legs"], color_variants=["dusty pink", "grey", "teal"], style_tags=["glam", "luxury"]),

    # Bedroom 2 / Secondary
    dict(sku="B2001", name="Queen Size Bed Frame – Low Profile", category="bed", room_type="bedroom_2", price=28500, thumbnail_url=PRODUCT_IMG["bed"], materials=["engineered wood"], color_variants=["wenge", "white", "oak"], style_tags=["modern", "minimalist"]),
    dict(sku="B2002", name="Single Bed with Trundle", category="bed", room_type="bedroom_2", price=16000, thumbnail_url=PRODUCT_IMG["bed"], materials=["engineered wood"], color_variants=["white", "grey"], style_tags=["functional"]),
    dict(sku="B2003", name="Wardrobe 2-Door Hinged", category="storage", room_type="bedroom_2", price=26000, thumbnail_url=PRODUCT_IMG["wardrobe"], materials=["MDF", "polyester"], color_variants=["white", "oak"], style_tags=["modern"]),
    dict(sku="B2004", name="Kids Study Desk & Storage", category="workspace", room_type="bedroom_2", price=9500, thumbnail_url=PRODUCT_IMG["generic"], materials=["MDF"], color_variants=["blue", "pink", "yellow"], style_tags=["kids", "functional"]),

    # Kitchen
    dict(sku="KT001", name="Modular Kitchen L-Shape 8ft", category="modular_kitchen", room_type="kitchen", price=88000, thumbnail_url=PRODUCT_IMG["kitchen"], materials=["marine ply", "acrylic shutters", "SS sink"], color_variants=["white", "grey", "wood finish"], style_tags=["modern", "functional"]),
    dict(sku="KT002", name="Modular Kitchen Straight 6ft", category="modular_kitchen", room_type="kitchen", price=58000, thumbnail_url=PRODUCT_IMG["kitchen"], materials=["marine ply", "membrane shutters", "SS sink"], color_variants=["beige", "white", "black"], style_tags=["modern"]),
    dict(sku="KT003", name="Auto-Clean Chimney 90cm", category="appliance", room_type="kitchen", price=21000, thumbnail_url=PRODUCT_IMG["kitchen"], materials=["stainless steel", "tempered glass"], color_variants=["black", "silver"], style_tags=["functional"]),
    dict(sku="KT004", name="4-Burner Gas Hob – Stainless", category="appliance", room_type="kitchen", price=13500, thumbnail_url=PRODUCT_IMG["kitchen"], materials=["stainless steel"], color_variants=["silver"], style_tags=["functional"]),
    dict(sku="KT005", name="Kitchen Backsplash Tiles (per sqft)", category="tiles", room_type="kitchen", price=280, thumbnail_url=PRODUCT_IMG["tiles"], materials=["ceramic"], color_variants=["subway white", "grey brick", "terracotta"], style_tags=["modern"]),
    dict(sku="KT006", name="Under-Counter Water Purifier", category="appliance", room_type="kitchen", price=8500, thumbnail_url=PRODUCT_IMG["generic"], materials=["ABS plastic", "steel"], color_variants=["white"], style_tags=["functional"]),

    # Bathroom
    dict(sku="BT001", name="Wall-Hung WC – Rimless", category="sanitaryware", room_type="bathroom", price=18500, thumbnail_url=PRODUCT_IMG["bathroom"], materials=["vitreous china"], color_variants=["white"], style_tags=["modern"]),
    dict(sku="BT002", name="Washbasin with Vanity Counter", category="sanitaryware", room_type="bathroom", price=14000, thumbnail_url=PRODUCT_IMG["bathroom"], materials=["vitreous china", "MDF counter"], color_variants=["white", "grey"], style_tags=["modern"]),
    dict(sku="BT003", name="Frameless Shower Enclosure", category="shower", room_type="bathroom", price=28000, thumbnail_url=PRODUCT_IMG["bathroom"], materials=["8mm tempered glass", "chrome fittings"], color_variants=["clear", "frosted"], style_tags=["luxury", "modern"]),
    dict(sku="BT004", name="Backlit Vanity Mirror 36\"", category="accessories", room_type="bathroom", price=9500, thumbnail_url=PRODUCT_IMG["bathroom"], materials=["LED mirror", "aluminium frame"], color_variants=["chrome", "black"], style_tags=["modern"]),
    dict(sku="BT005", name="Brass Towel Holder Set (3pc)", category="accessories", room_type="bathroom", price=3800, thumbnail_url=PRODUCT_IMG["bathroom"], materials=["brass"], color_variants=["antique brass", "matte black", "chrome"], style_tags=["luxury", "contemporary"]),
    dict(sku="BT006", name="Electric Water Heater 25L", category="appliance", room_type="bathroom", price=7800, thumbnail_url=PRODUCT_IMG["bathroom"], materials=["steel tank", "ABS body"], color_variants=["white"], style_tags=["functional"]),

    # Flooring & Ceiling
    dict(sku="FL001", name="Engineered Hardwood Flooring (sqft)", category="flooring", room_type="living_room", price=195, thumbnail_url=PRODUCT_IMG["tiles"], materials=["oak hardwood", "lacquer"], color_variants=["natural oak", "dark walnut", "whitewash"], style_tags=["scandinavian", "luxury"]),
    dict(sku="FL002", name="Large-Format Vitrified Tiles 800×800 (sqft)", category="flooring", room_type="living_room", price=95, thumbnail_url=PRODUCT_IMG["tiles"], materials=["vitrified porcelain"], color_variants=["marble white", "concrete grey", "beige"], style_tags=["modern", "functional"]),
    dict(sku="FL003", name="PVC Luxury Vinyl Planks (sqft)", category="flooring", room_type="bedroom_2", price=65, thumbnail_url=PRODUCT_IMG["tiles"], materials=["PVC", "foam backing"], color_variants=["light wood", "dark wood", "grey"], style_tags=["functional"]),
    dict(sku="CL001", name="False Ceiling – Gypsum per sqft", category="ceiling", room_type="living_room", price=130, thumbnail_url=PRODUCT_IMG["ceiling"], materials=["gypsum board"], color_variants=["white"], style_tags=["modern"]),
    dict(sku="CL002", name="Wooden Ceiling Panel (sqft)", category="ceiling", room_type="bedroom_master", price=220, thumbnail_url=PRODUCT_IMG["ceiling"], materials=["PU wood panel"], color_variants=["light oak", "dark walnut"], style_tags=["scandinavian", "warm"]),
    dict(sku="WL001", name="Texture Wall Paint per sqft", category="wall", room_type="living_room", price=55, thumbnail_url=PRODUCT_IMG["generic"], materials=["acrylic texture paint"], color_variants=["warm white", "sand", "terracotta", "sage"], style_tags=["modern"]),
    dict(sku="WL002", name="Designer Wallpaper Roll", category="wall", room_type="bedroom_master", price=2800, thumbnail_url=PRODUCT_IMG["curtain"], materials=["non-woven paper"], color_variants=["floral", "geometric", "tropical"], style_tags=["contemporary", "glam"]),

    # Dining
    dict(sku="DR001", name="6-Seater Dining Table & Chairs", category="dining", room_type="living_room", price=32000, thumbnail_url=PRODUCT_IMG["table"], materials=["solid sheesham wood", "fabric seats"], color_variants=["natural", "dark walnut"], style_tags=["modern", "warm"]),
    dict(sku="DR002", name="4-Seater Dining Set – Glass Top", category="dining", room_type="living_room", price=19500, thumbnail_url=PRODUCT_IMG["table"], materials=["tempered glass", "metal legs"], color_variants=["black", "chrome"], style_tags=["modern", "minimalist"]),
    dict(sku="DR003", name="Sideboard / Buffet Cabinet", category="storage", room_type="living_room", price=24000, thumbnail_url=PRODUCT_IMG["generic"], materials=["MDF", "solid wood accents"], color_variants=["white", "oak"], style_tags=["scandinavian"]),

    # Balcony
    dict(sku="BL001", name="2-Seater Outdoor Rattan Sofa Set", category="outdoor", room_type="balcony", price=24000, thumbnail_url=PRODUCT_IMG["outdoor"], materials=["synthetic rattan", "aluminium frame"], color_variants=["grey", "brown"], style_tags=["tropical", "contemporary"]),
    dict(sku="BL002", name="Artificial Garden Grass (sqft)", category="flooring", room_type="balcony", price=75, thumbnail_url=PRODUCT_IMG["outdoor"], materials=["polyethylene"], color_variants=["natural green"], style_tags=["tropical"]),
    dict(sku="BL003", name="Outdoor Wall Lights Set of 4", category="lighting", room_type="balcony", price=6500, thumbnail_url=PRODUCT_IMG["lamp"], materials=["metal", "weatherproof"], color_variants=["black", "silver"], style_tags=["modern"]),
]

VENDORS = [
    dict(name="HomeCraft Carpentry Pvt Ltd", phone="+919900001111", gst_no="29AABCS1429B1Z1",
         categories=["Carpentry", "Modular Furniture"], rating=4.7, active=True,
         serviceable_pincodes=["560001", "560002", "560078", "560100"]),
    dict(name="BrightSpark Electricals", phone="+919900002222", gst_no="29AADCE1234C1Z2",
         categories=["Electrical", "Smart Lighting"], rating=4.5, active=True,
         serviceable_pincodes=["560001", "560010", "400001", "400050"]),
    dict(name="ElegantTile Works", phone="+919900003333", gst_no="29AAFCT5678D1Z3",
         categories=["Civil", "Flooring", "Painting"], rating=4.8, active=True,
         serviceable_pincodes=["560001", "560078", "110001", "110050"]),
]


def seed_database(db: Session):
    if db.query(Package).count() > 0:
        return  # already seeded

    # Seed packages
    pkg_tiers = ["basic", "premium", "luxury"]
    pkg_tier_names = {"basic": "Basic", "premium": "Premium", "luxury": "Luxury"}
    for p in PACKAGES:
        thumb = PACKAGE_THUMBNAILS.get((p["bhk"], p["tier"]), PRODUCT_IMG["generic"])
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

    # Seed products
    for p in PRODUCTS:
        prod = Product(
            id=str(uuid.uuid4()),
            sku=p["sku"],
            name=p["name"],
            category=p["category"],
            room_type=p["room_type"],
            price=p["price"],
            thumbnail_url=p["thumbnail_url"],
            materials=p["materials"],
            color_variants=p["color_variants"],
            style_tags=p["style_tags"],
        )
        db.add(prod)

    # Seed vendors
    for v in VENDORS:
        vendor = Vendor(id=str(uuid.uuid4()), **v)
        db.add(vendor)

    db.commit()
    print("[DB] Database seeded with packages, products, and vendors.")
