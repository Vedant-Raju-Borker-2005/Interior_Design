"""Catalog vocabulary, customer brief definitions, tier resolution, and color palettes."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Sequence


@dataclass
class Brief:
    city: str = "Mumbai"
    bhk: str = "2 BHK"
    scope: str = "Full Home"
    budget: str = "₹8L–₹12L"
    quality: str = "Standard"
    timeline: str = "45 Days"
    style: str = "Modern"
    wood: str = "Teak Laminate"
    fabric: str = "Woven Fabric"
    colors: tuple[str, ...] = ("Off White", "Charcoal Grey")
    property_name: str = "Standard Apartment"

    @property
    def bhk_number(self) -> int:
        match = re.search(r"(\d+)", self.bhk)
        return int(match.group(1)) if match else 2


@dataclass
class Palette:
    dominant: str
    secondary: str
    accent: str


class Catalog:
    """Design catalog and floorplan variant registry."""

    styles: tuple[str, ...] = (
        "Modern",
        "Boho",
        "Luxury",
        "Indian Contemporary",
        "Minimalist",
        "Scandinavian",
    )
    woods: tuple[str, ...] = (
        "Teak Laminate",
        "Walnut Laminate",
        "Oak Finish",
        "Rosewood",
    )
    fabrics: tuple[str, ...] = (
        "Velvet",
        "Linen",
        "Woven Fabric",
        "Cotton Canvas",
    )
    budgets: tuple[str, ...] = (
        "₹3L–₹5L",
        "₹5L–₹8L",
        "₹8L–₹12L",
        "₹12L–₹20L",
        "₹20L+",
    )
    qualities: tuple[str, ...] = ("Budget", "Standard", "Premium")

    KNOWN_COLORS: set[str] = {
        "Off White",
        "Charcoal Grey",
        "Burnt Orange",
        "Ivory",
        "Champagne Gold",
        "Warm White",
        "Deep Emerald",
        "Beige",
        "Navy Blue",
        "Sage Green",
        "Taupe",
        "Soft Grey",
        "Olive",
    }
    LIGHT_NEUTRALS: set[str] = {"Off White", "Ivory", "Warm White", "Beige", "Soft Grey"}

    def __init__(self, variants: dict[str, Any] | None = None, skus: dict[str, Any] | None = None):
        self.variants: dict[str, Any] = variants or {}
        self.skus: dict[str, Any] = skus or {}

    @classmethod
    def from_blobs(cls, path: str | Path) -> "Catalog":
        p = Path(path)
        if not p.exists():
            return cls._build_default_catalog()
        text = p.read_text(encoding="utf-8")
        # Support either raw JSON or 'window.__DATA_BLOBS__ = {...};'
        json_match = re.search(r"(\{.*\})", text, re.DOTALL)
        if json_match:
            try:
                data = json.loads(json_match.group(1))
                return cls(variants=data.get("variants", {}), skus=data.get("skus", {}))
            except Exception:
                pass
        return cls._build_default_catalog()

    @classmethod
    def _build_default_catalog(cls) -> "Catalog":
        from .seed_data import create_default_variants, create_default_skus
        variants = create_default_variants()
        skus = create_default_skus()
        return cls(variants=variants, skus=skus)

    def default_brief(self) -> Brief:
        return Brief(
            city="Mumbai",
            bhk="2 BHK",
            scope="Full Home",
            budget="₹8L–₹12L",
            quality="Standard",
            timeline="45 Days",
            style="Modern",
            wood="Teak Laminate",
            fabric="Woven Fabric",
            colors=("Off White", "Charcoal Grey", "Burnt Orange"),
            property_name="Standard Apartment",
        )

    def resolve_tier(self, budget: str, quality: str) -> str:
        """Resolve budget and quality into the operational tier (Budget, Standard, Premium)."""
        if budget in ("₹3L–₹5L",) or quality == "Budget":
            if budget == "₹20L+":
                return "Premium"
            if budget in ("₹12L–₹20L",) and quality != "Budget":
                return "Premium"
            if budget == "₹8L–₹12L" and quality == "Standard":
                return "Standard"
            return "Budget"
        if budget in ("₹20L+",) or (budget == "₹12L–₹20L" and quality == "Premium"):
            return "Premium"
        return "Standard"

    def assign_palette(self, colors: Sequence[str], style: str) -> Palette:
        """Validate colors and style; choose dominant light neutral and accent."""
        if style not in self.styles:
            raise ValueError(f"Unknown style '{style}'. Allowed: {', '.join(self.styles)}")
        for c in colors:
            if c not in self.KNOWN_COLORS:
                raise ValueError(f"Unknown colour '{c}'. Allowed: {', '.join(sorted(self.KNOWN_COLORS))}")

        color_list = list(colors)
        # Find dominant neutral
        dominant = next((c for c in color_list if c in self.LIGHT_NEUTRALS), color_list[0])
        remaining = [c for c in color_list if c != dominant]
        secondary = remaining[0] if remaining else dominant
        accent = remaining[-1] if len(remaining) > 1 else secondary
        return Palette(dominant=dominant, secondary=secondary, accent=accent)

    def validate_brief(self, brief: Brief) -> None:
        if brief.style not in self.styles:
            raise ValueError(f"Invalid style: {brief.style}")
        for c in brief.colors:
            if c not in self.KNOWN_COLORS:
                raise ValueError(f"Invalid colour: {c}")

    def variant_scene(self, bhk: str, tier: str) -> dict[str, Any]:
        key = f"{bhk}|{tier}"
        if key in self.variants:
            return self.variants[key]["scene"]
        # Fallback to closest matching bhk
        for k, v in self.variants.items():
            if k.startswith(bhk):
                return v["scene"]
        # Fallback to first variant
        return next(iter(self.variants.values()))["scene"]

    def variant_svg(self, bhk: str, tier: str) -> str:
        key = f"{bhk}|{tier}"
        if key in self.variants:
            return self.variants[key].get("svg", "<svg></svg>")
        for k, v in self.variants.items():
            if k.startswith(bhk):
                return v.get("svg", "<svg></svg>")
        return "<svg></svg>"
