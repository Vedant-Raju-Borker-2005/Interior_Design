"""Score the floor-plan reader against plan_dataset/ground_truth.json.

    cd backend
    .venv\\Scripts\\python scripts\\plan_eval.py                 # every plan
    .venv\\Scripts\\python scripts\\plan_eval.py --split test     # held-out only
    .venv\\Scripts\\python scripts\\plan_eval.py --tag before     # save as a named run

Metrics per plan:
  bhk_ok        the BHK the reader infers matches the drawing
  type_recall   share of the rooms printed on the drawing whose type was found
  area_err      median |detected area - printed area| / printed area, over matched rooms
  scale_err     |detected total floor area - printed total| / printed total (when printed)
Runs are written to plan_dataset/runs/<tag>.json so two runs can be compared.
"""
from __future__ import annotations

import argparse
import json
import statistics
import sys
import time
import traceback
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
DATA = BACKEND / "plan_dataset"

from app.services import plan_layout as PL  # noqa: E402

# A detected type counts as the printed one when it means the same room.
SAME = {
    "master_bedroom": {"master_bedroom", "bedroom"},
    "bedroom": {"bedroom", "master_bedroom"},
    "living_room": {"living_room", "dining_area"},
    "dining_area": {"dining_area", "living_room"},
    "kitchen": {"kitchen"}, "bathroom": {"bathroom"}, "balcony": {"balcony"},
    "passage": {"passage", "foyer"}, "foyer": {"foyer", "passage"},
    "utility": {"utility", "storage"}, "storage": {"storage", "utility"},
    "study": {"study", "bedroom"},
}


