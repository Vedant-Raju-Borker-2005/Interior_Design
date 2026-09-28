"""Turn generated floor-plan sheets into image/mask pairs a segmentation net can train on.

    cd backend
    python scripts/synth_plans.py --count 4000          # draw the sheets first
    python ml/export_dataset.py                          # then make the masks

Each sheet in plan_dataset/synthetic has exact room boxes, so the mask is drawn
rather than guessed: every pixel gets the index of the room type covering it,
0 where there is no room. A sheet holding several flats is exported one flat at
a time, cropped to that flat, because that is what the reader is given at
run time — one flat, never the whole sheet.

Writes to plan_dataset/seg/{train,val,test}/{images,masks}/*.png and a
classes.json naming the channels. Masks are 8-bit PNGs, one byte per pixel.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
from app.services.plan_layout import ROOM_TYPES  # noqa: E402

# Index 0 is "not a room" — the walls, the page, the dimension chains outside.
CLASSES = ["background", *ROOM_TYPES.keys()]
INDEX = {name: i for i, name in enumerate(CLASSES)}

SYNTH = BACKEND / "plan_dataset" / "synthetic"
OUT = BACKEND / "plan_dataset" / "seg"
# Room boxes touch at the wall centreline, so a mask drawn from them has no gap
# between rooms. Pulling each box in by this fraction leaves the wall unlabelled,
# which is what lets the net learn where one room stops and the next starts.
INSET = 0.008


def _flat_crop(image: Image.Image, flat: dict, pad: float = 0.012):
    """The part of the sheet holding one flat, and that flat's boxes within it."""
    W, H = image.size
    x0, y0, x1, y1 = flat["box"]
    x0, y0 = max(0.0, x0 - pad), max(0.0, y0 - pad)
    x1, y1 = min(1.0, x1 + pad), min(1.0, y1 + pad)
    px = (round(x0 * W), round(y0 * H), round(x1 * W), round(y1 * H))
    if px[2] - px[0] < 32 or px[3] - px[1] < 32:
        return None, None
    crop = image.crop(px)
    cw, ch = crop.size
    boxes = []
    for room in flat["rooms"]:
        bx0, by0, bx1, by1 = room["box"]
        # back to pixels on the sheet, then into the crop's own frame
        rx0 = (bx0 * W - px[0]) / cw
        ry0 = (by0 * H - px[1]) / ch
        rx1 = (bx1 * W - px[0]) / cw
        ry1 = (by1 * H - px[1]) / ch
        boxes.append((room.get("type"), room.get("kind"), rx0, ry0, rx1, ry1))
    return crop, boxes


def _mask(size: tuple[int, int], boxes) -> Image.Image:
    w, h = size
    mask = Image.new("L", (w, h), INDEX["background"])
    draw = ImageDraw.Draw(mask)
    # Smallest last, so a bathroom inside a suite is not painted over by it.
    for rtype, _kind, x0, y0, x1, y1 in sorted(
            boxes, key=lambda b: -abs((b[4] - b[2]) * (b[5] - b[3]))):
        idx = INDEX.get(rtype)
        if idx is None:
            continue
        ix0, iy0 = (x0 + INSET) * w, (y0 + INSET) * h
        ix1, iy1 = (x1 - INSET) * w, (y1 - INSET) * h
        if ix1 - ix0 < 2 or iy1 - iy0 < 2:
            continue
        draw.rectangle([ix0, iy0, ix1, iy1], fill=idx)
    return mask


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--synthetic", default=str(SYNTH), help="folder holding images/ and ground_truth.json")
    ap.add_argument("--out", default=str(OUT))
    ap.add_argument("--size", type=int, default=512, help="longest side of the exported image")
    args = ap.parse_args()

    synth, out = Path(args.synthetic), Path(args.out)
    gt_path = synth / "ground_truth.json"
    if not gt_path.exists():
        sys.exit(f"{gt_path} not found — run scripts/synth_plans.py first")
    records = json.loads(gt_path.read_text(encoding="utf-8"))

    for split in ("train", "val", "test"):
        for kind in ("images", "masks"):
            (out / split / kind).mkdir(parents=True, exist_ok=True)

    counts = {"train": 0, "val": 0, "test": 0}
    for sid, rec in sorted(records.items()):
        split = rec.get("split", "train")
        path = synth / "images" / rec["file"]
        if not path.exists():
            continue
        sheet = Image.open(path).convert("RGB")
        for n, flat in enumerate(rec.get("flats") or []):
            crop, boxes = _flat_crop(sheet, flat)
            if crop is None:
                continue
            mask = _mask(crop.size, boxes)
            # One resize for both, nearest for the mask so class indices survive.
            scale = args.size / max(crop.size)
            wh = (max(1, round(crop.size[0] * scale)), max(1, round(crop.size[1] * scale)))
            crop = crop.resize(wh, Image.BILINEAR)
            mask = mask.resize(wh, Image.NEAREST)
            if np.asarray(mask).max() == 0:
                continue                       # nothing labelled; not worth training on
            name = f"{sid}_{n}.png"
            crop.save(out / split / "images" / name)
            mask.save(out / split / "masks" / name)
            counts[split] += 1

    (out / "classes.json").write_text(json.dumps(CLASSES, indent=1), encoding="utf-8")
    print("exported:", counts)
    print("classes :", len(CLASSES), CLASSES)


if __name__ == "__main__":
    main()
