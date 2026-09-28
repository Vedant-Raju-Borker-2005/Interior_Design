"""Synthetic floor-plan sheets with exact ground truth.

Every plan is drawn from a generated apartment, so each room's box, type and
area are known exactly. The mix deliberately reproduces what real brochure
plans do to a reader — the outliers as much as the common cases:

* styles: warm brochure fills, colour-coded plans that print only an area,
  black-and-white line drawings, single- and double-line CAD exports, grey
  fills, numbered rooms with a legend, furnished renders;
* labels: metres, millimetres, feet-inches (with and without dashes), m²,
  dual-unit, abbreviations (M.TOI, C.TOI, W.C, KIT.), mixed case;
* sheets: one flat, two side by side, a 2x2 grid of variants, a mirrored
  floor plate sharing a party wall, two stacked;
* clutter: furniture, door swings, window symbols, dimension chains outside
  the plan, titles, area statements, north arrows, watermarks, phone
  screenshot icons;
* damage: JPEG, blur, noise, low resolution, stretch, slight rotation,
  cropping, colour cast, and whole-sheet mirror flips.

    cd backend
    .venv\\Scripts\\python scripts\\synth_plans.py --count 600 --seed 7

Writes plan_dataset/synthetic/images/*.jpg and plan_dataset/synthetic/ground_truth.json.
Deterministic for a given seed, so the data need not be committed.
"""
from __future__ import annotations

import argparse
import json
import math
import random
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont, ImageOps

BACKEND = Path(__file__).resolve().parents[1]
OUT = BACKEND / "plan_dataset" / "synthetic"
FONT_DIR = Path(r"C:\Windows\Fonts")
FONTS = [f for f in ("arial.ttf", "arialbd.ttf", "segoeui.ttf", "segoeuib.ttf", "calibri.ttf", "calibrib.ttf",
                     "tahoma.ttf", "tahomabd.ttf", "verdana.ttf", "trebuc.ttf", "bahnschrift.ttf", "corbel.ttf",
                     "times.ttf", "consola.ttf", "framd.ttf", "Candara.ttf")
         if (FONT_DIR / f).exists()]

EXT_WALL, INT_WALL = 0.23, 0.115        # 9-inch and 4.5-inch brick, as built in India

# ──────────────────────────────────────────────────────────── programme ─────
# (min, max) carpet area in m² for each kind of space on Indian apartment plans.
SIZES = {
    "living_room": (11.0, 24.0), "dining_area": (6.0, 11.0), "kitchen": (4.5, 9.5),
    "master_bedroom": (11.0, 17.5), "bedroom": (8.5, 13.5), "bathroom": (2.4, 4.8),
    "passage": (2.0, 5.5), "utility": (1.6, 3.6), "foyer": (2.0, 4.5), "study": (5.0, 8.0),
    "pooja_room": (1.2, 2.4),
}
PRODUCT_TYPE = {"utility": "passage", "foyer": "passage"}      # what the app calls them

NAMES = {
    "living_room": ["LIVING", "LIVING ROOM", "Living", "Living Room", "DRAWING ROOM", "DRG. ROOM", "HALL",
                    "LIVING/DINING", "Living / Dining", "LIVING + DINING"],
    "dining_area": ["DINING", "Dining", "DINING AREA"],
    "kitchen": ["KITCHEN", "Kitchen", "KIT.", "KITCHEN"],
    "master_bedroom": ["MASTER BEDROOM", "M.BEDROOM", "Master Bedroom", "MASTER BED ROOM", "M. BED ROOM"],
    "bedroom": ["BEDROOM", "BED ROOM", "Bedroom", "BEDROOM-{n}", "BED ROOM {n}", "Bedroom {n}", "CHILDREN BEDROOM"],
    "bathroom": ["TOILET", "Toilet", "W.C.", "W.C/BATH", "BATH", "M.TOI", "C.TOI", "TOILET-{n}", "M.TOILET",
                 "BATHROOM"],
    "passage": ["PASSAGE", "Passage", "CORRIDOR", "Corridor"],
    "utility": ["UTILITY", "Utility", "WASH", "DRY BALCONY", "UTILITY AREA"],
    "foyer": ["FOYER", "Foyer", "ENTRANCE FOYER", "LOBBY"],
    "study": ["STUDY", "Study", "HOME OFFICE"],
    "pooja_room": ["POOJA", "POOJA ROOM", "Pooja"],
    "balcony": ["BALCONY", "Balcony", "BALC.", "SIT OUT", "SITOUT", "DECK", "BALCONY"],
}


@dataclass
class Space:
    kind: str                 # key of SIZES, or "balcony"
    name: str
    x0: float
    y0: float
    x1: float
    y1: float
    host: Optional[int] = None          # a balcony's room, a bath's bedroom

    @property
    def w(self) -> float:
        return self.x1 - self.x0

    @property
    def d(self) -> float:
        return self.y1 - self.y0

    @property
    def area(self) -> float:
        return self.w * self.d

    @property
    def product_type(self) -> str:
        return "balcony" if self.kind == "balcony" else PRODUCT_TYPE.get(self.kind, self.kind)


@dataclass
class Opening:
    kind: str                 # door | entrance | slider | window | open
    horizontal: bool          # the wall runs along x
    at: float                 # the wall line (y for horizontal, x for vertical)
    a: float                  # span along the wall
    b: float
    swing_into: Optional[int] = None


@dataclass
class Flat:
    bhk: int
    spaces: list[Space]
    openings: list[Opening] = field(default_factory=list)

    @property
    def bounds(self) -> tuple[float, float, float, float]:
        return (min(s.x0 for s in self.spaces), min(s.y0 for s in self.spaces),
                max(s.x1 for s in self.spaces), max(s.y1 for s in self.spaces))


def _programme(rng: random.Random, bhk: int) -> tuple[list[dict], list[dict]]:
    """The rooms of one flat, split into a private (sleeping) and a public zone."""
    def room(kind, n=0):
        lo, hi = SIZES[kind]
        name = rng.choice(NAMES[kind]).format(n=n or rng.randint(1, 3))
        return {"kind": kind, "name": name, "area": rng.uniform(lo, hi)}

    private: list[dict] = []
    baths = {1: 1, 2: 2, 3: rng.choice([2, 3]), 4: rng.choice([3, 4])}[bhk]
    for i in range(bhk):
        private.append(room("master_bedroom" if i == 0 else "bedroom", i + 1))
        if baths > 0 and (i == 0 or rng.random() < 0.55):      # attached bath beside its bedroom
            bath = room("bathroom", i + 1)
            bath["attached"] = len(private) - 1
            private.append(bath)
            baths -= 1
    while baths > 0:
        private.append(room("bathroom", 2))
        baths -= 1
    if bhk >= 2 and rng.random() < 0.6:
        private.insert(0, room("passage"))
    if bhk >= 2 and rng.random() < 0.10:
        private.append(room("study"))

    public: list[dict] = []
    if rng.random() < 0.3:
        public.append(room("foyer"))
    public.append(room("living_room"))
    if rng.random() < 0.35 or bhk >= 3:
        public.append(room("dining_area"))
    public.append(room("kitchen"))
    if rng.random() < 0.4:
        public.append(room("utility"))
    if rng.random() < 0.08:
        public.append(room("pooja_room"))
    return private, public


