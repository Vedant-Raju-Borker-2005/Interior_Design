"""Whether a piece of furniture can actually stand in a particular room.

Floor area alone does not answer this. A room can be half empty and still have
no wall long enough for a 2 m sofa, and a piece that fits the wall can still
leave no way to walk past it. Both are checked here, in one place, so the
catalogue and the recommendation engine cannot drift apart on the question.

Room sizes come from the customer's confirmed floor plan once they have
uploaded one — see sync_room_sizes in the design studio router — and from the
BHK defaults before that.
"""
from __future__ import annotations

from typing import Any, Optional

FT_PER_MM = 0.00328084
# Clear floor left in front of a piece so somebody can get past it. Indian
# apartments run tight, so this is a walkway, not a furniture showroom aisle.
WALKWAY_FT = 2.3
# A piece is not pressed wall to wall; leave a hand's width at each end.
END_GAP_FT = 0.5

# Used only when a room has no measurements of its own yet.
DEFAULT_SIZE_FT: dict[str, tuple[float, float]] = {
    "living_room": (16.0, 12.0), "dining_area": (12.0, 10.0),
    "master_bedroom": (14.0, 11.0), "bedroom_master": (14.0, 11.0),
    "bedroom": (12.0, 10.0), "kitchen": (10.0, 8.0),
    "bathroom": (7.0, 5.0), "study": (10.0, 8.0), "balcony": (10.0, 5.0),
}


def room_size_ft(room: Any, room_type: Optional[str] = None) -> tuple[float, float]:
    """The room's long and short side in feet, measured if we know it."""
    length = float(getattr(room, "length_ft", 0) or 0) if room is not None else 0.0
    width = float(getattr(room, "width_ft", 0) or 0) if room is not None else 0.0
    if length <= 0 or width <= 0:
        key = (room_type or getattr(room, "room_type", "") or "").lower()
        length, width = DEFAULT_SIZE_FT.get(key) or (
            DEFAULT_SIZE_FT.get(key.rstrip("_123456789")) or (12.0, 10.0))
    return max(length, width), min(length, width)


def wall_fit(width_mm: Optional[float], depth_mm: Optional[float],
             long_wall_ft: float, short_wall_ft: float) -> tuple[bool, str]:
    """Can this piece stand here, and if not, what stops it."""
    w = float(width_mm or 0) * FT_PER_MM
    d = float(depth_mm or 0) * FT_PER_MM
    if w <= 0 or d <= 0:
        return True, ""                      # unmeasured: do not hide it

    # A piece can be turned, so try it against either wall.
    for run, across in ((long_wall_ft, short_wall_ft), (short_wall_ft, long_wall_ft)):
        if w <= run - END_GAP_FT and d + WALKWAY_FT <= across:
            return True, ""

    if min(w, d) > long_wall_ft - END_GAP_FT:
        return False, f"{w:.1f} ft wide — the longest wall here is {long_wall_ft:.1f} ft"
    return False, (f"would leave under {WALKWAY_FT:.1f} ft to walk past "
                   f"in a {short_wall_ft:.1f} ft room")


def product_fits(product: Any, room: Any, room_type: Optional[str] = None) -> tuple[bool, str]:
    """wall_fit for a catalogue row against a project room."""
    long_wall, short_wall = room_size_ft(room, room_type)
    return wall_fit(getattr(product, "width", None), getattr(product, "depth", None),
                    long_wall, short_wall)
