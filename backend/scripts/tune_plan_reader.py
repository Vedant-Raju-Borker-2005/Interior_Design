"""Fit the plan reader's thresholds (plan_layout.TUNING) on labelled plans.

Coordinate descent: each threshold in turn is nudged down and up, and a change
is kept only if it raises the combined score on the *training* plans — a
stratified sample of the synthetic train split plus the real train plans.
Validation and test plans, synthetic and real, are never looked at here.

    cd backend
    .venv\\Scripts\\python scripts\\tune_plan_reader.py --per-style 8 --rounds 2

Writes plan_dataset/tuning.json. OCR is cached, so a trial costs geometry only.
"""
from __future__ import annotations

import argparse
import json
import random
import statistics
import sys
import time
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "scripts"))
sys.path.insert(0, str(BACKEND))

import plan_eval_synth as ES  # noqa: E402  (installs the OCR cache)
import plan_eval as ER  # noqa: E402
from app.services import plan_layout as PL  # noqa: E402

# How far each threshold may move from where it started.
BOUNDS = {
    "dark_lum": (80.0, 160.0), "dark_sat": (40.0, 110.0), "blob_span": (0.03, 0.16),
    "blob_mass": (0.0005, 0.006), "door_m": (1.1, 2.2), "wide_m": (2.0, 4.0),
    "min_room_m2": (0.4, 1.8), "sliver_walls": (0.8, 3.0),
}


def synth_value(r: dict) -> float:
    p, rc = r.get("precision") or 0.0, r.get("recall") or 0.0
    f1 = 2 * p * rc / (p + rc) if p + rc else 0.0
    area = r.get("area_err")
    return (0.35 * f1 + 0.25 * (r.get("type_acc") or 0.0) + 0.20 * (1.0 if r.get("bhk_ok") else 0.0)
            + 0.20 * (1.0 - min(area if area is not None else 1.0, 1.0)))


def real_value(r: dict) -> float:
    if "error" in r:
        return 0.0
    area = r.get("area_err")
    recall = r.get("type_recall")
    return (0.40 * (recall if recall is not None else 0.5) + 0.40 * (1.0 if r.get("bhk_ok") else 0.0)
            + 0.20 * (1.0 - min(area if area is not None else 0.5, 1.0)))


def objective(synth: list[dict], real: list[tuple[str, dict]]) -> tuple[float, dict]:
    s_vals = []
    for g in synth:
        try:
            s_vals.append(synth_value(ES.score(g)))
        except Exception:
            s_vals.append(0.0)
    r_vals = []
    for pid, g in real:
        try:
            r_vals.append(real_value(ER.score_plan(pid, g)))
        except Exception:
            r_vals.append(0.0)
    s = statistics.mean(s_vals) if s_vals else 0.0
    r = statistics.mean(r_vals) if r_vals else 0.0
    # Real plans are what customers upload: they count for half.
    return 0.5 * s + 0.5 * r, {"synthetic": round(s, 4), "real": round(r, 4)}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--per-style", type=int, default=8, help="synthetic train plans per drawing style")
    ap.add_argument("--rounds", type=int, default=2)
    ap.add_argument("--steps", default="0.85,1.15", help="multipliers tried for each threshold")
    ap.add_argument("--seed", type=int, default=5)
    args = ap.parse_args()

    syn_gt = json.loads((ES.DATA / "ground_truth.json").read_text(encoding="utf-8"))
    by_style: dict[str, list[dict]] = {}
    for g in syn_gt.values():
        if g["split"] == "train":
            by_style.setdefault(g["style"], []).append(g)
    rng = random.Random(args.seed)
    synth = [g for items in by_style.values() for g in rng.sample(items, min(args.per_style, len(items)))]
    real_gt = json.loads((ER.DATA / "ground_truth.json").read_text(encoding="utf-8"))
    real = [(pid, g) for pid, g in real_gt.items() if g["split"] == "train"]
    print(f"tuning on {len(synth)} synthetic + {len(real)} real training plans")

    start = dict(PL.TUNING)
    t0 = time.time()
    best, parts = objective(synth, real)
    print(f"start  score {best:.4f} {parts}  ({time.time() - t0:.0f}s per trial)", flush=True)
    history = [{"params": dict(PL.TUNING), "score": best, **parts}]
    steps = [float(x) for x in args.steps.split(",")]

    for rnd in range(args.rounds):
        improved = False
        for key in list(PL.TUNING):
            lo, hi = BOUNDS[key]
            here = PL.TUNING[key]
            for mult in steps:
                trial = min(hi, max(lo, here * mult))
                if abs(trial - here) < 1e-9:
                    continue
                PL.TUNING[key] = trial
                PL._VARIANT_CACHE.clear()
                score, parts = objective(synth, real)
                print(f"  round {rnd + 1}  {key:13} {here:.4g} -> {trial:.4g}: {score:.4f} {parts}", flush=True)
                if score > best + 1e-4:
                    best, here, improved = score, trial, True
                    history.append({"params": dict(PL.TUNING), "score": best, **parts})
                    print(f"    kept {key} = {trial:.4g}", flush=True)
                PL.TUNING[key] = here
        if not improved:
            break
        steps = [1 + (m - 1) / 2 for m in steps]          # finer steps next round

    out = {"start": start, "best": dict(PL.TUNING), "score_start": history[0]["score"], "score_best": best,
           "trained_on": {"synthetic": [g["id"] for g in synth], "real": [pid for pid, _ in real]},
           "history": history}
    (BACKEND / "plan_dataset" / "tuning.json").write_text(json.dumps(out, indent=1), encoding="utf-8")
    print(f"\nscore {history[0]['score']:.4f} -> {best:.4f}")
    for k in start:
        if abs(start[k] - PL.TUNING[k]) > 1e-9:
            print(f"  {k}: {start[k]:.4g} -> {PL.TUNING[k]:.4g}")
    print("saved plan_dataset/tuning.json")


if __name__ == "__main__":
    main()