def _partition(items: list[dict], rect: tuple[float, float, float, float], out: list[tuple[dict, tuple]]) -> None:
    """Binary slicing layout: split the list where the areas balance, cut the
    rectangle across its longer side in that proportion, and recurse. Keeping
    the list order keeps an attached bath next to its bedroom."""
    if len(items) == 1:
        out.append((items[0], rect))
        return
    total = sum(i["area"] for i in items)
    run, cut = 0.0, 1
    best = None
    for k in range(1, len(items)):
        run += items[k - 1]["area"]
        diff = abs(run - total / 2)
        if best is None or diff < best:
            best, cut = diff, k
    left, right = items[:cut], items[cut:]
    share = sum(i["area"] for i in left) / total
    x0, y0, x1, y1 = rect
    if (x1 - x0) >= (y1 - y0):
        xm = x0 + (x1 - x0) * share
        _partition(left, (x0, y0, xm, y1), out)
        _partition(right, (xm, y0, x1, y1), out)
    else:
        ym = y0 + (y1 - y0) * share
        _partition(left, (x0, y0, x1, ym), out)
        _partition(right, (x0, ym, x1, y1), out)


def _snap(v: float) -> float:
    return round(v / 0.05) * 0.05


def _badness(spaces: list[Space]) -> int:
    """How many rooms have a shape nobody would build."""
    bad = 0
    for s in spaces:
        short, long_ = min(s.w, s.d), max(s.w, s.d)
        small = s.kind in ("passage", "utility", "pooja_room", "bathroom", "foyer")
        limit = 6.0 if s.kind == "passage" else 3.2
        if short < (0.9 if small else 1.6) or long_ / max(short, 1e-6) > limit:
            bad += 1
    return bad


def make_flat(rng: random.Random, bhk: int) -> Flat:
    best: Optional[list[Space]] = None
    for _ in range(60):                    # redraw, keeping the most livable layout
        private, public = _programme(rng, bhk)
        a_priv = sum(r["area"] for r in private)
        a_pub = sum(r["area"] for r in public)
        total = a_priv + a_pub
        aspect = rng.uniform(0.72, 1.5)
        W = math.sqrt(total * aspect)
        D = total / W
        placed: list[tuple[dict, tuple]] = []
        if W >= D:                          # zones side by side
            xm = W * a_priv / total
            first, second = ((private, (0, 0, xm, D)), (public, (xm, 0, W, D))) if rng.random() < 0.5 \
                else ((public, (0, 0, W - xm, D)), (private, (W - xm, 0, W, D)))
        else:                               # zones one above the other
            ym = D * a_priv / total
            first, second = ((private, (0, 0, W, ym)), (public, (0, ym, W, D))) if rng.random() < 0.5 \
                else ((public, (0, 0, W, D - ym)), (private, (0, D - ym, W, D)))
        _partition(first[0], first[1], placed)
        _partition(second[0], second[1], placed)
        spaces = [Space(spec["kind"], spec["name"], _snap(x0), _snap(y0), _snap(x1), _snap(y1))
                  for spec, (x0, y0, x1, y1) in placed]
        if best is None or _badness(spaces) < _badness(best):
            best = spaces
        if _badness(best) == 0:
            break
    flat = Flat(bhk, best)
    _add_balconies(rng, flat)
    _add_openings(rng, flat)
    return flat


def _add_balconies(rng: random.Random, flat: Flat) -> None:
    count = rng.choice([0, 1, 1, 2]) if flat.bhk >= 2 else rng.choice([0, 1])
    bx0, by0, bx1, by1 = flat.bounds
    hosts = [i for i, s in enumerate(flat.spaces) if s.kind in ("living_room", "master_bedroom", "bedroom")]
    rng.shuffle(hosts)
    used_sides = set()
    for i in hosts:
        if count <= 0:
            break
        s = flat.spaces[i]
        sides = [side for side, on in (("top", abs(s.y0 - by0) < 1e-6), ("bottom", abs(s.y1 - by1) < 1e-6),
                                       ("left", abs(s.x0 - bx0) < 1e-6), ("right", abs(s.x1 - bx1) < 1e-6))
                 if on and side not in used_sides]
        if not sides:
            continue
        side = rng.choice(sides)
        depth = _snap(rng.uniform(1.2, 1.8))
        if side in ("top", "bottom"):
            span = s.w * rng.uniform(0.7, 1.0)
            a = _snap(s.x0 + (s.w - span) * rng.random())
            b = _snap(a + span)
            y0, y1 = (s.y0 - depth, s.y0) if side == "top" else (s.y1, s.y1 + depth)
            box = (a, y0, b, y1)
        else:
            span = s.d * rng.uniform(0.7, 1.0)
            a = _snap(s.y0 + (s.d - span) * rng.random())
            b = _snap(a + span)
            x0, x1 = (s.x0 - depth, s.x0) if side == "left" else (s.x1, s.x1 + depth)
            box = (x0, a, x1, b)
        flat.spaces.append(Space("balcony", rng.choice(NAMES["balcony"]), *box, host=i))
        used_sides.add(side)
        count -= 1
    # Shift everything so the drawing starts at (0, 0).
    bx0, by0, _, _ = flat.bounds
    for s in flat.spaces:
        s.x0, s.x1, s.y0, s.y1 = s.x0 - bx0, s.x1 - bx0, s.y0 - by0, s.y1 - by0


def _shared(a: Space, b: Space) -> Optional[tuple[bool, float, float, float]]:
    """The wall two spaces share: (horizontal, line, start, end), or None."""
    eps = 1e-6
    if abs(a.y1 - b.y0) < eps or abs(b.y1 - a.y0) < eps:
        line = a.y1 if abs(a.y1 - b.y0) < eps else a.y0
        lo, hi = max(a.x0, b.x0), min(a.x1, b.x1)
        if hi - lo > 0.8:
            return True, line, lo, hi
    if abs(a.x1 - b.x0) < eps or abs(b.x1 - a.x0) < eps:
        line = a.x1 if abs(a.x1 - b.x0) < eps else a.x0
        lo, hi = max(a.y0, b.y0), min(a.y1, b.y1)
        if hi - lo > 0.8:
            return False, line, lo, hi
    return None


