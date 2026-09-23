"""Split a brochure sheet that shows several flats into one image per flat.

Builders often send one picture holding two or four layouts — "UG 101 / UG 102",
a 2×2 grid of variants, or a floor plate with the same flat mirrored. Reading
such a sheet as a single home produces nonsense, so the upload is cut first and
the customer picks their flat.

Two cuts are used, in this order:

* **gutters** — a sheet with separate drawings has bands of blank paper running
  right across it. Recursively cutting on those bands (an XY-cut) separates
  drawings that do not touch.
* **mirror line** — a floor plate prints the same flat twice, back to back, with
  no blank band between them. That is found by testing whether one half of the
  panel is the mirror image of the other.

Both work on the ink mask, so colour brochures and line drawings behave alike.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
from PIL import Image

# A panel is only worth keeping if it could hold a flat.
MIN_AREA_FRACTION = 0.06        # of the whole sheet
MIN_SIDE_FRACTION = 0.18        # of the sheet's width / height
GUTTER_FRACTION = 0.035         # a blank band this wide separates drawings
INK_IN_GUTTER = 0.012           # a band is blank when under 1.2% of it is ink
MAX_PANELS = 8
MIRROR_MATCH = 0.45             # grey correlation: real mirrored plates score 0.5-0.95,
                                # the two halves of one flat stay under 0.3
PARTY_WALL = 0.55               # two flats back to back share a wall along the mirror line
WORK_SIZE = 900


@dataclass
class Panel:
    """A flat found on the sheet, as fractions of the original image."""
    box: tuple[float, float, float, float]      # x0, y0, x1, y1
    source: str                                 # "whole" | "gutter" | "mirror"

    def crop(self, img: Image.Image) -> Image.Image:
        w, h = img.size
        x0, y0, x1, y1 = self.box
        return img.crop((round(x0 * w), round(y0 * h), round(x1 * w), round(y1 * h)))


def _masks(img: Image.Image) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """(ink, lines, grey): anything drawn, the dark line work, and the grey image.

    Panels are separated on the line work rather than on ink, because brochure
    cards sit on tinted backgrounds that would otherwise fill the gutters.
    """
    small = img.convert("RGB")
    scale = WORK_SIZE / max(small.size)
    if scale < 1:
        small = small.resize((max(1, round(small.width * scale)), max(1, round(small.height * scale))),
                             Image.BILINEAR)
    arr = np.asarray(small, dtype=np.int16)
    # The paper is whatever colour the sheet's border mostly is.
    border = np.concatenate([arr[0], arr[-1], arr[:, 0], arr[:, -1]])
    paper = np.median(border, axis=0)
    ink = np.abs(arr - paper).sum(axis=2) > 40
    grey = np.asarray(small.convert("L"), dtype=np.float32)
    return ink, grey < 190, grey


def _ink_mask(img: Image.Image) -> np.ndarray:
    return _masks(img)[0]


def _blank_runs(profile: np.ndarray, min_run: int) -> list[tuple[int, int]]:
    """Runs of near-empty columns (or rows) at least min_run long."""
    blank = profile <= INK_IN_GUTTER
    runs, start = [], None
    for i, b in enumerate(blank):
        if b and start is None:
            start = i
        elif not b and start is not None:
            if i - start >= min_run:
                runs.append((start, i))
            start = None
    if start is not None and len(blank) - start >= min_run:
        runs.append((start, len(blank)))
    return runs


def _trim(mask: np.ndarray) -> Optional[tuple[int, int, int, int]]:
    """Tight box around the ink inside a region."""
    rows = np.where(mask.any(axis=1))[0]
    cols = np.where(mask.any(axis=0))[0]
    if not len(rows) or not len(cols):
        return None
    return int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1


def _cut(mask: np.ndarray, box: tuple[int, int, int, int], depth: int) -> list[tuple[int, int, int, int]]:
    """Recursively split a region on blank bands that cross it completely."""
    x0, y0, x1, y1 = box
    region = mask[y0:y1, x0:x1]
    if depth >= 3 or region.size == 0:
        return [box]
    height, width = region.shape
    for axis in (1, 0):                      # vertical bands first, then horizontal
        profile = region.mean(axis=axis)
        length = width if axis == 0 else height
        min_run = max(6, round(GUTTER_FRACTION * length))
        runs = [r for r in _blank_runs(profile, min_run) if r[0] > 0 and r[1] < len(profile)]
        if not runs:
            continue
        pieces, cursor = [], 0
        for a, b in runs:
            pieces.append((cursor, a))
            cursor = b
        pieces.append((cursor, len(profile)))
        pieces = [(a, b) for a, b in pieces if b - a > 0]
        if len(pieces) < 2:
            continue
        out: list[tuple[int, int, int, int]] = []
        for a, b in pieces:
            sub = (x0, y0 + a, x1, y0 + b) if axis == 1 else (x0 + a, y0, x0 + b, y1)
            tight = _trim(mask[sub[1]:sub[3], sub[0]:sub[2]])
            if tight is None:
                continue
            tx0, ty0, tx1, ty1 = tight
            out.extend(_cut(mask, (sub[0] + tx0, sub[1] + ty0, sub[0] + tx1, sub[1] + ty1), depth + 1))
        return out or [box]
    return [box]


def _party_wall(lines: np.ndarray, box: tuple[int, int, int, int], axis: str) -> float:
    """How much of the mirror line is drawn as wall: two flats back to back share one."""
    x0, y0, x1, y1 = box
    region = lines[y0:y1, x0:x1]
    h, w = region.shape
    if axis == "h":
        band = region[max(0, h // 2 - 2):h // 2 + 3, :]
    else:
        band = region[:, max(0, w // 2 - 2):w // 2 + 3]
    return float(band.mean()) if band.size else 0.0


def _mirror_split(ink: np.ndarray, grey: np.ndarray, lines: np.ndarray,
                  box: tuple[int, int, int, int]) -> Optional[list[tuple[int, int, int, int]]]:
    """A floor plate prints one flat twice, back to back: split on the mirror line.

    The two halves of the *drawing* are compared grey level by grey level, over
    the pixels either half has drawn on. Two prints of the same flat correlate
    far higher than the two halves of a single flat.
    """
    x0, y0, x1, y1 = box
    region, tone = ink[y0:y1, x0:x1], grey[y0:y1, x0:x1]
    h, w = region.shape
    if h < 40 or w < 40:
        return None
    best = None
    for axis in ("h", "v"):
        half = (h if axis == "h" else w) // 2
        if half < 20:
            continue
        if axis == "h":
            a, b = tone[:half], tone[h - half:][::-1]
            ma, mb = region[:half], region[h - half:][::-1]
        else:
            a, b = tone[:, :half], tone[:, w - half:][:, ::-1]
            ma, mb = region[:, :half], region[:, w - half:][:, ::-1]
        drawn = ma | mb
        if drawn.sum() < 200:
            continue
        p, q = a[drawn], b[drawn]
        if p.std() < 1 or q.std() < 1:
            continue
        score = float(np.corrcoef(p, q)[0, 1])
        if score < MIRROR_MATCH or _party_wall(lines, box, axis) < PARTY_WALL:
            continue
        if best is None or score > best[0]:
            best = (score, axis)
    if best is None:
        return None
    return _halves(box, best[1])


def _halves(box: tuple[int, int, int, int], axis: str) -> list[tuple[int, int, int, int]]:
    x0, y0, x1, y1 = box
    if axis == "h":
        mid = y0 + (y1 - y0) // 2
        return [(x0, y0, x1, mid), (x0, mid, x1, y1)]
    mid = x0 + (x1 - x0) // 2
    return [(x0, y0, mid, y1), (mid, y0, x1, y1)]


def split_sheet(img: Image.Image) -> list[Panel]:
    """Flats printed on one sheet. A single-plan sheet returns one whole panel."""
    mask, lines, grey = _masks(img)
    h, w = mask.shape
    whole = _trim(mask) or (0, 0, w, h)
    boxes = _cut(lines, whole, 0)

    keep = []
    for box in boxes:
        bx0, by0, bx1, by1 = box
        if (bx1 - bx0) * (by1 - by0) < MIN_AREA_FRACTION * w * h:
            continue
        if (bx1 - bx0) < MIN_SIDE_FRACTION * w or (by1 - by0) < MIN_SIDE_FRACTION * h:
            continue
        keep.append(box)
    if not keep:
        keep = [whole]

    # Each panel may still be a floor plate holding the same flat twice.
    split: list[tuple[tuple[int, int, int, int], str]] = []
    for box in keep:
        # Only a sheet that gutters could not divide is tested for a mirror line.
        halves = _mirror_split(mask, grey, lines, box) if len(keep) == 1 else None
        if halves:
            split.extend((half, "mirror") for half in halves)
        else:
            split.append((box, "gutter" if len(keep) > 1 else "whole"))

    if len(split) > MAX_PANELS:
        split = sorted(split, key=lambda s: -(s[0][2] - s[0][0]) * (s[0][3] - s[0][1]))[:MAX_PANELS]
    panels = [Panel((b[0] / w, b[1] / h, b[2] / w, b[3] / h), kind) for b, kind in split]
    panels.sort(key=lambda p: (round(p.box[1], 2), p.box[0]))       # reading order
    return panels
