"""Workflow 2 — the shared spatial constraint solver.

Both rendering workflows need the same validated positions, so this is the only
place furniture coordinates are decided.

Two stages, matching the architecture doc:

1. **Feasibility.** A deterministic anchored sweep places every item at the
   lowest-cost pose that satisfies all hard constraints. The doc specifies
   OR-Tools CP-SAT here; `CPSATBackend` wires that up when `ortools` is
   importable, and `SweepBackend` is the dependency-free fallback that runs by
   default. Both emit the same `Placement` list, so the stage below neither
   knows nor cares which ran.
2. **Polish.** Simulated annealing on the soft objective — open space,
   functional adjacency, wall alignment, visual balance. Hard constraints are
   carried as a large penalty so the chain can cross infeasible ground, and the
   best *feasible* state seen is what gets returned. If annealing never beats
   the seed, the seed is returned unchanged.

Everything is seeded. The same scene and the same seed give the same layout.
"""
from __future__ import annotations

import math
import random
from dataclasses import dataclass, field, replace
from typing import Iterable, Protocol, Sequence

from .scene import Box, Opening, Room, Scene, SceneObject, yaw_footprint

YAWS = (0.0, 90.0, 180.0, 270.0)


# ─────────────────────────────────────────────────── placement rules ───────
@dataclass(frozen=True)
class Rule:
    """How a category wants to sit in a room."""
    anchor: str = "wall"          # wall | corner | centre | counter | free
    clearance: float = 0.60       # metres of access space in front
    faces_room: bool = True       # front normal points into the room
    against: tuple[str, ...] = () # categories it likes to be beside
    gap: float = 0.35             # preferred distance to those categories
    priority: int = 50            # lower places first (anchors before fillers)
    stackable: bool = False       # may sit under other items (rugs, planters)
    keeps_window_clear: bool = False   # a bed across a window reads as a mistake
    flanks: bool = False          # a pair sits either side of its partner


RULES: dict[str, Rule] = {
    "bed":            Rule("wall", 0.65, True, ("nightstand",), 0.12, 5, keeps_window_clear=True),
    "wardrobe":       Rule("wall", 0.75, True, (), 0.35, 10, keeps_window_clear=True),
    "sofa":           Rule("wall", 0.80, True, ("coffee_table",), 0.55, 5),
    "counter_run":    Rule("counter", 0.95, True, (), 0.35, 5),
    "island":         Rule("centre", 0.85, True, ("counter_run",), 1.10, 12),
    "dining_set":     Rule("centre", 0.85, True, (), 0.35, 8),
    "media_console":  Rule("wall", 0.70, True, ("sofa",), 2.40, 15, keeps_window_clear=True),
    "bookshelf":      Rule("wall", 0.55, True, (), 0.35, 20, keeps_window_clear=True),
    "wall_cabinets":  Rule("wall", 0.00, True, ("counter_run",), 0.00, 18),
    "tall_storage":   Rule("corner", 0.65, True, (), 0.35, 18, keeps_window_clear=True),
    "vanity":         Rule("wall", 0.70, True, (), 0.35, 8),
    "wc":             Rule("wall", 0.60, True, (), 0.35, 9),
    "shower":         Rule("corner", 0.60, True, (), 0.35, 7),
    "desk":           Rule("wall", 0.75, True, ("chair",), 0.10, 12),
    "chair":          Rule("free", 0.35, True, ("desk",), 0.10, 60),
    "nightstand":     Rule("wall", 0.35, True, ("bed",), 0.12, 30, flanks=True),
    "dresser":        Rule("wall", 0.65, True, (), 0.35, 22),
    "sideboard":      Rule("wall", 0.65, True, ("dining_set",), 0.60, 22),
    "bar_unit":       Rule("corner", 0.60, True, (), 0.35, 24),
    "mandir":         Rule("wall", 0.70, True, (), 0.35, 8),
    "bench":          Rule("wall", 0.45, True, ("bed",), 0.30, 40),
    "coffee_table":   Rule("centre", 0.45, False, ("sofa",), 0.55, 35),
    "side_table":     Rule("free", 0.30, False, ("sofa",), 0.18, 55),
    "console_table":  Rule("wall", 0.50, True, (), 0.35, 38),
    "armchair":       Rule("free", 0.50, True, ("coffee_table",), 0.70, 45),
    "floor_lamp":     Rule("corner", 0.15, False, ("sofa",), 0.35, 70),
    "planter":        Rule("corner", 0.10, False, (), 0.35, 80, stackable=True),
    "rug":            Rule("centre", 0.00, False, ("sofa", "bed"), 0.00, 90, stackable=True),
    "fridge":         Rule("wall", 0.80, True, (), 0.35, 14),
}
DEFAULT_RULE = Rule()