def _add_openings(rng: random.Random, flat: Flat) -> None:
    sp = flat.spaces
    idx = {i: s for i, s in enumerate(sp)}

    def connect(i: int, targets: tuple[str, ...], kind: str = "door", width=(0.75, 0.9)) -> bool:
        for want in targets:
            for j, other in idx.items():
                if j == i or other.kind != want:
                    continue
                wall = _shared(sp[i], other)
                if not wall:
                    continue
                horizontal, line, lo, hi = wall
                w = min(rng.uniform(*width), hi - lo - 0.3)
                if w < 0.6:
                    continue
                a = _snap(lo + 0.15 + (hi - lo - 0.3 - w) * rng.random())
                flat.openings.append(Opening(kind, horizontal, line, a, a + w, swing_into=i))
                return True
        return False

    for i, s in idx.items():
        if s.kind in ("master_bedroom", "bedroom", "study"):
            connect(i, ("passage", "living_room", "dining_area", "foyer", "bedroom", "master_bedroom"))
        elif s.kind == "bathroom":
            connect(i, ("master_bedroom", "bedroom", "passage", "living_room", "dining_area", "foyer"),
                    width=(0.7, 0.78))
        elif s.kind == "kitchen":
            connect(i, ("dining_area", "living_room", "foyer", "passage"), width=(0.8, 1.0))
        elif s.kind == "utility":
            connect(i, ("kitchen", "dining_area", "passage"), width=(0.7, 0.8))
        elif s.kind == "passage":
            connect(i, ("living_room", "dining_area", "foyer"), kind="open", width=(1.0, 1.4))
        elif s.kind == "dining_area":
            connect(i, ("living_room",), kind="open", width=(1.4, 2.4))
        elif s.kind == "foyer":
            connect(i, ("living_room",), kind="open", width=(1.0, 1.4))
        elif s.kind == "pooja_room":
            connect(i, ("living_room", "dining_area", "passage"), width=(0.6, 0.75))
        elif s.kind == "balcony" and s.host is not None:
            wall = _shared(s, sp[s.host])
            if wall:
                horizontal, line, lo, hi = wall
                w = min(rng.uniform(1.2, 2.1), hi - lo - 0.2)
                a = _snap(lo + (hi - lo - w) / 2)
                flat.openings.append(Opening("slider", horizontal, line, a, a + w))

    # Main door on the outside of the foyer or living room.
    bx0, by0, bx1, by1 = flat.bounds
    for kind in ("foyer", "living_room"):
        cand = [i for i, s in idx.items() if s.kind == kind]
        if not cand:
            continue
        s = sp[cand[0]]
        options = [(True, s.y0, s.x0, s.x1) if abs(s.y0 - by0) < 1e-6 else None,
                   (True, s.y1, s.x0, s.x1) if abs(s.y1 - by1) < 1e-6 else None,
                   (False, s.x0, s.y0, s.y1) if abs(s.x0 - bx0) < 1e-6 else None,
                   (False, s.x1, s.y0, s.y1) if abs(s.x1 - bx1) < 1e-6 else None]
        options = [o for o in options if o and o[3] - o[2] > 1.4]
        if options:
            horizontal, line, lo, hi = rng.choice(options)
            w = rng.uniform(0.95, 1.1)
            a = _snap(lo + 0.2 + (hi - lo - 0.4 - w) * rng.random())
            flat.openings.append(Opening("entrance", horizontal, line, a, a + w, swing_into=cand[0]))
            break

    # Windows on outside walls that no balcony covers.
    for i, s in idx.items():
        if s.kind not in ("master_bedroom", "bedroom", "living_room", "kitchen", "bathroom", "dining_area", "study"):
            continue
        for horizontal, line, lo, hi, outside in (
                (True, s.y0, s.x0, s.x1, abs(s.y0 - by0) < 1e-6), (True, s.y1, s.x0, s.x1, abs(s.y1 - by1) < 1e-6),
                (False, s.x0, s.y0, s.y1, abs(s.x0 - bx0) < 1e-6), (False, s.x1, s.y0, s.y1, abs(s.x1 - bx1) < 1e-6)):
            if not outside or rng.random() < 0.25:
                continue
            if any(o.horizontal == horizontal and abs(o.at - line) < 1e-6 and o.a < hi and o.b > lo
                   for o in flat.openings):
                continue
            size = {"bathroom": (0.5, 0.7), "kitchen": (0.9, 1.3)}.get(s.kind, (1.0, 1.9))
            w = min(rng.uniform(*size), hi - lo - 0.4)
            if w < 0.45:
                continue
            a = _snap(lo + (hi - lo - w) / 2 + rng.uniform(-0.2, 0.2))
            flat.openings.append(Opening("window", horizontal, line, a, a + w))


def mirror_flat(flat: Flat, axis: str) -> Flat:
    """The same flat reflected — how floor plates print the unit next door."""
    bx0, by0, bx1, by1 = flat.bounds
    spaces, openings = [], []
    for s in flat.spaces:
        if axis == "x":
            spaces.append(Space(s.kind, s.name, bx1 - s.x1, s.y0, bx1 - s.x0, s.y1, s.host))
        else:
            spaces.append(Space(s.kind, s.name, s.x0, by1 - s.y1, s.x1, by1 - s.y0, s.host))
    for o in flat.openings:
        if axis == "x":
            if o.horizontal:
                openings.append(Opening(o.kind, True, o.at, bx1 - o.b, bx1 - o.a, o.swing_into))
            else:
                openings.append(Opening(o.kind, False, bx1 - o.at, o.a, o.b, o.swing_into))
        else:
            if o.horizontal:
                openings.append(Opening(o.kind, True, by1 - o.at, o.a, o.b, o.swing_into))
            else:
                openings.append(Opening(o.kind, False, o.at, by1 - o.b, by1 - o.a, o.swing_into))
    return Flat(flat.bhk, spaces, openings)


# ───────────────────────────────────────────────────────────── labels ───────
def _ftin(m: float) -> tuple[int, int]:
    inches = round(m / 0.0254)
    return inches // 12, inches % 12


def fmt_size(rng: random.Random, w: float, d: float, units: str) -> list[str]:
    """How a room's size is printed. Returns one or two lines."""
    a, b = (w, d) if rng.random() < 0.5 else (d, w)
    if rng.random() < 0.25:                      # brochures round and fudge their numbers
        a *= rng.uniform(0.97, 1.03)
        b *= rng.uniform(0.97, 1.03)
    sep = rng.choice([" X ", "X", " x ", "x", " × ", "*"])
    if units == "m":
        return [f"{a:.2f}{sep}{b:.2f}"]
    if units == "m_suffix":
        return [f"{a:.2f}M{sep.strip() or 'x'}{b:.2f}M"]
    if units == "mm":
        return [f"{round(a * 100) * 10}{sep}{round(b * 100) * 10}"]
    if units in ("ftin", "ftin_dash"):
        (fa, ia), (fb, ib) = _ftin(a), _ftin(b)
        if units == "ftin":
            return [f"{fa}'{ia}\"{sep}{fb}'{ib}\""]
        return [f"{fa}'-{ia}\"{sep}{fb}'-{ib}\""]
    if units == "dual":
        (fa, ia), (fb, ib) = _ftin(a), _ftin(b)
        return [f"{a:.2f}M x {b:.2f}M", f"{fa}'{ia}\"x{fb}'{ib}\""]
    if units == "area":
        return [f"{a * b:.2f}{rng.choice(['m2', ' m2', ' sq.m', 'm²'])}"]
    return []


