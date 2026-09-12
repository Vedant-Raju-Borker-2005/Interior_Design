"""End-to-end orchestration.

    from ids import DesignPipeline, Brief

    pipe = DesignPipeline.build(blobs="build/data_blobs.js")   # trains once
    pipe.save("artifacts/2026-09-11")

    result = pipe.design(Brief(bhk="3 BHK", style="Luxury", budget="₹12L–₹20L"))
    result.scene            # solved scene model  (workflow 2 output)
    result.recommendations  # ranked add-ons      (workflow 1 output)
    result.price            # predicted total
    pipe.render_html(result, "out/home.html")                  # workflow 3

Reload without retraining:

    pipe = DesignPipeline.load("artifacts/2026-09-11", blobs="build/data_blobs.js")
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Sequence

from .catalog import Brief, Catalog, Palette
from .history import (CATALOG_ROWS, CITY_MULT, History, STYLE_TAGS, TIERS,
                      item_documents, style_documents, synthesise)
from .models import AssociationModel, ModelBundle, PriceModel, StyleEmbedder
from .scene import Scene, Violation, validate
from .solver import SpatialSolver, SweepBackend


@dataclass
class DesignResult:
    brief: Brief
    tier: str
    palette: Palette
    scene: Scene
    svg: str
    recommendations: list[dict[str, Any]]
    price: float
    price_with_recommendations: float
    violations: list[Violation] = field(default_factory=list)
    solve_reports: list[Any] = field(default_factory=list)

    @property
    def feasible(self) -> bool:
        return not self.violations

    def summary(self) -> dict[str, Any]:
        return {
            "bhk": self.brief.bhk, "style": self.brief.style, "tier": self.tier,
            "palette": [self.palette.dominant, self.palette.secondary, self.palette.accent],
            "rooms": len(self.scene.rooms), "objects": len(self.scene.objects),
            "feasible": self.feasible, "violations": len(self.violations),
            "price": round(self.price),
            "price_with_recommendations": round(self.price_with_recommendations),
            "recommendations": [r["category"] for r in self.recommendations],
        }


class DesignPipeline:
    """Workflow 1 → shared solver → Workflow 3, wired together."""

    def __init__(self, catalog: Catalog, bundle: ModelBundle,
                 solver: SpatialSolver | None = None):
        self.catalog = catalog
        self.bundle = bundle
        self.solver = solver or SpatialSolver(backend=SweepBackend(), seed=7,
                                              iterations=900)

    # ─────────────────────────────────────────────────────────── build ──
    @classmethod
    def build(cls, *, blobs: str | Path, history: History | None = None,
              version: str = "v1", solver: SpatialSolver | None = None
              ) -> "DesignPipeline":
        catalog = Catalog.from_blobs(blobs)
        hist = history or synthesise()

        association = AssociationModel().fit(hist.baskets)
        embedder = StyleEmbedder().fit(item_documents(), style_documents())
        price = PriceModel(CATALOG_ROWS, TIERS, list(STYLE_TAGS), CITY_MULT)
        price.fit(hist.orders, hist.prices)

        bundle = ModelBundle(association, embedder, price, CATALOG_ROWS, version)
        bundle.export()["meta"]  # fail fast if anything is unexportable
        pipe = cls(catalog, bundle, solver)
        pipe.synthetic_history = hist.synthetic
        return pipe

    @classmethod
    def load(cls, artifacts: str | Path, *, blobs: str | Path,
             solver: SpatialSolver | None = None) -> "DesignPipeline":
        return cls(Catalog.from_blobs(blobs), ModelBundle.load(artifacts), solver)

    def save(self, artifacts: str | Path) -> Path:
        return self.bundle.save(artifacts)

    # ────────────────────────────────────────────────────────── design ──
    def design(self, brief: Brief, *, solve: bool = True) -> DesignResult:
        """Run workflow 1 -> solver -> priced result for one customer brief."""
        cat = self.catalog
        cat.validate_brief(brief)
        tier = cat.resolve_tier(brief.budget, brief.quality)
        palette = cat.assign_palette(brief.colors, brief.style)

        scene = Scene.from_dict(cat.variant_scene(brief.bhk, tier))
        svg = cat.variant_svg(brief.bhk, tier)

        reports: list[Any] = []
        if solve:
            scene, reports = self.solver.solve_scene(scene)

        placed = scene.categories()
        recs = self.bundle.association.recommend(placed, limit=5)
        for r in recs:
            r["style_fit"] = self.bundle.embedder.similarity(r["category"], brief.style)
            r["score"] = 0.62 * r["score"] + 0.38 * r["style_fit"]
        recs.sort(key=lambda r: -r["score"])

        price = self.bundle.price.predict(placed, brief.bhk_number, brief.style,
                                          tier, brief.city)
        price_rec = self.bundle.price.predict(
            placed + [r["category"] for r in recs], brief.bhk_number,
            brief.style, tier, brief.city)
        # The GBR is fitted, not constrained, so it is not guaranteed monotonic
        # in item count — on dense baskets it can predict a hair *less* for a
        # superset. Quoting a smaller total for strictly more furniture is
        # indefensible to a customer, so clamp. `tests/test_ids.py` measures how
        # often the raw model breaks monotonicity; if that number climbs, the
        # feature set needs work rather than a bigger clamp.
        price_rec = max(price_rec, price)

        return DesignResult(brief, tier, palette, scene, svg, recs, price,
                            price_rec, validate(scene), reports)

    # ────────────────────────────────────────────────────────── render ──
    def render_html(self, result: DesignResult, out_path: str | Path, *,
                    textures: dict[str, Any] | str | Path,
                    viewer_js: str | Path, template=None) -> Path:
        """Workflow 3. Inlines the solved scene, the texture atlas and the
        trained bundle into one self-contained file."""
        from .export import assemble_html
        return assemble_html(
            out_path=out_path, catalog=self.catalog,
            variants=self._variants_with(result),
            textures=textures, model=self.bundle.export(),
            viewer_js=viewer_js, defaults=_defaults_from(result.brief))

    def _variants_with(self, result: DesignResult) -> dict[str, Any]:
        """Replace the cached layout for this brief with the solved one, leave
        the rest untouched so every toggle still works in the browser."""
        out = {k: dict(v) for k, v in self.catalog.variants.items()}
        key = f"{result.brief.bhk}|{result.tier}"
        out[key] = {"scene": result.scene.to_dict(), "svg": result.svg}
        return out

    def solve_all(self) -> dict[str, Any]:
        """Re-solve every cached variant. Use before shipping a build so the
        browser never loads a layout the solver has not validated."""
        out: dict[str, Any] = {}
        summary: dict[str, int] = {}
        for key, v in self.catalog.variants.items():
            scene = Scene.from_dict(v["scene"])
            solved, _ = self.solver.solve_scene(scene)
            bad = validate(solved)
            summary[key] = len(bad)
            out[key] = {"scene": solved.to_dict(), "svg": v["svg"]}
        self._solved_variants = out
        self.solve_summary = summary
        return out


def _defaults_from(brief: Brief) -> dict[str, Any]:
    return {"city": brief.city, "bhk": brief.bhk, "scope": brief.scope,
            "budget": brief.budget, "quality": brief.quality,
            "timeline": brief.timeline, "style": brief.style,
            "wood": brief.wood, "fabric": brief.fabric,
            "colors": list(brief.colors), "property": brief.property_name}
