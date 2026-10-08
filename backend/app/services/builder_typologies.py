"""The builder's layouts, written out by hand from their drawings.

The plan reader exists for a customer who uploads a photograph of a plan we
have never seen. These eight layouts are not that: they are the drawings the
builder supplied, we have them in front of us, and their rooms are printed with
dimensions. Reading them with the tracer would introduce error into numbers we
already know exactly, so they are written down instead.

Every room's size here is the size printed on its drawing, to the centimetre.
Where a room is drawn but not dimensioned -- balconies given only as "1.50M
WIDE", terraces, ducts -- the stated width is used and the length taken from
the wall it runs along. Positions follow the drawing: which rooms share a wall,
what opens off what, which side the balcony is on.

Co-ordinates are metres from the top-left corner of the drawing, x to the
right and y downwards, the same orientation as the sheet. They are converted
to the normalised boxes the rest of the pipeline expects by to_plan() below,
so these layouts travel the identical path as a traced plan -- which is what
keeps room editing, the alternative arrangements and the camera views working.

Source files live beside the repository; each layout names the one it came from.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Optional


@dataclass(frozen=True)
class Space:
    """One room, positioned and sized in metres."""
    room_type: str
    label: str
    x: float
    y: float
    w: float
    h: float

    @property
    def area_m2(self) -> float:
        return round(self.w * self.h, 2)


@dataclass(frozen=True)
class Opening:
    """A door or window in a wall, in metres.

    `axis` is the wall's direction: "x" for a wall running left to right, whose
    position is a y value, and "y" for one running top to bottom, at an x.
    """
    kind: str                        # "door" | "window"
    axis: str                        # "x" | "y"
    at: float                        # where the wall is
    start: float                     # along the wall
    end: float


@dataclass(frozen=True)
class Layout:
    key: str
    name: str
    bhk: str
    source: str                      # the drawing this was written from
    description: str
    width_m: float                   # overall envelope
    depth_m: float
    spaces: tuple[Space, ...] = field(default_factory=tuple)
    # The front door, from the entry mark on the drawing. Everything else --
    # the way each room opens onto the next, and onto its balcony -- is worked
    # out from which rooms touch, in openings() below.
    entrance: Optional[Opening] = None

    @property
    def carpet_area_sqft(self) -> float:
        """Enclosed floor area, excluding balconies and terraces.

        Includes the hall between the rooms, because carpet area does and
        because that is the floor the model builds. Computed from the same
        spaces the plan is built from, so the figure on the card and the one
        the viewer reports are the same number.
        """
        inside = sum(s.area_m2 for s in self.spaces + circulation(self)
                     if s.room_type != "balcony" and "terrace" not in s.label.lower()
                     and "balcon" not in s.label.lower())
        return round(inside * 10.7639, 1)


# ── PLAN 5 — one bedroom, single aspect ──────────────────────────────────────
# Kitchen/dining over the living room, bathroom between it and the bedroom,
# balconies down the left of both living room and bedroom.
PLAN_5 = Layout(
    key="plan_5", name="Plan 5 — 1 BHK", bhk="1BHK", source="PLAN 5.pdf",
    description="Kitchen and dining open off the living room, with balconies down one side.",
    width_m=5.06, depth_m=10.43,
    entrance=Opening("door", "y", 5.06, 2.70, 3.60),
    spaces=(
        Space("kitchen",     "Kitchen / Dining", 1.25, 0.00, 3.81, 2.50),
        Space("living_room", "Living Room",      1.25, 2.50, 3.81, 3.78),
        Space("balcony",     "Balcony",          0.00, 2.50, 1.25, 3.78),
        Space("bathroom",    "W.C./Bath",        1.25, 6.28, 2.40, 1.25),
        Space("bedroom",     "Bedroom",          1.25, 7.53, 3.81, 2.90),
        Space("balcony",     "Balcony",          0.00, 7.53, 1.25, 2.90),
    ),
)

# ── PLAN 3 (F-3) — one bedroom, three bays ───────────────────────────────────
# Living room and bedroom across the front with the bathroom between them,
# foyer, kitchen and utility balcony along the back.
PLAN_3 = Layout(
    key="plan_3", name="Plan 3 (F-3) — 1 BHK", bhk="1BHK", source="PLAN 3.pdf",
    description="Living room and bedroom across the front, kitchen and foyer behind.",
    width_m=7.30, depth_m=7.05,
    entrance=Opening("door", "x", 7.05, 0.20, 1.10),
    spaces=(
        Space("balcony",     "Balcony",     0.00, 0.00, 3.00, 1.15),
        Space("balcony",     "Balcony",     4.30, 0.00, 3.00, 1.15),
        Space("living_room", "Living Room", 0.00, 1.15, 3.00, 3.40),
        Space("bathroom",    "W.C./Bath",   3.00, 1.15, 1.30, 2.40),
        Space("bedroom",     "Bedroom",     4.30, 1.15, 3.00, 3.40),
        Space("passage",     "Foyer",       0.00, 4.55, 1.30, 2.50),
        Space("kitchen",     "Kitchen",     1.30, 4.55, 3.00, 2.50),
        Space("balcony",     "Utility Balcony", 4.30, 4.55, 1.50, 2.50),
    ),
)

# ── PLAN 2 (F-1) — one bedroom, with a dining space ──────────────────────────
# PLAN 3 widened by a dining bay on the left and a second W.C. behind it.
PLAN_2 = Layout(
    key="plan_2", name="Plan 2 (F-1) — 1 BHK", bhk="1BHK", source="PLAN 2.pdf",
    description="A separate dining space beside the living room, and a second W.C.",
    width_m=9.35, depth_m=7.05,
    entrance=Opening("door", "x", 7.05, 2.10, 3.00),
    spaces=(
        Space("balcony",     "Balcony",       0.00, 0.00, 2.05, 1.15),
        Space("balcony",     "Balcony",       2.05, 0.00, 3.00, 1.15),
        Space("balcony",     "Balcony",       6.35, 0.00, 3.00, 1.15),
        Space("dining_area", "Dining Space",  0.00, 1.15, 2.05, 3.40),
        Space("living_room", "Living Room",   2.05, 1.15, 3.00, 3.40),
        Space("bathroom",    "W.C./Bath",     5.05, 1.15, 1.30, 2.40),
        Space("bedroom",     "Bedroom",       6.35, 1.15, 3.00, 3.40),
        Space("bathroom",    "W.C.",          0.00, 4.55, 1.95, 1.40),
        Space("passage",     "Foyer",         1.95, 4.55, 1.30, 2.50),
        Space("kitchen",     "Kitchen",       3.25, 4.55, 3.00, 2.50),
        Space("balcony",     "Utility Balcony", 6.25, 4.55, 1.50, 2.50),
    ),
)

# ── PLAN 4 — two bedrooms, one of them a kids' room ──────────────────────────
PLAN_4 = Layout(
    key="plan_4", name="Plan 4 — 2 BHK", bhk="2BHK", source="PLAN 4.pdf",
    description="A main bedroom and a kids' room, with the kitchen and dining together.",
    width_m=8.46, depth_m=9.39,
    entrance=Opening("door", "x", 9.39, 3.90, 4.80),
    spaces=(
        Space("balcony",     "Balcony",         6.51, 0.00, 1.95, 1.25),
        Space("balcony",     "Balcony",         0.00, 1.25, 1.25, 3.34),
        Space("master_bedroom", "Bedroom",      1.25, 1.25, 3.26, 3.34),
        Space("bathroom",    "W.C.",            4.51, 1.25, 2.00, 1.25),
        Space("bedroom",     "Kids Room",       6.51, 1.25, 1.95, 3.34),
        Space("passage",     "Passage",         4.36, 4.59, 1.35, 1.25),
        Space("bathroom",    "W.C./Bath",       1.25, 4.59, 1.90, 1.60),
        Space("kitchen",     "Kitchen / Dining", 5.71, 4.59, 2.75, 3.00),
        Space("balcony",     "Balcony",         0.00, 6.19, 1.25, 3.20),
        Space("living_room", "Living Room",     1.25, 6.19, 3.81, 3.20),
        Space("balcony",     "Balcony",         7.66, 7.59, 0.80, 1.80),
    ),
)

# ── PLAN 1 — two bedrooms off a passage ──────────────────────────────────────
PLAN_1 = Layout(
    key="plan_1", name="Plan 1 — 2 BHK", bhk="2BHK", source="PLAN 1.pdf",
    description="A large living room, with both bedrooms reached from a central passage.",
    width_m=9.76, depth_m=11.78,
    entrance=Opening("door", "y", 9.76, 5.60, 6.50),
    spaces=(
        Space("balcony",     "Balcony",          4.15, 0.00, 5.61, 1.50),
        Space("balcony",     "Balcony",          0.00, 1.50, 1.30, 3.20),
        Space("kitchen",     "Kitchen / Dining", 1.30, 1.50, 3.25, 2.20),
        Space("living_room", "Living Room",      6.00, 1.50, 3.76, 5.15),
        Space("bathroom",    "W.C./Bath",        1.30, 3.70, 1.85, 1.55),
        Space("bathroom",    "W.C.",             1.30, 5.25, 1.85, 1.10),
        Space("passage",     "Passage",          3.15, 5.25, 2.85, 1.40),
        Space("master_bedroom", "Master Bedroom", 1.30, 6.65, 2.95, 3.63),
        Space("bedroom",     "Bedroom",          4.25, 6.65, 2.75, 3.63),
        Space("balcony",     "Balcony",          0.00, 6.65, 1.30, 3.63),
        Space("balcony",     "Balcony",          1.30, 10.28, 4.00, 1.50),
    ),
)

# ── Borda, Typology B — two bedrooms, both en-suite side ─────────────────────
BORDA_B = Layout(
    key="borda_b", name="Borda — Typology B", bhk="2BHK", source="Borda - Typology B.pdf",
    description="Both bedrooms across the front with their own balconies, living and dining behind.",
    width_m=7.00, depth_m=16.30,
    entrance=Opening("door", "y", 7.00, 13.60, 14.50),
    spaces=(
        Space("balcony",     "Terrace",          0.00, 0.00, 3.50, 1.50),
        Space("balcony",     "Balcony",          0.00, 1.50, 3.50, 1.50),
        Space("balcony",     "Balcony",          3.50, 1.50, 3.50, 1.50),
        Space("bedroom",     "Bedroom",          0.00, 3.00, 3.50, 3.50),
        Space("master_bedroom", "Master Bedroom", 3.50, 3.00, 3.50, 3.50),
        Space("balcony",     "Utility Balcony",  0.00, 6.50, 1.19, 1.50),
        Space("bathroom",    "Bath",             3.50, 6.50, 1.30, 3.15),
        Space("bathroom",    "Bath",             5.80, 6.50, 1.20, 2.50),
        Space("kitchen",     "Kitchen",          0.00, 8.00, 2.48, 3.00),
        Space("passage",     "Entrance",         4.80, 9.65, 2.20, 1.35),
        # The printed Living / Dining, 5.61 x 3.80, as the two halves the
        # drawing furnishes: the table on the left, the seating on the right.
        Space("dining_area", "Dining",           1.39, 11.00, 2.20, 3.80),
        Space("living_room", "Living",           3.59, 11.00, 3.41, 3.80),
        Space("balcony",     "Balcony",          1.39, 14.80, 3.50, 1.50),
    ),
)


# ── Nanu Sapana Solarium — the two-bedroom flat (Flat 03) ────────────────────
# Overall envelope and column grid are printed on the sheet: 11.18 across
# (3.53 | 3.85 | 3.80) and 10.16 down (2.70 | 1.73 | 4.23 | 1.50).
SOLARIUM_2BHK = Layout(
    key="solarium_2bhk", name="Solarium — 2 BHK (Flat 03)", bhk="2BHK",
    source="2 BHK Apartment Nanu sapana Solarium.pdf",
    description="An open terrace off the living room, with both bedrooms along the back.",
    # 11.18 is the structural envelope printed on the sheet; the open terrace
    # stands outside it, over the setback, so the drawing runs wider.
    width_m=13.08, depth_m=10.16,
    entrance=Opening("door", "y", 0.00, 1.40, 2.30),
    spaces=(
        Space("living_room", "Living",           0.00, 0.00, 3.53, 3.40),
        Space("dining_area", "Dining",           0.00, 3.40, 3.53, 2.26),
        Space("kitchen",     "Kitchen",          3.53, 0.00, 3.56, 2.50),
        Space("balcony",     "Enclosed Balcony", 7.09, 0.00, 1.50, 2.50),
        Space("balcony",     "Open Terrace",     8.59, 0.00, 4.49, 2.50),
        Space("bathroom",    "W.C./Bath",        4.53, 2.50, 2.53, 1.43),
        Space("bathroom",    "W.C./Bath",        7.06, 2.50, 2.50, 1.43),
        Space("bedroom",     "Bedroom 01",       3.53, 4.43, 3.75, 3.03),
        Space("master_bedroom", "Master Bedroom 01", 7.38, 4.43, 3.40, 4.03),
        Space("balcony",     "Balcony",          0.00, 8.66, 3.53, 1.50),
        Space("balcony",     "Enclosed Balcony", 3.53, 8.66, 3.85, 1.50),
        Space("balcony",     "Enclosed Balcony", 7.38, 8.66, 3.80, 1.50),
    ),
)


# ── Nanu Sapana Solarium — the three-bedroom flat (Flat 01) ──────────────────
# Column grid printed on the sheet: 3.86 | 1.40 | 3.60 | 3.65 across.
SOLARIUM_3BHK = Layout(
    key="solarium_3bhk", name="Solarium — 3 BHK (Flat 01)", bhk="3BHK",
    source="3 BHK Apartment Nanu sapana Solarium.pdf",
    description="Three bedrooms across the front, each with an enclosed balcony.",
    width_m=12.51, depth_m=10.87,
    entrance=Opening("door", "x", 10.57, 5.00, 5.90),
    spaces=(
        Space("balcony",     "Enclosed Balcony", 0.00, 0.00, 3.86, 1.50),
        Space("balcony",     "Enclosed Balcony", 5.26, 0.00, 3.60, 1.50),
        Space("balcony",     "Enclosed Balcony", 8.86, 0.00, 3.65, 1.50),
        Space("master_bedroom", "Master Bedroom 01", 0.00, 1.50, 3.56, 3.56),
        Space("bathroom",    "W.C./Bath",        3.86, 1.50, 1.40, 2.96),
        Space("bedroom",     "Bedroom 01",       5.26, 1.50, 3.30, 3.56),
        Space("master_bedroom", "Master Bedroom 02", 8.86, 1.50, 3.55, 3.56),
        Space("bathroom",    "W.C./Bath",        0.00, 5.36, 1.40, 2.56),
        Space("bathroom",    "W.C./Bath",        10.06, 5.36, 2.45, 1.40),
        Space("dining_area", "Dining",           1.40, 6.76, 2.40, 3.81),
        Space("living_room", "Living",           3.80, 6.76, 4.00, 3.81),
        Space("kitchen",     "Kitchen",          8.06, 6.76, 2.95, 2.96),
        Space("balcony",     "Enclosed Balcony", 11.01, 6.76, 1.50, 2.96),
        Space("balcony",     "Balcony",          0.00, 7.92, 1.40, 2.95),
    ),
)


ALL: tuple[Layout, ...] = (
    PLAN_2, PLAN_3, PLAN_5,                       # one bedroom
    PLAN_1, PLAN_4, BORDA_B, SOLARIUM_2BHK,       # two bedrooms
    SOLARIUM_3BHK,                                # three bedrooms
)

BY_KEY: dict[str, Layout] = {lay.key: lay for lay in ALL}


DOOR_M = 0.90                    # a single leaf
BALCONY_OPENING_M = 1.80         # the glazed door onto a balcony
MIN_SHARED_M = 0.80              # below this two rooms only clip corners


def openings(layout: Layout) -> list[Opening]:
    """Where this layout's walls are open.

    Without these every room is a sealed box: no front door, and a balcony
    that cannot be stepped onto, which is what makes one read as a strip
    stuck to the outside rather than part of the flat. Two rooms that share
    enough wall get an opening in it -- wide and glazed onto a balcony, a
    single door between rooms -- centred on the wall they share.
    """
    found: list[Opening] = []
    if layout.entrance:
        found.append(layout.entrance)

    for i, a in enumerate(layout.spaces):
        for b in layout.spaces[i + 1:]:
            outdoor = ("balcon" in a.label.lower() or "terrace" in a.label.lower()
                       or "balcon" in b.label.lower() or "terrace" in b.label.lower())
            if ("balcon" in a.label.lower() or "terrace" in a.label.lower()) and                ("balcon" in b.label.lower() or "terrace" in b.label.lower()):
                continue                      # two balconies need no door between them
            width = BALCONY_OPENING_M if outdoor else DOOR_M
            kind = "window" if outdoor else "door"

            # A shared vertical wall: one room's right edge is the other's left.
            for left, right in ((a, b), (b, a)):
                if abs((left.x + left.w) - right.x) < 0.02:
                    lo = max(left.y, right.y)
                    hi = min(left.y + left.h, right.y + right.h)
                    if hi - lo >= MIN_SHARED_M:
                        mid = (lo + hi) / 2
                        half = min(width, hi - lo - 0.2) / 2
                        found.append(Opening(kind, "y", right.x, mid - half, mid + half))

            # A shared horizontal wall.
            for top, below in ((a, b), (b, a)):
                if abs((top.y + top.h) - below.y) < 0.02:
                    lo = max(top.x, below.x)
                    hi = min(top.x + top.w, below.x + below.w)
                    if hi - lo >= MIN_SHARED_M:
                        mid = (lo + hi) / 2
                        half = min(width, hi - lo - 0.2) / 2
                        found.append(Opening(kind, "x", below.y, mid - half, mid + half))
    return found


def circulation(layout: Layout, step: float = 0.05) -> tuple[Space, ...]:
    """The hall and passage floor between this layout's rooms, as rectangles.

    A layout is written as the rooms the drawing dimensions, and a drawing does
    not dimension the hall you walk through to reach them. Left unnamed that
    floor is still enclosed, so the engine fills it in anyway and the flat
    reports more area than its rooms account for -- Borda read 774 sq ft
    against 654 sq ft of rooms. Naming it here keeps the two the same number
    and gives the circulation a floor the solver knows to keep clear.
    """
    import numpy as np
    import scipy.ndimage as ndi

    nx = int(round(layout.width_m / step))
    ny = int(round(layout.depth_m / step))
    grid = np.zeros((ny, nx), dtype=bool)
    for sp in layout.spaces:
        grid[int(sp.y / step):int(round((sp.y + sp.h) / step)),
             int(sp.x / step):int(round((sp.x + sp.w) / step))] = True

    labelled, count = ndi.label(~grid)
    open_to_outside = set(labelled[0, :]) | set(labelled[-1, :]) |                       set(labelled[:, 0]) | set(labelled[:, -1])
    enclosed = np.zeros_like(grid)
    for i in range(1, count + 1):
        if i not in open_to_outside:
            enclosed |= (labelled == i)

    # Greedy maximal rectangles: take the widest run on a row, extend it down
    # as far as it stays clear. Few, large pieces beat many slivers, which the
    # wall builder would otherwise turn into a thicket of stubs.
    out: list[Space] = []
    todo = enclosed.copy()
    while todo.any():
        ys, xs = np.where(todo)
        y0, x0 = int(ys[0]), int(xs[np.where(ys == ys[0])].min())
        x1 = x0
        while x1 + 1 < nx and todo[y0, x1 + 1]:
            x1 += 1
        y1 = y0
        while y1 + 1 < ny and todo[y1 + 1, x0:x1 + 1].all():
            y1 += 1
        todo[y0:y1 + 1, x0:x1 + 1] = False
        w, h = (x1 + 1 - x0) * step, (y1 + 1 - y0) * step
        if w * h < 0.5:
            continue                              # a sliver is not a hall
        out.append(Space("passage", "Hall", round(x0 * step, 2), round(y0 * step, 2),
                         round(w, 2), round(h, 2)))
    return tuple(out)


def to_plan(layout: Layout) -> dict[str, Any]:
    """The layout in the shape the rest of the pipeline reads.

    The same keys a traced plan produces, so a hand-written layout and an
    uploaded photograph travel the identical code path from here on. The
    pixel size is the envelope at 100 px per metre, which makes the aspect
    ratio exact and keeps the normalised boxes honest.
    """
    image_w = int(round(layout.width_m * 100))
    image_h = int(round(layout.depth_m * 100))
    rooms = []
    for i, s in enumerate(layout.spaces + circulation(layout), start=1):
        rooms.append({
            "id": f"{layout.key}-r{i}",
            "label": s.label,
            "room_type": s.room_type,
            "box": [round(s.x / layout.width_m, 4),
                    round(s.y / layout.depth_m, 4),
                    round((s.x + s.w) / layout.width_m, 4),
                    round((s.y + s.h) / layout.depth_m, 4)],
        })
    return {
        "rooms": rooms,
        "plan_width_m": layout.width_m,
        "plan_depth_m": layout.depth_m,
        "image_w": image_w,
        "image_h": image_h,
        "door_gaps": [
            {"axis": o.axis,
             "pos": round((o.at / layout.depth_m) if o.axis == "x"
                          else (o.at / layout.width_m), 4),
             "a": round((o.start / layout.width_m) if o.axis == "x"
                        else (o.start / layout.depth_m), 4),
             "b": round((o.end / layout.width_m) if o.axis == "x"
                        else (o.end / layout.depth_m), 4),
             "kind": o.kind}
            for o in openings(layout)
        ],
        "method": "builder",
        "source_file": layout.source,
    }


def holes(layout: Layout, step: float = 0.05) -> list[tuple[float, float, float, float]]:
    """Enclosed floor this layout leaves unnamed, as rectangles in metres.

    A hand-written layout is a set of rectangles, and rectangles leave gaps.
    The engine fills an enclosed gap in with circulation so the model has a
    continuous floor, which is right -- but it means the flat reports more
    floor than the rooms account for, and the difference shows up as a carpet
    area nobody can explain. Finding the gaps here makes them a thing to fix
    rather than a discrepancy to notice later.
    """
    import numpy as np
    nx = int(round(layout.width_m / step))
    ny = int(round(layout.depth_m / step))
    grid = np.zeros((ny, nx), dtype=bool)
    for sp in layout.spaces:
        x0, y0 = int(sp.x / step), int(sp.y / step)
        x1, y1 = int(round((sp.x + sp.w) / step)), int(round((sp.y + sp.h) / step))
        grid[y0:y1, x0:x1] = True

    import scipy.ndimage as ndi
    empty = ~grid
    labelled, count = ndi.label(empty)
    outside = set(labelled[0, :]) | set(labelled[-1, :]) |               set(labelled[:, 0]) | set(labelled[:, -1])
    found = []
    for i in range(1, count + 1):
        if i in outside:
            continue                              # open to the outside, not a hole
        ys, xs = np.where(labelled == i)
        area = len(ys) * step * step
        if area < 0.5:
            continue                              # a sliver, not a room's worth
        found.append((round(xs.min() * step, 2), round(ys.min() * step, 2),
                      round((xs.max() + 1) * step, 2), round((ys.max() + 1) * step, 2)))
    return found


def check(layout: Layout) -> list[str]:
    """Problems with a hand-written layout: overlaps and rooms off the sheet.

    Written by hand means mistyped by hand, and a room that overlaps its
    neighbour or hangs off the edge produces a wrong model in silence.
    """
    problems: list[str] = []
    for s in layout.spaces:
        if s.x < -0.01 or s.y < -0.01:
            problems.append(f"{s.label} starts outside the plan at ({s.x}, {s.y})")
        if s.x + s.w > layout.width_m + 0.01:
            problems.append(f"{s.label} runs {s.x + s.w - layout.width_m:.2f} m past the right edge")
        if s.y + s.h > layout.depth_m + 0.01:
            problems.append(f"{s.label} runs {s.y + s.h - layout.depth_m:.2f} m past the bottom edge")
        if s.w <= 0 or s.h <= 0:
            problems.append(f"{s.label} has no size")

    for i, a in enumerate(layout.spaces):
        for b in layout.spaces[i + 1:]:
            overlap_x = min(a.x + a.w, b.x + b.w) - max(a.x, b.x)
            overlap_y = min(a.y + a.h, b.y + b.h) - max(a.y, b.y)
            if overlap_x > 0.01 and overlap_y > 0.01:
                problems.append(
                    f"{a.label} and {b.label} overlap by "
                    f"{overlap_x:.2f} x {overlap_y:.2f} m")
    return problems