# ─────────────────────────────────────────────────────────────── styles ─────
STYLES = ["brochure", "area_colour", "line_bw", "cad_single", "cad_double", "grey_fill", "numbered", "furnished"]
STYLE_WEIGHTS = [0.20, 0.14, 0.14, 0.10, 0.08, 0.12, 0.06, 0.16]


def _jitter(rng: random.Random, hex_: str, amount: int = 14) -> tuple[int, int, int]:
    r, g, b = (int(hex_[i:i + 2], 16) for i in (1, 3, 5))
    return tuple(max(0, min(255, c + rng.randint(-amount, amount))) for c in (r, g, b))


def palette(rng: random.Random, style: str) -> dict:
    if style == "area_colour":
        base = {"living_room": "#FFF27A", "dining_area": "#FFF27A", "kitchen": "#7FE3F0", "bedroom": "#F7B77A",
                "master_bedroom": "#F7B77A", "bathroom": "#7EB6F2", "balcony": "#C8C8C8", "passage": "#FFF27A",
                "utility": "#7FE3F0", "foyer": "#FFF27A", "study": "#F7B77A", "pooja_room": "#F7B77A"}
        wall = "#4A4A4A"
    elif style == "grey_fill":
        base = {k: "#BDBDBD" for k in SIZES} | {"living_room": "#8E8E8E", "dining_area": "#8E8E8E",
                                                "balcony": "#9DB89A", "bathroom": "#A9C2CC", "utility": "#A9C2CC"}
        wall = "#1E1E1E"
    elif style in ("brochure", "furnished", "numbered"):
        base = {"living_room": "#F2E3C9", "dining_area": "#F2E3C9", "kitchen": "#DCE5E8", "bedroom": "#EBD9C1",
                "master_bedroom": "#E8D2B5", "bathroom": "#CFE2EA", "balcony": "#DADDCB", "passage": "#F4EDE0",
                "utility": "#DCE5E8", "foyer": "#F4EDE0", "study": "#EBD9C1", "pooja_room": "#F3E0C0"}
        wall = rng.choice(["#2B2B2B", "#3A3530", "#222222", "#4A4038"])
    else:                                   # line drawings and CAD exports: white floors
        base = {k: "#FFFFFF" for k in SIZES} | {"balcony": "#FFFFFF"}
        wall = {"line_bw": "#111111", "cad_single": rng.choice(["#1E88C8", "#16A0B8", "#2A6FB5"]),
                "cad_double": rng.choice(["#222222", "#B83227", "#1E5FA8"])}[style]
    fills = {k: _jitter(rng, v, 10 if style != "area_colour" else 6) for k, v in base.items()}
    paper = _jitter(rng, rng.choice(["#FFFFFF", "#FFFFFF", "#FAF7F2", "#F1EFEA", "#E9E6E1"]), 4)
    if style == "area_colour":
        paper = _jitter(rng, rng.choice(["#9A9A9A", "#B5B5B5", "#FFFFFF"]), 6)
    return {"fills": fills, "wall": _jitter(rng, wall, 8), "paper": paper}


# ──────────────────────────────────────────────────────────── drawing ───────
class Pen:
    """Draws a flat at a given scale and origin on the sheet (px per metre)."""

    def __init__(self, img: Image.Image, ox: float, oy: float, ppm: float):
        self.img, self.d = img, ImageDraw.Draw(img)
        self.ox, self.oy, self.ppm = ox, oy, ppm

    def p(self, x: float, y: float) -> tuple[float, float]:
        return self.ox + x * self.ppm, self.oy + y * self.ppm

    def rect(self, x0, y0, x1, y1, **kw):
        a, b = self.p(x0, y0), self.p(x1, y1)
        self.d.rectangle([min(a[0], b[0]), min(a[1], b[1]), max(a[0], b[0]), max(a[1], b[1])], **kw)

    def line(self, pts, **kw):
        self.d.line([self.p(*q) for q in pts], **kw)


def _font(rng: random.Random, px: float, bold: Optional[bool] = None) -> ImageFont.FreeTypeFont:
    names = FONTS
    if bold is True:
        names = [f for f in FONTS if "bd" in f or f.endswith("b.ttf") or f == "framd.ttf"] or FONTS
    return ImageFont.truetype(str(FONT_DIR / rng.choice(names)), max(7, int(px)))


def _text_centered(d: ImageDraw.ImageDraw, xy, text, font, fill):
    l, t, r, b = d.textbbox((0, 0), text, font=font)
    d.text((xy[0] - (r - l) / 2, xy[1] - (b - t) / 2 - t), text, font=font, fill=fill)
    return r - l, b - t


def _walls(pen: Pen, flat: Flat, style: str, colour, rng: random.Random) -> None:
    """Each space's outline as walls, with the door and window gaps cut out."""
    bx0, by0, bx1, by1 = flat.bounds
    single = style == "cad_single"
    double = style == "cad_double"
    stroke = max(1, round(pen.ppm * 0.025))

    def gaps_on(horizontal, line, lo, hi):
        out = []
        for o in flat.openings:
            if o.horizontal == horizontal and abs(o.at - line) < 1e-6 and o.a < hi and o.b > lo:
                out.append((max(lo, o.a), min(hi, o.b)))
        return sorted(out)

    edges = []
    for s in flat.spaces:
        edges += [(True, s.y0, s.x0, s.x1), (True, s.y1, s.x0, s.x1), (False, s.x0, s.y0, s.y1), (False, s.x1, s.y0, s.y1)]
    for horizontal, line, lo, hi in edges:
        outside = (horizontal and (abs(line - by0) < 1e-6 or abs(line - by1) < 1e-6)) or \
                  (not horizontal and (abs(line - bx0) < 1e-6 or abs(line - bx1) < 1e-6))
        t = (EXT_WALL if outside else INT_WALL) * rng.uniform(0.85, 1.15)
        pieces, cursor = [], lo
        for a, b in gaps_on(horizontal, line, lo, hi):
            if a > cursor:
                pieces.append((cursor, a))
            cursor = max(cursor, b)
        if cursor < hi:
            pieces.append((cursor, hi))
        for a, b in pieces:
            a2, b2 = a - t / 2, b + t / 2
            if horizontal:
                box = (a2, line - t / 2, b2, line + t / 2)
            else:
                box = (line - t / 2, a2, line + t / 2, b2)
            if single:
                if horizontal:
                    pen.line([(a2, line), (b2, line)], fill=colour, width=stroke + 1)
                else:
                    pen.line([(line, a2), (line, b2)], fill=colour, width=stroke + 1)
            elif double:
                x0, y0, x1, y1 = box
                if horizontal:
                    pen.line([(x0, y0), (x1, y0)], fill=colour, width=stroke)
                    pen.line([(x0, y1), (x1, y1)], fill=colour, width=stroke)
                else:
                    pen.line([(x0, y0), (x0, y1)], fill=colour, width=stroke)
                    pen.line([(x1, y0), (x1, y1)], fill=colour, width=stroke)
            else:
                pen.rect(*box, fill=colour)


