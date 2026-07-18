"""Seed the database with sample packages, products, and vendors."""
import uuid
from sqlalchemy.orm import Session
from .models import Package, Product, Vendor, VendorProduct


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

# Distinct, verified Unsplash product image URLs — each product gets its own unique photo
IMG = {
    # Sofas (distinct types)
    "sofa_modular":    f"{UNSPLASH}/photo-1555041469-a586c61ea9bc?w=600&q=85&fit=crop",   # grey L-shape sectional
    "sofa_sectional":  f"{UNSPLASH}/photo-1493663284031-b7e3aaa4eb94?w=600&q=85&fit=crop",  # classic sectional sofa
    "sofa_chesterfield": f"{UNSPLASH}/photo-1567225557594-88d73398014a?w=600&q=85&fit=crop", # chesterfield style
    "sofa_loveseat":   f"{UNSPLASH}/photo-1506439773649-6e0eb8cfb237?w=600&q=85&fit=crop",  # loveseat 2-seater
    # Coffee Tables
    "table_coffee":    f"{UNSPLASH}/photo-1616627561839-074385245ff6?w=600&q=85&fit=crop",  # coffee table
    "table_glass":     f"{UNSPLASH}/photo-1518455027359-f3f8164ba6bd?w=600&q=85&fit=crop",  # glass coffee table
    # Side Tables
    "table_side":      f"{UNSPLASH}/photo-1586023492125-27b2c045efd7?w=600&q=85&fit=crop",  # side table
    "table_marble":    f"{UNSPLASH}/photo-1595526114035-0d45ed16cfbf?w=600&q=85&fit=crop",  # marble top table
    # Chairs
    "chair_accent":    f"{UNSPLASH}/photo-1598300042247-d088f8ab3a91?w=600&q=85&fit=crop",  # accent armchair
    "chair_wingback":  f"{UNSPLASH}/photo-1580480055273-228ff5388ef8?w=600&q=85&fit=crop",  # wingback chair
    # Rugs
    "rug_wool":        f"{UNSPLASH}/photo-1600166898405-da9535204843?w=600&q=85&fit=crop",  # wool area rug
    # Lighting
    "lamp_floor":      f"{UNSPLASH}/photo-1507003211169-0a1dd7228f2d?w=600&q=85&fit=crop",  # floor lamp
    "lamp_chandelier": f"{UNSPLASH}/photo-1565814329452-e1efa11c5b89?w=600&q=85&fit=crop",  # chandelier
    "lamp_pendant":    f"{UNSPLASH}/photo-1513506003901-1e6a35087a18?w=600&q=85&fit=crop",  # pendant light
    # Beds
    "bed_king":        f"{UNSPLASH}/photo-1616594039964-ae9021a400a0?w=600&q=85&fit=crop",  # king bed
    "bed_queen":       f"{UNSPLASH}/photo-1505693416388-ac5ce068fe85?w=600&q=85&fit=crop",  # queen bed
    "bed_single":      f"{UNSPLASH}/photo-1522771739844-6a9f6d5f14af?w=600&q=85&fit=crop",  # single bed
    # Wardrobes
    "wardrobe_sliding":f"{UNSPLASH}/photo-1558618666-fcd25c85cd64?w=600&q=85&fit=crop",   # sliding wardrobe
    "wardrobe_hinged": f"{UNSPLASH}/photo-1540574163026-643ea20ade25?w=600&q=85&fit=crop",  # hinged wardrobe
    # Other bedroom
    "dressing_table":  f"{UNSPLASH}/photo-1590750281732-37e8b5ef35f2?w=600&q=85&fit=crop",  # dressing table
    "bedside_table":   f"{UNSPLASH}/photo-1501183638710-841dd1904471?w=600&q=85&fit=crop",  # bedside table
    "ottoman":         f"{UNSPLASH}/photo-1571508601891-ca5e7a713859?w=600&q=85&fit=crop",  # ottoman bench
    "study_desk":      f"{UNSPLASH}/photo-1593642632559-0c6d3fc62b89?w=600&q=85&fit=crop",  # study desk
    # Kitchen
    "kitchen_L":       f"{UNSPLASH}/photo-1556909114-f6e7ad7d3136?w=600&q=85&fit=crop",   # L-shape kitchen
    "kitchen_straight":f"{UNSPLASH}/photo-1556911220-bff31c812dba?w=600&q=85&fit=crop",   # straight kitchen
    "chimney":         f"{UNSPLASH}/photo-1600489000022-c2086d79f9d4?w=600&q=85&fit=crop",  # kitchen chimney
    "hob":             f"{UNSPLASH}/photo-1585771724684-38269d6639fd?w=600&q=85&fit=crop",  # gas hob
    # Bathroom
    "wc_wallhung":     f"{UNSPLASH}/photo-1552321554-5fefe8c9ef14?w=600&q=85&fit=crop",   # wall hung WC
    "washbasin":       f"{UNSPLASH}/photo-1584622650111-993a426fbf0a?w=600&q=85&fit=crop",  # washbasin vanity
    "shower":          f"{UNSPLASH}/photo-1507652313519-d4e9174996dd?w=600&q=85&fit=crop",  # shower enclosure
    # Decor
    "wall_art":        f"{UNSPLASH}/photo-1513519245088-0e12902e35a7?w=600&q=85&fit=crop",  # wall art
    "mattress":        f"{UNSPLASH}/photo-1631049552240-59c37f38802b?w=600&q=85&fit=crop",  # mattress
    "tv_unit":         f"{UNSPLASH}/photo-1555041469-a586c61ea9bc?w=600&q=85&fit=crop",   # TV unit
    "bookshelf":       f"{UNSPLASH}/photo-1507003211169-0a1dd7228f2d?w=600&q=85&fit=crop",  # bookshelf
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

PRODUCTS = [
    # ── Living Room ──────────────────────────────────────────────────────────
    # Sofas
    dict(
        sku="LR001", name="Luxura Modular Sofa",
        category="sofas", room_type="living_room", price=47500,
        thumbnail_url=IMG["sofa_modular"],
        materials=["fabric", "wood"], color_variants=["grey", "beige", "navy"],
        style_tags=["modern", "contemporary"],
        primary_material="Solid Wood", width=2200.0, height=850.0, depth=900.0,
        weight=45.0, weight_capacity=350.0, style="Modern", finish="Textured",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Living Room",
        description="High-quality premium modular sofa with multi-density foam comfort, robust solid wood inner framing, and resilient legs.",
        variants={
            "color": ["Grey", "Navy", "Beige", "Charcoal", "Emerald Green", "Royal Blue"],
            "fabric": ["Velvet", "Linen", "Boucle", "Cotton Blend"],
            "wood_finish": ["Natural Oak", "Dark Walnut", "Mahogany"],
            "size": ["3-Seater", "2-Seater", "L-Shape", "U-Shape"],
            "texture": ["Smooth", "Textured Woven", "Coarse Velvet"],
            "cushion_style": ["Tufted", "Plain Minimalist", "Ribbed Accent"]
        }
    ),
    dict(
        sku="LR002", name="Sectional Classic Leather Sofa",
        category="sofas", room_type="living_room", price=62000,
        thumbnail_url=IMG["sofa_sectional"],
        materials=["leather", "wood"], color_variants=["brown", "black", "white"],
        style_tags=["luxury", "modern"],
        primary_material="Italian Leather", width=2400.0, height=850.0, depth=950.0,
        weight=55.0, weight_capacity=400.0, style="Luxury", finish="Natural",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Living Room",
        description="Classic Italian top-grain leather sectional sofa, contoured for ergonomic lower back support.",
        variants={
            "color": ["Tan Brown", "Charcoal Black", "Ivory White", "Cognac Leather"],
            "fabric": ["Genuine Italian Leather", "Premium Faux Leather"],
            "wood_finish": ["Walnut", "Ebony", "Teak"],
            "size": ["3-Seater Sectional", "L-Shape Large", "4-Seater Extended"],
            "texture": ["Top-grain Matte", "Distressed Vintage", "Smooth Nappa"],
            "cushion_style": ["Plain Minimalist", "Deep Button Tufted"]
        }
    ),
    dict(
        sku="LR013", name="Chesterfield Velvet Sofa",
        category="sofas", room_type="living_room", price=55000,
        thumbnail_url=IMG["sofa_chesterfield"],
        materials=["velvet", "solid wood"], color_variants=["emerald", "burgundy", "navy"],
        style_tags=["luxury", "classic"],
        primary_material="Velvet", width=2200.0, height=800.0, depth=900.0,
        weight=50.0, weight_capacity=350.0, style="Luxury", finish="Textured",
        mounting_type="Floor Standing", assembly_required="No", suitable_room="Living Room",
        description="Bespoke button-tufted velvet Chesterfield sofa with elegant rolled arms and dark mahogany legs.",
        variants={
            "color": ["Emerald Green", "Deep Burgundy", "Royal Navy", "Burnt Orange", "Midnight Black"],
            "fabric": ["Premium Velvet", "Plush Suede", "Brocade"],
            "wood_finish": ["Dark Mahogany", "Polished Ebony", "Antique Gold Studs"],
            "size": ["2-Seater", "3-Seater", "3-Seater + Chaise"],
            "cushion_style": ["Deep Button Tufted", "Scroll Arm Tufted"]
        }
    ),
    dict(
        sku="LR014", name="Compact Loveseat Sofa",
        category="sofas", room_type="living_room", price=28500,
        thumbnail_url=IMG["sofa_loveseat"],
        materials=["fabric", "engineered wood"], color_variants=["blush", "grey", "white"],
        style_tags=["scandinavian", "minimalist"],
        primary_material="Fabric", width=1600.0, height=820.0, depth=850.0,
        weight=30.0, weight_capacity=220.0, style="Scandinavian", finish="Matte",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Living Room",
        description="Minimalist space-saving double seater loveseat, perfect for small apartment spaces.",
        variants={
            "color": ["Blush Pink", "Light Grey", "Off-White", "Dusty Blue", "Sage Green"],
            "fabric": ["Linen Weave", "Boucle", "Cotton Velvet", "Microfibre"],
            "size": ["2-Seater 130cm", "2.5-Seater 155cm"],
            "cushion_style": ["Plain Minimalist", "Track Arm"]
        }
    ),
    # Coffee Tables
    dict(
        sku="LR003", name="Center Coffee Table — Solid Walnut",
        category="coffee_tables", room_type="living_room", price=13500,
        thumbnail_url=IMG["table_coffee"],
        materials=["walnut wood", "tempered glass"], color_variants=["natural", "dark walnut"],
        style_tags=["scandinavian", "modern"],
        primary_material="Solid Walnut", width=1200.0, height=450.0, depth=600.0,
        weight=18.0, weight_capacity=50.0, style="Scandinavian", finish="Natural",
        mounting_type="Floor Standing", assembly_required="No", suitable_room="Living Room",
        description="Premium walnut central coffee table highlighting natural wood grain and sleek legs.",
        variants={
            "color": ["Natural Walnut", "Charcoal Black", "Warm Honey"],
            "wood_finish": ["Oak Veneer", "Solid Walnut", "Teak Finish"],
            "size": ["Standard (40\"x20\")", "Large (48\"x24\")"]
        }
    ),
    dict(
        sku="LR015", name="Glass-Top Coffee Table",
        category="coffee_tables", room_type="living_room", price=9800,
        thumbnail_url=IMG["table_glass"],
        materials=["tempered glass", "stainless steel"], color_variants=["clear", "black"],
        style_tags=["modern", "contemporary"],
        primary_material="Tempered Glass", width=1100.0, height=420.0, depth=600.0,
        weight=15.0, weight_capacity=40.0, style="Modern", finish="Glossy",
        mounting_type="Floor Standing", assembly_required="No", suitable_room="Living Room",
        description="Modern tempered glass top coffee table supported by a geometric metallic steel frame.",
        variants={
            "color": ["Clear Glass + Gold Frame", "Smoked Glass + Chrome", "Frosted + Matte Black"],
            "size": ["Round 80cm", "Rectangle 110x60cm"]
        }
    ),
    # Side Tables
    dict(
        sku="LR010", name="Side Table — Marble Top",
        category="side_tables", room_type="living_room", price=5800,
        thumbnail_url=IMG["table_marble"],
        materials=["marble", "brass"], color_variants=["white marble", "black marble"],
        style_tags=["luxury"],
        primary_material="Marble", width=450.0, height=550.0, depth=450.0,
        weight=8.0, weight_capacity=20.0, style="Luxury", finish="Glossy",
        mounting_type="Floor Standing", assembly_required="No", suitable_room="Living Room",
        description="Luxury side table topped with Italian Carrara marble over sleek brass legs.",
        variants={
            "color": ["White Carrara", "Black Marquina", "Green Emerald Marble"],
            "wood_finish": ["Brushed Brass Legs", "Matte Black Steel Legs", "Polished Gold"],
            "size": ["Standard (18\" Round)", "Tall (22\" Round)"]
        }
    ),
    dict(
        sku="LR016", name="Wooden Nest of Side Tables",
        category="side_tables", room_type="living_room", price=4200,
        thumbnail_url=IMG["table_side"],
        materials=["solid wood", "metal"], color_variants=["oak", "walnut", "white"],
        style_tags=["scandinavian", "modern"],
        primary_material="Solid Wood", width=500.0, height=500.0, depth=500.0,
        weight=7.5, weight_capacity=25.0, style="Scandinavian", finish="Natural",
        mounting_type="Floor Standing", assembly_required="No", suitable_room="Living Room",
        description="A nested set of wooden accent end tables with a space-saving slide-in design.",
        variants={
            "color": ["Natural Oak", "Walnut Brown", "Painted White"],
            "wood_finish": ["Natural Matte", "Lacquered Gloss"],
            "size": ["Set of 2", "Set of 3"]
        }
    ),
    # Chairs
    dict(
        sku="LR011", name="Accent Armchair — Boucle",
        category="chairs", room_type="living_room", price=22000,
        thumbnail_url=IMG["chair_accent"],
        materials=["boucle fabric"], color_variants=["cream", "blush", "sage"],
        style_tags=["scandinavian", "boho"],
        primary_material="Fabric", width=850.0, height=900.0, depth=800.0,
        weight=14.0, weight_capacity=150.0, style="Scandinavian", finish="Textured",
        mounting_type="Floor Standing", assembly_required="No", suitable_room="Living Room",
        description="Cosy premium boucle loop armchair offering outstanding seat depth and tactile warmth.",
        variants={
            "color": ["Cream Boucle", "Blush Pink", "Sage Green", "Oatmeal Linen"],
            "fabric": ["Boucle Loop", "Soft Velvet", "Premium Linen"],
            "wood_finish": ["Natural Oak Legs", "Walnut Legs", "Gold Metal Swivel Base"]
        }
    ),
    dict(
        sku="LR017", name="Wingback Reading Chair",
        category="chairs", room_type="living_room", price=32000,
        thumbnail_url=IMG["chair_wingback"],
        materials=["premium fabric", "solid wood"], color_variants=["navy", "forest green", "cognac"],
        style_tags=["classic", "luxury"],
        primary_material="Fabric", width=900.0, height=1050.0, depth=850.0,
        weight=18.0, weight_capacity=160.0, style="Luxury", finish="Matte",
        mounting_type="Floor Standing", assembly_required="No", suitable_room="Living Room",
        description="Ergonomically contoured reading wingback chair with supportive headrests.",
        variants={
            "color": ["Deep Navy", "Forest Green", "Cognac Brown", "Charcoal Grey"],
            "fabric": ["Premium Tweed", "Leather", "Velvet"],
            "wood_finish": ["Dark Walnut Legs", "Mahogany Legs", "Brass Claw Feet"]
        }
    ),
    # Rugs
    dict(
        sku="LR009", name="Hand-tufted Wool Area Rug",
        category="rugs", room_type="living_room", price=18000,
        thumbnail_url=IMG["rug_wool"],
        materials=["wool", "cotton backing"], color_variants=["cream", "terracotta", "sage"],
        style_tags=["contemporary", "warm"],
        primary_material="Wool", width=2400.0, height=15.0, depth=3000.0,
        weight=12.0, weight_capacity=0.0, style="Contemporary", finish="Textured",
        mounting_type="Floor Standing", assembly_required="No", suitable_room="Living Room",
        description="Comfortable wool-blend area rug woven with thick yarn patterns.",
        variants={
            "color": ["Cream & Grey Geometric", "Warm Terracotta Blend", "Calming Sage & Ivory", "Deep Navy Abstract"],
            "size": ["5' x 7'", "8' x 10'", "9' x 12'"],
            "texture": ["Plush High Pile", "Textured Low Loop", "Flatweave Wool"]
        }
    ),
    # Lighting
    dict(
        sku="LR006", name="Arc Floor Lamp",
        category="lighting", room_type="living_room", price=5200,
        thumbnail_url=IMG["lamp_floor"],
        materials=["metal", "fabric shade"], color_variants=["gold", "chrome", "matte black"],
        style_tags=["modern", "luxury"],
        primary_material="Metal", width=350.0, height=1950.0, depth=1200.0,
        weight=6.5, weight_capacity=0.0, style="Modern", finish="Glossy",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Living Room",
        description="Sleek statement arch floor lamp with overhead fabric diffuser.",
        variants={
            "color": ["Brushed Gold", "Polished Chrome", "Matte Black"],
            "size": ["Standard Height (6.5 ft)", "Extendable Deluxe (7.5 ft)"]
        }
    ),
    dict(
        sku="LR007", name="Ring Chandelier",
        category="lighting", room_type="living_room", price=14800,
        thumbnail_url=IMG["lamp_chandelier"],
        materials=["metal", "LED"], color_variants=["copper", "gold", "silver"],
        style_tags=["luxury", "contemporary"],
        primary_material="Metal", width=800.0, height=800.0, depth=800.0,
        weight=8.0, weight_capacity=0.0, style="Luxury", finish="Glossy",
        mounting_type="Hanging", assembly_required="Yes", suitable_room="Living Room",
        description="Contemporary LED ring chandelier adding grand luxury illumination to high ceilings.",
        variants={
            "color": ["Champagne Gold", "Rose Copper", "Polished Silver"],
            "size": ["Single Ring 60cm", "Double Ring 80cm/60cm"]
        }
    ),
    dict(
        sku="LR012", name="Premium Wall Art",
        category="decor", room_type="living_room", price=3500,
        thumbnail_url=IMG["wall_art"],
        materials=["canvas", "wood frame"], color_variants=["abstract", "geometric"],
        style_tags=["modern", "decor"],
        primary_material="Canvas", width=900.0, height=600.0, depth=25.0,
        weight=2.0, weight_capacity=0.0, style="Modern", finish="Matte",
        mounting_type="Wall Mounted", assembly_required="No", suitable_room="Living Room",
        description="Vividly rendered abstract canvas painting framed in dynamic light pine borders.",
        variants={
            "color": ["Ocean Blue Abstract", "Monochromatic Swirls", "Earthy Terracotta Shapes"],
            "size": ["Medium (24\"x36\")", "Large (36\"x48\")"]
        }
    ),
    dict(
        sku="LR004", name="TV Unit with Storage",
        category="Furniture", room_type="living_room", price=19500,
        thumbnail_url=IMG["tv_unit"],
        materials=["MDF", "lacquer"], color_variants=["white", "grey", "oak"],
        style_tags=["modern", "functional"],
        primary_material="MDF", width=1800.0, height=500.0, depth=450.0,
        weight=32.0, weight_capacity=80.0, style="Modern", finish="Laminated",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Living Room",
        description="Lacquered sleek entertainment shelf unit with ample drawers and wire routing panels.",
        variants={
            "color": ["Gloss White", "Concrete Grey", "Oak Finish"],
            "wood_finish": ["Gloss Lacquer", "Matte PU", "Veneer"]
        }
    ),
    dict(
        sku="LR005", name="6-Shelf Bookshelf",
        category="Furniture", room_type="living_room", price=8500,
        thumbnail_url=IMG["bookshelf"],
        materials=["engineered wood"], color_variants=["white", "mahogany"],
        style_tags=["scandinavian"],
        primary_material="Engineered Wood", width=800.0, height=1800.0, depth=280.0,
        weight=25.0, weight_capacity=60.0, style="Scandinavian", finish="Matte",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Living Room",
        description="Clean vertical shelf bookcase providing multi-tier storage for libraries and displays.",
        variants={
            "color": ["Pure White", "Dark Mahogany", "Natural Oak"],
            "size": ["4-Shelf", "6-Shelf"]
        }
    ),

    # ── Master Bedroom ────────────────────────────────────────────────────────
    dict(
        sku="MB001", name="King Size Bed Frame — Upholstered",
        category="Furniture", room_type="bedroom_master", price=48000,
        thumbnail_url=IMG["bed_king"],
        materials=["fabric", "solid wood"], color_variants=["charcoal grey", "beige", "navy"],
        style_tags=["modern", "luxury"],
        primary_material="Solid Wood", width=2000.0, height=1150.0, depth=2150.0,
        weight=60.0, weight_capacity=400.0, style="Luxury", finish="Matte",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Bedroom",
        description="Exquisite wingback headboard king size bed frame wrapped in cushioned upholstery.",
        variants={
            "color": ["Charcoal Grey", "Warm Beige", "Deep Navy", "Dusty Rose", "Forest Green"],
            "fabric": ["Velvet Headboard", "Linen Upholstered", "Premium Suede"],
            "wood_finish": ["Dark Walnut", "Natural Oak", "Matte Black Metal"],
            "size": ["King (76\"x80\")", "Queen (60\"x80\")"],
            "texture": ["Smooth Padded", "Button Tufted", "Channel Stitched"]
        }
    ),
    dict(
        sku="MB002", name="Pocket Spring King Mattress",
        category="Furniture", room_type="bedroom_master", price=36000,
        thumbnail_url=IMG["mattress"],
        materials=["pocket springs", "memory foam"], color_variants=["white"],
        style_tags=["comfort"],
        primary_material="Memory Foam", width=1800.0, height=250.0, depth=2000.0,
        weight=32.0, weight_capacity=300.0, style="Modern", finish="Textured",
        mounting_type="Floor Standing", assembly_required="No", suitable_room="Bedroom",
        description="Luxurious firm orthopedic mattress constructed with pocket coils and cooling foam layers.",
        variants={
            "size": ["King (76\"x80\")", "Queen (60\"x80\")"],
            "texture": ["Medium Firm", "Plush Pillow-top", "Extra Firm Orthopedic"]
        }
    ),
    dict(
        sku="MB003", name="Walk-in Wardrobe 6-Door Sliding",
        category="Furniture", room_type="bedroom_master", price=65000,
        thumbnail_url=IMG["wardrobe_sliding"],
        materials=["MDF", "mirror", "polyester finish"], color_variants=["white", "latte", "graphite"],
        style_tags=["modern", "luxury"],
        primary_material="MDF", width=2400.0, height=2100.0, depth=650.0,
        weight=130.0, weight_capacity=300.0, style="Modern", finish="Glossy",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Bedroom",
        description="Premium sliding walk-in wardrobe with soft closing mechanics and full length dressing mirrors.",
        variants={
            "color": ["Gloss White", "Latte Matte", "Graphite Grey", "Champagne Beige"],
            "wood_finish": ["High Gloss PU", "Matte Membrane", "Acrylic Finish"],
            "size": ["6-Door 8ft", "4-Door 6ft", "8-Door 10ft"]
        }
    ),
    dict(
        sku="MB004", name="Dressing Table with Lighted Mirror",
        category="Furniture", room_type="bedroom_master", price=24000,
        thumbnail_url=IMG["dressing_table"],
        materials=["MDF", "LED mirror"], color_variants=["white", "rose gold accent"],
        style_tags=["glam", "contemporary"],
        primary_material="MDF", width=950.0, height=1550.0, depth=400.0,
        weight=28.0, weight_capacity=45.0, style="Contemporary", finish="Matte",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Bedroom",
        description="Hollywood style vanity table with interactive light options and felt lined cosmetics drawers.",
        variants={
            "color": ["Pure White", "Blush Pink", "Champagne Gold", "Marble White"],
            "wood_finish": ["Matte Lacquer", "Gloss PU", "Brushed Rose Gold Trim"]
        }
    ),
    dict(
        sku="MB005", name="Bedside Tables — Pair",
        category="Furniture", room_type="bedroom_master", price=12500,
        thumbnail_url=IMG["bedside_table"],
        materials=["wood", "metal legs"], color_variants=["oak", "walnut", "white"],
        style_tags=["scandinavian", "modern"],
        primary_material="Solid Wood", width=450.0, height=500.0, depth=400.0,
        weight=12.0, weight_capacity=25.0, style="Scandinavian", finish="Natural",
        mounting_type="Floor Standing", assembly_required="No", suitable_room="Bedroom",
        description="A pair of clean wood nightstands featuring single drawer storage over sleek steel support rods.",
        variants={
            "color": ["Natural Oak", "Dark Walnut", "Matte White", "Grey Concrete"],
            "wood_finish": ["Natural Wood", "Painted Matte", "Lacquered Gloss"]
        }
    ),
    dict(
        sku="MB006", name="Pendant Lights Pair — Rattan",
        category="Lighting", room_type="bedroom_master", price=9200,
        thumbnail_url=IMG["lamp_pendant"],
        materials=["rattan", "LED bulb"], color_variants=["natural", "black"],
        style_tags=["boho", "scandinavian"],
        primary_material="Rattan", width=300.0, height=400.0, depth=300.0,
        weight=1.8, weight_capacity=0.0, style="Scandinavian", finish="Textured",
        mounting_type="Hanging", assembly_required="Yes", suitable_room="Bedroom",
        description="Handwoven rattan mesh pendant globes casting warm shadows inside cosy rooms.",
        variants={
            "color": ["Natural Rattan", "Black Metal", "Woven Beige", "Bleached White"],
            "size": ["Small (20cm)", "Medium (30cm)", "Large (40cm)"]
        }
    ),
    dict(
        sku="MB007", name="Study Desk & Ergonomic Chair",
        category="Furniture", room_type="bedroom_master", price=17500,
        thumbnail_url=IMG["study_desk"],
        materials=["MDF", "mesh fabric"], color_variants=["white/black", "oak/white"],
        style_tags=["functional"],
        primary_material="MDF", width=1200.0, height=750.0, depth=600.0,
        weight=22.0, weight_capacity=90.0, style="Modern", finish="Laminated",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Bedroom",
        description="Study desk configuration including a height adjustable mesh back swivel chair.",
        variants={
            "color": ["White/Black", "Oak/White", "Grey/Chrome"],
            "fabric": ["Mesh Breathable", "PU Leather", "Fabric Cushion"]
        }
    ),
    dict(
        sku="MB008", name="Ottoman Storage Bench",
        category="Furniture", room_type="bedroom_master", price=11000,
        thumbnail_url=IMG["ottoman"],
        materials=["velvet", "wood legs"], color_variants=["dusty pink", "grey", "teal"],
        style_tags=["glam", "luxury"],
        primary_material="Fabric", width=1200.0, height=450.0, depth=450.0,
        weight=14.5, weight_capacity=180.0, style="Luxury", finish="Textured",
        mounting_type="Floor Standing", assembly_required="No", suitable_room="Bedroom",
        description="Multi-functional storage bench wrapped in plush velvet button-tufted panels.",
        variants={
            "color": ["Dusty Pink Velvet", "Midnight Grey", "Teal Blue", "Champagne Gold"],
            "fabric": ["Velvet", "Faux Suede", "Boucle"],
            "wood_finish": ["Walnut Legs", "Gold Metal Legs", "Black Matte Legs"]
        }
    ),

    # ── Bedroom 2 ─────────────────────────────────────────────────────────────
    dict(
        sku="B2001", name="Queen Size Bed Frame — Low Profile",
        category="Furniture", room_type="bedroom_2", price=28500,
        thumbnail_url=IMG["bed_queen"],
        materials=["engineered wood"], color_variants=["wenge", "white", "oak"],
        style_tags=["modern", "minimalist"],
        primary_material="Engineered Wood", width=1600.0, height=850.0, depth=2100.0,
        weight=42.0, weight_capacity=300.0, style="Minimalist", finish="Laminated",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Bedroom",
        description="Low profile platform queen bed frame highlighting clear Japanese Scandinavian lines.",
        variants={
            "color": ["Wenge Dark", "Pure White", "Natural Oak"],
            "wood_finish": ["High Gloss", "Matte Laminate"],
            "size": ["Queen (60\"x80\")", "Full (54\"x75\")"]
        }
    ),
    dict(
        sku="B2002", name="Single Bed with Trundle",
        category="Furniture", room_type="bedroom_2", price=16000,
        thumbnail_url=IMG["bed_single"],
        materials=["engineered wood"], color_variants=["white", "grey"],
        style_tags=["functional"],
        primary_material="Engineered Wood", width=1000.0, height=800.0, depth=2000.0,
        weight=38.0, weight_capacity=200.0, style="Modern", finish="Laminated",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Bedroom",
        description="Space saving single bed frame containing a roll-out guest trundle drawer underneath.",
        variants={
            "color": ["Pure White", "Light Grey", "Powder Blue"],
            "wood_finish": ["Matte", "Gloss"]
        }
    ),
    dict(
        sku="B2003", name="Wardrobe 2-Door Hinged",
        category="Furniture", room_type="bedroom_2", price=26000,
        thumbnail_url=IMG["wardrobe_hinged"],
        materials=["MDF", "polyester"], color_variants=["white", "oak"],
        style_tags=["modern"],
        primary_material="MDF", width=1000.0, height=2100.0, depth=550.0,
        weight=70.0, weight_capacity=150.0, style="Modern", finish="Matte",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Bedroom",
        description="Practical 2-door hinged wardrobe with deep storage shelves and hanging rods.",
        variants={
            "color": ["Pure White", "Oak Wood", "Mocha Brown"],
            "wood_finish": ["Matte Laminate", "High Gloss PU"]
        }
    ),
    dict(
        sku="B2004", name="Kids Study Desk & Storage",
        category="Furniture", room_type="bedroom_2", price=9500,
        thumbnail_url=IMG["study_desk"],
        materials=["MDF"], color_variants=["blue", "pink", "yellow"],
        style_tags=["kids", "functional"],
        primary_material="MDF", width=1000.0, height=720.0, depth=500.0,
        weight=16.0, weight_capacity=50.0, style="Modern", finish="Laminated",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Bedroom",
        description="Compact kids study desk equipped with pastel drawer handles and storage niches.",
        variants={
            "color": ["Sky Blue", "Candy Pink", "Sunshine Yellow", "Mint Green"]
        }
    ),

    # ── Kitchen ───────────────────────────────────────────────────────────────
    dict(
        sku="KT001", name="Modular Kitchen L-Shape 8ft",
        category="Kitchen", room_type="kitchen", price=88000,
        thumbnail_url=IMG["kitchen_L"],
        materials=["marine ply", "acrylic shutters", "SS sink"], color_variants=["white", "grey", "wood finish"],
        style_tags=["modern", "functional"],
        primary_material="Marine Ply", width=2400.0, height=850.0, depth=600.0,
        weight=150.0, weight_capacity=500.0, style="Modern", finish="Glossy",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Kitchen",
        description="Waterproof modular kitchen package utilizing boiling-water-resistant ply and anti-fingerprint acrylic.",
        variants={
            "color": ["Gloss White", "Concrete Grey", "Oak Wood Finish", "Charcoal Black", "Ivory Matte"],
            "wood_finish": ["Acrylic High Gloss", "Membrane Matte", "PU Painted", "Veneer Finish"],
            "texture": ["Smooth Gloss", "Woodgrain Texture", "Micro Suede"],
            "size": ["L-Shape 8ft", "L-Shape 10ft", "Island + Straight"]
        }
    ),
    dict(
        sku="KT002", name="Modular Kitchen Straight 6ft",
        category="Kitchen", room_type="kitchen", price=58000,
        thumbnail_url=IMG["kitchen_straight"],
        materials=["marine ply", "membrane shutters", "SS sink"], color_variants=["beige", "white", "black"],
        style_tags=["modern"],
        primary_material="Marine Ply", width=1800.0, height=850.0, depth=600.0,
        weight=110.0, weight_capacity=350.0, style="Modern", finish="Matte",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Kitchen",
        description="Sleek straight line kitchen perfect for compact spaces and studio apartments.",
        variants={
            "color": ["Warm Beige", "Pure White", "Matte Black", "Graphite Grey"],
            "wood_finish": ["Membrane Matte", "Acrylic Gloss"],
            "size": ["6ft Straight", "8ft Straight"]
        }
    ),
    dict(
        sku="KT003", name="Auto-Clean Chimney 90cm",
        category="Kitchen", room_type="kitchen", price=21000,
        thumbnail_url=IMG["chimney"],
        materials=["stainless steel", "tempered glass"], color_variants=["black", "silver"],
        style_tags=["functional"],
        primary_material="Stainless Steel", width=900.0, height=550.0, depth=480.0,
        weight=13.5, weight_capacity=0.0, style="Modern", finish="Textured",
        mounting_type="Wall Mounted", assembly_required="Yes", suitable_room="Kitchen",
        description="Touch control smart kitchen chimney featuring heat auto-clean filters.",
        variants={
            "color": ["Matte Black", "Brushed Silver", "White"]
        }
    ),
    dict(
        sku="KT004", name="4-Burner Gas Hob — Stainless",
        category="Kitchen", room_type="kitchen", price=13500,
        thumbnail_url=IMG["hob"],
        materials=["stainless steel"], color_variants=["silver"],
        style_tags=["functional"],
        primary_material="Tempered Glass", width=720.0, height=90.0, depth=520.0,
        weight=9.8, weight_capacity=35.0, style="Modern", finish="Textured",
        mounting_type="Wall Mounted", assembly_required="Yes", suitable_room="Kitchen",
        description="Built-in kitchen hob containing brass burners and heavy duty cast iron grid supports.",
        variants={
            "color": ["Stainless Steel", "Matte Black"],
            "texture": ["Brushed", "Mirror Polish"]
        }
    ),

    # ── Bathroom ──────────────────────────────────────────────────────────────
    dict(
        sku="BT001", name="Wall-Hung WC — Rimless",
        category="Décor", room_type="bathroom", price=18500,
        thumbnail_url=IMG["wc_wallhung"],
        materials=["vitreous china"], color_variants=["white"],
        style_tags=["modern"],
        primary_material="Vitreous China", width=370.0, height=360.0, depth=540.0,
        weight=21.0, weight_capacity=220.0, style="Modern", finish="Glossy",
        mounting_type="Wall Mounted", assembly_required="Yes", suitable_room="Bathroom",
        description="Rimless hygienic ceramic commode with high performance soft closing seat covers.",
        variants={
            "color": ["Gloss White", "Matte White", "Sandstone Beige"],
            "texture": ["Standard", "Rimless Hygiene"]
        }
    ),
    dict(
        sku="BT002", name="Washbasin with Vanity Counter",
        category="Furniture", room_type="bathroom", price=14000,
        thumbnail_url=IMG["washbasin"],
        materials=["vitreous china", "MDF counter"], color_variants=["white", "grey"],
        style_tags=["modern"],
        primary_material="MDF", width=800.0, height=500.0, depth=460.0,
        weight=17.5, weight_capacity=60.0, style="Modern", finish="Glossy",
        mounting_type="Wall Mounted", assembly_required="Yes", suitable_room="Bathroom",
        description="Wall-hung vanity set including single drawer storage under moisture resistant ply counter.",
        variants={
            "color": ["White", "Taupe Grey", "Light Oak"],
            "wood_finish": ["Gloss White", "Matt Grey", "Oak Veneer"],
            "size": ["Single 80cm", "Double 120cm"]
        }
    ),
    dict(
        sku="BT003", name="Frameless Shower Enclosure",
        category="Furniture", room_type="bathroom", price=28000,
        thumbnail_url=IMG["shower"],
        materials=["8mm tempered glass", "chrome fittings"], color_variants=["clear", "frosted"],
        style_tags=["luxury", "modern"],
        primary_material="Glass", width=1200.0, height=1950.0, depth=900.0,
        weight=45.0, weight_capacity=0.0, style="Modern", finish="Glossy",
        mounting_type="Floor Standing", assembly_required="Yes", suitable_room="Bathroom",
        description="Polished chrome brass hardware holding heavy 8mm toughened shower partition glass panels.",
        variants={
            "color": ["Clear Glass", "Frosted Glass", "Bronze Tinted Glass"],
            "texture": ["Smooth Frameless", "Ribbed Fluted"],
            "size": ["800x800 Square", "900x1200 Rectangle"]
        }
    )
]

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
    if db.query(Package).count() > 0:
        return  # already seeded

    # First-ever seed: clear any stale pre-seeded data
    db.query(Product).delete()
    db.query(VendorProduct).delete()
    db.commit()

    # Seed packages
    pkg_tiers = ["basic", "premium", "luxury"]
    pkg_tier_names = {"basic": "Basic", "premium": "Premium", "luxury": "Luxury"}
    for p in PACKAGES:
        thumb = PACKAGE_THUMBNAILS.get((p["bhk"], p["tier"]), IMG["sofa_modular"])
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

    # Seed products and associate them with vendors
    from .models import ProductVariant, Inventory
    
    for p in PRODUCTS:
        # Determine vendor
        cat = (p.get("category") or "").lower()
        sub = (p.get("subcategory") or "").lower()
        
        if "lighting" in cat or "lighting" in sub:
            vendor_name = "BrightSpark Electricals"
        elif any(k in cat or k in sub for k in ["decor", "décor", "rugs", "flooring"]):
            vendor_name = "ElegantTile Works"
        else:
            vendor_name = "HomeCraft Carpentry Pvt Ltd"
            
        vendor_id = vendor_map.get(vendor_name)
        prod_id = str(uuid.uuid4())
        
        # Create VendorProduct
        vendor_prod = VendorProduct(
            id=prod_id,
            vendor_id=vendor_id,
            name=p["name"],
            category=p["category"],
            subcategory=p.get("subcategory") or p["category"],
            sku=p["sku"],
            description=p.get("description") or f"High-quality {p['name']}",
            base_price=p["price"],
            images=[p["thumbnail_url"]],
            is_archived=False,
            primary_material=p.get("primary_material"),
            width=p.get("width"),
            height=p.get("height"),
            depth=p.get("depth"),
            weight=p.get("weight"),
            weight_capacity=p.get("weight_capacity"),
            style=p.get("style"),
            finish=p.get("finish"),
            mounting_type=p.get("mounting_type"),
            assembly_required=p.get("assembly_required"),
            suitable_room=p.get("suitable_room")
        )
        db.add(vendor_prod)
        
        # Create ProductVariants from variants dict
        variants_dict = p.get("variants") or {}
        colors = variants_dict.get("color") or p.get("color_variants") or []
        materials = variants_dict.get("fabric") or p.get("materials") or []
        sizes = variants_dict.get("size") or []
        
        # Add a default variant
        v_rec = ProductVariant(
            id=str(uuid.uuid4()),
            product_id=prod_id,
            color=colors[0] if colors else None,
            material=materials[0] if materials else None,
            size=sizes[0] if sizes else None,
            price_adjustment=0.0,
            sku_suffix="DEF"
        )
        db.add(v_rec)
        
        # Create Inventory
        inv = Inventory(
            id=str(uuid.uuid4()),
            product_id=prod_id,
            available_qty=100,
            reserved_qty=0,
            incoming_qty=0
        )
        db.add(inv)
        
        # Create Customer Product
        room_type = p.get("room_type") or "living_room"
        
        cust_prod = Product(
            id=prod_id,
            sku=p["sku"],
            name=p["name"],
            category=p["category"],
            subcategory=p.get("subcategory") or p["category"],
            vendor_id=vendor_id,
            room_type=room_type,
            price=p["price"],
            thumbnail_url=p["thumbnail_url"],
            materials=materials,
            color_variants=colors,
            variants=variants_dict,
            style_tags=p.get("style_tags") or ["modern"],
            primary_material=p.get("primary_material"),
            width=p.get("width"),
            height=p.get("height"),
            depth=p.get("depth"),
            weight=p.get("weight"),
            weight_capacity=p.get("weight_capacity"),
            style=p.get("style"),
            finish=p.get("finish"),
            mounting_type=p.get("mounting_type"),
            assembly_required=p.get("assembly_required"),
            suitable_room=p.get("suitable_room"),
            description=p.get("description")
        )
        db.add(cust_prod)
        
    db.commit()
    print("[DB] Database seeded with packages, vendors, products, and inventory.")