def rule_for(category: str) -> Rule:
    return RULES.get(category, DEFAULT_RULE)


# ──────────────────────────────────────────────────────── placements ───────
@dataclass
class Item:
    item_id: str
    category: str
    width: float
    depth: float
    height: float
    rule: Rule = field(default_factory=lambda: DEFAULT_RULE)

    @staticmethod
    def from_object(o: SceneObject) -> "Item":
        return Item(o.object_id, o.category, o.dimensions["width"],
                    o.dimensions["depth"], o.dimensions["height"], rule_for(o.category))


@dataclass
class Placement:
    item_id: str
    x: float
    y: float
    yaw: float

    def box(self, item: Item) -> Box:
        w, d = yaw_footprint(item.width, item.depth, self.yaw)
        return Box.centred(self.x, self.y, w, d)

    def clearance_box(self, item: Item) -> Box:
        """The access strip in front of the item, in its facing direction."""
        c = item.rule.clearance
        if c <= 0:
            return Box(self.x, self.y, self.x, self.y)
        w, d = yaw_footprint(item.width, item.depth, self.yaw)
        b = self.box(item)
        # yaw 0 faces +y (north); the viewer applies PI - yaw, so this is the
        # same convention the renderer uses.
        if self.yaw == 0:
            return Box(b.x0, b.y1, b.x1, b.y1 + c)
        if self.yaw == 180:
            return Box(b.x0, b.y0 - c, b.x1, b.y0)
        if self.yaw == 90:
            return Box(b.x1, b.y0, b.x1 + c, b.y1)
        return Box(b.x0 - c, b.y0, b.x0, b.y1)


@dataclass
class SolveReport:
    room_id: str
    backend: str
    items: int
    feasible: bool
    hard_violations: int
    soft_cost: float
    annealing_accepted: int
    improved: bool

    def __str__(self) -> str:
        flag = "ok " if self.feasible else "INFEASIBLE"
        return (f"{self.room_id:16s} {flag} {self.items:2d} items  "
                f"cost {self.soft_cost:8.3f}  hard {self.hard_violations}  "
                f"backend {self.backend}"
                + ("  (annealed)" if self.improved else ""))


# ───────────────────────────────────────────────────────── the costs ───────
class RoomContext:
    """Everything the cost function needs about one room, precomputed once."""

    def __init__(self, room: Room, openings: Sequence[Opening],
                 wall_margin: float = 0.05):
        self.room = room
        self.inner = room.box.inflate(-wall_margin)
        self.doors = [o for o in openings if o.is_door]
        self.windows = [o for o in openings if not o.is_door]
        self.no_go = [b for b in (o.swing_box() for o in self.doors) if b]
        # a corridor from each door to the room centre must stay walkable
        self.paths: list[Box] = []
        for d in self.doors:
            cx, cy = d.centre
            self.paths.append(Box(min(cx, self.inner.cx) - 0.35,
                                  min(cy, self.inner.cy) - 0.35,
                                  max(cx, self.inner.cx) + 0.35,
                                  max(cy, self.inner.cy) + 0.35))
        self.window_zones = [Box.centred(*o.centre, max(o.width, 0.4), 0.30)
                             for o in self.windows]
        # The step-in space at each door: walking in should not mean squeezing
        # past a chair. Deeper than the swing box, and soft rather than hard.
        self.landings: list[Box] = []
        for d in self.doors:
            cx, cy = d.centre
            span = max(d.width, 0.75) + 0.30
            towards_x = self.inner.cx - cx
            towards_y = self.inner.cy - cy
            if abs(towards_x) > abs(towards_y):        # door on a side wall
                depth = 0.75 * (1 if towards_x > 0 else -1)
                self.landings.append(Box(min(cx, cx + depth), cy - span / 2,
                                         max(cx, cx + depth), cy + span / 2))
            else:
                depth = 0.75 * (1 if towards_y > 0 else -1)
                self.landings.append(Box(cx - span / 2, min(cy, cy + depth),
                                         cx + span / 2, max(cy, cy + depth)))

    def wall_distance(self, b: Box) -> float:
        return min(b.x0 - self.inner.x0, self.inner.x1 - b.x1,
                   b.y0 - self.inner.y0, self.inner.y1 - b.y1)

    def corner_distance(self, b: Box) -> float:
        return min(math.hypot(b.cx - x, b.cy - y)
                   for x in (self.inner.x0, self.inner.x1)
                   for y in (self.inner.y0, self.inner.y1))


