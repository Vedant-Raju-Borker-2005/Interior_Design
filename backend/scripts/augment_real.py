"""Damaged copies of the real training plans — the WhatsApp effects, applied again.

Only plans in the *train* split are copied, so nothing leaks into the real test
set. What a plan says (its BHK, its rooms, their printed sizes) does not change
under JPEG, blur, stretch or a mirror flip, so each copy keeps the original's
ground truth.

    cd backend
    .venv\\Scripts\\python scripts\\augment_real.py --copies 5
"""
from __future__ import annotations

import argparse
import copy
import json
import random
import sys
from pathlib import Path

from PIL import Image

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND / "scripts"))
from synth_plans import damage  # noqa: E402

DATA = BACKEND / "plan_dataset"
OUT = DATA / "augmented"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--copies", type=int, default=5)
    ap.add_argument("--seed", type=int, default=3)
    args = ap.parse_args()

    real = json.loads((DATA / "ground_truth.json").read_text(encoding="utf-8"))
    (OUT / "images").mkdir(parents=True, exist_ok=True)
    rng = random.Random(args.seed)
    out = {}
    for pid, g in real.items():
        if g["split"] != "train":
            continue
        src = Image.open(DATA / "images" / g["file"]).convert("RGB")
        for k in range(args.copies):
            local = random.Random(rng.randint(0, 2**31))
            # damage() edits room boxes; real plans have none, so it gets a stub
            stub = {"flats": []}
            img = damage(src.copy(), stub, local)
            aid = f"{pid}_aug{k}"
            rec = copy.deepcopy(g)
            rec.update(file=f"{aid}.jpg", split="train", source=pid,
                       corruptions=stub["corruptions"], augmented=True)
            img.save(OUT / "images" / rec["file"], quality=stub["jpeg_quality"])
            out[aid] = rec
    (OUT / "ground_truth.json").write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"wrote {len(out)} augmented copies of {len({r['source'] for r in out.values()})} training plans to {OUT}")


if __name__ == "__main__":
    main()
