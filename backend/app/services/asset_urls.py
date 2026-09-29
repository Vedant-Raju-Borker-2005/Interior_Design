"""Serve a stored asset URL from whoever is actually answering the request.

Image URLs are stored absolute, with a hostname baked in. That hostname is
whatever machine last seeded or repaired the database, so the same row can be
right in production and useless on a developer's laptop — the catalogue points
at the deployed backend, which may be asleep, and no pictures appear.

The path after /static is the part that is stable. Rewriting the host to the
one serving the current request makes a single database work everywhere, and
leaves rows that point somewhere else entirely — a CDN, a supplier's site —
untouched.
"""
from __future__ import annotations

import re
from typing import Any, Optional

# Only our own asset routes are rewritten; anything else is somebody else's URL.
OURS = re.compile(r"^https?://[^/]+(/static/(?:assets|uploads)/.*)$", re.I)


def rehost(value: Any, base: Optional[str]) -> Any:
    """Point a stored URL, or a list or dict of them, at `base`."""
    if not base:
        return value
    base = base.rstrip("/")
    if isinstance(value, str):
        m = OURS.match(value)
        return base + m.group(1) if m else value
    if isinstance(value, list):
        return [rehost(v, base) for v in value]
    if isinstance(value, dict):
        return {k: rehost(v, base) for k, v in value.items()}
    return value


def base_from(request) -> Optional[str]:
    """The scheme and host this request arrived on."""
    try:
        return str(request.base_url).rstrip("/")
    except Exception:
        return None