HARD_PENALTY = 1000.0

# How strongly each aesthetic rule pulls, relative to the other soft costs.
W_FLANK = 2.0          # a nightstand beside its bed, level with the headboard
W_FLANK_MIRROR = 1.8   # the pair balanced either side
W_ANCHOR_CENTRE = 0.9  # the bed centred on its wall so both fit
W_WINDOW_CLEAR = 2.5   # a bed or wardrobe across a window
W_LANDING = 2.5        # the space you step into from a door
W_BACK_TO_WALL = 16.0  # a headboard belongs against a wall, not just any side


def hard_violations(items: dict[str, Item], place: dict[str, Placement],
                    ctx: RoomContext) -> float:
    """Total squared-ish magnitude of every hard-constraint breach."""
    bad = 0.0
    boxes = {k: place[k].box(items[k]) for k in place}
    for k, b in boxes.items():
        if not ctx.inner.contains(b, tol=0.01):
            dx = max(0.0, ctx.inner.x0 - b.x0) + max(0.0, b.x1 - ctx.inner.x1)
            dy = max(0.0, ctx.inner.y0 - b.y0) + max(0.0, b.y1 - ctx.inner.y1)
            bad += 4.0 * (dx + dy)
        if items[k].rule.stackable:
            continue
        for ng in ctx.no_go:
            bad += 6.0 * ng.overlap(b)
        if items[k].height > 1.0:
            for wz in ctx.window_zones:
                bad += 3.0 * wz.overlap(b)

    keys = list(boxes)
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            a, c = keys[i], keys[j]
            if items[a].rule.stackable or items[c].rule.stackable:
                continue
            bad += 5.0 * boxes[a].overlap(boxes[c])
    return bad


