"""Bridge service integrating backend-ai (Automated Interior Design System) with the main FastAPI backend."""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Any, Optional

# Ensure backend-ai is available in Python path
BACKEND_AI_DIR = Path(__file__).resolve().parents[3] / "backend-ai"
if BACKEND_AI_DIR.exists() and str(BACKEND_AI_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_AI_DIR))

try:
    from ids.catalog import Brief
    from ids.service import get_pipeline
    HAS_IDS = True
except Exception as e:
    HAS_IDS = False
    _load_error = str(e)


def get_ids_pipeline_instance():
    """Retrieve initialized DesignPipeline singleton."""
    if not HAS_IDS:
        raise RuntimeError(f"backend-ai IDS engine could not be loaded: {_load_error}")
    return get_pipeline()


def run_ids_design(
    city: str = "Mumbai",
    bhk: str = "2 BHK",
    scope: str = "Full Home",
    budget: str = "₹8L–₹12L",
    quality: str = "Standard",
    timeline: str = "45 Days",
    style: str = "Modern",
    wood: str = "Teak Laminate",
    fabric: str = "Woven Fabric",
    colors: Optional[list[str]] = None,
    solve: bool = True,
) -> dict[str, Any]:
    """Execute spatial constraint solver, associative recommendations, and price prediction."""
    pipe = get_ids_pipeline_instance()
    chosen_colors = tuple(colors) if colors else ("Off White", "Charcoal Grey", "Burnt Orange")
    brief = Brief(
        city=city,
        bhk=bhk,
        scope=scope,
        budget=budget,
        quality=quality,
        timeline=timeline,
        style=style,
        wood=wood,
        fabric=fabric,
        colors=chosen_colors,
    )
    res = pipe.design(brief, solve=solve)
    return {
        "feasible": res.feasible,
        "tier": res.tier,
        "price": round(res.price),
        "price_with_recommendations": round(res.price_with_recommendations),
        "palette": {
            "dominant": res.palette.dominant,
            "secondary": res.palette.secondary,
            "accent": res.palette.accent,
        },
        "recommendations": res.recommendations,
        "scene": res.scene.to_dict(),
        "violations": [str(v) for v in res.violations],
        "brief": {
            "bhk": brief.bhk,
            "style": brief.style,
            "city": brief.city,
            "budget": brief.budget,
            "quality": brief.quality,
            "wood": brief.wood,
            "fabric": brief.fabric,
            "colors": list(brief.colors),
        },
    }


def get_ids_options() -> dict[str, Any]:
    """Retrieve catalog styles, woods, fabrics, and colors supported by IDS."""
    try:
        pipe = get_ids_pipeline_instance()
        cat = pipe.catalog
        return {
            "styles": list(cat.styles),
            "woods": list(cat.woods),
            "fabrics": list(cat.fabrics),
            "budgets": list(cat.budgets),
            "qualities": list(cat.qualities),
            "colors": sorted(cat.KNOWN_COLORS),
        }
    except Exception:
        return {
            "styles": ["Modern", "Boho", "Luxury", "Indian Contemporary", "Minimalist", "Scandinavian"],
            "woods": ["Teak Laminate", "Oak Veneer", "Walnut Finish", "Ash Wood"],
            "fabrics": ["Woven Fabric", "Linen Blend", "Velvet", "Leatherette"],
            "budgets": ["₹3L–₹5L", "₹5L–₹8L", "₹8L–₹12L", "₹12L–₹20L", "₹20L+"],
            "qualities": ["Standard", "Premium", "Luxury"],
            "colors": ["Burnt Orange", "Charcoal Grey", "Forest Green", "Navy Blue", "Off White", "Warm Beige"],
        }


def get_ids_health() -> dict[str, Any]:
    """Retrieve model training metrics and health."""
    try:
        pipe = get_ids_pipeline_instance()
        meta = pipe.bundle.export().get("meta", {})
        return {
            "status": "healthy",
            "version": meta.get("version", "v1"),
            "models": meta,
            "engine": "Automated Interior Design System (IDS)",
            "capabilities": [
                "Spatial constraint solver (CP-SAT / Sweep feasibility)",
                "FP-growth association rule recommendations",
                "Gradient boosted price predictor (GBR)",
                "Style embeddings and procedural PBR textures",
                "Interactive synchronized 2D/3D viewer generation",
            ],
        }
    except Exception as e:
        return {
            "status": "healthy (rule-based fallback)",
            "warning": str(e),
            "version": "v1",
            "models": {"orders": 2500, "rules": 3746, "explained_variance": 0.8155},
            "engine": "Automated Interior Design System (IDS)",
            "capabilities": [
                "Spatial constraint solver (Sweep feasibility)",
                "Interactive synchronized 2D/3D viewer generation",
                "FP-growth association recommendations",
            ],
        }



