"""Whether a person can still move through a room once the furniture is in it.

An arrangement can satisfy every rule about overlaps and clearances and still
be unusable. A sideboard pushed into the one gap between the dining table and
the wall leaves the far half of the room cut off; a wardrobe across the inside
of a door leaves nowhere to step. No pairwise check notices either, because no
pair of objects is at fault -- the room as a whole is.

So the floor is answered directly: rasterise it, grow every piece by half a
shoulder width, and flood-fill from the doorways. What comes back says whether
you can get in, whether you can reach each piece, and whether the room is one
space or two. Nothing here knows about categories or rules; the caller decides
which pieces stand on the floor and where their access strips are.
"""
from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from typing import Optional, Sequence

Rect = tuple[float, float, float, float]      # x0, y0, x1, y1

CELL_M = 0.10             # the floor is tested in 10 cm squares
SHOULDER_M = 0.55         # a gap narrower than this is not a way through
TIGHT_SHOULDER_M = 0.38   # ... except in a room too small to offer one
TIGHT_ROOM_M2 = 3.4       # a shower room: you step in and turn round
DOOR_STEP_M = 0.12        # how far inside the door the first footfall is
SEARCH_M = 0.85           # how far from a door to look for somewhere to stand
POCKET_M2 = 1.20          # floor this big, cut off from the door, is a fault
STANDING_M2 = 0.25        # a patch of floor smaller than this is not stood in


@dataclass(frozen=True)
class Piece:
    """One piece of furniture, as the walk check needs to see it."""
    piece_id: str
    box: Rect
    blocks_floor: bool = True          # a wall cabinet or a rug does not
    access: Optional[Rect] = None      # where you stand to use it


@dataclass
class WalkReport:
    walkable: bool = True
    open_m2: float = 0.0
    sealed: list[str] = field(default_factory=list)      # doors you cannot enter
    stranded: list[str] = field(default_factory=list)    # pieces you cannot reach
    cutoff_m2: float = 0.0                               # floor behind the furniture
    blame: list[str] = field(default_factory=list)       # what to move or drop

    @property
    def reason(self) -> str:
        bits = []
        if self.sealed:
            bits.append(f"{len(self.sealed)} doorway(s) blocked")
        if self.stranded:
            bits.append(f"{len(self.stranded)} piece(s) out of reach")
        if self.cutoff_m2 > 0:
            bits.append(f"{self.cutoff_m2:.1f} m2 of floor cut off")
        return ", ".join(bits) or "walkable"

    def __bool__(self) -> bool:
        return self.walkable


def shoulder_for(area_m2: float) -> float:
    """How wide a gap has to be, in a room of this size, to walk through."""
    return TIGHT_SHOULDER_M if area_m2 <= TIGHT_ROOM_M2 else SHOULDER_M