def soft_cost(items: dict[str, Item], place: dict[str, Placement],
              ctx: RoomContext) -> float:
    """Lower is better. Purely aesthetic/ergonomic — no feasibility here."""
    cost = 0.0
    boxes = {k: place[k].box(items[k]) for k in place}

    for k, p in place.items():
        it, b = items[k], boxes[k]
        r = it.rule
        if r.anchor == "wall" or r.anchor == "counter":
            cost += 2.2 * max(0.0, ctx.wall_distance(b))
            # Touching a wall with any edge is not enough. A bed shoved
            # side-on with its headboard in open floor satisfies the line
            # above and still looks wrong, so charge for the gap behind the
            # piece specifically — the side it turns its back on.
            if r.faces_room:
                cost += W_BACK_TO_WALL * max(0.0, _back_gap(b, p.yaw, ctx))
        elif r.anchor == "corner":
            cost += 1.1 * ctx.corner_distance(b)
        elif r.anchor == "centre":
            cost += 0.9 * math.hypot(b.cx - ctx.inner.cx, b.cy - ctx.inner.cy)

        # access strip must not be swallowed by neighbours
        cb = p.clearance_box(it)
        if cb.area > 0:
            for k2, b2 in boxes.items():
                if k2 == k or items[k2].rule.stackable:
                    continue
                cost += 3.0 * cb.overlap(b2)
            cost += 1.5 * max(0.0, cb.area - ctx.inner.overlap(cb))

        # walking path from every door, and the space you step into
        if not r.stackable:
            for path in ctx.paths:
                cost += 1.2 * path.overlap(b)
            for landing in ctx.landings:
                cost += W_LANDING * landing.overlap(b)

    # functional adjacency
    by_cat: dict[str, list[str]] = {}
    for k, it in items.items():
        by_cat.setdefault(it.category, []).append(k)
    for k, it in items.items():
        for want in it.rule.against:
            partners = by_cat.get(want, [])
            if not partners:
                continue
            if it.rule.flanks:
                # Beside, in the partner's own frame: level with its head and
                # clear of its side. Plain distance would accept a diagonal.
                p = min(partners, key=lambda q: math.hypot(boxes[k].cx - boxes[q].cx,
                                                           boxes[k].cy - boxes[q].cy))
                pb, pit, yaw = boxes[p], items[p], place[p].yaw
                fx, fy = _facing(yaw)
                lx, ly = -fy, fx
                dx, dy = boxes[k].cx - pb.cx, boxes[k].cy - pb.cy
                sideways = dx * lx + dy * ly
                along = dx * fx + dy * fy
                want_side = (pit.width + it.width) / 2 + it.rule.gap
                want_along = -(pit.depth - it.depth) / 2          # at the head end
                cost += W_FLANK * (abs(abs(sideways) - want_side) + abs(along - want_along))
                continue
            best = min(math.hypot(boxes[k].cx - boxes[p].cx,
                                  boxes[k].cy - boxes[p].cy) for p in partners)
            cost += 1.6 * abs(best - _target_gap(it, items, want))

        # A bed or a wardrobe standing across a window looks like a mistake.
        if it.rule.keeps_window_clear:
            for wz in ctx.window_zones:
                cost += W_WINDOW_CLEAR * wz.overlap(boxes[k])

    # A pair — two nightstands — belongs either side of its partner, level with
    # each other. Cost is least when their offsets from the bed cancel out.
    for cat, keys in by_cat.items():
        rule = rule_for(cat)
        if not rule.flanks or len(keys) != 2:
            continue
        for want in rule.against:
            partners = by_cat.get(want, [])
            if not partners:
                continue
            # The bed centres on its wall, or the second nightstand has nowhere
            # to stand: sideways room must be left on both sides.
            for q in partners:
                fx, fy = _facing(place[q].yaw)
                if abs(fx) > abs(fy):
                    cost += W_ANCHOR_CENTRE * abs(boxes[q].cy - ctx.inner.cy)
                else:
                    cost += W_ANCHOR_CENTRE * abs(boxes[q].cx - ctx.inner.cx)
            a, b = (boxes[k] for k in keys)
            p = min(partners, key=lambda q: abs(boxes[q].cx - a.cx) + abs(boxes[q].cy - a.cy))
            pb = boxes[p]
            cost += W_FLANK_MIRROR * abs((a.cx - pb.cx) + (b.cx - pb.cx))   # mirrored left/right
            cost += W_FLANK_MIRROR * abs((a.cy - pb.cy) + (b.cy - pb.cy))   # and level with each other

    # visual balance — keep the room's mass roughly centred
    tot = sum(b.area for b in boxes.values()) or 1.0
    mx = sum(b.cx * b.area for b in boxes.values()) / tot
    my = sum(b.cy * b.area for b in boxes.values()) / tot
    cost += 0.8 * math.hypot(mx - ctx.inner.cx, my - ctx.inner.cy)
    return cost