def _openings(pen: Pen, flat: Flat, style: str, colour, rng: random.Random) -> None:
    thin = max(1, round(pen.ppm * 0.012))
    for o in flat.openings:
        if o.kind == "window":
            t = EXT_WALL
            if o.horizontal:
                for off in (-t / 2, 0, t / 2):
                    pen.line([(o.a, o.at + off), (o.b, o.at + off)], fill=colour, width=thin)
            else:
                for off in (-t / 2, 0, t / 2):
                    pen.line([(o.at + off, o.a), (o.at + off, o.b)], fill=colour, width=thin)
        elif o.kind in ("door", "entrance") and style not in ("area_colour",) or \
                (style == "area_colour" and o.kind in ("door", "entrance") and rng.random() < 0.8):
            if o.swing_into is None:
                continue
            room = flat.spaces[o.swing_into]
            r = o.b - o.a
            if o.horizontal:
                into = 1 if room.y0 + room.y1 > 2 * o.at else -1
                hinge = (o.a, o.at)
                leaf = (o.a, o.at + into * r)
                pen.line([hinge, leaf], fill=colour, width=thin)
                steps = [(o.a + r * math.sin(k * math.pi / 24), o.at + into * r * math.cos(k * math.pi / 24))
                         for k in range(13)]
            else:
                into = 1 if room.x0 + room.x1 > 2 * o.at else -1
                hinge = (o.at, o.a)
                leaf = (o.at + into * r, o.a)
                pen.line([hinge, leaf], fill=colour, width=thin)
                steps = [(o.at + into * r * math.cos(k * math.pi / 24), o.a + r * math.sin(k * math.pi / 24))
                         for k in range(13)]
            pen.line(steps, fill=colour, width=thin)
        elif o.kind == "slider":
            if o.horizontal:
                pen.line([(o.a, o.at - 0.03), ((o.a + o.b) / 2 + 0.05, o.at - 0.03)], fill=colour, width=thin)
                pen.line([((o.a + o.b) / 2 - 0.05, o.at + 0.03), (o.b, o.at + 0.03)], fill=colour, width=thin)
            else:
                pen.line([(o.at - 0.03, o.a), (o.at - 0.03, (o.a + o.b) / 2 + 0.05)], fill=colour, width=thin)
                pen.line([(o.at + 0.03, (o.a + o.b) / 2 - 0.05), (o.at + 0.03, o.b)], fill=colour, width=thin)


def _furniture(pen: Pen, s: Space, style: str, rng: random.Random) -> None:
    """Rough furniture outlines — clutter a reader must not mistake for walls."""
    if style in ("area_colour",):
        ink, fill = (200, 40, 40), None
    elif style in ("line_bw", "cad_single", "cad_double"):
        ink, fill = (120, 120, 120), None
    elif style == "grey_fill":
        ink, fill = (70, 70, 70), (230, 230, 230)
    else:
        ink, fill = (110, 90, 70), (250, 246, 238)
    w = max(1, round(pen.ppm * 0.012))
    m = 0.18
    x0, y0, x1, y1 = s.x0 + m, s.y0 + m, s.x1 - m, s.y1 - m
    if x1 - x0 < 0.6 or y1 - y0 < 0.6:
        return
    k = s.kind
    if k in ("master_bedroom", "bedroom"):
        bw, bl = (1.8 if k == "master_bedroom" else 1.5), 2.0
        if x1 - x0 >= bw + 0.3 and y1 - y0 >= bl + 0.2:
            cx = (x0 + x1) / 2 + rng.uniform(-0.3, 0.3)
            top = y0 if rng.random() < 0.5 else y1 - bl
            pen.rect(cx - bw / 2, top, cx + bw / 2, top + bl, outline=ink, width=w, fill=fill)
            head = top if top == y0 else top + bl - 0.25
            for px in (cx - bw / 4, cx + bw / 4):
                pen.rect(px - 0.3, head + 0.05, px + 0.3, head + 0.22, outline=ink, width=w)
        if rng.random() < 0.7 and x1 - x0 > 1.2:
            pen.rect(x0, y1 - 0.6, min(x1, x0 + 1.8), y1, outline=ink, width=w)      # wardrobe
    elif k in ("living_room", "dining_area"):
        if x1 - x0 > 2.2 and y1 - y0 > 2.2:
            pen.rect(x0, y0 + 0.3, x0 + 0.85, min(y1, y0 + 2.4), outline=ink, width=w, fill=fill)   # sofa
            pen.rect(x0 + 1.2, y0 + 0.9, x0 + 1.8, y0 + 1.8, outline=ink, width=w)                  # table
        if k == "dining_area" or rng.random() < 0.5:
            cx, cy = (x0 + x1) / 2 + 0.4, (y0 + y1) / 2
            pen.rect(cx - 0.45, cy - 0.7, cx + 0.45, cy + 0.7, outline=ink, width=w, fill=fill)
            for dy in (-0.45, 0.0, 0.45):
                for dx in (-0.75, 0.55):
                    pen.rect(cx + dx, cy + dy - 0.18, cx + dx + 0.2, cy + dy + 0.18, outline=ink, width=w)
    elif k == "kitchen":
        if y1 - y0 > x1 - x0:
            pen.rect(x0 - m + 0.05, y0, x0 - m + 0.65, y1, outline=ink, width=w, fill=fill)
            for yy in (y0 + 0.4, y0 + 1.0):
                pen.d.ellipse([*pen.p(x0 + 0.05, yy), *pen.p(x0 + 0.3, yy + 0.25)], outline=ink, width=w)
        else:
            pen.rect(x0, y0 - m + 0.05, x1, y0 - m + 0.65, outline=ink, width=w, fill=fill)
            for xx in (x0 + 0.4, x0 + 1.0):
                pen.d.ellipse([*pen.p(xx, y0 + 0.05), *pen.p(xx + 0.25, y0 + 0.3)], outline=ink, width=w)
    elif k == "bathroom":
        pen.d.ellipse([*pen.p(x0, y1 - 0.65), *pen.p(x0 + 0.42, y1 - 0.1)], outline=ink, width=w)      # WC
        pen.rect(x1 - 0.5, y0, x1, y0 + 0.4, outline=ink, width=w)                                     # basin
    elif k == "balcony":
        for _ in range(rng.randint(0, 3)):
            cx, cy = rng.uniform(x0, x1), rng.uniform(y0, y1)
            pen.d.ellipse([*pen.p(cx - 0.18, cy - 0.18), *pen.p(cx + 0.18, cy + 0.18)],
                          outline=(80, 130, 70), width=w)


