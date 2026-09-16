"""The customer's product picks → what the 2D plan, 3D model and AI renders show.

On the Customize step a customer picks a product per category and chooses its
variant options (colour, fabric, wood finish, size, texture, cushion style, and
anything else a vendor adds). This module is the one place that:

* merges those choices from a room item (``custom_attributes`` plus the older
  ``custom_*`` columns);
* turns option *names* a vendor typed ("Royal Navy Blue", "Teak", "Glossy",
  "Boucle") into render parameters: a colour, a fabric family, a wood species
  and a sheen;
* maps each picked product onto the objects in the viewer's scene (a coffee
  table pick paints the scene's coffee table), so the 2D plan and 3D model show
  exactly what was chosen; and
* describes the picks in words for the AI (Gemini) render prompt.

Unknown option values are never an error: they fall through to the prompt and
leave the 3D appearance on the design palette.
"""
from __future__ import annotations

import re
from typing import Any, Iterable, Optional

# ══════════════════════════════════════════════════════ option attributes ═════
# Display order and wording; any other vendor-defined option follows these.
OPTION_LABELS: dict[str, str] = {
    "color": "colour", "fabric": "fabric", "wood_finish": "wood finish", "material": "material",
    "texture": "texture", "size": "size", "cushion_style": "cushion style",
}
LEGACY_COLUMNS: dict[str, str] = {
    "color": "custom_color", "material": "custom_material", "size": "custom_size",
    "fabric": "custom_fabric", "wood_finish": "custom_wood_finish",
    "texture": "custom_texture", "cushion_style": "custom_cushion_style",
}
RESERVED_VARIANT_KEYS = {"images", "image", "thumbnail", "gallery"}
_ALIASES = {"colour": "color", "wood": "wood_finish", "woodfinish": "wood_finish", "finish": "wood_finish",
            "cushion": "cushion_style", "cushions": "cushion_style"}


def option_key(key: Any) -> str:
    k = re.sub(r"[^a-z0-9]+", "_", str(key or "").strip().lower()).strip("_")
    if k.startswith("custom_"):          # the older per-option field names
        k = k[len("custom_"):]
    return _ALIASES.get(k, k)


def clean_attributes(raw: Optional[dict[str, Any]]) -> dict[str, str]:
    """Normalise keys, drop empties and non-option keys, cap sizes."""
    out: dict[str, str] = {}
    for key, value in (raw or {}).items():
        k = option_key(key)
        if not k or k in RESERVED_VARIANT_KEYS or value is None:
            continue
        if isinstance(value, (list, tuple)):
            value = value[0] if value else ""
        v = str(value).strip()[:80]
        if v:
            out[k[:40]] = v
    return dict(list(out.items())[:20])


def item_attributes(item: Any) -> dict[str, str]:
    """Everything chosen for a room item, in display order."""
    merged: dict[str, str] = {}
    for key, column in LEGACY_COLUMNS.items():
        value = getattr(item, column, None)
        if value:
            merged[key] = str(value)
    stored = getattr(item, "custom_attributes", None)
    if isinstance(stored, dict):
        merged.update(clean_attributes(stored))
    ordered = {k: merged[k] for k in OPTION_LABELS if k in merged}
    ordered.update({k: v for k, v in merged.items() if k not in ordered})
    return ordered


def apply_attributes(item: Any, attributes: dict[str, str]) -> None:
    """Store a choice set on a room item (JSON + the legacy per-option columns)."""
    for key, column in LEGACY_COLUMNS.items():
        setattr(item, column, attributes.get(key))
    item.custom_attributes = attributes or None


def option_label(key: str) -> str:
    return OPTION_LABELS.get(key) or key.replace("_", " ")


def describe_attributes(attributes: dict[str, str]) -> str:
    return "; ".join(f"{option_label(k)}: {v}" for k, v in attributes.items())