def _tidy_pairs(items: dict[str, Item], place: dict[str, Placement], ctx: RoomContext,
                score: float, settle=None) -> tuple[dict[str, Placement], float]:
    """Centre an anchor on its wall and set its pair either side of the head.

    A bed with two bedside tables is the case that matters: annealing settles
    for one table beside the bed and the other wherever it fits. `settle`, when
    given, re-places the room's other items around the moved group.
    """
    by_cat: dict[str, list[str]] = {}
    for key, item in items.items():
        by_cat.setdefault(item.category, []).append(key)

    for cat, keys in by_cat.items():
        if not rule_for(cat).flanks or len(keys) != 2:
            continue
        for want in rule_for(cat).against:
            anchors = by_cat.get(want) or []
            if len(anchors) != 1:
                continue
            anchor = anchors[0]
            ap, aitem = place[anchor], items[anchor]
            fx, fy = _facing(ap.yaw)
            lx, ly = -fy, fx
            trial = dict(place)
            # keep how far the anchor stands from its wall, centre it along the wall
            centre_x = ctx.inner.cx if abs(lx) > abs(ly) else ap.x
            centre_y = ctx.inner.cy if abs(ly) > abs(lx) else ap.y
            trial[anchor] = Placement(anchor, centre_x, centre_y, ap.yaw)
            partner = items[keys[0]]
            side = (aitem.width + partner.width) / 2 + partner.rule.gap
            along = -(aitem.depth - partner.depth) / 2
            # Both tables have to land inside the room, or the pair is not on.
            span = ctx.inner.d if abs(ly) > abs(lx) else ctx.inner.w
            half = yaw_footprint(partner.width, partner.depth, ap.yaw)[1 if abs(ly) > abs(lx) else 0] / 2
            room_for_pair = span / 2 - half
            if room_for_pair < (aitem.width + partner.width) / 2:
                continue                       # too narrow: leave the solver's answer
            side = min(side, room_for_pair)
            for sign, key in zip((1.0, -1.0), keys):
                trial[key] = Placement(
                    key,
                    centre_x + lx * side * sign + fx * along,
                    centre_y + ly * side * sign + fy * along,
                    ap.yaw)
            # The group has moved; let everything else settle around it before
            # judging, or one stray chair in the way sinks a better room.
            if settle is not None:
                trial = settle(trial, set(keys) | {anchor})
            trial_score = (hard_violations(items, trial, ctx) * HARD_PENALTY
                           + soft_cost(items, trial, ctx))
            if trial_score < score:
                place, score = trial, trial_score
    return place, score


def _back_gap(b: Box, yaw: float, ctx) -> float:
    """How far the back of a piece sits from the wall it is turned away from."""
    fx, fy = _facing(yaw)
    if fy > 0:                      # faces north, back to the south wall
        return b.y0 - ctx.inner.y0
    if fy < 0:                      # faces south, back to the north wall
        return ctx.inner.y1 - b.y1
    if fx > 0:                      # faces east, back to the west wall
        return b.x0 - ctx.inner.x0
    return ctx.inner.x1 - b.x1      # faces west, back to the east wall


def _facing(yaw: float) -> tuple[float, float]:
    """Unit vector an item faces. Yaw 0 faces +y, matching the renderer."""
    return {0.0: (0.0, 1.0), 90.0: (1.0, 0.0), 180.0: (0.0, -1.0), 270.0: (-1.0, 0.0)}.get(yaw % 360, (0.0, 1.0))


def _target_gap(item: Item, items: dict[str, Item], partner_cat: str) -> float:
    """Preferred centre-to-centre distance to a partner category."""
    if item.rule.stackable:
        return 0.0                # a rug lies under its sofa or bed, not beside it
    partner = next((i for i in items.values() if i.category == partner_cat), None)
    span = (item.depth + (partner.depth if partner else 0.6)) / 2
    return span + item.rule.gap


# ─────────────────────────────────────────────────────────── backends ──────
class Backend(Protocol):
    name: str

    def seed(self, items: dict[str, Item], ctx: RoomContext,
             rng: random.Random) -> dict[str, Placement]: ...