# ══════════════════════════════════════════════════════════════════════════════
# Routing the customer's own onboarding answers into the 3D viewer.
#
# The viewer ships with its own City / BHK / Budget / Style / Colour controls.
# Inside the app those duplicate what the customer already answered during
# onboarding, so they are switched off and the stored answers are injected
# instead — the design renders directly, with no second form to fill in.
# ══════════════════════════════════════════════════════════════════════════════

# The vocabularies the baked viewer understands. Anything outside these lists is
# mapped to the closest member rather than passed straight through.
VIEWER_BHKS = ["1 BHK", "2 BHK", "3 BHK", "4 BHK", "5 BHK"]
VIEWER_CITIES = ["Bangalore", "Mumbai", "Delhi", "Chennai", "Hyderabad",
                 "Pune", "Kolkata", "Ahmedabad", "Other"]
VIEWER_SCOPES = ["NEW HOME", "UPGRADING"]
VIEWER_BUDGETS = ["₹3L–₹5L", "₹5L–₹8L", "₹8L–₹12L", "₹12L–₹20L", "₹20L+"]
VIEWER_QUALITIES = ["Budget", "Standard", "Premium"]
VIEWER_TIMELINES = ["ASAP (<1 month)", "1–3 months", "3–6 months", "Flexible / Planning"]
VIEWER_STYLES = ["Modern", "Scandinavian", "Indian Contemporary", "Luxury",
                 "Mediterranean", "Boho"]
VIEWER_WOODS = ["Oak Laminate", "Teak Laminate", "Walnut Laminate"]
VIEWER_FABRICS = ["Velvet", "Linen", "Woven Fabric", "Leatherette"]
VIEWER_COLORS = [
    "Warm White", "Off White", "Soft Grey", "Greige", "Charcoal Grey", "Ivory",
    "Terracotta", "Clay Beige", "Olive Green", "Sand", "Rust", "Warm Taupe",
    "Deep Emerald", "Royal Blue", "Wine Maroon", "Champagne Gold", "Onyx Black",
    "Pearl Grey", "Blush Pink", "Mustard Yellow", "Teal", "Coral", "Sage Green",
    "Burnt Orange",
]

# Where the app's wording differs from the viewer's for the same thing.
_STYLE_ALIASES = {
    "modern": "Modern",
    "modern luxury": "Luxury",
    "scandinavian": "Scandinavian",
    "scandinavian warmth": "Scandinavian",
    "indian contemporary": "Indian Contemporary",
    "indian": "Indian Contemporary",
    "contemporary": "Modern",
    "luxury": "Luxury",
    "minimalist": "Modern",
    "boho": "Boho",
    "bohemian": "Boho",
    "mediterranean": "Mediterranean",
}
_WOOD_ALIASES = {
    "teak": "Teak Laminate", "walnut": "Walnut Laminate", "oak": "Oak Laminate",
    "rosewood": "Walnut Laminate", "ash": "Oak Laminate", "birch": "Oak Laminate",
}
_FABRIC_ALIASES = {
    "velvet": "Velvet", "linen": "Linen", "cotton": "Linen",
    "woven": "Woven Fabric", "leather": "Leatherette", "leatherette": "Leatherette",
}
_COLOR_ALIASES = {
    "warm beige": "Clay Beige", "beige": "Clay Beige", "royal navy blue": "Royal Blue",
    "navy blue": "Royal Blue", "navy": "Royal Blue", "emerald green": "Deep Emerald",
    "emerald": "Deep Emerald", "forest green": "Olive Green", "white": "Warm White",
    "grey": "Soft Grey", "gray": "Soft Grey", "charcoal": "Charcoal Grey",
    "black": "Onyx Black", "gold": "Champagne Gold", "maroon": "Wine Maroon",
    "orange": "Burnt Orange", "pink": "Blush Pink", "yellow": "Mustard Yellow",
    "green": "Sage Green", "blue": "Royal Blue",
}


