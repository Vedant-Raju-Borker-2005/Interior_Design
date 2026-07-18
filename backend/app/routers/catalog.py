from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional, List

from ..db import get_db
from ..models import Package, Product, ColorAnalytics
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

    # ── Base query ─────────────────────────────────────────────────────────────
    q = db.query(Product)
    if room_type:
        q = q.filter(Product.room_type == room_type)
    if category:
        # Normalize: replace underscores with spaces so "coffee_tables" matches "Coffee Tables"
        cat_normalized = category.lower().replace("_", " ")
        q = q.filter(
            or_(
                func.lower(func.replace(Product.category, "_", " ")) == cat_normalized,
                func.lower(func.replace(Product.subcategory, "_", " ")) == cat_normalized,
            )
        )
    if max_price:
        q = q.filter(Product.price <= max_price)

    all_prods = q.all()

    # Load project color preferences
    color_prefs = []
    if project_id:
        from ..models import Project
        project = db.query(Project).filter(Project.id == project_id).first()
        if project and project.color_preferences:
            color_prefs = project.color_preferences

    # Filter products based on color preferences
    exact_color_match_found = True
    if color_prefs and all_prods:
        exact_matches = []
        token_matches = []
        
        # Build token sets for preferred colors (excluding generic words)
        ignore_words = {'and', 'or', 'with', 'set', 'table', 'chair', 'bed', 'sofa', 'rug', 'lighting', 'vanity', 'cabinet'}
        pref_tokens = set()
        for pref in color_prefs:
            for word in pref.lower().split():
                if len(word) > 2 and word not in ignore_words:
                    pref_tokens.add(word)
        
        # Also treat 'gray' and 'grey' as synonyms
        if 'gray' in pref_tokens:
            pref_tokens.add('grey')
        if 'grey' in pref_tokens:
            pref_tokens.add('gray')

        for p in all_prods:
            p_colors = p.color_variants or []
            if not p_colors and p.variants and isinstance(p.variants, dict):
                p_colors = p.variants.get("color", [])
            p_colors_lower = [c.lower().strip() for c in p_colors]
            
            # 1. Check exact match
            has_exact = False
            for uc in color_prefs:
                uc_clean = uc.lower().strip()
                if uc_clean in p_colors_lower or uc_clean in p.name.lower():
                    has_exact = True
                    break
            
            if has_exact:
                exact_matches.append(p)
                continue
                
            # 2. Check token match
            has_token = False
            # Check in product colors
            for pc in p_colors_lower:
                for word in pc.split():
                    if word in pref_tokens:
                        has_token = True
                        break
                if has_token:
                    break
            # Also check in product name
            if not has_token:
                for word in p.name.lower().split():
                    if word in pref_tokens:
                        has_token = True
                        break
            
            if has_token:
                token_matches.append(p)

        if exact_matches:
            all_prods = exact_matches
            exact_color_match_found = True
        elif token_matches:
            all_prods = token_matches
            exact_color_match_found = True
        else:
            # Fallback: if no matches at all, keep all_prods but flag match as False
            exact_color_match_found = False

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

    # Sorting logic combining color priority & pincode priority
    def combined_sort_key(p: Product):
        p_colors = p.color_variants or []
        if not p_colors and p.variants and isinstance(p.variants, dict):
            p_colors = p.variants.get("color", [])
        color_pri = get_color_match_priority(p_colors, color_prefs)
        
        pin_tier = 2
        if p.vendor_id in exact_ids:
            pin_tier = 0
        elif p.vendor_id in nearby_ids:
            pin_tier = 1
            
        return (color_pri, pin_tier)

    all_prods.sort(key=combined_sort_key)

    # Style tag filtering
    if style:
        all_prods = [p for p in all_prods if style.lower() in (p.style_tags or [])]

    # Helper for label
    def tier_label(p: Product):
        if p.vendor_id in exact_ids:
            return "local"
        if p.vendor_id in nearby_ids:
            return "nearby"
        return "national"

    paginated = all_prods[skip: skip + limit]
    return {
        "items": [_prod_out(p, tier_label(p)) for p in paginated],
        "total": len(all_prods),
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


def _prod_out(p: Product, availability_tier: str = "national") -> dict:
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
        "description": p.description
    }