class SweepBackend:
    """Dependency-free feasibility pass.

    Places items in rule priority order. For each, it sweeps candidate poses
    along every wall (and the room centre), scores them against the items
    already down, and takes the best pose with no hard breach — falling back to
    the least-bad pose if the room is genuinely over-filled, which annealing
    then gets a chance to repair.
    """
    name = "sweep"

    def __init__(self, step: float = 0.10):
        self.step = step

    def _candidates(self, item: Item, ctx: RoomContext) -> Iterable[Placement]:
        inner, s = ctx.inner, self.step
        r = item.rule
        if r.anchor in ("centre",):
            for fx in (0.5, 0.4, 0.6, 0.35, 0.65):
                for fy in (0.5, 0.4, 0.6, 0.35, 0.65):
                    for yaw in (0.0, 90.0):
                        w, d = yaw_footprint(item.width, item.depth, yaw)
                        yield Placement(item.item_id,
                                        inner.x0 + fx * inner.w,
                                        inner.y0 + fy * inner.d, yaw)
            return
        # wall / corner / counter / free all sweep the perimeter
        for yaw, (ax, ay) in zip(YAWS, ((0, 1), (1, 0), (0, -1), (-1, 0))):
            w, d = yaw_footprint(item.width, item.depth, yaw)
            if w > inner.w + 1e-6 or d > inner.d + 1e-6:
                continue
            if ay == 1:      # back to the south wall, facing north
                y = inner.y0 + d / 2
                xs = _frange(inner.x0 + w / 2, inner.x1 - w / 2, s)
                for x in xs:
                    yield Placement(item.item_id, x, y, yaw)
            elif ay == -1:
                y = inner.y1 - d / 2
                for x in _frange(inner.x0 + w / 2, inner.x1 - w / 2, s):
                    yield Placement(item.item_id, x, y, yaw)
            elif ax == 1:
                x = inner.x0 + w / 2
                for y in _frange(inner.y0 + d / 2, inner.y1 - d / 2, s):
                    yield Placement(item.item_id, x, y, yaw)
            else:
                x = inner.x1 - w / 2
                for y in _frange(inner.y0 + d / 2, inner.y1 - d / 2, s):
                    yield Placement(item.item_id, x, y, yaw)

    def seed(self, items: dict[str, Item], ctx: RoomContext,
             rng: random.Random) -> dict[str, Placement]:
        order = sorted(items.values(), key=lambda i: (i.rule.priority, i.item_id))
        placed: dict[str, Placement] = {}
        for item in order:
            sub = {k: items[k] for k in list(placed) + [item.item_id]}
            best, best_key = None, None
            for cand in self._candidates(item, ctx):
                trial = dict(placed); trial[item.item_id] = cand
                hard = hard_violations(sub, trial, ctx)
                cost = soft_cost(sub, trial, ctx)
                key = (hard > 1e-6, hard, cost)
                if best_key is None or key < best_key:
                    best, best_key = cand, key
                    if hard <= 1e-6 and cost < 1e-9:
                        break
            if best is None:     # item cannot fit in any orientation
                best = Placement(item.item_id, ctx.inner.cx, ctx.inner.cy, 0.0)
            placed[item.item_id] = best
        return placed