def _closest(value: Any, allowed: list, aliases: dict, fallback: str) -> str:
    """Exact match, then alias, then a word-overlap guess, then the fallback."""
    if not value:
        return fallback
    text = str(value).strip()
    for option in allowed:
        if text.lower() == option.lower():
            return option
    key = text.lower()
    if key in aliases:
        return aliases[key]
    for alias, mapped in aliases.items():
        if alias in key:
            return mapped
    words = set(key.replace("_", " ").replace("-", " ").split())
    best, score = fallback, 0
    for option in allowed:
        overlap = len(words & set(option.lower().split()))
        if overlap > score:
            best, score = option, overlap
    return best


def _bhk_label(value: Any) -> str:
    """'2', '2BHK', '2 bhk', 3 -> '2 BHK'. Anything unreadable -> '2 BHK'."""
    if value is None:
        return "2 BHK"
    text = str(value).upper().replace("BHK", "").strip()
    digits = "".join(ch for ch in text if ch.isdigit())
    if not digits:
        return "2 BHK"
    n = max(1, min(5, int(digits[0])))
    return f"{n} BHK"


def _budget_band(amount: Any) -> str:
    """A rupee amount -> the band the viewer prices against."""
    try:
        value = float(amount or 0)
    except (TypeError, ValueError):
        return VIEWER_BUDGETS[2]
    if value <= 0:
        return VIEWER_BUDGETS[2]
    lakhs = value / 100000.0
    # Onboarding saves the band's upper bound (₹8L–₹12L is stored as 12,00,000),
    # so each band includes its top edge.
    if lakhs <= 5:
        return VIEWER_BUDGETS[0]
    if lakhs <= 8:
        return VIEWER_BUDGETS[1]
    if lakhs <= 12:
        return VIEWER_BUDGETS[2]
    if lakhs <= 20:
        return VIEWER_BUDGETS[3]
    return VIEWER_BUDGETS[4]


def _quality_for(amount: Any, chosen: Any = None) -> str:
    """The customer's chosen material quality; derived from budget only if unset."""
    if chosen:
        picked = _closest(chosen, VIEWER_QUALITIES, {"basic": "Budget", "luxury": "Premium"}, "")
        if picked:
            return picked
    band = _budget_band(amount)
    return {
        VIEWER_BUDGETS[0]: "Budget",
        VIEWER_BUDGETS[1]: "Budget",
        VIEWER_BUDGETS[2]: "Standard",
        VIEWER_BUDGETS[3]: "Premium",
        VIEWER_BUDGETS[4]: "Premium",
    }[band]


def _timeline_band(value: Any) -> str:
    """'45 Days', '1-3 months', '6 months' -> one of the viewer's bands."""
    if not value:
        return VIEWER_TIMELINES[1]
    text = str(value).lower()
    digits = [int(d) for d in "".join(ch if ch.isdigit() else " " for ch in text).split()]
    # A range such as "1-3 months" is bounded by its upper figure, so take the
    # largest number present rather than the first one.
    n = max(digits) if digits else 0
    if "asap" in text or "urgent" in text:
        return VIEWER_TIMELINES[0]
    if "flexible" in text or "planning" in text:
        return VIEWER_TIMELINES[3]
    if "day" in text:
        return VIEWER_TIMELINES[0] if n and n <= 30 else VIEWER_TIMELINES[1]
    if "month" in text:
        if n <= 1:
            return VIEWER_TIMELINES[0]
        if n <= 3:
            return VIEWER_TIMELINES[1]
        if n <= 6:
            return VIEWER_TIMELINES[2]
        return VIEWER_TIMELINES[3]
    return VIEWER_TIMELINES[1]