def _floor(pen: Pen, s: Space, fill, style: str, rng: random.Random) -> None:
    pen.rect(s.x0, s.y0, s.x1, s.y1, fill=fill)
    if style in ("brochure", "furnished", "grey_fill") and s.kind in ("kitchen", "bathroom", "utility", "balcony") \
            and rng.random() < 0.7:
        tile = rng.choice([0.3, 0.45, 0.6])
        shade = tuple(max(0, c - 18) for c in fill)
        x = s.x0 + tile
        while x < s.x1:
            pen.line([(x, s.y0), (x, s.y1)], fill=shade, width=1)
            x += tile
        y = s.y0 + tile
        while y < s.y1:
            pen.line([(s.x0, y), (s.x1, y)], fill=shade, width=1)
            y += tile
    elif style == "furnished" and s.kind in ("living_room", "master_bedroom", "bedroom", "dining_area"):
        plank = 0.18
        shade = tuple(max(0, c - 12) for c in fill)
        y = s.y0 + plank
        while y < s.y1:
            pen.line([(s.x0, y), (s.x1, y)], fill=shade, width=1)
            y += plank


def _labels(pen: Pen, flat: Flat, style: str, units: str, rng: random.Random, numbering: dict) -> dict[int, list[str]]:
    printed: dict[int, list[str]] = {}
    ink = (30, 30, 30) if style not in ("cad_single",) else (40, 60, 80)
    for i, s in enumerate(flat.spaces):
        cx, cy = pen.p((s.x0 + s.x1) / 2, (s.y0 + s.y1) / 2)
        room_px = min(s.w, s.d) * pen.ppm
        name_px = min(max(pen.ppm * rng.uniform(0.22, 0.32), 9), room_px * 0.28)
        if name_px < 7:
            continue
        lines: list[str] = []
        if style == "area_colour":
            lines = [f"{s.area:.2f}"]
            font = _font(rng, min(name_px * 1.8, room_px * 0.35), bold=rng.random() < 0.5)
            _text_centered(pen.d, (cx, cy), lines[0], font, (20, 20, 20))
        elif style == "numbered":
            n = numbering.setdefault(s.kind + s.name, len(numbering) + 1)
            lines = [str(n)]
            font = _font(rng, name_px * 1.1)
            r = name_px * 0.9
            pen.d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=ink, width=1)
            _text_centered(pen.d, (cx, cy), lines[0], font, ink)
        else:
            name = s.name if rng.random() > 0.05 else s.name.upper()
            size = [] if s.kind == "balcony" and rng.random() < 0.3 else fmt_size(rng, s.w, s.d, units)
            if room_px < 55 and rng.random() < 0.6:
                size = []                      # a tiny WC often has only its name
            lines = [name] + size
            font = _font(rng, name_px, bold=rng.random() < 0.55)
            small = _font(rng, name_px * 0.8)
            y = cy - (len(lines) - 1) * name_px * 0.6
            for j, text in enumerate(lines):
                _text_centered(pen.d, (cx, y), text, font if j == 0 else small, ink)
                y += name_px * 1.2
        printed[i] = lines
    return printed


def _dimension_chain(pen: Pen, flat: Flat, units: str, rng: random.Random) -> None:
    """Lengths printed along the outside of the plan — numbers that are not rooms."""
    bx0, by0, bx1, by1 = flat.bounds
    xs = sorted({round(s.x0, 2) for s in flat.spaces} | {round(s.x1, 2) for s in flat.spaces})
    y = by0 - 0.55
    ink = (90, 90, 90)
    font = _font(rng, max(8, pen.ppm * 0.16))
    pen.line([(xs[0], y), (xs[-1], y)], fill=ink, width=1)
    for a, b in zip(xs, xs[1:]):
        pen.line([(a, y - 0.08), (a, y + 0.08)], fill=ink, width=1)
        if b - a < 0.8:
            continue
        length = b - a
        text = f"{round(length * 1000)}" if units in ("mm", "m", "m_suffix", "area") else "{}'{}\"".format(*_ftin(length))
        cx, cy = pen.p((a + b) / 2, y - 0.2)
        _text_centered(pen.d, (cx, cy), text, font, ink)
    pen.line([(xs[-1], y - 0.08), (xs[-1], y + 0.08)], fill=ink, width=1)


def draw_flat(img: Image.Image, flat: Flat, ox: float, oy: float, ppm: float, style: str, units: str,
              pal: dict, rng: random.Random, numbering: dict, extras: bool = True) -> dict[int, list[str]]:
    pen = Pen(img, ox, oy, ppm)
    for s in flat.spaces:
        _floor(pen, s, pal["fills"].get(s.kind, pal["fills"].get("passage")), style, rng)
    if style not in ("cad_single",) or rng.random() < 0.6:
        for s in flat.spaces:
            if rng.random() < 0.85:
                _furniture(pen, s, style, rng)
    _walls(pen, flat, style, pal["wall"], rng)
    _openings(pen, flat, style, pal["wall"] if style in ("cad_single", "cad_double", "line_bw") else (60, 60, 60), rng)
    printed = _labels(pen, flat, style, units, rng, numbering)
    if extras and rng.random() < 0.25:
        _dimension_chain(pen, flat, units, rng)
    return printed


# ────────────────────────────────────────────────────────────── sheets ──────
SHEETS = ["single", "side_by_side", "grid", "mirror_plate", "stacked"]
SHEET_WEIGHTS = [0.64, 0.10, 0.08, 0.12, 0.06]
UNITS = {"brochure": ["m", "ftin", "ftin_dash", "mm", "dual", "area"],
         "area_colour": ["area"], "line_bw": ["m", "ftin", "ftin_dash", "mm"],
         "cad_single": ["dual", "m_suffix", "ftin"], "cad_double": ["mm", "m", "ftin_dash"],
         "grey_fill": ["ftin", "ftin_dash", "m"], "numbered": ["m"], "furnished": ["m", "ftin", "dual", "mm"]}
BUILDERS = ["SKYLINE HOMES", "GREENLEAF REALTY", "ARYA ESTATES", "NIRMAN HEIGHTS", "VASUNDHARA HOMES"]


