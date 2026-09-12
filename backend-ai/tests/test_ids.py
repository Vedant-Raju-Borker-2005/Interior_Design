"""Regression gates. `pytest -q` from the package root.

The two that matter most in CI:
  * `test_solver_feasible_all_variants` — no layout ever ships with a hard
    constraint breach.
  * `test_price_parity` — the exported trees and the sklearn model agree, so the
    browser and the server quote the same number.
"""
from __future__ import annotations

import math
from pathlib import Path

import pytest

from ids import (Brief, Catalog, DesignPipeline, Scene, SpatialSolver,
                 SweepBackend, validate)
from ids.history import CATALOG_ROWS, CITY_MULT, STYLE_TAGS, TIERS, synthesise
from ids.models import AssociationModel, PriceModel, StyleEmbedder
from ids.scene import Box

BLOBS = Path(__file__).resolve().parents[1] / "build" / "data_blobs.js"
pytestmark = pytest.mark.skipif(not BLOBS.exists(), reason="scene blobs not present")


@pytest.fixture(scope="session")
def catalog() -> Catalog:
    return Catalog.from_blobs(BLOBS)


@pytest.fixture(scope="session")
def history():
    return synthesise(2500, seed=3)


@pytest.fixture(scope="session")
def pipeline(history) -> DesignPipeline:
    return DesignPipeline.build(blobs=BLOBS, history=history)


# ─────────────────────────────────────────────────────────── geometry ──────
def test_box_overlap_and_containment():
    a, b = Box(0, 0, 2, 2), Box(1, 1, 3, 3)
    assert a.overlap(b) == pytest.approx(1.0)
    assert a.overlap(Box(5, 5, 6, 6)) == 0.0
    assert Box(0, 0, 4, 4).contains(a)
    assert not a.contains(Box(0, 0, 4, 4))


def test_scene_round_trip(catalog):
    for key in catalog.variants:
        d = catalog.variant_scene(*key.split("|"))
        assert Scene.from_dict(d).to_dict() == d


# ───────────────────────────────────────────────────────────── solver ──────
def test_solver_feasible_all_variants(catalog):
    solver = SpatialSolver(backend=SweepBackend(), seed=7, iterations=600)
    for key in catalog.variants:
        scene = Scene.from_dict(catalog.variant_scene(*key.split("|")))
        solved, reports = solver.solve_scene(scene)
        assert not validate(solved), f"{key}: {[str(v) for v in validate(solved)][:3]}"
        assert all(r.feasible for r in reports), key


def test_solver_is_deterministic(catalog):
    scene = Scene.from_dict(catalog.variant_scene("2 BHK", "Standard"))
    s = SpatialSolver(backend=SweepBackend(), seed=11, iterations=300)
    a, _ = s.solve_scene(scene)
    b, _ = s.solve_scene(scene)
    assert [o.position for o in a.objects] == [o.position for o in b.objects]


def test_solver_does_not_mutate_input(catalog):
    scene = Scene.from_dict(catalog.variant_scene("2 BHK", "Standard"))
    before = [dict(o.position) for o in scene.objects]
    SpatialSolver(backend=SweepBackend(), seed=1, iterations=200).solve_scene(scene)
    assert [dict(o.position) for o in scene.objects] == before


# ─────────────────────────────────────────────────────────── catalogue ─────
def test_tier_resolution_matches_viewer(catalog):
    assert catalog.resolve_tier("₹3L–₹5L", "Budget") == "Budget"
    assert catalog.resolve_tier("₹20L+", "Premium") == "Premium"
    assert catalog.resolve_tier("₹8L–₹12L", "Standard") == "Standard"


def test_palette_prefers_light_neutral_as_dominant(catalog):
    p = catalog.assign_palette(["Off White", "Charcoal Grey", "Burnt Orange"], "Modern")
    assert p.dominant == "Off White"
    assert p.accent == "Burnt Orange"