# ═════════════════════════════════════════════════════════ name resolution ═════
# Interior colour names → sRGB. The viewer's own palette is included so a pick
# named like a palette colour renders identically to it.
COLOUR_HEX: dict[str, str] = {
    # viewer palette
    "warm white": "#F4EFE8", "off white": "#F7F5F0", "soft grey": "#C9CBC8", "greige": "#CFC6B8",
    "charcoal grey": "#3C3F43", "ivory": "#F2E8D5", "terracotta": "#C1663F", "clay beige": "#C9A98A",
    "olive green": "#6B7248", "sand": "#D9C7A8", "rust": "#A34D2A", "warm taupe": "#9C8672",
    "deep emerald": "#14553F", "royal blue": "#23408E", "wine maroon": "#6E1F2E", "champagne gold": "#C8A96A",
    "onyx black": "#1C1C1E", "pearl grey": "#D6D3CD", "blush pink": "#E7C4C0", "mustard yellow": "#D9A521",
    "teal": "#1F7A78", "coral": "#E4735B", "sage green": "#A7B79C", "burnt orange": "#C25A2B",
    # neutrals
    "white": "#F5F5F2", "snow white": "#FAFAF8", "cream": "#F3E9D2", "beige": "#D8C8AE", "warm beige": "#D9C3A5",
    "linen": "#E9E1D1", "oatmeal": "#DCCFB8", "taupe": "#9C8672", "mushroom": "#B3A594", "stone": "#B7B0A5",
    "grey": "#9A9C9E", "gray": "#9A9C9E", "light grey": "#C9CBC8", "dove grey": "#B9B6B0", "ash grey": "#B2B4B2",
    "charcoal": "#3C3F43", "graphite": "#4A4A4A", "slate": "#5A6570", "slate grey": "#5A6570",
    "black": "#1C1C1E", "onyx": "#1C1C1E", "jet black": "#141414", "ebony": "#2A2522",
    # warm hues
    "blush": "#E7C4C0", "pink": "#E8B4B8", "dusty pink": "#D4A5A5", "rose": "#C98B8B", "rose pink": "#D9A0A6",
    "old rose": "#B8858B", "peach": "#F2C1A0", "salmon": "#E9967A", "red": "#B33A3A", "cherry red": "#9B1B30",
    "maroon": "#6E1F2E", "wine": "#6E1F2E", "burgundy": "#6D2332", "oxblood": "#5A1F1B", "brick": "#9C4A3A",
    "orange": "#D9772B", "tangerine": "#E88A3A", "amber": "#C98A2E", "mustard": "#D9A521", "ochre": "#C28E2E",
    "yellow": "#E3C04D", "lemon": "#EFD86A", "gold": "#C8A96A", "champagne": "#E8D9B5", "brass": "#B5A36A",
    "copper": "#B87333", "bronze": "#8C6A3F", "rose gold": "#C9A193",
    # cool hues
    "silver": "#BFC1C2", "chrome": "#D5D8DA", "steel": "#8D9399", "gunmetal": "#4B5157",
    "green": "#4F7B55", "olive": "#6B7248", "sage": "#A7B79C", "mint": "#B8D8C0", "pistachio": "#B7C99B",
    "emerald": "#1F6B4F", "emerald green": "#1F6B4F", "forest green": "#2E4A34", "bottle green": "#1E4D2B",
    "moss": "#6A7043", "turquoise": "#3FB0AC", "aqua": "#7FC8C4", "duck egg blue": "#A6C9C4",
    "blue": "#3A5F9E", "navy": "#1F2A44", "navy blue": "#1F2A44", "royal navy blue": "#1E2B57",
    "midnight blue": "#1B2440", "cobalt": "#2E4DA0", "sky blue": "#9CC3E4", "powder blue": "#B0C8DE",
    "dusty blue": "#7C95AE", "denim": "#4A6285", "indigo": "#3B3F7A", "ink blue": "#26344F", "petrol": "#1F4B5A",
    "purple": "#6B4C8A", "lavender": "#B7A7D6", "lilac": "#C5B4D9", "plum": "#6A3E5E", "mauve": "#B08A9E",
    "aubergine": "#4B2B3F",
    # browns and woods
    "brown": "#7A5236", "chocolate": "#4E3325", "coffee": "#6F4E37", "mocha": "#7B5E4A", "tan": "#C09A6B",
    "camel": "#C19A6B", "cognac": "#9A4E1C", "caramel": "#AF6E3D", "chestnut": "#7B3F2A", "espresso": "#3B2A20",
    "natural": "#CDB894", "natural wood": "#C7A57B", "honey": "#C8914A",
    # stone and composites
    "marble": "#E8E6E1", "white marble": "#EFEEEA", "carrara": "#ECEBE8", "concrete": "#A9A9A6",
    "granite": "#5E5B58", "black granite": "#2E2C2B", "terrazzo": "#D9D4CC", "quartz": "#E6E3DD",
}
WOOD_HEX: dict[str, str] = {
    "oak": "#C7A57B", "white oak": "#D2B48C", "natural oak": "#C7A57B", "smoked oak": "#8A6A4A",
    "teak": "#9A6B3F", "walnut": "#5B3A26", "dark walnut": "#4A2E1F", "sheesham": "#8A5A3B",
    "rosewood": "#6B2E23", "mango": "#A8794F", "mango wood": "#A8794F", "acacia": "#9C6B3C",
    "mahogany": "#6F2E1E", "wenge": "#645452", "ash": "#D4C3A3", "maple": "#D9B98C", "beech": "#D6B58C",
    "birch": "#E0CDA9", "pine": "#D8B982", "cedar": "#B8764A", "cherry": "#8B3A2B", "cherry wood": "#8B3A2B",
    "ebony": "#2A2522", "espresso": "#3B2A20", "rattan": "#C8A26B", "cane": "#D1B07C", "bamboo": "#C9B27C",
    "plywood": "#D6BC8E", "bleached": "#E2D6C0", "whitewash": "#E6DDCC",
}
# roughness: 0 mirror … 1 fully diffuse
SHEEN: dict[str, float] = {
    "high gloss": 0.12, "piano": 0.1, "glossy": 0.18, "gloss": 0.18, "lacquer": 0.2, "lacquered": 0.2,
    "polished": 0.16, "mirror": 0.08, "semi gloss": 0.35, "semi-gloss": 0.35, "satin": 0.45, "eggshell": 0.55,
    "silk": 0.4, "natural": 0.62, "oiled": 0.58, "waxed": 0.5, "brushed": 0.4, "matte": 0.82, "matt": 0.82,
    "textured": 0.9, "distressed": 0.9, "rustic": 0.88, "sandblasted": 0.92, "raw": 0.9, "smooth": 0.5,
}
FABRIC_FAMILY: dict[str, tuple[str, float]] = {   # name → (viewer texture family, roughness)
    "velvet": ("velvet", 0.94), "chenille": ("velvet", 0.95), "suede": ("velvet", 0.86), "velour": ("velvet", 0.94),
    "linen": ("linen", 0.9), "silk": ("linen", 0.4), "satin": ("linen", 0.35),
    "cotton": ("woven", 0.9), "boucle": ("woven", 0.98), "bouclé": ("woven", 0.98), "wool": ("woven", 0.93),
    "jute": ("woven", 0.96), "tweed": ("woven", 0.95), "polyester": ("woven", 0.82), "microfiber": ("woven", 0.86),
    "woven": ("woven", 0.92), "fabric": ("woven", 0.9), "canvas": ("woven", 0.92),
    "leather": ("leather", 0.42), "genuine leather": ("leather", 0.42), "top grain leather": ("leather", 0.4),
    "leatherette": ("leather", 0.5), "faux leather": ("leather", 0.5), "pu leather": ("leather", 0.5),
    "vegan leather": ("leather", 0.5), "rexine": ("leather", 0.52),
}
_MODIFIERS = {"light": 0.28, "pale": 0.35, "soft": 0.18, "pastel": 0.4, "dusty": 0.1,
              "dark": -0.3, "deep": -0.25, "rich": -0.12, "muted": 0.0}