def compose(rng: random.Random, sid: str) -> tuple[Image.Image, dict]:
    style = rng.choices(STYLES, STYLE_WEIGHTS)[0]
    sheet = rng.choices(SHEETS, SHEET_WEIGHTS)[0]
    if style == "numbered" and sheet != "single":
        sheet = "single"
    units = rng.choice(UNITS[style])
    bhk = rng.choices([1, 2, 3, 4], [0.22, 0.42, 0.28, 0.08])[0]
    pal = palette(rng, style)

    base = make_flat(rng, bhk)
    if sheet == "single":
        flats = [base]
        layout = [(0.0, 0.0)]
    elif sheet == "side_by_side":
        other = base if rng.random() < 0.4 else make_flat(rng, rng.choice([bhk, max(1, bhk - 1), min(4, bhk + 1)]))
        gap = rng.uniform(1.5, 3.5)
        flats = [base, other]
        layout = [(0.0, 0.0), (base.bounds[2] + gap, 0.0)]
    elif sheet == "stacked":
        other = make_flat(rng, rng.choice([bhk, max(1, bhk - 1)]))
        gap = rng.uniform(1.5, 3.0)
        flats = [base, other]
        layout = [(0.0, 0.0), (0.0, base.bounds[3] + gap)]
    elif sheet == "grid":
        flats = [base] + [make_flat(rng, bhk) for _ in range(3)]
        cw = max(f.bounds[2] for f in flats) + rng.uniform(1.5, 3.0)
        ch = max(f.bounds[3] for f in flats) + rng.uniform(1.5, 3.0)
        layout = [(0.0, 0.0), (cw, 0.0), (0.0, ch), (cw, ch)]
    else:                                   # mirror_plate: the unit next door, reflected, sharing a wall
        axis = rng.choice(["x", "y"])
        twin = mirror_flat(base, axis)
        flats = [base, twin]
        layout = [(0.0, 0.0), (base.bounds[2], 0.0)] if axis == "x" else [(0.0, 0.0), (0.0, base.bounds[3])]

    extent_w = max(ox + f.bounds[2] for f, (ox, _) in zip(flats, layout))
    extent_h = max(oy + f.bounds[3] for f, (_, oy) in zip(flats, layout))
    ppm = rng.uniform(60, 110)             # drawn large, resampled down later
    margin = rng.uniform(1.0, 2.2)
    legend_w = 4.2 if style == "numbered" else 0.0
    W = int((extent_w + 2 * margin + legend_w) * ppm)
    H = int((extent_h + 2 * margin + (1.2 if rng.random() < 0.5 else 0)) * ppm)
    img = Image.new("RGB", (W, H), pal["paper"])
    d = ImageDraw.Draw(img)
    numbering: dict = {}
    top = margin

    if sheet == "grid" and rng.random() < 0.7:          # variant cards, as on plan_13
        card = _jitter(rng, "#EFEAD9", 6)
        for f, (ox, oy) in zip(flats, layout):
            x0, y0 = (margin + ox - 0.6) * ppm, (top + oy - 0.6) * ppm
            x1, y1 = (margin + ox + f.bounds[2] + 0.6) * ppm, (top + oy + f.bounds[3] + 0.6) * ppm
            d.rounded_rectangle([x0, y0, x1, y1], radius=int(0.5 * ppm), fill=card)

    flats_gt = []
    for fi, (f, (ox, oy)) in enumerate(zip(flats, layout)):
        printed = draw_flat(img, f, (margin + ox) * ppm, (top + oy) * ppm, ppm, style, units, pal, rng,
                            numbering, extras=sheet == "single")
        fx0, fy0, fx1, fy1 = f.bounds
        rooms = []
        for i, s in enumerate(f.spaces):
            box = [(margin + ox + s.x0) * ppm / W, (top + oy + s.y0) * ppm / H,
                   (margin + ox + s.x1) * ppm / W, (top + oy + s.y1) * ppm / H]
            rooms.append({"type": s.product_type, "kind": s.kind, "name": s.name, "box": box,
                          "area_m2": round(s.area, 2), "size_m": [round(s.w, 2), round(s.d, 2)],
                          "printed": printed.get(i, [])})
        flats_gt.append({
            "box": [(margin + ox + fx0) * ppm / W, (top + oy + fy0) * ppm / H,
                    (margin + ox + fx1) * ppm / W, (top + oy + fy1) * ppm / H],
            "bhk": f"{f.bhk} BHK", "rooms": rooms})

    # Legend for numbered plans.
    if style == "numbered":
        lx = (margin + extent_w + 0.6) * ppm
        font = _font(rng, ppm * 0.2)
        seen = []
        for key, n in sorted(numbering.items(), key=lambda kv: kv[1]):
            seen.append(n)
            s = next(sp for sp in base.spaces if sp.kind + sp.name == key)
            text = f"{n} - {s.name.upper()}"
            d.text((lx, (top + (n - 1) * 0.42) * ppm), text, font=font, fill=(40, 40, 40))

    extras = []
    if rng.random() < 0.55:
        font = _font(rng, ppm * rng.uniform(0.45, 0.7), bold=True)
        title = rng.choice([f"{bhk} BHK", f"{bhk} BHK", f"TYPE {rng.choice('ABCD')}", f"FLAT NO. {rng.randint(1, 12)}0{rng.randint(1, 4)}",
                            f"{bhk}-Bedroom + {max(1, bhk - 1)} Toilets", "UNIT PLAN"])
        d.text((margin * ppm * 0.5, margin * ppm * 0.25), title, font=font, fill=(40, 40, 40))
        extras.append("title")
    if rng.random() < 0.35:
        font = _font(rng, ppm * 0.22)
        area = sum(r["area_m2"] for r in flats_gt[0]["rooms"])
        line = rng.choice([f"Carpet Area : {area:.2f} sq.m", f"Built-Up area: {area * 1.18:.0f} sq. mt.",
                           f"{area * 10.764 * 1.25:.0f} sq.ft.", f"Sale Area {area * 10.764 * 1.3:.0f} Sq.Ft."])
        d.text((margin * ppm * 0.5, H - margin * ppm * 0.6), line, font=font, fill=(60, 60, 60))
        extras.append("area_statement")
    if rng.random() < 0.2:
        cx, cy, r = W - margin * ppm * 0.5, margin * ppm * 0.5, ppm * 0.35
        d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(60, 60, 60), width=2)
        d.polygon([(cx, cy - r), (cx - r * 0.35, cy + r * 0.4), (cx + r * 0.35, cy + r * 0.4)], fill=(60, 60, 60))
        d.text((cx - r * 0.2, cy - r * 1.8), "N", font=_font(rng, ppm * 0.25), fill=(60, 60, 60))
        extras.append("north_arrow")

    gt = {"id": sid, "style": style, "sheet": sheet, "units": units, "flats": flats_gt,
          "sub_plans": len(flats), "extras": extras}
    return img, gt