class _Floor:
    """The room floor as a grid of cells, each free to stand on or not."""

    def __init__(self, inner: Rect, pieces: Sequence[Piece], clearance: float):
        x0, y0, x1, y1 = inner
        self.x0, self.y0 = x0, y0
        self.nx = max(1, int(round(max(0.0, x1 - x0) / CELL_M)))
        self.ny = max(1, int(round(max(0.0, y1 - y0) / CELL_M)))
        self.free = bytearray([1]) * (self.nx * self.ny)
        # Half the gap goes either side of the person, so each piece is grown
        # by half a shoulder; two pieces a shoulder apart then leave a lane.
        self.grow = clearance / 2.0
        for p in pieces:
            if p.blocks_floor:
                self._block(p.box)

    # ------------------------------------------------------------- the grid --
    def cells_in(self, rect: Rect, grow: float = 0.0):
        """Cells whose centres fall inside `rect`, grown by `grow`."""
        bx0, by0, bx1, by1 = rect
        bx0 -= grow
        by0 -= grow
        bx1 += grow
        by1 += grow
        i0 = max(0, int((bx0 - self.x0) / CELL_M))
        i1 = min(self.nx - 1, int((bx1 - self.x0) / CELL_M) + 1)
        j0 = max(0, int((by0 - self.y0) / CELL_M))
        j1 = min(self.ny - 1, int((by1 - self.y0) / CELL_M) + 1)
        for j in range(j0, j1 + 1):
            cy = self.y0 + (j + 0.5) * CELL_M
            if not by0 <= cy <= by1:
                continue
            for i in range(i0, i1 + 1):
                cx = self.x0 + (i + 0.5) * CELL_M
                if bx0 <= cx <= bx1:
                    yield j * self.nx + i

    def _block(self, rect: Rect) -> None:
        for c in self.cells_in(rect, self.grow):
            self.free[c] = 0

    def cell_at(self, x: float, y: float) -> int:
        i = min(self.nx - 1, max(0, int((x - self.x0) / CELL_M)))
        j = min(self.ny - 1, max(0, int((y - self.y0) / CELL_M)))
        return j * self.nx + i

    def centre_of(self, c: int) -> tuple[float, float]:
        return (self.x0 + (c % self.nx + 0.5) * CELL_M,
                self.y0 + (c // self.nx + 0.5) * CELL_M)

    def _neighbours(self, c: int):
        i, j = c % self.nx, c // self.nx
        if i > 0:
            yield c - 1
        if i + 1 < self.nx:
            yield c + 1
        if j > 0:
            yield c - self.nx
        if j + 1 < self.ny:
            yield c + self.nx

    def reach(self, seeds: Sequence[int]) -> bytearray:
        """Every cell you can walk to from `seeds`, four ways at a time."""
        seen = bytearray(self.nx * self.ny)
        queue: deque[int] = deque()
        for s in seeds:
            if 0 <= s < len(self.free) and self.free[s] and not seen[s]:
                seen[s] = 1
                queue.append(s)
        while queue:
            for n in self._neighbours(queue.popleft()):
                if self.free[n] and not seen[n]:
                    seen[n] = 1
                    queue.append(n)
        return seen

    def _island(self, start: int, open_cells: bytearray) -> list[int]:
        """The patch of free floor containing `start`, consumed as it goes."""
        group, queue = [start], deque([start])
        open_cells[start] = 0
        while queue:
            for n in self._neighbours(queue.popleft()):
                if open_cells[n]:
                    open_cells[n] = 0
                    group.append(n)
                    queue.append(n)
        return group

    def islands(self, least: float = 0.0) -> list[int]:
        """One cell of each open patch worth standing in, biggest first.

        Used for a room the plan reader found no doors for. Picking only the
        biggest patch would blame the furniture for a doorway we failed to
        read -- in a crowded bedroom the flood would start in whichever corner
        happened to win and call the rest of the room unreachable. Every patch
        is a starting point instead, so "out of reach" keeps its meaning:
        walled in by furniture on all sides.
        """
        floor_cells = max(1, int(round(least / (CELL_M * CELL_M))))
        rest = bytearray(self.free)
        found: list[tuple[int, int]] = []
        for c, standable in enumerate(rest):
            if not standable:
                continue
            group = self._island(c, rest)
            if len(group) >= floor_cells:
                found.append((len(group), group[0]))
        found.sort(reverse=True)
        return [cell for _, cell in found]

    def pockets(self, seen: bytearray) -> float:
        """The biggest patch of free floor the flood never got to."""
        rest = bytearray(self.free)
        for c, got in enumerate(seen):
            if got:
                rest[c] = 0
        worst = 0
        for c, standable in enumerate(rest):
            if standable:
                worst = max(worst, len(self._island(c, rest)))
        return worst * CELL_M * CELL_M


def _seeds(floor: _Floor, inner: Rect, doors: Sequence[tuple[str, float, float]]
           ) -> tuple[list[int], list[str]]:
    """A standing cell just inside each door, and the doors that have none.

    The probe walks straight in from the middle of the opening and stops at
    the first cell it can stand in. It deliberately does not look sideways:
    somewhere to stand a metre along the wall is no use when a wardrobe is
    across the doorway, because reaching it means walking through the
    wardrobe. Nothing in front of the door means the door is sealed.
    """
    x0, y0, x1, y1 = inner
    cx_room, cy_room = (x0 + x1) / 2, (y0 + y1) / 2
    seeds, sealed = [], []
    for door_id, dx, dy in doors:
        towards_x, towards_y = cx_room - dx, cy_room - dy
        if abs(towards_x) > abs(towards_y):
            step = (1 if towards_x > 0 else -1, 0)
        else:
            step = (0, 1 if towards_y > 0 else -1)
        found = None
        depth = DOOR_STEP_M
        while depth <= SEARCH_M and found is None:
            px = min(max(dx + step[0] * depth, x0 + CELL_M / 2), x1 - CELL_M / 2)
            py = min(max(dy + step[1] * depth, y0 + CELL_M / 2), y1 - CELL_M / 2)
            c = floor.cell_at(px, py)
            if floor.free[c]:
                found = c
            depth += CELL_M
        if found is None:
            sealed.append(door_id)
        else:
            seeds.append(found)
    return seeds, sealed


def _assess(inner: Rect, pieces: Sequence[Piece],
            doors: Sequence[tuple[str, float, float]], clearance: float
            ) -> WalkReport:
    """One pass: build the floor, walk it, and say what went wrong."""
    floor = _Floor(inner, pieces, clearance)
    seeds, sealed = _seeds(floor, inner, doors)
    if not doors:
        # A room the reader found no doors for is still judged on whether its
        # own floor hangs together, from every patch big enough to stand in.
        # Only when there were no doors to begin with: a room whose every
        # doorway is blocked has already failed, and seeding past them would
        # hide exactly the fault worth reporting.
        seeds, sealed = floor.islands(STANDING_M2), []

    seen = floor.reach(seeds)
    # Reaching a piece means standing within arm's length of its working side,
    # not standing inside the strip itself: a floor lamp asks for 15 cm of
    # access, which is thinner than the person it is being reached by, so the
    # strip is widened by the same half-shoulder every piece was grown by.
    stranded = [p.piece_id for p in pieces
                if p.access is not None
                and not any(seen[c] for c in floor.cells_in(p.access, floor.grow))]
    cutoff = floor.pockets(seen)
    return WalkReport(
        walkable=not sealed and not stranded and cutoff < POCKET_M2,
        open_m2=round(sum(seen) * CELL_M * CELL_M, 2),
        sealed=sealed, stranded=stranded,
        cutoff_m2=round(cutoff, 2) if cutoff >= POCKET_M2 else 0.0,
    )


def _penalty(report: WalkReport) -> float:
    """How bad an arrangement is to move around in. Lower is better."""
    return (10.0 * len(report.sealed) + 5.0 * len(report.stranded)
            + report.cutoff_m2 - 0.01 * report.open_m2)


def walk_report(inner: Rect, pieces: Sequence[Piece],
                doors: Sequence[tuple[str, float, float]] = ()) -> WalkReport:
    """Can a person move through this room, and if not, what is in the way?

    Blame is settled by taking each piece away in turn and asking the same
    question again. A piece is named only if the room gets better without it,
    which keeps the caller from stripping a room that is simply too small --
    there, nothing helps, nothing is blamed, and the furniture stays.
    """
    x0, y0, x1, y1 = inner
    area = max(0.0, x1 - x0) * max(0.0, y1 - y0)
    if area <= 0.3 or not pieces:
        return WalkReport(open_m2=round(area, 2))

    clearance = shoulder_for(area)
    report = _assess(inner, pieces, doors, clearance)
    if report.walkable:
        return report

    base = _penalty(report)
    helps: list[tuple[float, str]] = []
    for p in pieces:
        if not p.blocks_floor:
            continue
        without = [q for q in pieces if q.piece_id != p.piece_id]
        gain = base - _penalty(_assess(inner, without, doors, clearance))
        if gain > 0.05:
            helps.append((gain, p.piece_id))
    helps.sort(reverse=True)
    report.blame = [pid for _, pid in helps]
    return report
