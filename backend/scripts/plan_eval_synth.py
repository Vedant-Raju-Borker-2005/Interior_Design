"""Score the floor-plan reader on the synthetic plans, room by room.

Synthetic plans have exact room boxes, so this is stricter than the real-plan
score: a room counts as found only if a detected box overlaps it by IoU >= 0.5,
and its area is compared with the true geometry, not a printed label.

    cd backend
    .venv\\Scripts\\python scripts\\plan_eval_synth.py --split val
    .venv\\Scripts\\python scripts\\plan_eval_synth.py --split train --limit 150 --tag tuned

OCR output is cached in plan_dataset/ocr_cache/, keyed by the pixels read, so
repeated runs while tuning only redo the geometry.
Runs are saved to plan_dataset/synthetic/runs/<tag>.json.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import statistics
import sys
import time
from collections import defaultdict
from pathlib import Path

import numpy as np
from PIL import Image

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
DATA = BACKEND / "plan_dataset" / "synthetic"
CACHE = BACKEND / "plan_dataset" / "ocr_cache"

from app.services import plan_layout as PL  # noqa: E402
from app.services import plan_ocr  # noqa: E402

SAME = {
    "master_bedroom": {"master_bedroom", "bedroom"}, "bedroom": {"bedroom", "master_bedroom"},
    "living_room": {"living_room", "dining_area"}, "dining_area": {"dining_area", "living_room"},
    "kitchen": {"kitchen"}, "bathroom": {"bathroom"}, "balcony": {"balcony"},
    "passage": {"passage"}, "study": {"study", "bedroom"}, "pooja_room": {"pooja_room", "passage"},
}


# ───────────────────────────────────────────────────────────── OCR cache ────
_real_read = plan_ocr.read_texts


def _cached_read(img: Image.Image):
    key = hashlib.sha1(np.asarray(img.convert("RGB")).tobytes()).hexdigest()[:20]
    path = CACHE / f"{key}.json"
    if path.exists():
        rows = json.loads(path.read_text(encoding="utf-8"))
        return [plan_ocr.Text(**r) for r in rows]
    texts = _real_read(img)
    CACHE.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps([t.__dict__ for t in texts]), encoding="utf-8")
    return texts


plan_ocr.read_texts = _cached_read


# ────────────────────────────────────────────────────────────── scoring ─────
def iou(a, b) -> float:
    ix = max(0.0, min(a[2], b[2]) - max(a[0], b[0]))
    iy = max(0.0, min(a[3], b[3]) - max(a[1], b[1]))
    inter = ix * iy
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


def _to_crop(box, crop):
    cx0, cy0, cx1, cy1 = crop
    w, h = cx1 - cx0, cy1 - cy0
    return [(box[0] - cx0) / w, (box[1] - cy0) / h, (box[2] - cx0) / w, (box[3] - cy0) / h]


def _metres_per_fraction(rooms) -> tuple[float, float]:
    """How many metres one full image width / height is, from the true geometry."""
    xs = [r["size_m"][0] / (r["box"][2] - r["box"][0]) for r in rooms if r["box"][2] > r["box"][0]]
    ys = [r["size_m"][1] / (r["box"][3] - r["box"][1]) for r in rooms if r["box"][3] > r["box"][1]]
    return statistics.median(xs), statistics.median(ys)


def score(gt: dict) -> dict:
    img = PL.load_plan_image((DATA / "images" / gt["file"]).read_bytes())
    t0 = time.time()
    det = PL.detect_rooms(img, bhk_hint=2)
    seconds = time.time() - t0

    panels = det.get("panels") or []
    flats = gt["flats"]
    all_rooms = [r for f in flats for r in f["rooms"]]
    if panels:
        crop = panels[det["panel"]]["box"]
        flat = max(flats, key=lambda f: iou(f["box"], crop))
        want = [dict(r, box=_to_crop(r["box"], crop)) for r in flat["rooms"]]
        mx, my = _metres_per_fraction(flat["rooms"])
        true_w = mx * (crop[2] - crop[0])
        bhk_want = flat["bhk"]
    else:
        # Nothing was split: the whole sheet was read as one plan.
        flat = flats[0] if len(flats) == 1 else None
        want = all_rooms
        mx, my = _metres_per_fraction(all_rooms)
        true_w = mx
        bhk_want = flats[0]["bhk"] if len(flats) == 1 else None
    want = [r for r in want if not r.get("cut_off")]

    got = det.get("rooms") or []
    width_m = det.get("plan_width_m") or 0.0
    depth_m = det.get("plan_depth_m") or (width_m * img.height / img.width if width_m else 0.0)
    if panels:
        pw = (crop[2] - crop[0]) * img.width
        ph = (crop[3] - crop[1]) * img.height
        depth_m = det.get("plan_depth_m") or (width_m * ph / pw if width_m else 0.0)

    # Greedy one-to-one matching on IoU.
    pairs = sorted(((iou(g["box"], w["box"]), i, j) for i, g in enumerate(got) for j, w in enumerate(want)),
                   reverse=True)
    used_g, used_w, matches = set(), set(), []
    for v, i, j in pairs:
        if v < 0.5:
            break
        if i in used_g or j in used_w:
            continue
        used_g.add(i)
        used_w.add(j)
        matches.append((i, j, v))

    typed = sum(1 for i, j, _ in matches if got[i]["room_type"] in SAME.get(want[j]["type"], {want[j]["type"]}))
    area_errs = []
    for i, j, _ in matches:
        b = got[i]["box"]
        a = (b[2] - b[0]) * width_m * (b[3] - b[1]) * depth_m
        area_errs.append(abs(a - want[j]["area_m2"]) / want[j]["area_m2"])

    return {
        "id": gt["id"], "split": gt["split"], "style": gt["style"], "sheet": gt["sheet"],
        "units": gt["units"], "corruptions": gt.get("corruptions", []), "seconds": round(seconds, 1),
        "rooms_true": len(want), "rooms_found": len(got), "matched": len(matches),
        "recall": len(matches) / len(want) if want else None,
        "precision": len(matches) / len(got) if got else 0.0,
        "type_acc": typed / len(matches) if matches else None,
        "area_err": statistics.median(area_errs) if area_errs else None,
        "scale_err": abs(width_m - true_w) / true_w if true_w and width_m else None,
        "scale_source": det.get("scale_source"),
        "bhk_want": bhk_want, "bhk_got": PL.plan_bhk(got) if got else None,
        "bhk_ok": (PL.plan_bhk(got) == bhk_want) if bhk_want and got else False,
        "panels_want": gt["sub_plans"], "panels_got": max(1, len(panels)),
    }


def summarise(rows: list[dict]) -> dict:
    def mean(key):
        v = [r[key] for r in rows if r.get(key) is not None]
        return round(statistics.mean(v), 3) if v else None

    def median(key):
        v = [r[key] for r in rows if r.get(key) is not None]
        return round(statistics.median(v), 3) if v else None

    return {
        "plans": len(rows),
        "room_recall": mean("recall"), "room_precision": mean("precision"),
        "type_accuracy": mean("type_acc"),
        "area_err_median": median("area_err"), "scale_err_median": median("scale_err"),
        "bhk_correct": round(sum(1 for r in rows if r["bhk_ok"]) / max(1, len(rows)), 3),
        "panels_correct": round(sum(1 for r in rows if r["panels_got"] == r["panels_want"]) / max(1, len(rows)), 3),
        "scale_from_plan": round(sum(1 for r in rows if r["scale_source"]) / max(1, len(rows)), 3),
        "seconds_mean": mean("seconds"),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", choices=["train", "val", "test", "all"], default="val")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--tag", default="latest")
    ap.add_argument("--style")
    args = ap.parse_args()

    gts = json.loads((DATA / "ground_truth.json").read_text(encoding="utf-8"))
    items = [g for g in gts.values() if (args.split == "all" or g["split"] == args.split)
             and (not args.style or g["style"] == args.style)]
    if args.limit:
        items = items[:args.limit]

    # Results are appended as they come, so a run stopped halfway (this laptop
    # has 4 GB) picks up where it left off.
    (DATA / "runs").mkdir(exist_ok=True)
    partial = DATA / "runs" / f"{args.tag}.partial.jsonl"
    done = {}
    if partial.exists():
        for line in partial.read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                done[row["id"]] = row
    rows = [done[g["id"]] for g in items if g["id"] in done]
    todo = [g for g in items if g["id"] not in done]
    if done:
        print(f"resuming: {len(rows)} already scored, {len(todo)} to go")
    t0 = time.time()
    import gc
    for n, g in enumerate(todo, len(rows) + 1):
        try:
            row = score(g)
        except Exception as exc:                         # a crash is a result too
            row = {"id": g["id"], "split": g["split"], "style": g["style"], "sheet": g["sheet"],
                   "units": g["units"], "corruptions": g.get("corruptions", []), "error": repr(exc),
                   "recall": 0.0, "precision": 0.0, "bhk_ok": False, "panels_got": 0,
                   "panels_want": g["sub_plans"], "scale_source": None, "seconds": 0.0}
        rows.append(row)
        with partial.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(row) + "\n")
        gc.collect()
        if n % 10 == 0 or n == len(items):
            s = summarise(rows)
            print(f"  {n}/{len(items)}  recall {s['room_recall']}  type {s['type_accuracy']}  "
                  f"bhk {s['bhk_correct']}  area {s['area_err_median']}  ({time.time() - t0:.0f}s)", flush=True)

    report = {"summary": summarise(rows), "by": {}}
    for key in ("style", "sheet", "units"):
        groups = defaultdict(list)
        for r in rows:
            groups[r[key]].append(r)
        report["by"][key] = {k: summarise(v) for k, v in sorted(groups.items())}
    groups = defaultdict(list)
    for r in rows:
        for c in r.get("corruptions") or ["none"]:
            groups[c].append(r)
    report["by"]["corruption"] = {k: summarise(v) for k, v in sorted(groups.items())}
    report["rows"] = rows

    print("\n" + json.dumps(report["summary"], indent=1))
    for key in ("style", "sheet"):
        print(f"\nby {key}:")
        for k, s in report["by"][key].items():
            print(f"  {k:14} n={s['plans']:3d}  recall {s['room_recall']}  type {s['type_accuracy']}  "
                  f"bhk {s['bhk_correct']}  area {s['area_err_median']}  panels {s['panels_correct']}")
    (DATA / "runs").mkdir(exist_ok=True)
    (DATA / "runs" / f"{args.tag}.json").write_text(json.dumps(report, indent=1), encoding="utf-8")
    print("\nsaved", DATA / "runs" / f"{args.tag}.json")


if __name__ == "__main__":
    main()