# ───────────────────────────────────────────────────────────── damage ───────
def damage(img: Image.Image, gt: dict, rng: random.Random) -> Image.Image:
    """What forwarding a brochure over WhatsApp does to it."""
    done = []
    W, H = img.size
    if rng.random() < 0.15:                                   # watermark
        layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
        dl = ImageDraw.Draw(layer)
        font = _font(rng, W * 0.08, bold=True)
        dl.text((W * 0.15, H * 0.4), rng.choice(BUILDERS), font=font, fill=(120, 120, 120, 38))
        img = Image.alpha_composite(img.convert("RGBA"), layer.rotate(rng.uniform(-25, 25))).convert("RGB")
        done.append("watermark")
    if rng.random() < 0.22:                                   # crop into the drawing's margin
        side = rng.choice(["l", "r", "t", "b"])
        cut = rng.uniform(0.03, 0.12)
        box = [0, 0, W, H]
        if side == "l":
            box[0] = int(W * cut)
        elif side == "r":
            box[2] = int(W * (1 - cut))
        elif side == "t":
            box[1] = int(H * cut)
        else:
            box[3] = int(H * (1 - cut))
        img = img.crop(box)
        fx0, fy0, fx1, fy1 = box[0] / W, box[1] / H, box[2] / W, box[3] / H
        for flat in gt["flats"]:
            flat["box"] = _recrop(flat["box"], fx0, fy0, fx1, fy1)
            for r in flat["rooms"]:
                x0, y0, x1, y1 = r["box"]
                whole = (x1 - x0) * (y1 - y0)
                left = max(0.0, min(x1, fx1) - max(x0, fx0)) * max(0.0, min(y1, fy1) - max(y0, fy0))
                if whole > 0 and left / whole < 0.5:
                    r["cut_off"] = True          # mostly outside the picture now: not scored
                r["box"] = _recrop(r["box"], fx0, fy0, fx1, fy1)
        W, H = img.size
        done.append("cropped")
    if rng.random() < 0.22:                                   # uneven stretch
        sx = rng.uniform(0.78, 1.22)
        img = img.resize((int(W * sx), H), Image.BICUBIC)
        W, H = img.size
        done.append("stretched")
    if rng.random() < 0.20:                                   # photographed or scanned slightly askew
        img = img.rotate(rng.uniform(-3.0, 3.0), resample=Image.BICUBIC, expand=False,
                         fillcolor=img.getpixel((2, 2)))
        done.append("rotated")
    if rng.random() < 0.08:                                   # exported mirror-image, like plan_17
        img = ImageOps.mirror(img)
        for flat in gt["flats"]:
            flat["box"] = [1 - flat["box"][2], flat["box"][1], 1 - flat["box"][0], flat["box"][3]]
            for r in flat["rooms"]:
                r["box"] = [1 - r["box"][2], r["box"][1], 1 - r["box"][0], r["box"][3]]
        done.append("mirror_flipped")
    # Final size: what a phone forwards.
    longest = rng.choice([512, 640, 720, 800, 960, 1080, 1200])
    scale = longest / max(img.size)
    img = img.resize((max(1, int(img.width * scale)), max(1, int(img.height * scale))), Image.LANCZOS)
    W, H = img.size
    if rng.random() < 0.25:                                   # phone screenshot chrome
        d = ImageDraw.Draw(img)
        s = int(W * 0.025)
        d.line([(s * 2, s), (s, s * 2), (s * 2, s * 3)], fill=(40, 40, 40), width=max(2, s // 4))
        cx, cy = W - s * 3, H - s * 3
        d.ellipse([cx - s, cy - s, cx + s, cy + s], outline=(40, 40, 40), width=max(2, s // 5))
        d.line([(cx + s * 0.7, cy + s * 0.7), (cx + s * 1.6, cy + s * 1.6)], fill=(40, 40, 40), width=max(2, s // 4))
        done.append("screenshot_icons")
    if rng.random() < 0.35:
        img = img.filter(ImageFilter.GaussianBlur(rng.uniform(0.5, 1.8)))
        done.append("blur")
    if rng.random() < 0.25:
        arr = np.asarray(img, dtype=np.int16)
        arr = arr + np.random.default_rng(rng.randint(0, 10**9)).normal(0, rng.uniform(4, 14), arr.shape).astype(np.int16)
        img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        done.append("noise")
    if rng.random() < 0.20:
        img = ImageEnhance.Contrast(img).enhance(rng.uniform(0.55, 0.85))
        done.append("low_contrast")
    if rng.random() < 0.15:
        cast = np.array([rng.uniform(0.88, 1.10), rng.uniform(0.88, 1.10), rng.uniform(0.85, 1.08)])
        img = Image.fromarray(np.clip(np.asarray(img) * cast, 0, 255).astype(np.uint8))
        done.append("colour_cast")
    gt["corruptions"] = done
    gt["jpeg_quality"] = rng.choice([22, 30, 40, 50, 60, 70, 80])
    gt["width"], gt["height"] = img.size
    return img


def _recrop(box, fx0, fy0, fx1, fy1):
    x0 = (box[0] - fx0) / (fx1 - fx0)
    y0 = (box[1] - fy0) / (fy1 - fy0)
    x1 = (box[2] - fx0) / (fx1 - fx0)
    y1 = (box[3] - fy0) / (fy1 - fy0)
    return [max(0.0, x0), max(0.0, y0), min(1.0, x1), min(1.0, y1)]


# ─────────────────────────────────────────────────────────────── main ───────
def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--count", type=int, default=600)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--out", default=str(OUT))
    args = ap.parse_args()

    out = Path(args.out)
    (out / "images").mkdir(parents=True, exist_ok=True)
    rng = random.Random(args.seed)
    records = {}
    for n in range(args.count):
        sid = f"syn_{n:04d}"
        local = random.Random(rng.randint(0, 2**31))
        img, gt = compose(local, sid)
        img = damage(img, gt, local)
        gt["file"] = f"{sid}.jpg"
        # 70 / 15 / 15, fixed by position so a regenerated set splits the same way
        gt["split"] = "train" if n % 20 < 14 else ("val" if n % 20 < 17 else "test")
        img.save(out / "images" / gt["file"], quality=gt["jpeg_quality"])
        records[sid] = gt
        if (n + 1) % 50 == 0:
            print(f"  {n + 1}/{args.count}", flush=True)
    (out / "ground_truth.json").write_text(json.dumps(records, indent=1), encoding="utf-8")
    from collections import Counter
    print("styles:", dict(Counter(g["style"] for g in records.values())))
    print("sheets:", dict(Counter(g["sheet"] for g in records.values())))
    print("bhk:", dict(Counter(g["flats"][0]["bhk"] for g in records.values())))
    print("splits:", dict(Counter(g["split"] for g in records.values())))
    print("rooms:", sum(len(f["rooms"]) for g in records.values() for f in g["flats"]))
    print("wrote", out)


if __name__ == "__main__":
    main()
