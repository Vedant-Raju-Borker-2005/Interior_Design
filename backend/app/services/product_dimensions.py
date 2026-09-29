"""Real sizes for the catalogue, in millimetres.

Every product in the catalogue carried the column default — 1200 x 600 x 750 —
so a wardrobe, a bedside table and a rug all claimed to be the same size.
Nothing that reasons about whether a piece fits a room could work.

The numbers here are the ones the 3D room templates already use, which is why
furniture looks right in the viewer: a sofa is 2.02 m across, a king bed
1.85 x 2.05. Keeping one table means the catalogue and the 3D model finally
agree about how big things are.

Width is the face you see, depth is how far it stands out from the wall.
"""
from __future__ import annotations

from typing import Optional

# Checked first, because a name is more specific than a category. A kitchen's
# "Modular Cabinets" covers both a 620 mm deep base run and a 340 mm wall unit.
BY_NAME: tuple[tuple[str, tuple[int, int, int]], ...] = (
    ("base cabinet",      (2600, 620, 900)),
    ("wall cabinet",      (2200, 340, 720)),
    ("bedside lighting",  (250, 250, 500)),     # a lamp on a table, not a floor lamp
    ("bedside table",     (450, 420, 550)),
    ("towel rack",        (600, 120, 800)),     # wall mounted, almost no footprint
    ("master bed",        (1850, 2050, 550)),
    ("bed set",           (1850, 2050, 550)),
    ("sofa set",          (2020, 920, 840)),
    ("wardrobe",          (2600, 620, 2350)),
    ("study desk",        (1050, 550, 750)),
    ("vanity",            (1010, 520, 850)),
    ("area rug",          (1870, 1700, 20)),
    ("coffee table",      (1100, 620, 420)),
    ("side table",        (450, 450, 550)),
    ("accent chair",      (780, 800, 820)),
)

BY_SUBCATEGORY: dict[str, tuple[int, int, int]] = {
    "accent chair":    (780, 800, 820),
    "coffee table":    (1100, 620, 420),
    "side tables":     (450, 450, 550),
    "bedside tables":  (450, 420, 550),
    "master bed":      (1850, 2050, 550),
    "bed set":         (1850, 2050, 550),
    "study desk":      (1050, 550, 750),
    "vanity counter":  (1010, 520, 850),
    "wardrobe":        (2600, 620, 2350),
    "modular cabinets": (2600, 620, 900),
    "area rug":        (1870, 1700, 20),
    "sofa":            (2020, 920, 840),
    "lighting":        (380, 380, 1620),
    "fixtures":        (600, 120, 800),
}

BY_CATEGORY: dict[str, tuple[int, int, int]] = {
    "sofas":         (2020, 920, 840),
    "chairs":        (780, 800, 820),
    "coffee_tables": (1100, 620, 420),
    "side_tables":   (450, 450, 550),
    "rugs":          (1870, 1700, 20),
    "lighting":      (380, 380, 1620),
    "kitchen":       (2600, 620, 900),
    "furniture":     (1200, 600, 750),
    "décor":         (600, 120, 800),
    "decor":         (600, 120, 800),
}

DEFAULT = (1200, 600, 750)


def dimensions_for(name: Optional[str] = None,
                   category: Optional[str] = None,
                   subcategory: Optional[str] = None) -> tuple[int, int, int]:
    """Width, depth and height in mm for a catalogue row, most specific first."""
    lowered = (name or "").lower()
    for needle, dims in BY_NAME:
        if needle in lowered:
            return dims
    sub = (subcategory or "").strip().lower()
    if sub in BY_SUBCATEGORY:
        return BY_SUBCATEGORY[sub]
    cat = (category or "").strip().lower()
    if cat in BY_CATEGORY:
        return BY_CATEGORY[cat]
    return DEFAULT