def score_plan(pid: str, gt: dict) -> dict:
    img = PL.load_plan_image((DATA / "images" / gt["file"]).read_bytes())
    t0 = time.time()
    try:
        det = PL.detect_rooms(img, bhk_hint=2)
    except Exception as exc:
        return {"id": pid, "error": f"{type(exc).__name__}: {exc}",
                "trace": traceback.format_exc(limit=3), "seconds": round(time.time() - t0, 1)}
    seconds = round(time.time() - t0, 1)
    rooms = det.get("rooms", [])
    width_m = det.get("plan_width_m") or 0
    depth_m = det.get("plan_depth_m") or (width_m * img.height / img.width if width_m else 0)

    # Detected areas in m², from the fraction of the sheet each room covers.
    detected = []
    for r in rooms:
        x0, y0, x1, y1 = r["box"]
        detected.append({"type": r.get("room_type"), "label": r.get("label"),
                         "area": round(abs(x1 - x0) * width_m * abs(y1 - y0) * depth_m, 2)})

    printed = [r for r in gt["rooms"] if r.get("area_m2")]
    used, errors, matched = set(), [], 0
    for want in printed:
        best, best_err = None, 1e9
        for i, got in enumerate(detected):
            if i in used or got["type"] not in SAME.get(want["type"], {want["type"]}):
                continue
            err = abs(got["area"] - want["area_m2"]) / want["area_m2"]
            if err < best_err:
                best, best_err = i, err
        if best is not None:
            used.add(best)
            matched += 1
            errors.append(best_err)

    gt_types = [r["type"] for r in gt["rooms"]]
    found_types = [d["type"] for d in detected]
    pool = list(found_types)
    hits = 0
    for t in gt_types:
        for i, f in enumerate(pool):
            if f in SAME.get(t, {t}):
                pool.pop(i)
                hits += 1
                break

    total_area = sum(d["area"] for d in detected)
    scale_err = None
    if gt.get("printed_total_area_m2"):
        scale_err = round(abs(total_area - gt["printed_total_area_m2"]) / gt["printed_total_area_m2"], 3)

    # Colour plans print an area in each room but no names: score the sizes
    # themselves, biggest to smallest, against what is printed.
    size_err = None
    printed_areas = sorted(gt.get("areas_without_names_m2") or [], reverse=True)
    if len(printed_areas) >= 3:
        mine = sorted((d["area"] for d in detected), reverse=True)[:len(printed_areas)]
        if mine:
            pairs = list(zip(printed_areas, mine))
            size_err = round(statistics.median(abs(m - w) / w for w, m in pairs), 3)

    # A sheet of several flats is read one flat at a time, so the room list
    # cannot be compared with the whole sheet's.
    one_of_many = gt.get("sub_plans", 1) > 1

    return {
        "id": pid, "split": gt["split"], "style": gt["style"], "seconds": seconds,
        "bhk_want": gt["bhk"], "bhk_got": PL.plan_bhk(rooms), "bhk_ok": PL.plan_bhk(rooms) == gt["bhk"],
        "rooms_want": len(gt_types), "rooms_got": len(detected),
        "one_of_many_flats": one_of_many,
        "type_recall": None if one_of_many or not gt_types else round(hits / len(gt_types), 3),
        "size_err": size_err,
        "areas_matched": f"{matched}/{len(printed)}" if printed else "-",
        "area_err": round(statistics.median(errors), 3) if errors else None,
        "scale_err": scale_err, "plan_width_m": round(width_m, 2),
        "scale_source": det.get("scale_source"), "method": det.get("method"),
        "notes": det.get("notes", [])[:3],
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", choices=["train", "test", "all"], default="all")
    ap.add_argument("--tag", default="latest")
    ap.add_argument("--only", help="comma-separated plan ids")
    args = ap.parse_args()

    gts = json.loads((DATA / "ground_truth.json").read_text(encoding="utf-8"))
    ids = [p for p, g in gts.items()
           if (args.split == "all" or g["split"] == args.split)
           and (not args.only or p in args.only.split(","))]

    rows = []
    print(f"{'plan':9} {'split':6} {'style':18} {'bhk':>14} {'rooms':>9} {'recall':>7} {'area err':>9} {'sec':>5}")
    for pid in ids:
        row = score_plan(pid, gts[pid])
        rows.append(row)
        if "error" in row:
            print(f"{pid:9} FAILED  {row['error'][:60]}")
            continue
        bhk = f"{row['bhk_got']}/{row['bhk_want']}"
        rooms = f"{row['rooms_got']}/{row['rooms_want']}"
        recall = "-" if row["type_recall"] is None else f"{row['type_recall']:.2f}"
        area = "-" if row["area_err"] is None else format(row["area_err"], ".0%")
        print(f"{pid:9} {row['split']:6} {row['style'][:18]:18} {bhk:>14} {rooms:>9} "
              f"{recall:>7} {area:>9} {row['seconds']:>5}", flush=True)

    ok = [r for r in rows if "error" not in r]
    recalls = [r["type_recall"] for r in ok if r["type_recall"] is not None]
    errs = [r["area_err"] for r in ok if r["area_err"] is not None]
    sizes = [r["size_err"] for r in ok if r.get("size_err") is not None]
    summary = {
        "plans": len(rows), "failed": len(rows) - len(ok),
        "bhk_correct": f"{sum(1 for r in ok if r['bhk_ok'])}/{len(ok)}",
        "type_recall_mean": round(statistics.mean(recalls), 3) if recalls else None,
        "area_err_median": round(statistics.median(errs), 3) if errs else None,
        "size_err_median": round(statistics.median(sizes), 3) if sizes else None,
        "seconds_mean": round(statistics.mean([r["seconds"] for r in ok]), 1) if ok else None,
    }
    print("\n" + json.dumps(summary, indent=1))
    (DATA / "runs").mkdir(exist_ok=True)
    (DATA / "runs" / f"{args.tag}.json").write_text(
        json.dumps({"summary": summary, "rows": rows}, indent=1), encoding="utf-8")
    print("saved", DATA / "runs" / f"{args.tag}.json")


if __name__ == "__main__":
    main()
