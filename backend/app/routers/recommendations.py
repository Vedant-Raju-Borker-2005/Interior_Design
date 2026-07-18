"""AI Recommendations Router — smart package & product suggestions."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from ..db import get_db
from ..models import Package, Product

router = APIRouter()

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



STYLE_COMPAT = {
    "modern":              {"modern": 1.0, "minimalist": 0.85, "contemporary": 0.8},
    "scandinavian":        {"scandinavian": 1.0, "boho": 0.7, "minimalist": 0.8, "warm": 0.7},
    "indian_contemporary": {"indian_contemporary": 1.0, "contemporary": 0.9, "warm": 0.8},
    "luxury":              {"luxury": 1.0, "contemporary": 0.75, "glam": 0.85, "italian": 0.9, "art-deco": 0.8},
    "mediterranean":       {"mediterranean": 1.0, "tropical": 0.75},
    "boho":                {"boho": 1.0, "scandinavian": 0.7, "tropical": 0.65},
}


def _score_package(pkg: Package, style_tags: List[str], budget: float, color_prefs: List[str], db: Session) -> float:
    score = 0.0
    pkg_styles = pkg.style_tags or []
    # Style match
    for user_style in style_tags:
        compat = STYLE_COMPAT.get(user_style, {})
        for pkg_style in pkg_styles:
            score += compat.get(pkg_style, 0.2)
    # Budget fit (1.0 if exactly at budget, less if much cheaper or over)
    if pkg.base_price <= budget:
        budget_score = pkg.base_price / budget
    else:
        budget_score = max(0, 1 - (pkg.base_price - budget) / budget)
    score += budget_score * 2
    # Featured bonus
    if pkg.featured:
        score += 0.3

    # Color preference bonus: check matching products in database
    if color_prefs:
        style_prods = db.query(Product).all()
        matching_style_prods = [
            p for p in style_prods 
            if any(t in (p.style_tags or []) for t in pkg_styles)
        ]
        if matching_style_prods:
            color_match_count = 0
            for p in matching_style_prods:
                p_colors = p.color_variants or []
                if not p_colors and p.variants and isinstance(p.variants, dict):
                    p_colors = p.variants.get("color", [])
                p_priority = get_color_match_priority(p_colors, color_prefs)
                if p_priority in (1, 2):
                    color_match_count += 1
            color_score = (color_match_count / len(matching_style_prods)) * 1.5
            score += color_score

    return score



@router.get("/packages", summary="AI-recommended packages")
def recommend_packages(
    bhk: str = Query(...),
    budget: float = Query(...),
    style_tags: str = Query("", description="Comma-separated style tags"),
    project_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    tags = [t.strip() for t in style_tags.split(",") if t.strip()] if style_tags else []
    
    color_prefs = []
    if project_id:
        from ..models import Project
        project = db.query(Project).filter(Project.id == project_id).first()
        if project and project.color_preferences:
            color_prefs = project.color_preferences

    packages = db.query(Package).filter(Package.bhk == bhk).all()

    scored = []
    for pkg in packages:
        score = _score_package(pkg, tags, budget, color_prefs, db)
        scored.append({"package": _pkg_dict(pkg), "score": round(score, 3), "match_pct": min(100, int(score * 20))})

    scored.sort(key=lambda x: x["score"], reverse=True)

    # Label top recommendation
    if scored:
        scored[0]["recommended"] = True
        scored[0]["label"] = "Best Match for You"

    return {
        "bhk": bhk,
        "budget": budget,
        "style_tags": tags,
        "recommendations": scored,
        "total": len(scored),
    }



@router.get("/products", summary="AI-recommended products for a room")
def recommend_products(
    room_type: str = Query(...),
    style_tags: str = Query("", description="Comma-separated style tags"),
    budget: float = Query(500000),
    project_id: Optional[str] = Query(None),
    limit: int = 10,
    db: Session = Depends(get_db),
):
    tags = [t.strip() for t in style_tags.split(",") if t.strip()] if style_tags else []
    products = db.query(Product).filter(Product.room_type == room_type).all()

    color_prefs = []
    if project_id:
        from ..models import Project
        project = db.query(Project).filter(Project.id == project_id).first()
        if project and project.color_preferences:
            color_prefs = project.color_preferences

    # Check if exact color match is found
    exact_color_match_found = True
    if color_prefs and products:
        exact_match = False
        for p in products:
            p_colors = p.color_variants or []
            if not p_colors and p.variants and isinstance(p.variants, dict):
                p_colors = p.variants.get("color", [])
            p_colors_lower = [c.lower().strip() for c in p_colors]
            if any(uc.lower().strip() in p_colors_lower for uc in color_prefs):
                exact_match = True
                break
        exact_color_match_found = exact_match

    def score_product(p: Product) -> float:
        s = 0.0
        for user_tag in tags:
            compat = STYLE_COMPAT.get(user_tag, {})
            for pt in (p.style_tags or []):
                s += compat.get(pt, 0.1)
        # Price budget fit
        per_room = budget * 0.25
        if p.price <= per_room:
            s += 1.0
        return s

    def product_sort_key(p: Product):
        p_colors = p.color_variants or []
        if not p_colors and p.variants and isinstance(p.variants, dict):
            p_colors = p.variants.get("color", [])
        color_pri = get_color_match_priority(p_colors, color_prefs)
        
        style_score = score_product(p)
        return (color_pri, -style_score)

    scored = sorted(products, key=product_sort_key)[:limit]

    return {
        "room_type": room_type,
        "style_tags": tags,
        "products": [_prod_dict(p) for p in scored],
        "total": len(scored),
        "exact_color_match_found": exact_color_match_found
    }



# ── Helpers ───────────────────────────────────────────────────────────────────
def _pkg_dict(p: Package) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "tier": p.tier,
        "bhk": p.bhk,
        "base_price": p.base_price,
        "style_tags": p.style_tags or [],
        "thumbnail_url": p.thumbnail_url,
        "description": p.description,
        "featured": p.featured,
    }


def _prod_dict(p: Product) -> dict:
    return {
        "id": p.id,
        "sku": p.sku,
        "name": p.name,
        "category": p.category,
        "room_type": p.room_type,
        "price": p.price,
        "materials": p.materials or [],
        "color_variants": p.color_variants or [],
        "thumbnail_url": p.thumbnail_url,
        "style_tags": p.style_tags or [],
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