def test_brief_validation_rejects_unknown(catalog):
    with pytest.raises(ValueError, match="colour"):
        catalog.assign_palette(["Not A Colour"], "Modern")
    with pytest.raises(ValueError, match="style"):
        catalog.assign_palette(["Off White"], "Brutalist")


# ──────────────────────────────────────────────────────────────── ML ───────
def test_association_rules_are_sane(history):
    m = AssociationModel(min_support=0.05, min_confidence=0.5).fit(history.baskets)
    assert m.rules
    for r in m.rules:
        assert 0 <= r.confidence <= 1.0001
        assert r.lift > 0
        assert r.consequent not in r.antecedent
    recs = m.recommend(["bed", "wardrobe"], limit=3)
    assert all(r["category"] not in {"bed", "wardrobe"} for r in recs)


def test_embedder_similarity_bounded():
    e = StyleEmbedder(dim=12).fit(
        {"sofa": "seating fabric lounge", "mandir": "wood ritual traditional"},
        {"Luxury": "velvet marble rich", "Indian Contemporary": "wood ritual brass"})
    for item in ("sofa", "mandir"):
        for style in ("Luxury", "Indian Contemporary"):
            assert 0.0 <= e.similarity(item, style) <= 1.0
    assert e.similarity("mandir", "Indian Contemporary") > e.similarity("sofa", "Indian Contemporary")


def test_price_parity(history):
    """The exported trees must reproduce sklearn exactly — otherwise the
    browser quotes a different number from the server."""
    pm = PriceModel(CATALOG_ROWS, TIERS, list(STYLE_TAGS), CITY_MULT,
                    n_estimators=40).fit(history.orders, history.prices)
    exported = pm.export()
    for o in history.orders[:60]:
        x = pm.featurise(o["items"], o["bhk"], o["style"], o["tier"], o["city"])
        assert PriceModel.eval_exported(exported, x) == pytest.approx(
            pm.predict(o["items"], o["bhk"], o["style"], o["tier"], o["city"]), rel=1e-6)


def test_price_monotonicity_rate(history):
    """Documents a known limitation: the GBR is unconstrained, so a superset
    basket can price marginally lower. The pipeline clamps this; the gate here
    is that it stays rare."""
    pm = PriceModel(CATALOG_ROWS, TIERS, list(STYLE_TAGS), CITY_MULT,
                    n_estimators=60).fit(history.orders, history.prices)
    breaks = 0
    trials = history.orders[:120]
    for o in trials:
        extra = next((r["category"] for r in CATALOG_ROWS
                      if r["category"] not in o["items"]), None)
        if extra is None:
            continue
        a = pm.predict(o["items"], o["bhk"], o["style"], o["tier"], o["city"])
        b = pm.predict(list(o["items"]) + [extra], o["bhk"], o["style"],
                       o["tier"], o["city"])
        breaks += b < a - 1.0
    assert breaks / len(trials) < 0.35


# ─────────────────────────────────────────────────────────── pipeline ──────
def test_design_end_to_end(pipeline):
    r = pipeline.design(Brief(bhk="3 BHK", style="Luxury", budget="₹12L–₹20L",
                              quality="Premium", colors=("Off White", "Charcoal Grey")))
    assert r.feasible and not r.violations
    assert r.tier == "Premium"
    assert r.price > 0
    assert r.price_with_recommendations >= r.price       # clamp holds
    assert len(r.scene.objects) > 0


def test_pipeline_round_trips_through_disk(pipeline, tmp_path):
    pipeline.save(tmp_path / "art")
    again = DesignPipeline.load(tmp_path / "art", blobs=BLOBS)
    a = pipeline.design(Brief(), solve=False)
    b = again.design(Brief(), solve=False)
    assert a.price == pytest.approx(b.price)
    assert [x["category"] for x in a.recommendations] == \
           [x["category"] for x in b.recommendations]


def test_exported_bundle_is_json_safe(pipeline):
    import json
    blob = json.dumps(pipeline.bundle.export())
    assert "</script" not in blob.lower()
    assert json.loads(blob)["meta"]["embedding_dim"] == 24
