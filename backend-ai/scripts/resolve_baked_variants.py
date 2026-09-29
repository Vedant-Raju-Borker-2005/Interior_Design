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


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--check", action="store_true", help="report only, write nothing")
    ap.add_argument("--iterations", type=int, default=900)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--viewer", default=str(VIEWER))
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

    print(f"{'variant':22}{'objects':>8}{'before':>9}{'after':>8}{'moved':>8}")
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

        before_bad += was
        after_bad += now
        moved += changed
        print(f"  {key:20}{len(raw['objects']):8d}{was:9d}{now:8d}{changed:8d}")

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
