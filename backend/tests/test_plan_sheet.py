"""Cutting a brochure sheet that shows more than one flat.

    cd backend
    .venv\\Scripts\\python -m pytest tests/test_plan_sheet.py -q
"""
from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))

from app.services.plan_sheet import split_sheet  # noqa: E402


def _flat(draw: ImageDraw.ImageDraw, x: int, y: int, w: int, h: int, mirrored: bool = False) -> None:
    """A small plan drawn the way brochures are: walls, tinted rooms, a door gap
    and a fitting. The room tints differ so the two halves of one flat do not
    look like mirror images of each other."""
    mid = x + int(w * 0.38)                                      # rooms of unequal size,
    balcony = x + w - int(w * 0.12)                              # balcony along one edge:
    draw.rectangle([x, y, mid, y + h], fill="#EFEAE2")           # a real flat is not symmetric
    draw.rectangle([mid, y, x + w, y + h], fill="#D6DCE4")
    draw.rectangle([balcony, y, x + w, y + h], fill="#CFE0CB")
    draw.rectangle([x, y, x + w, y + h], outline="black", width=5)
    draw.line([mid, y, mid, y + h], fill="black", width=5)
    draw.line([balcony, y, balcony, y + h], fill="black", width=4)
    draw.rectangle([mid - 4, y + h // 3, mid + 4, y + h // 3 + 40], fill="#EFEAE2")   # door gap
    box = [x + 20, y + 20, x + 70, y + 60] if not mirrored else [x + w - 70, y + 20, x + w - 20, y + 60]
    draw.rectangle(box, outline="black", width=3, fill="#BFAE96")


def _sheet(size, panels) -> Image.Image:
    img = Image.new("RGB", size, "white")
    d = ImageDraw.Draw(img)
    for spec in panels:
        _flat(d, *spec)
    return img


def test_one_plan_stays_whole():
    img = _sheet((700, 600), [(80, 60, 520, 460)])
    panels = split_sheet(img)
    assert len(panels) == 1 and panels[0].source == "whole"


def test_two_plans_side_by_side_are_split():
    img = _sheet((1200, 600), [(40, 60, 480, 460), (660, 60, 480, 460)])
    panels = split_sheet(img)
    assert len(panels) == 2, [p.box for p in panels]
    assert all(p.source == "gutter" for p in panels)
    left, right = panels
    assert left.box[2] <= right.box[0]            # they do not overlap


def test_four_variants_on_one_sheet_are_split():
    img = _sheet((1200, 1100), [(40, 40, 460, 420), (660, 40, 460, 420),
                                (40, 600, 460, 420), (660, 600, 460, 420)])
    assert len(split_sheet(img)) == 4


def test_a_floor_plate_mirrored_about_its_centre_is_split():
    # Two prints of one flat, back to back, sharing a party wall — no gutter.
    img = Image.new("RGB", (900, 900), "white")
    _flat(ImageDraw.Draw(img), 60, 20, 780, 420)
    img.paste(img.crop((0, 20, 900, 440)).transpose(Image.FLIP_TOP_BOTTOM), (0, 440))
    panels = split_sheet(img)
    assert len(panels) == 2 and all(p.source == "mirror" for p in panels), [p.box for p in panels]
    assert panels[0].box[3] <= panels[1].box[1] + 0.01        # cut at the party wall


def test_panels_come_back_in_reading_order_and_crop():
    img = _sheet((1200, 1100), [(40, 40, 460, 420), (660, 40, 460, 420),
                                (40, 600, 460, 420), (660, 600, 460, 420)])
    panels = split_sheet(img)
    tops = [p.box[1] for p in panels]
    assert tops == sorted(tops)
    crop = panels[0].crop(img)
    assert crop.width < img.width and crop.height < img.height
