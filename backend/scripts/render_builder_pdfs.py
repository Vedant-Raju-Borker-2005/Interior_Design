"""Turn the builder's PDF drawings into the images the customer sees.

    cd backend
    .venv\\Scripts\\python scripts\\render_builder_pdfs.py

The layout cards and the plan behind the 2D view should show the builder's
actual drawing, not a redrawing of it. Each PDF is rasterised at print
resolution, trimmed to the ink so the sheet's white margin does not shrink the
plan on the card, and saved beside the other floor plans.

The room geometry stays where it is, written out in builder_typologies.py from
the dimensions printed on these same sheets. The drawing is what the customer
recognises; the geometry is what the 3D model is built from.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pymupdf
from PIL import Image, ImageChops

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.services.builder_typologies import ALL  # noqa: E402

# Where the builder's drawings live, beside the repository.
PDF_DIR = BACKEND.parent.parent
OUT_DIR = BACKEND / "assets" / "floor_plans"
DPI = 200                      # readable on a card, still a sensible file size
MARGIN = 18                    # white kept around the ink after trimming
MAX_SIDE = 1800                # a card does not need print resolution


def trim(img: Image.Image) -> Image.Image:
    """Crop the sheet's blank margin away so the plan fills the card."""
    grey = img.convert("L")
    # Anything not near-white counts as drawing.
    mask = grey.point(lambda v: 255 if v < 244 else 0)
    box = mask.getbbox()
    if not box:
        return img
    x0, y0, x1, y1 = box
    return img.crop((max(0, x0 - MARGIN), max(0, y0 - MARGIN),
                     min(img.width, x1 + MARGIN), min(img.height, y1 + MARGIN)))


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    missing, done = [], 0

    for lay in ALL:
        src = PDF_DIR / lay.source
        if not src.exists():
            missing.append(lay.source)
            print(f"  {lay.key:16} MISSING {lay.source}")
            continue

        with pymupdf.open(src) as doc:
            page = doc[0]
            pix = page.get_pixmap(dpi=DPI)
            img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

        before = img.size
        img = trim(img)
        # A white backing, because some sheets are drawn on transparency.
        flat = Image.new("RGB", img.size, "white")
        flat.paste(img, (0, 0))
        if max(flat.size) > MAX_SIDE:
            scale = MAX_SIDE / max(flat.size)
            flat = flat.resize((round(flat.width * scale), round(flat.height * scale)),
                               Image.LANCZOS)
        out = OUT_DIR / f"builder_{lay.key}.png"
        flat.save(out, format="PNG", optimize=True)
        done += 1
        print(f"  {lay.key:16} {before[0]}x{before[1]} -> {flat.width}x{flat.height}  "
              f"{out.stat().st_size // 1024} KB   ({lay.source})")

    print(f"\nrendered {done} of {len(ALL)}")
    if missing:
        print("missing PDFs:", ", ".join(missing))
        print(f"looked in {PDF_DIR}")
        sys.exit(1)


if __name__ == "__main__":
    main()