class CPSATBackend:
    """OR-Tools feasibility pass, per the architecture doc.

    Used automatically when `ortools` is installed. Positions are solved on a
    `grid` centimetre lattice with no-overlap and no-go reification; rotation is
    the small discrete set CP-SAT handles well. Falls back to `SweepBackend`
    if the model proves infeasible within `max_seconds`.
    """
    name = "cp-sat"

    def __init__(self, grid: float = 0.05, max_seconds: float = 8.0):
        self.grid = grid
        self.max_seconds = max_seconds
        from ortools.sat.python import cp_model  # noqa: F401  (import check)

    def seed(self, items: dict[str, Item], ctx: RoomContext,
             rng: random.Random) -> dict[str, Placement]:
        from ortools.sat.python import cp_model

        g = self.grid
        to_u = lambda v: int(round(v / g))
        inner = ctx.inner
        m = cp_model.CpModel()
        X, Y, W, D, ivx, ivy = {}, {}, {}, {}, [], []
        for k, it in items.items():
            # orientation is a boolean: swapped or not
            rot = m.NewBoolVar(f"r_{k}")
            w0, d0 = to_u(it.width), to_u(it.depth)
            w = m.NewIntVar(min(w0, d0), max(w0, d0), f"w_{k}")
            d = m.NewIntVar(min(w0, d0), max(w0, d0), f"d_{k}")
            m.Add(w == w0).OnlyEnforceIf(rot.Not())
            m.Add(d == d0).OnlyEnforceIf(rot.Not())
            m.Add(w == d0).OnlyEnforceIf(rot)
            m.Add(d == w0).OnlyEnforceIf(rot)
            x = m.NewIntVar(to_u(inner.x0), to_u(inner.x1), f"x_{k}")
            y = m.NewIntVar(to_u(inner.y0), to_u(inner.y1), f"y_{k}")
            xe = m.NewIntVar(to_u(inner.x0), to_u(inner.x1), f"xe_{k}")
            ye = m.NewIntVar(to_u(inner.y0), to_u(inner.y1), f"ye_{k}")
            m.Add(xe == x + w)
            m.Add(ye == y + d)
            X[k], Y[k], W[k], D[k] = x, y, w, d
            items[k].__dict__["_rot"] = rot
            ivx.append(m.NewIntervalVar(x, w, xe, f"ix_{k}"))
            ivy.append(m.NewIntervalVar(y, d, ye, f"iy_{k}"))
            for ng in ctx.no_go:                      # keep clear of door swings
                bx = m.NewBoolVar(f"ng_{k}_{id(ng)}_x")
                by = m.NewBoolVar(f"ng_{k}_{id(ng)}_y")
                m.Add(xe <= to_u(ng.x0)).OnlyEnforceIf(bx)
                m.Add(x >= to_u(ng.x1)).OnlyEnforceIf(bx.Not())
                m.Add(ye <= to_u(ng.y0)).OnlyEnforceIf(by)
                m.Add(y >= to_u(ng.y1)).OnlyEnforceIf(by.Not())
                if not items[k].rule.stackable:
                    m.AddBoolOr([bx, by])
        movable = [k for k in items if not items[k].rule.stackable]
        if movable:
            m.AddNoOverlap2D([ivx[i] for i, k in enumerate(items) if k in movable],
                             [ivy[i] for i, k in enumerate(items) if k in movable])
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = self.max_seconds
        solver.parameters.num_search_workers = 8
        if solver.Solve(m) not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            return SweepBackend().seed(items, ctx, rng)
        out = {}
        for k, it in items.items():
            w = solver.Value(W[k]) * g
            d = solver.Value(D[k]) * g
            yaw = 90.0 if abs(w - it.depth) < g else 0.0
            out[k] = Placement(k, solver.Value(X[k]) * g + w / 2,
                               solver.Value(Y[k]) * g + d / 2, yaw)
        return out


def default_backend() -> Backend:
    try:
        return CPSATBackend()
    except Exception:
        return SweepBackend()


