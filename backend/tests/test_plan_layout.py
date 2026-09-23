"""Floor-plan tracing: room detection and the 2D/3D scene built from it.

Pure unit tests — no database, no network.

    cd backend
    .venv\\Scripts\\python -m pytest tests/test_plan_layout.py -q
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import numpy as np
import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
os.environ.pop("GEMINI_KEY", None)

from app.services import plan_layout as PL  # noqa: E402
from plan_samples import HEIGHT, PX_PER_M, WIDTH, iou, one_bhk_plan  # noqa: E402

BRIEF = {"bhk": "2 BHK", "style": "Scandinavian", "budget": "₹8L–₹12L", "quality": "Standard",
         "wood": "Oak Laminate", "fabric": "Velvet", "colors": ["Warm White", "Sage Green"],
         "property": "Plan Test Home"}


@pytest.fixture(scope="module")
def detected():
    im, truth = one_bhk_plan()
    return PL.detect_rooms(im, bhk_hint=2), truth


def test_detects_the_rooms_of_an_uploaded_plan(detected):
    det, truth = detected
    assert det["method"] == "heuristic"
    assert (det["image_w"], det["image_h"]) == (WIDTH, HEIGHT)
    for kind, box in truth:
        best = max(det["rooms"], key=lambda r: iou(r["box"], box))
        assert iou(best["box"], box) >= 0.5, f"{kind} not found"
        assert best["room_type"] == kind, f"{kind} typed as {best['room_type']}"
    # The scale comes from the door widths: within 15% of the drawing's true width.
    true_width = WIDTH / PX_PER_M
    assert abs(det["plan_width_m"] - true_width) / true_width < 0.15
    labels = [r["label"] for r in det["rooms"]]
    assert len(labels) == len(set(labels))


def test_door_gaps_in_the_plan_are_found(detected):
    det, _ = detected
    doors = [g for g in det["door_gaps"] if g["kind"] == "door"]
    # The bedroom door (bottom wall, x 232-290 px) and the entrance (x 430-490 px).
    def near(axis, pos, a, b):
        return any(g["axis"] == axis and abs(g["pos"] - pos) < 0.02 and g["a"] < b and g["b"] > a for g in doors)
    assert near("x", 283 / HEIGHT, 232 / WIDTH, 290 / WIDTH), det["door_gaps"]
    assert near("x", 540 / HEIGHT, 430 / WIDTH, 490 / WIDTH), det["door_gaps"]


def test_doors_follow_the_gaps_drawn_on_the_plan(detected):
    det, _ = detected
    plan = {**PL.clean_plan(det["rooms"], det["plan_width_m"], det["image_w"], det["image_h"]),
            "door_gaps": det["door_gaps"]}
    scene = PL.build_plan_variant(plan, BRIEF)["scene"]
    living = next(r for r in scene["rooms"] if r["room_type"] == "living_room")
    entrance = next(o for o in scene["openings"] if o["kind"] == "entrance")
    # The drawn entrance is on the living room's bottom (south) wall.
    assert abs(entrance["p0"][1] - living["rect"][1]) < 0.3, (entrance, living["rect"])


def test_a_small_wc_still_gets_a_door():
    rooms = [
        {"room_type": "living_room", "box": [0.30, 0.0, 1.0, 1.0]},
        {"room_type": "bathroom", "label": "WC", "box": [0.0, 0.0, 0.15, 0.2]},
        {"room_type": "passage", "box": [0.15, 0.0, 0.30, 0.2]},
        {"room_type": "master_bedroom", "box": [0.0, 0.2, 0.30, 1.0]},
    ]
    scene = PL.build_plan_variant(PL.clean_plan(rooms, 6.8, 1000, 1000), BRIEF)["scene"]
    wc = next(r for r in scene["rooms"] if r["label"] == "WC")
    assert any(o["room_id"] == wc["room_id"] and o["kind"] == "door" for o in scene["openings"])


def test_detection_does_not_depend_on_the_project_bhk():
    im, _ = one_bhk_plan()
    kinds = [[r["room_type"] for r in PL.detect_rooms(im, bhk_hint=h)["rooms"]] for h in (1, 2, 3, 4)]
    assert all(k == kinds[0] for k in kinds), kinds


def test_gap_bridging_never_fills_a_narrow_room():
    walls = np.zeros((120, 120), bool)
    walls[10:110, 40:46] = True      # two parallel walls 30 px apart (a narrow WC)
    walls[10:110, 76:82] = True
    walls[10:16, 10:110] = True      # a top wall with a 20 px door gap
    walls[10:16, 50:70] = False
    horiz = PL.ndi.binary_opening(walls, structure=np.ones((1, 9), bool))
    vert = PL.ndi.binary_opening(walls, structure=np.ones((9, 1), bool))
    out = PL._bridge_wall_gaps(walls, horiz, vert, 40)
    assert not out[60, 50:70].any(), "room between parallel walls was filled"
    assert out[12, 50:70].all(), "door gap in the wall was not bridged"


def test_confirmed_plan_is_validated():
    rooms = [{"room_type": "living_room", "box": [0.1, 0.1, 0.6, 0.6]}]
    with pytest.raises(PL.PlanError):
        PL.clean_plan(rooms, 1.0, 600, 600)                       # absurd scale
    with pytest.raises(PL.PlanError):
        PL.clean_plan([{"room_type": "garage", "box": [0, 0, 1, 1]}], 10, 600, 600)
    with pytest.raises(PL.PlanError):
        PL.clean_plan([{"room_type": "bathroom", "box": [0.1, 0.1, 0.12, 0.5]}], 10, 600, 600)
    ok = PL.clean_plan([{"room_type": "kitchen", "box": [0.7, 0.9, 0.2, 0.4]}], 10, 600, 600)
    assert ok["rooms"][0]["box"] == [0.2, 0.4, 0.7, 0.9]        # corners normalised
    assert ok["rooms"][0]["label"] == "Kitchen"


@pytest.fixture(scope="module")
def variant(detected):
    det, _ = detected
    plan = PL.clean_plan(det["rooms"], det["plan_width_m"], det["image_w"], det["image_h"])
    return PL.build_plan_variant(plan, BRIEF)


def test_scene_follows_the_viewer_contract(variant):
    scene = variant["scene"]
    assert variant["bhk"] == "1 BHK" and scene["bhk"] == "1 BHK"
    for key in ("bounds", "design", "cutaway_height_m", "circulation", "balcony", "entrance",
                "rooms", "walls", "openings", "objects"):
        assert key in scene
    json.dumps(variant)                                          # embeddable as-is

    room_types = {r["room_type"] for r in scene["rooms"]}
    assert {"living_room", "master_bedroom", "kitchen", "bathroom"} <= room_types
    assert scene["balcony"] is not None
    assert scene["entrance"] and any(o["kind"] == "entrance" for o in scene["openings"])
    assert {w["kind"] for w in scene["walls"]} >= {"exterior", "partition"}

    # Every door/window sits on a wall the viewer will cut it out of.
    for op in scene["openings"]:
        (x0, y0), (x1, y1) = op["p0"], op["p1"]
        horizontal = abs(y0 - y1) < 1e-4
        on_wall = False
        for w in scene["walls"]:
            (a0, b0), (a1, b1) = w["p0"], w["p1"]
            if horizontal and abs(b0 - b1) < 1e-4 and abs(b0 - y0) < 1e-3:
                on_wall |= min(a0, a1) - 1e-3 <= min(x0, x1) and max(x0, x1) <= max(a0, a1) + 1e-3
            if not horizontal and abs(a0 - a1) < 1e-4 and abs(a0 - x0) < 1e-3:
                on_wall |= min(b0, b1) - 1e-3 <= min(y0, y1) and max(y0, y1) <= max(b0, b1) + 1e-3
        assert on_wall, f"{op['opening_id']} is not on a wall"

    # Every enclosed room has a way in.
    doors = {o["room_id"] for o in scene["openings"] if o["kind"] in ("door", "balcony_door")}
    for r in scene["rooms"]:
        if r["room_type"] != "living_room":
            assert r["room_id"] in doors, f"{r['label']} has no door"


def test_furniture_is_solved_inside_each_room(variant):
    from ids.scene import Opening, Room, Scene, SceneObject, validate

    scene = variant["scene"]
    assert len(scene["objects"]) >= 12
    rooms = {r["room_id"]: r for r in scene["rooms"]}
    for o in scene["objects"]:
        assert o["room_id"] in rooms
        assert {"role", "label", "asset_reference", "scale", "dimensions"} <= set(o)
    ids_rooms = [Room(r["room_id"], r["label"], tuple(r["rect"])) for r in scene["rooms"]]
    ids_objects = [SceneObject(o["object_id"], o["room_id"], o["category"], o["position"],
                               o["rotation"], o["dimensions"]) for o in scene["objects"]]
    violations = [v for v in validate(Scene(ids_rooms, ids_objects, [])) if v.kind in ("boundary", "overlap")]
    assert not violations, violations[:3]


def test_plan_svg_matches_the_scene(variant):
    svg = variant["svg"]
    assert svg.startswith("<svg") and svg.rstrip().endswith("</svg>")
    for r in variant["scene"]["rooms"]:
        assert f'data-room="{r["room_id"]}"' in svg
    for element_id in ("tb-title", "tb-detail", "chip-0", "chip-label-2"):
        assert f'id="{element_id}"' in svg                     # re-tinted live by the viewer


def test_variant_is_cached_per_geometry_and_tier(detected):
    det, _ = detected
    plan = PL.clean_plan(det["rooms"], det["plan_width_m"], det["image_w"], det["image_h"])
    first = PL.build_plan_variant(plan, BRIEF)
    first["scene"]["rooms"].clear()                              # callers get their own copy
    again = PL.build_plan_variant(plan, BRIEF)
    assert again["scene"]["rooms"]
    premium = PL.build_plan_variant(plan, {**BRIEF, "budget": "₹20L+", "quality": "Premium"})
    assert premium["summary"]["tier"] == "Premium" and again["summary"]["tier"] == "Standard"


def test_a_stretched_plan_keeps_true_room_sizes():
    rooms = [{"room_type": "living_room", "box": [0.0, 0.0, 0.5, 1.0]},
             {"room_type": "master_bedroom", "box": [0.5, 0.0, 1.0, 1.0]}]
    plan = PL.clean_plan(rooms, 8.0, 800, 400, plan_depth_m=6.0)   # image 2:1, home 8 m x 6 m
    scene = PL.build_plan_variant(plan, BRIEF)["scene"]
    assert scene["bounds"]["depth"] == pytest.approx(6.0, abs=0.06)
    with pytest.raises(PL.PlanError):
        PL.clean_plan(rooms, 8.0, 800, 400, plan_depth_m=40.0)


def test_every_room_gets_the_piece_that_makes_it_that_room():
    """A 1.3 m2 WC is still a WC: it shows a pan, not an empty tiled box."""
    rooms = [
        {"room_type": "living_room", "box": [0.30, 0.0, 1.0, 1.0]},
        {"room_type": "bathroom", "label": "Bath", "box": [0.0, 0.0, 0.16, 0.18]},
        {"room_type": "kitchen", "box": [0.0, 0.18, 0.30, 0.45]},
        {"room_type": "master_bedroom", "box": [0.0, 0.45, 0.30, 1.0]},
    ]
    scene = PL.build_plan_variant(PL.clean_plan(rooms, 7.5, 1000, 1000), BRIEF)["scene"]
    by_room: dict[str, list[str]] = {}
    for o in scene["objects"]:
        by_room.setdefault(o["room_id"], []).append(o["category"])
    for room in scene["rooms"]:
        got = by_room.get(room["room_id"], [])
        assert got, f"{room['label']} came out empty"
        if room["room_type"] == "bathroom":
            assert {"wc", "vanity", "shower"} & set(got), got
        if room["room_type"] == "kitchen":
            assert {"counter_run", "wall_cabinets"} & set(got), got
        if room["room_type"] in ("bedroom", "master_bedroom"):
            assert "bed" in got, got
