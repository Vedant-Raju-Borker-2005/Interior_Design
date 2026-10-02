"""Re-solve the furniture positions baked into the 3D viewer.

    cd backend-ai
    ..\\backend\\.venv\\Scripts\\python scripts\\resolve_baked_variants.py --check
    ..\\backend\\.venv\\Scripts\\python scripts\\resolve_baked_variants.py

A project with a confirmed floor plan has its rooms arranged live, so
improvements to the solver reach it immediately. A project without one falls
back to window.__VARIANTS__ — positions worked out once and frozen into
frontend/index.html — which no amount of solver work will touch. That is the
view most people see first, and it is where the television ends up facing the
wrong way.

This runs those frozen scenes back through the current solver. Only each
object's position and rotation change; which objects a room holds, their
models, colours and finishes are left exactly as they are.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ENGINE = HERE.parent
sys.path.insert(0, str(ENGINE))

from ids.scene import Opening, Room, Scene, SceneObject, validate  # noqa: E402
from ids.solver import SpatialSolver, SweepBackend  # noqa: E402

VIEWER = ENGINE / "frontend" / "index.html"
MARKER = "window.__VARIANTS__ = "
DOOR_KINDS = {"door", "balcony_door", "entrance"}


def scene_from_baked(raw: dict) -> Scene:
    """The baked JSON predates Scene.from_dict's shape, so build it by hand."""
    rooms = [Room(r["room_id"], r.get("label") or r["room_id"], tuple(r["rect"]))
             for r in raw.get("rooms") or []]
    openings = [
        Opening(o["opening_id"], o["room_id"], tuple(o["p0"]), tuple(o["p1"]),
                o.get("kind") in DOOR_KINDS)
        for o in raw.get("openings") or []
    ]
    objects = [
        SceneObject(o["object_id"], o["room_id"], o["category"],
                    dict(o["position"]), dict(o["rotation"]), dict(o["dimensions"]))
        for o in raw.get("objects") or []
    ]
    return Scene(rooms=rooms, openings=openings, objects=objects)


# Which pieces each arrangement leaves out. Varying the contents is what makes
# one layout genuinely different from another rather than the same furniture
# nudged a few centimetres.
LOOSE = ("planter", "floor_lamp", "armchair", "bench", "side_table", "console_table")
SEATING = ("armchair", "bench", "side_table")
STRATEGIES = (("Balanced", 7, ()), ("Open", 23, LOOSE), ("Storage", 41, SEATING))
ESSENTIAL = {"master_bedroom": ("bed", "wardrobe"), "bedroom": ("bed", "wardrobe"),
             "living_room": ("sofa",), "dining_area": ("dining_set",),
             "kitchen": ("counter_run",), "bathroom": ("wc",), "study": ("desk",)}


NOTICEABLE_M = 0.25
NOTICEABLE_COUNT = 2


def _worth_offering(candidate, existing) -> bool:
    """Is this arrangement different enough from one already on offer?"""
    def by_category(objects):
        out = {}
        for o in objects:
            out.setdefault(o["category"], []).append(o)
        return out

    mine, theirs = by_category(candidate), by_category(existing)
    if set(mine) != set(theirs) or any(len(mine[c]) != len(theirs[c]) for c in mine):
        return True
    moved = 0
    for category, items in mine.items():
        for a, b in zip(items, theirs[category]):
            if abs(float(a["rotation"]["yaw"]) - float(b["rotation"]["yaw"])) >= 45:
                moved += 1
                continue
            if math.hypot(a["position"]["x"] - b["position"]["x"],
                          a["position"]["z"] - b["position"]["z"]) >= NOTICEABLE_M:
                moved += 1
    return moved >= NOTICEABLE_COUNT


