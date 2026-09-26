"""One place to decide how many pixels of a plan image make a metre.

Several things in a drawing hint at its scale: a room with its size printed in
it, a room with its area printed in it, the width of a door, and — weakest —
the fact that a 3 BHK is usually about a certain size. The reader used to let
each of these overwrite the last, so whichever ran last won outright and a
single misread number threw the whole plan out.

Here each hint is one piece of evidence with a weight, and the scale is the
weighted median of all of them. A wrong hint is outvoted instead of deciding,
and `describe` can say what the answer was based on.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Optional

# Anything outside this is not a flat, so the evidence that produced it is
# discarded before the vote rather than being allowed to drag the median.
MIN_PLAN_M = 2.5
MAX_PLAN_M = 80.0

# How much each kind of hint is trusted, before it is multiplied by how many
# rooms it came from. A printed size is the drawing telling you the answer; a
# table of typical flat sizes is a guess of last resort.
WEIGHTS = {
    "printed sizes": 6.0,
    "printed areas": 5.0,
    "door widths": 2.0,
    "typical carpet area": 1.0,
    "typical envelope": 0.7,
}


# Which hints are of a kind. A lower number is believed over a higher one.
TIER = {
    "printed sizes": 0,
    "printed areas": 0,
    "door widths": 1,
    "typical carpet area": 2,
    "typical envelope": 2,
}


@dataclass(frozen=True)
class Evidence:
    """One estimate of pixels per metre, and how much it should count."""
    ppm: float
    source: str
    samples: int = 1

    @property
    def weight(self) -> float:
        # Two rooms agreeing is better than one, but not twice as good: a
        # misread number repeated across rooms should not win on volume alone.
        return WEIGHTS.get(self.source, 1.0) * math.sqrt(max(self.samples, 1))


def _weighted_median(pairs: list[tuple[float, float]]) -> float:
    """The value where half the weight lies either side."""
    pairs = sorted(pairs)
    half = sum(w for _, w in pairs) / 2.0
    run = 0.0
    for value, weight in pairs:
        run += weight
        if run >= half:
            return value
    return pairs[-1][0]


def resolve(evidence: Iterable[Evidence], image_w: int, image_h: int) -> Optional[tuple[float, str]]:
    """Pixels per metre for an image, plus a sentence naming what decided it.

    Returns None when nothing credible was offered, in which case the caller
    keeps whatever it already had.
    """
    usable = [e for e in evidence
              if e.ppm and e.ppm > 0 and MIN_PLAN_M <= image_w / e.ppm <= MAX_PLAN_M]
    if not usable:
        return None

    # The tiers are not rivals. A drawing that states a room's size is telling
    # you the scale; a table of typical flat sizes is only a guess for when it
    # does not. So the best tier present decides, and the vote happens inside
    # it — enough to outvote one misread number, without a guess diluting a
    # measurement.
    best = min(TIER.get(e.source, 3) for e in usable)
    usable = [e for e in usable if TIER.get(e.source, 3) == best]

    ppm = _weighted_median([(e.ppm, e.weight) for e in usable])

    # Having chosen, drop whatever disagrees wildly and take the vote again, so
    # a couple of good hints are not pulled about by one bad one.
    close = [e for e in usable if abs(math.log(e.ppm / ppm)) <= 0.5]
    if close:
        ppm = _weighted_median([(e.ppm, e.weight) for e in close])
    else:
        close = usable

    by_source: dict[str, int] = {}
    for e in close:
        by_source[e.source] = by_source.get(e.source, 0) + e.samples
    named = ", ".join(f"{src} ({n})" if n > 1 else src
                      for src, n in sorted(by_source.items(), key=lambda kv: -WEIGHTS.get(kv[0], 0)))
    return ppm, named