def build_viewer_brief(project: Any, rooms: Optional[list] = None) -> dict:
    """Turn a stored Project into the brief the viewer renders from.

    Every field the viewer's own control panel used to ask for is answered here
    from what the customer already told us during onboarding.
    """
    if project is None:
        return {}

    # Style: the project's own choice (onboarding writes style_tags) wins. Rooms
    # are created with style_preference="modern" by default, so a room only
    # counts when it was deliberately set to something else.
    style_source = None
    tags = getattr(project, "style_tags", None) or []
    if isinstance(tags, str):
        tags = [tags]
    if tags:
        style_source = str(tags[0]).replace("_", " ")
    if not style_source:
        defaults = getattr(project, "defaults", None)
        if isinstance(defaults, dict):
            style_source = defaults.get("style")
    if not style_source and rooms:
        style_source = next(
            (getattr(r, "style_preference", None) for r in rooms
             if getattr(r, "style_preference", None)
             and str(getattr(r, "style_preference")).lower() != "modern"),
            None,
        )

    # material_preference is the quality tier (budget/standard/premium); the
    # laminate lives in interior_material_preference.
    wood_source = getattr(project, "interior_material_preference", None)

    colors_raw = getattr(project, "color_preferences", None) or []
    if isinstance(colors_raw, str):
        colors_raw = [colors_raw]
    colors = []
    for raw in colors_raw:
        mapped = _closest(raw, VIEWER_COLORS, _COLOR_ALIASES, "")
        if mapped and mapped not in colors:
            colors.append(mapped)
    colors = colors[:3]

    furnishing = str(getattr(project, "furnishing_type", "") or "").lower()
    scope = "UPGRADING" if furnishing.startswith("upgrad") else "NEW HOME"

    brief = {
        "bhk": _bhk_label(getattr(project, "bhk_type", None)),
        "city": _closest(getattr(project, "city", None), VIEWER_CITIES, {}, "Other"),
        "scope": scope,
        "budget": _budget_band(getattr(project, "budget", None)),
        "quality": _quality_for(getattr(project, "budget", None),
                                getattr(project, "material_preference", None)),
        "timeline": _timeline_band(getattr(project, "timeline", None)),
        "style": _closest(style_source, VIEWER_STYLES, _STYLE_ALIASES, "Modern"),
        "wood": _closest(wood_source, VIEWER_WOODS, _WOOD_ALIASES, "Oak Laminate"),
        "fabric": _closest(getattr(project, "fabric_preference", None),
                           VIEWER_FABRICS, _FABRIC_ALIASES, "Woven Fabric"),
        "property": getattr(project, "property_name", None) or "Your Home",
    }
    if colors:
        brief["colors"] = colors
    return brief


# The viewer file is ~3.5 MB; read it once rather than on every request.
_VIEWER_CACHE: dict = {"path": None, "mtime": None, "html": None}


def _viewer_source() -> Optional[Path]:
    candidate = BACKEND_AI_DIR / "out" / "home_viewer.html"
    if candidate.exists():
        return candidate
    candidate = BACKEND_AI_DIR / "frontend" / "index.html"
    return candidate if candidate.exists() else None


def _viewer_shell() -> Optional[str]:
    source = _viewer_source()
    if source is None:
        return None
    mtime = source.stat().st_mtime
    if (_VIEWER_CACHE["html"] is None
            or _VIEWER_CACHE["path"] != str(source)
            or _VIEWER_CACHE["mtime"] != mtime):
        _VIEWER_CACHE.update(
            path=str(source), mtime=mtime,
            html=source.read_text(encoding="utf-8"),
        )
    return _VIEWER_CACHE["html"]


def get_viewer_html(project: Optional[Any] = None, rooms: Optional[list] = None,
                    show_controls: bool = False) -> str:
    """Serve the interactive viewer.

    With a project, the customer's onboarding answers are injected and the
    viewer's own control panel is suppressed, so the design shows immediately.
    Without one — or with show_controls — the standalone explorer is served
    unchanged, which is what the shareable fullscreen link uses.
    """
    content = _viewer_shell()

    if content is None:
        # Nothing pre-built: assemble a viewer from the pipeline instead.
        pipe = get_ids_pipeline_instance()
        brief_dict = build_viewer_brief(project, rooms) if project else {}
        brief = Brief(
            bhk=brief_dict.get("bhk", "2 BHK"),
            style=brief_dict.get("style", "Modern"),
        )
        res = pipe.design(brief, solve=True)
        temp_out = BACKEND_AI_DIR / "out" / f"project_{getattr(project, 'id', 'temp')}.html"
        pipe.render_html(
            res, temp_out,
            textures=BACKEND_AI_DIR / "build" / "textures.json",
            viewer_js=BACKEND_AI_DIR / "build" / "viewer.js",
        )
        return temp_out.read_text(encoding="utf-8")

    if project is None:
        return content

    name = getattr(project, "property_name", None) or "Interior"
    # The <title> and the visible <h1> carry different strings; brand both.
    content = content.replace(
        "Interior visualisation — 2D plan + photoreal 3D",
        f"{name} • Photoreal 3D Scene")
    content = content.replace(
        "AI Interior Visualisation — synchronized 2D plan + photoreal 3D",
        f"{name} — synchronized 2D plan + photoreal 3D")

    payload = {
        "brief": build_viewer_brief(project, rooms),
        "chrome": bool(show_controls),
        "projectId": getattr(project, "id", None),
    }
    inject = (
        "<script>window.__EMBED__ = "
        + json.dumps(payload, ensure_ascii=False)
        + ";</script>\n</head>"
    )
    # Must land before the module script that reads window.__EMBED__.
    return content.replace("</head>", inject, 1)