def arrangements_for_room(room_raw, objects, openings, solver_seeds=STRATEGIES):
    """Two or three ways to arrange one baked room, best effort, deduplicated."""
    from ids.solver import SpatialSolver, SweepBackend, rule_for

    x0, y0, w, d = room_raw["rect"]
    if w * d < 5.0 or len(objects) < 3:
        return []                       # no room to rearrange anything
    rtype = room_raw.get("room_type") or ""
    must = ESSENTIAL.get(rtype, ())
    s_room = Room(room_raw["room_id"], room_raw.get("label") or "", (x0, y0, w, d))
    mine = [o for o in openings if o.room_id == room_raw["room_id"]]

    out, seen = [], set()
    for index, (name, seed, omit) in enumerate(solver_seeds):
        chosen = [o for o in objects
                  if o["category"] not in omit or o["category"] in must]
        if len(chosen) < 2:
            continue
        solver = SpatialSolver(backend=SweepBackend(), seed=seed,
                               iterations=500 if index == 0 else 220)
        prefix = "" if index == 0 else f"L{index}__"
        s_objs = [SceneObject(f"{prefix}{o['object_id']}", o["room_id"], o["category"],
                              dict(o["position"]), dict(o["rotation"]), dict(o["dimensions"]))
                  for o in chosen]
        place, _ = solver.solve_room(s_room, s_objs, mine)
        built = []
        for o, so in zip(chosen, s_objs):
            spot = place.get(so.object_id)
            if spot is None:
                continue
            copy_o = json.loads(json.dumps(o))
            copy_o["object_id"] = so.object_id
            copy_o["position"] = {"x": round(spot.x, 3), "y": 0.0, "z": round(spot.y, 3)}
            copy_o["rotation"] = {"yaw": round(float(spot.yaw), 1)}
            built.append(copy_o)
        if not built:
            continue
        trial = Scene(rooms=[s_room], openings=mine, objects=[
            SceneObject(o["object_id"], o["room_id"], o["category"], o["position"],
                        o["rotation"], o["dimensions"]) for o in built])
        if validate(trial):
            continue
        # An arrangement that turns out to be the one already on screen makes
        # the control look broken, so it has to be visibly different from the
        # others before it is worth offering.
        if any(not _worth_offering(built, kept["objects"]) for kept in out):
            continue
        out.append({"name": name, "objects": built})
    return out if len(out) > 1 else []


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="report only, write nothing")
    ap.add_argument("--iterations", type=int, default=900)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--viewer", default=str(VIEWER))
    ap.add_argument("--layouts", action="store_true",
                    help="also bake two or three arrangements per room")
    args = ap.parse_args()

    path = Path(args.viewer)
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines(keepends=True)
    index = next((i for i, l in enumerate(lines) if l.startswith(MARKER)), None)
    if index is None:
        sys.exit(f"{MARKER.strip()} not found in {path}")
    variants = json.loads(lines[index][len(MARKER):].rstrip().rstrip("\n").rstrip(";"))

    solver = SpatialSolver(backend=SweepBackend(), seed=args.seed, iterations=args.iterations)
    before_bad = after_bad = moved = 0

    print(f"{'variant':22}{'objects':>8}{'before':>9}{'after':>8}{'moved':>8}{'choices':>8}")
    for key, variant in variants.items():
        raw = variant.get("scene") or {}
        if not raw.get("objects"):
            continue
        scene = scene_from_baked(raw)
        was = len(validate(scene))
        solved, _reports = solver.solve_scene(scene)
        now = len(validate(solved))

        placed = {o.object_id: o for o in solved.objects}
        changed = 0
        for o in raw["objects"]:
            p = placed.get(o["object_id"])
            if p is None:
                continue
            new_pos = {"x": round(p.position["x"], 3), "y": round(p.position.get("y", 0.0), 3),
                       "z": round(p.position["z"], 3)}
            new_rot = {"yaw": round(float(p.rotation["yaw"]), 1)}
            if new_pos != o["position"] or new_rot != o["rotation"]:
                changed += 1
            o["position"], o["rotation"] = new_pos, new_rot

        if args.layouts:
            # The viewer offers these behind the arrows on a room's chip. The
            # first is what is already in scene["objects"], so only the others
            # add anything; a room with nothing to offer is left out entirely.
            per_room, openings = {}, scene.openings
            for room_raw in raw.get("rooms") or []:
                mine = [o for o in raw["objects"] if o["room_id"] == room_raw["room_id"]]
                alts = arrangements_for_room(room_raw, mine, openings)
                if alts:
                    per_room[room_raw["room_id"]] = alts
            if per_room:
                raw["layouts"] = per_room

        before_bad += was
        after_bad += now
        moved += changed
        choices = len(raw.get("layouts") or {})
        print(f"  {key:20}{len(raw['objects']):8d}{was:9d}{now:8d}{changed:8d}{choices:8d}")

    print(f"\nviolations {before_bad} -> {after_bad}, {moved} pieces moved")
    if after_bad > before_bad:
        sys.exit("the re-solve made things worse; nothing written")
    if args.check:
        print("--check: nothing written")
        return

    lines[index] = MARKER + json.dumps(variants, separators=(",", ":")) + ";\n"
    path.write_text("".join(lines), encoding="utf-8")
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
