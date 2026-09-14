"""Feed the customer's uploaded floor plan into AI rendering — feedback 1.1.

A render is plan-specific only if the image model actually receives the plan.
This resolves the plan a render should use (the room's own plan first, then the
project's) and returns it ready for an image+text request.
"""
from __future__ import annotations

import base64
import mimetypes
import os
from typing import Optional
from urllib.parse import unquote, urlparse

# Image models accept raster images; a PDF plan cannot be attached directly.
_RASTER = {".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp"}

# Anything larger is almost certainly an unoptimised scan and would blow the
# request size limit of the image API.
_MAX_BYTES = 8 * 1024 * 1024


def _local_path(url: str) -> Optional[str]:
    """`http://host/static/assets/floor_plans/x.png` -> `assets/floor_plans/x.png`."""
    if not url:
        return None
    path = unquote(urlparse(url).path or url)
    marker = "/static/assets/"
    if marker not in path:
        return None
    return os.path.join("assets", path.split(marker, 1)[1])


def plan_url_for(project, room=None) -> Optional[str]:
    room_plan = ((getattr(room, "custom_config", None) or {}).get("floor_plan_url")) if room is not None else None
    return room_plan or getattr(project, "floor_plan_url", None)


def plan_image_for(project, room=None) -> Optional[tuple[str, str]]:
    """Return (base64, mime) for the plan image, or None if there is no usable
    raster plan on disk. PDFs are skipped rather than failing the render."""
    local = _local_path(plan_url_for(project, room) or "")
    if not local or not os.path.exists(local):
        return None
    ext = os.path.splitext(local)[1].lower()
    mime = _RASTER.get(ext) or mimetypes.guess_type(local)[0]
    if ext not in _RASTER or not mime:
        return None
    if os.path.getsize(local) > _MAX_BYTES:
        return None
    with open(local, "rb") as fh:
        return base64.b64encode(fh.read()).decode("ascii"), mime


def plan_prompt_suffix(room_type: str) -> str:
    room = (room_type or "room").replace("_", " ")
    return (
        f" Base the {room} on the attached floor plan: keep its walls, openings, "
        f"proportions and furniture zones exactly as drawn, viewed at eye level."
    )