def _norm(name: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9#\- ]+", " ", name.lower())).strip()


def _longest_phrase(text: str, table: dict[str, Any]) -> Optional[str]:
    best = None
    for phrase in table:
        if re.search(rf"(?<![a-z]){re.escape(phrase)}(?![a-z])", text):
            if best is None or len(phrase) > len(best):
                best = phrase
    return best


def _mix(hex_colour: str, amount: float) -> str:
    """amount > 0 lightens toward white, < 0 darkens toward black."""
    r, g, b = (int(hex_colour[i:i + 2], 16) for i in (1, 3, 5))
    if amount >= 0:
        r, g, b = (round(c + (255 - c) * amount) for c in (r, g, b))
    else:
        r, g, b = (round(c * (1 + amount)) for c in (r, g, b))
    return f"#{r:02X}{g:02X}{b:02X}"


def resolve_colour(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    text = _norm(name)
    m = re.search(r"#([0-9a-f]{6})\b", text)
    if m:
        return f"#{m.group(1).upper()}"
    if text in COLOUR_HEX:
        return COLOUR_HEX[text]
    phrase = _longest_phrase(text, COLOUR_HEX) or _longest_phrase(text, WOOD_HEX)
    if not phrase:
        return None
    base = COLOUR_HEX.get(phrase) or WOOD_HEX[phrase]
    rest = text.replace(phrase, " ")
    for word, amount in _MODIFIERS.items():
        if re.search(rf"\b{word}\b", rest) and amount:
            return _mix(base, amount)
    return base


def resolve_wood(name: Optional[str]) -> Optional[str]:
    if not name:
        return None
    phrase = _longest_phrase(_norm(name), WOOD_HEX)
    return WOOD_HEX[phrase] if phrase else None


def resolve_sheen(*names: Optional[str]) -> Optional[float]:
    for name in names:
        if name:
            phrase = _longest_phrase(_norm(name), SHEEN)
            if phrase:
                return SHEEN[phrase]
    return None


def resolve_fabric(name: Optional[str]) -> Optional[tuple[str, float]]:
    if not name:
        return None
    phrase = _longest_phrase(_norm(name), FABRIC_FAMILY)
    return FABRIC_FAMILY[phrase] if phrase else None


def look_for(attributes: dict[str, str], product: Any = None) -> dict[str, Any]:
    """Render parameters for one pick. Keys are only present when resolved."""
    look: dict[str, Any] = {}
    colour = attributes.get("color")
    hex_colour = resolve_colour(colour)
    if hex_colour:
        look["hex"] = hex_colour
    wood_name = attributes.get("wood_finish") or attributes.get("material")
    wood_hex = resolve_wood(wood_name)
    if wood_hex:
        look["wood_hex"] = wood_hex
        look["wood"] = wood_name
    sheen = resolve_sheen(attributes.get("texture"), attributes.get("wood_finish"), attributes.get("material"))
    if sheen is not None:
        look["roughness"] = sheen
    fabric = resolve_fabric(attributes.get("fabric") or attributes.get("material"))
    if fabric:
        look["fabric_family"], look["fabric_roughness"] = fabric
        look["fabric"] = attributes.get("fabric") or attributes.get("material")
    if colour and not hex_colour:
        look["unresolved_colour"] = colour
    return look


# ═══════════════════════════════════════════════════ product → scene objects ═════
# Checked in order; the first rule whose keyword appears in the product's
# category / subcategory / name decides which scene objects it dresses.
CATEGORY_RULES: list[tuple[tuple[str, ...], list[str]]] = [
    (("bedside", "nightstand", "night stand"), ["nightstand"]),
    (("coffee table", "coffee_table", "centre table", "center table"), ["coffee_table"]),
    (("side table", "side_table", "end table"), ["side_table"]),
    (("dining",), ["dining_set"]),
    (("study", "desk", "workstation"), ["desk"]),
    (("sofa", "couch", "sectional", "settee", "loveseat"), ["sofa"]),
    (("recliner", "armchair", "accent chair", "lounge chair", "accent_chair"), ["armchair"]),
    (("chair", "stool", "seating"), ["armchair", "chair"]),
    (("bed",), ["bed"]),
    (("wardrobe", "almirah", "closet"), ["wardrobe"]),
    (("dresser", "dressing"), ["dresser"]),
    (("rug", "carpet", "dhurrie", "floor mat", "doormat"), ["rug"]),
    (("lamp", "lighting", "light"), ["floor_lamp"]),
    (("tv", "media", "entertainment"), ["media_console"]),
    (("book", "shelf", "shelves"), ["bookshelf"]),
    (("shoe", "console"), ["console_table"]),
    (("sideboard", "crockery", "buffet"), ["sideboard"]),
    (("bar",), ["bar_unit"]),
    (("mandir", "pooja", "puja"), ["mandir"]),
    (("vanity", "basin", "sink"), ["vanity"]),
    (("shower", "fixture", "faucet", "tap"), ["shower"]),
    (("toilet", "wc", "commode"), ["wc"]),
    (("island",), ["island"]),
    (("kitchen", "cabinet", "modular", "countertop", "counter"), ["counter_run", "wall_cabinets", "island"]),
    (("storage", "cupboard"), ["tall_storage"]),
    (("plant", "planter"), ["planter"]),
    (("bench",), ["bench"]),
]
# Project room types → the viewer's scene room types.
ROOM_TYPE_MAP: dict[str, str] = {
    "living_room": "living_room", "living": "living_room", "hall": "living_room",
    "bedroom_master": "master_bedroom", "master_bedroom": "master_bedroom",
    "kitchen": "kitchen", "dining_room": "dining_area", "dining_area": "dining_area",
    "home_office": "study", "study": "study", "pooja_room": "pooja_room", "family_lounge": "family_lounge",
}


_ROOM_WORDS = re.compile(r"(bed ?rooms?|bath ?rooms?|living ?rooms?|dining ?rooms?|furniture|decor|home)")


def scene_categories(product: Any) -> list[str]:
    def field(attr: str) -> str:
        text = _norm(str(getattr(product, attr, "") or "").replace("_", " "))
        return _ROOM_WORDS.sub(" ", text)          # "Bedroom Furniture" names a room, not a bed
    # Most specific field first: category, then subcategory, then the name.
    for haystack in (field("category"), field("subcategory"), field("name")):
        for keywords, cats in CATEGORY_RULES:
            if any(re.search(rf"(?<![a-z]){re.escape(k.replace('_', ' '))}", haystack) for k in keywords):
                return cats
    return []


def scene_room(room_type: str) -> tuple[Optional[str], int]:
    """('bedroom', 1) for 'bedroom_2'; ('bathroom', 0) for 'bathroom'."""
    rt = (room_type or "").lower()
    if rt in ROOM_TYPE_MAP:
        return ROOM_TYPE_MAP[rt], 0
    m = re.match(r"^(bedroom|bathroom)(?:_(\d+))?$", rt)
    if m:
        n = int(m.group(2) or 1)
        # bedroom_2 is the first non-master bedroom; bathroom / bathroom_2 count from one.
        return (m.group(1), n - 2 if m.group(1) == "bedroom" else n - 1)
    return None, 0


def viewer_selections(rooms: Iterable[Any]) -> list[dict[str, Any]]:
    """One entry per picked product, ready for the viewer to apply."""
    out: list[dict[str, Any]] = []
    for room in rooms or []:
        target, index = scene_room(getattr(room, "room_type", ""))
        for item in getattr(room, "items", None) or []:
            product = getattr(item, "product", None)
            if product is None:
                continue
            attributes = item_attributes(item)
            out.append({
                "item_id": item.id,
                "room": getattr(room, "room_type", ""),
                "room_type": target,
                "room_index": max(index, 0),
                "categories": scene_categories(product),
                "product": {"id": product.id, "name": product.name,
                            "category": product.category, "thumbnail_url": product.thumbnail_url},
                "attributes": attributes,
                "look": look_for(attributes, product),
            })
    return out


def prompt_products(items: Iterable[Any], extra: Optional[Iterable[dict[str, Any]]] = None) -> list[dict[str, Any]]:
    """Products for the render prompt: the saved picks, then any the client sent
    that aren't saved (the saved choice wins for the same product)."""
    out: list[dict[str, Any]] = []
    seen: set[str] = set()
    for item in items or []:
        product = getattr(item, "product", None)
        if product is None:
            continue
        seen.add(str(product.id))
        out.append({"id": product.id, "name": product.name, **item_attributes(item)})
    for p in extra or []:
        if isinstance(p, dict) and str(p.get("id")) not in seen and p.get("name"):
            out.append({"id": p.get("id"), "name": p.get("name"),
                        **clean_attributes({k: v for k, v in p.items() if k not in ("id", "name")})})
    return out


def describe_product(p: dict[str, Any]) -> str:
    attributes = {k: v for k, v in p.items() if k not in ("id", "name") and v}
    return f"{p.get('name', 'item')} ({describe_attributes(attributes)})" if attributes else str(p.get("name", "item"))


STANDARD_OPTIONS = ("color", "fabric", "size", "texture", "wood_finish", "cushion_style")


def catalog_variant_options(options: Optional[dict[str, Any]], existing: Optional[dict[str, Any]] = None
                            ) -> dict[str, Any]:
    """A vendor's option lists in the catalogue's shape: the standard groups are
    always present, any extra group the vendor defines is kept, values are
    trimmed and de-duplicated, and the product's image list is preserved."""
    out: dict[str, Any] = {key: [] for key in STANDARD_OPTIONS}
    for key, values in (options or {}).items():
        k = option_key(key)
        if not k or k in RESERVED_VARIANT_KEYS:
            continue
        if isinstance(values, str):
            values = re.split(r"[,\n]", values)
        if not isinstance(values, (list, tuple)):
            continue
        kept: list[str] = []
        for v in values:
            text = str(v or "").strip()[:80]
            if text and text.lower() not in {x.lower() for x in kept}:
                kept.append(text)
        out[k[:40]] = kept[:40]
    if isinstance(existing, dict) and existing.get("images"):
        out["images"] = existing["images"]
    return out
