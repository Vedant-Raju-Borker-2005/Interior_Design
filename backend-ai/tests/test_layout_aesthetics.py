"""What a designer would check at a glance: does the room look arranged, or filled?

    cd backend-ai
    python -m pytest tests/test_layout_aesthetics.py -q
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ids.scene import Opening, Room, SceneObject  # noqa: E402
from ids.solver import SpatialSolver  # noqa: E402

ROOM = Room("bed1", "Bedroom", (0.0, 0.0, 3.6, 3.05))
DOOR = Opening("d1", "bed1", (0.4, 0.0), (1.3, 0.0), True)
WINDOW = Opening("w1", "bed1", (1.2, 3.05), (2.6, 3.05), False)


def _obj(item_id: str, category: str, w: float, d: float, h: float) -> SceneObject:
    return SceneObject(item_id, "bed1", category, {"x": 1.0, "y": 0.0, "z": 1.0},
                       {"yaw": 0.0}, {"width": w, "depth": d, "height": h})


def _footprint(place, item: SceneObject):
    w, d = item.dimensions["width"], item.dimensions["depth"]
    if place.yaw % 180:
        w, d = d, w
    return (place.x - w / 2, place.y - d / 2, place.x + w / 2, place.y + d / 2)


def _overlap(a, b) -> float:
    return max(0.0, min(a[2], b[2]) - max(a[0], b[0])) * max(0.0, min(a[3], b[3]) - max(a[1], b[1]))


@pytest.fixture(scope="module")
def bedroom():
    items = [_obj("bed", "bed", 1.85, 2.05, 1.10), _obj("ns1", "nightstand", 0.45, 0.42, 0.55),
             _obj("ns2", "nightstand", 0.45, 0.42, 0.55), _obj("wr", "wardrobe", 1.80, 0.60, 2.10),
             _obj("rug", "rug", 1.60, 2.20, 0.02)]
    place, report = SpatialSolver(backend=None, seed=7, iterations=500).solve_room(ROOM, items, [DOOR, WINDOW])
    assert report.feasible
    return place, {i.object_id: i for i in items}


def test_nightstands_stand_either_side_of_the_bed(bedroom):
    place, items = bedroom
    bed, a, b = place["bed"], place["ns1"], place["ns2"]
    across_x = (a.x - bed.x) * (b.x - bed.x)
    across_y = (a.y - bed.y) * (b.y - bed.y)
    assert across_x < 0 or across_y < 0, "both nightstands ended up on the same side"
    for ns in (a, b):
        assert max(abs(ns.x - bed.x), abs(ns.y - bed.y)) < 1.9, "a nightstand drifted away from the bed"


def test_the_rug_lies_under_the_bed(bedroom):
    place, _ = bedroom
    bed, rug = place["bed"], place["rug"]
    assert max(abs(rug.x - bed.x), abs(rug.y - bed.y)) < 0.9


def test_the_bed_does_not_stand_across_the_window(bedroom):
    place, items = bedroom
    window_band = (1.2, 3.05 - 0.15, 2.6, 3.05 + 0.15)
    assert _overlap(_footprint(place["bed"], items["bed"]), window_band) < 0.10


def test_the_way_in_stays_clear(bedroom):
    place, items = bedroom
    landing = (0.4 - 0.15, 0.0, 1.3 + 0.15, 0.75)
    for key in ("bed", "ns1", "ns2", "wr"):
        assert _overlap(_footprint(place[key], items[key]), landing) < 0.15, f"{key} blocks the door"


def test_the_bed_centres_on_its_wall_so_both_nightstands_fit(bedroom):
    place, _ = bedroom
    bed = place["bed"]
    # The bed faces along x here, so it should sit near the middle of the y span.
    across = bed.y if bed.yaw in (90.0, 270.0) else bed.x
    middle = 3.05 / 2 if bed.yaw in (90.0, 270.0) else 3.6 / 2
    assert abs(across - middle) < 0.45