# ──────────────────────────────────────────────────────── the solver ───────
class SpatialSolver:
    """Solve furniture placement for a scene, in place-safe fashion.

    >>> solver = SpatialSolver(seed=7)
    >>> solved, reports = solver.solve_scene(scene)
    """

    def __init__(self, backend: Backend | None = None, *, seed: int = 0,
                 iterations: int = 4000, t0: float = 2.2, t1: float = 0.02,
                 wall_margin: float = 0.05):
        self.backend = backend or default_backend()
        self.seed_value = seed
        self.iterations = iterations
        self.t0, self.t1 = t0, t1
        self.wall_margin = wall_margin

    # ------------------------------------------------------------------ --
    def solve_room(self, room: Room, objects: Sequence[SceneObject],
                   openings: Sequence[Opening]
                   ) -> tuple[dict[str, Placement], SolveReport]:
        items = {o.object_id: Item.from_object(o) for o in objects}
        ctx = RoomContext(room, openings, self.wall_margin)
        rng = random.Random(self.seed_value ^ (hash(room.room_id) & 0xFFFF))
        if not items:
            return {}, SolveReport(room.room_id, self.backend.name, 0, True, 0, 0.0, 0, False)

        place = self.backend.seed(items, ctx, rng)
        seed_hard = hard_violations(items, place, ctx)
        seed_soft = soft_cost(items, place, ctx)
        best = dict(place)
        best_score = seed_hard * HARD_PENALTY + seed_soft
        cur, cur_score = dict(place), best_score
        accepted = 0

        keys = list(items)
        for step in range(self.iterations):
            t = self.t0 * (self.t1 / self.t0) ** (step / max(1, self.iterations - 1))
            k = rng.choice(keys)
            trial = dict(cur)
            trial[k] = self._perturb(cur[k], items[k], ctx, rng)
            score = (hard_violations(items, trial, ctx) * HARD_PENALTY
                     + soft_cost(items, trial, ctx))
            if score < cur_score or rng.random() < math.exp((cur_score - score) / t):
                cur, cur_score = trial, score
                accepted += 1
                if score < best_score:
                    best, best_score = dict(trial), score

        # Annealing moves one piece at a time, so it cannot discover an
        # arrangement that needs the bed and both tables to move together.
        # That grouping is proposed here and kept only if it scores better.
        def settle(start: dict[str, Placement], fixed: set[str]) -> dict[str, Placement]:
            """Nudge everything except `fixed` into the space that is left."""
            movable = [k for k in items if k not in fixed]
            if not movable:
                return start
            state = dict(start)
            state_score = (hard_violations(items, state, ctx) * HARD_PENALTY
                           + soft_cost(items, state, ctx))
            local = random.Random(self.seed_value ^ 0x5EED)
            for step in range(max(200, self.iterations // 2)):
                k = local.choice(movable)
                trial = dict(state)
                trial[k] = self._perturb(state[k], items[k], ctx, local)
                trial_score = (hard_violations(items, trial, ctx) * HARD_PENALTY
                               + soft_cost(items, trial, ctx))
                if trial_score < state_score:
                    state, state_score = trial, trial_score
            return state

        best, best_score = _tidy_pairs(items, best, ctx, best_score, settle)

        final_hard = hard_violations(items, best, ctx)
        if final_hard > seed_hard + 1e-9:          # never ship a worse layout
            best, final_hard = place, seed_hard
        report = SolveReport(
            room.room_id, self.backend.name, len(items),
            feasible=final_hard <= 1e-6,
            hard_violations=int(final_hard > 1e-6),
            soft_cost=soft_cost(items, best, ctx),
            annealing_accepted=accepted,
            improved=best_score < seed_hard * HARD_PENALTY + seed_soft - 1e-9,
        )
        return best, report

    def _perturb(self, p: Placement, item: Item, ctx: RoomContext,
                 rng: random.Random) -> Placement:
        mode = rng.random()
        if mode < 0.18:
            return replace(p, yaw=rng.choice(YAWS))
        if mode < 0.34:                                   # snap back to a wall
            inner = ctx.inner
            w, d = yaw_footprint(item.width, item.depth, p.yaw)
            side = rng.randrange(4)
            if side == 0:
                return replace(p, y=inner.y0 + d / 2)
            if side == 1:
                return replace(p, y=inner.y1 - d / 2)
            if side == 2:
                return replace(p, x=inner.x0 + w / 2)
            return replace(p, x=inner.x1 - w / 2)
        sigma = 0.55 if mode < 0.75 else 0.15
        return replace(p, x=p.x + rng.gauss(0, sigma), y=p.y + rng.gauss(0, sigma))

    # ------------------------------------------------------------------ --
    def solve_scene(self, scene: Scene, *, rooms: Iterable[str] | None = None
                    ) -> tuple[Scene, list[SolveReport]]:
        """Return a new Scene with solver-placed objects. Input is untouched."""
        out = Scene.from_dict(scene.to_dict())
        wanted = set(rooms) if rooms is not None else {r.room_id for r in out.rooms}
        reports: list[SolveReport] = []
        by_id = {o.object_id: o for o in out.objects}

        for room in out.rooms:
            if room.room_id not in wanted:
                continue
            objs = out.objects_in(room.room_id)
            place, rep = self.solve_room(room, objs, out.openings_in(room.room_id))
            reports.append(rep)
            for oid, p in place.items():
                o = by_id[oid]
                o.position = {"x": round(p.x, 3), "y": 0.0, "z": round(p.y, 3)}
                o.rotation = {"yaw": float(p.yaw)}
        return out, reports


def _frange(lo: float, hi: float, step: float) -> list[float]:
    if hi < lo:
        return [(lo + hi) / 2]
    n = max(1, int((hi - lo) / step) + 1)
    return [lo + i * step for i in range(n)] + ([hi] if n * step < (hi - lo) else [])
