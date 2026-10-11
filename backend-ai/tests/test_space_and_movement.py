"""Two pieces never share a space, and a room is always one you can move in.

    cd backend-ai
    python -m pytest tests/test_space_and_movement.py -q

The first half is about height: a wall cabinet above a worktop and a rug under
a sofa share floor on the plan and share nothing in the room, while a planter
inside a media console shares both. The second half is about the floor as a
whole, which no pairwise rule can see -- a sideboard in the one gap past the
dining table leaves half the room cut off and breaks no clearance at all.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from ids.scene import Opening, Room, Scene, SceneObject, validate  # noqa: E402
from ids.solver import (SpatialSolver, collide, needs_access,  # noqa: E402
                        occupies_floor, rule_for)
from ids.walk import Piece, walk_report  # noqa: E402


def _obj(item_id, category, pos, dims, yaw=0.0):
    x, z = pos
    w, d, h = dims
    return SceneObject(item_id, "r1", category,
                       {"x": x, "y": rule_for(category).mount, "z": z},
                       {"yaw": yaw}, {"width": w, "depth": d, "height": h})


# ───────────────────────────────────────────── sharing space, in three axes ──
def test_a_wall_cabinet_may_hang_over_the_worktop():
    assert rule_for("wall_cabinets").mount > 0.9
    assert not collide("counter_run", 0.9, "wall_cabinets", 0.72)


def test_a_rug_may_lie_under_the_sofa():
    assert not collide("sofa", 0.8, "rug", 0.02)


def test_a_planter_may_not_stand_inside_the_media_console():
    assert collide("media_console", 0.5, "planter", 1.1)


def test_a_floor_lamp_may_not_stand_through_a_wall_cabinet():
    assert collide("floor_lamp", 1.62, "wall_cabinets", 0.72)


def test_only_what_stands_on_the_floor_spends_the_floor():
    assert occupies_floor("counter_run", 0.9)
    assert not occupies_floor("wall_cabinets", 0.72)   # it hangs
    assert not occupies_floor("rug", 0.02)             # it is walked over


def test_the_validator_reports_two_pieces_in_one_place():
    room = Room("r1", "Living Room", (0.0, 0.0, 4.0, 3.0))
    scene = Scene(rooms=[room], openings=[], objects=[
        _obj("console", "media_console", (1.6, 0.4), (1.8, 0.45, 0.5)),
        _obj("plant", "planter", (1.6, 0.4), (0.42, 0.42, 1.1)),
    ])
    assert any(v.kind == "overlap" for v in validate(scene))


def test_the_validator_passes_a_cabinet_above_its_worktop():
    room = Room("r1", "Kitchen", (0.0, 0.0, 3.0, 2.4))
    scene = Scene(rooms=[room], openings=[
        Opening("d1", "r1", (2.2, 2.4), (3.0, 2.4), True),
    ], objects=[
        _obj("counter", "counter_run", (1.3, 0.35), (2.6, 0.62, 0.9)),
        _obj("uppers", "wall_cabinets", (1.3, 0.21), (2.2, 0.34, 0.72)),
    ])
    assert [v for v in validate(scene) if v.kind == "overlap"] == []


# ──────────────────────────────────────────────── somewhere left to walk ────
OPEN_ROOM = (0.0, 0.0, 4.0, 3.0)


def test_an_arranged_room_is_walkable():
    report = walk_report(OPEN_ROOM, [Piece("sofa", (0.2, 0.2, 2.4, 1.1))],
                         [("d1", 3.6, 0.0)])
    assert report.walkable, report.reason
    assert report.open_m2 > 6.0


def test_furniture_across_the_only_doorway_is_a_fault():
    report = walk_report(OPEN_ROOM, [
        Piece("wardrobe", (1.2, 0.0, 2.8, 0.6)),
        Piece("bed", (0.2, 1.2, 2.2, 3.0)),
    ], [("d1", 2.0, 0.0)])
    assert not report.walkable
    assert report.sealed == ["d1"]
    assert report.blame[0] == "wardrobe"       # the bed is not what is in the way


def test_a_room_cut_in_two_is_a_fault():
    report = walk_report((0.0, 0.0, 4.0, 4.0),
                         [Piece("sideboard", (0.0, 1.8, 3.7, 2.3))],
                         [("d1", 2.0, 0.0)])
    assert not report.walkable
    assert report.cutoff_m2 > 1.2
    assert report.blame == ["sideboard"]


def test_a_rug_and_a_wall_cabinet_are_not_in_the_way():
    report = walk_report(OPEN_ROOM, [
        Piece("rug", (0.5, 0.5, 3.5, 2.5), blocks_floor=False),
        Piece("wall_cabinets", (1.0, 0.0, 3.2, 0.35), blocks_floor=False),
    ], [("d1", 2.0, 0.0)])
    assert report.walkable, report.reason


def test_a_galley_kitchen_keeps_its_lane():
    report = walk_report((0.0, 0.0, 3.0, 2.4), [
        Piece("counter_run", (0.0, 0.0, 2.6, 0.62), access=(0.0, 0.62, 2.6, 1.57)),
        Piece("fridge", (2.4, 1.7, 3.0, 2.4), access=(2.4, 1.0, 3.0, 1.7)),
    ], [("d1", 0.4, 2.4)])
    assert report.walkable, report.reason


def test_the_same_kitchen_overloaded_is_rejected():
    report = walk_report((0.0, 0.0, 3.0, 2.4), [
        Piece("counter_run", (0.0, 0.0, 2.6, 0.62), access=(0.0, 0.62, 2.6, 1.57)),
        Piece("dining_set", (0.1, 0.7, 2.8, 2.3), access=(0.1, 2.3, 2.8, 2.4)),
    ], [("d1", 0.4, 2.4)])
    assert not report.walkable
    assert report.blame[0] == "dining_set"


def test_a_shower_room_too_small_for_a_lane_still_passes():
    # A 3 m2 bathroom cannot offer a 0.55 m corridor and does not need to.
    report = walk_report((0.0, 0.0, 1.5, 2.0), [
        Piece("wc", (1.0, 0.1, 1.45, 0.75), access=(0.4, 0.1, 1.0, 0.75)),
        Piece("vanity", (0.0, 1.4, 0.9, 1.95), access=(0.0, 0.85, 0.9, 1.4)),
    ], [("d1", 0.3, 0.0)])
    assert report.walkable, report.reason


def test_a_piece_reached_across_its_partner_is_not_stranded():
    # A nightstand asks for 0.35 m, which is a reach and not a walkway, so it
    # is not held to having floor of its own in front of it.
    assert needs_access("bed")
    assert not needs_access("nightstand")
    assert not needs_access("floor_lamp")


def test_a_piece_is_only_blamed_when_moving_it_would_help():
    """Blame has to earn itself, or a tight room gets stripped to the walls.

    Each name in `blame` is a piece the room measurably improves without. The
    caller drops the least important of them and asks again, so a room where
    nothing would help keeps what it has instead of emptying one piece at a
    time.
    """
    pieces = [
        Piece("wardrobe", (1.2, 0.0, 2.8, 0.6)),
        Piece("bed", (0.2, 1.2, 2.2, 3.0)),
        Piece("lamp", (3.7, 2.7, 3.95, 2.95)),
    ]
    report = walk_report(OPEN_ROOM, pieces, [("d1", 2.0, 0.0)])
    assert not report.walkable
    for blamed in report.blame:
        rest = [p for p in pieces if p.piece_id != blamed]
        better = walk_report(OPEN_ROOM, rest, [("d1", 2.0, 0.0)])
        assert (better.walkable
                or len(better.sealed) < len(report.sealed)
                or better.cutoff_m2 < report.cutoff_m2), blamed
    # The lamp in the far corner is in nobody's way, so it is not named.
    assert "lamp" not in report.blame


# ────────────────────────────────────────── the two rules, through the solver ─
def test_the_solver_leaves_a_lane_through_a_small_kitchen():
    room = Room("r1", "Kitchen", (0.0, 0.0, 3.0, 2.4))
    door = Opening("d1", "r1", (0.0, 2.4), (0.9, 2.4), True)
    objects = [
        _obj("counter", "counter_run", (1.3, 0.35), (2.6, 0.62, 0.9)),
        _obj("uppers", "wall_cabinets", (1.3, 0.2), (2.2, 0.34, 0.72)),
        _obj("fridge", "fridge", (2.7, 2.0), (0.7, 0.7, 1.8)),
    ]
    place, _ = SpatialSolver(seed=7, iterations=400).solve_room(room, objects, [door])
    for o in objects:
        spot = place[o.object_id]
        o.position = {"x": spot.x, "y": rule_for(o.category).mount, "z": spot.y}
        o.rotation = {"yaw": spot.yaw}
    faults = validate(Scene(rooms=[room], openings=[door], objects=objects))
    assert [str(v) for v in faults] == []


@pytest.mark.parametrize("category,mount", [
    ("wall_cabinets", 1.40),
    ("counter_run", 0.0),
    ("bed", 0.0),
])
def test_a_mounted_piece_ships_at_its_mounted_height(category, mount):
    assert rule_for(category).mount == pytest.approx(mount)
