"""Make the layout a customer chose the plan their home is designed against.

Choosing a layout used to record the choice and nothing else, so two customers
who picked different 2 BHKs saw the same standard arrangement. This reads the
layout's own drawing and hands the result to the same machinery an uploaded
floor plan goes through, which is what makes the 2D plan and the 3D model show
their actual rooms.

Reusing that path matters as much as the result: the scene it produces carries
the alternative arrangements, the customer's own edits and the camera views, so
moving a piece or switching a room's layout keeps working exactly as before.

The reading is cached on the layout. It takes tens of seconds and depends only
on the drawing, so the first customer to pick a layout pays for it once -- or
nobody does, when scripts/warm_typology_plans.py has run first.
"""
from __future__ import annotations

import datetime
import logging
import os
from typing import Any, Optional
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from ..models import Project, Room, Typology
from .plan_layout import PlanError, clean_plan, detect_rooms, load_plan_image
from .typologies import normalise_bhk

log = logging.getLogger(__name__)

ASSET_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(
    os.path.abspath(__file__)))), "assets")


def _local_path(file_url: Optional[str]) -> Optional[str]:
    """The file on disk behind a stored asset URL.

    Stored URLs carry whichever host wrote them, so only the path is trusted --
    the same reason asset_urls.rehost exists on the way out.
    """
    if not file_url:
        return None
    path = urlparse(file_url).path or file_url
    marker = "/static/assets/"
    if marker in path:
        path = path.split(marker, 1)[1]
    elif path.startswith("/"):
        path = path.lstrip("/")
    candidate = os.path.normpath(os.path.join(ASSET_DIR, path))
    if not candidate.startswith(os.path.normpath(ASSET_DIR)):
        return None                      # never read outside the asset folder
    return candidate if os.path.exists(candidate) else None


def plan_image_path(typology: Typology) -> Optional[str]:
    """The drawing for this layout, if it has one on disk."""
    plan = getattr(typology, "floor_plan", None)
    return _local_path(plan.file_url if plan else None) or _local_path(typology.image_url)


def read_plan(typology: Typology, *, refresh: bool = False) -> Optional[dict[str, Any]]:
    """The rooms on this layout's drawing, read once and kept.

    Returns None when the layout has no drawing, which is not an error: the
    customer still gets the standard arrangement for their configuration.
    """
    if typology.plan_cache and not refresh:
        return typology.plan_cache
    path = plan_image_path(typology)
    if not path:
        return None

    with open(path, "rb") as fh:
        raw = fh.read()
    img = load_plan_image(raw)
    digits = [c for c in (normalise_bhk(typology.bhk_type) or "") if c.isdigit()]
    hint = int(digits[0]) if digits else 2
    ext = os.path.splitext(path)[1].lstrip(".").lower() or "png"
    detected = detect_rooms(img, bhk_hint=hint, raw=raw,
                            mime=f"image/{'jpeg' if ext in ('jpg', 'jpeg') else ext}")
    if not detected.get("rooms"):
        return None
    plan = getattr(typology, "floor_plan", None)
    return {
        "image_url": (plan.file_url if plan else None) or typology.image_url,
        "image_w": detected["image_w"],
        "image_h": detected["image_h"],
        "rooms": detected["rooms"],
        "plan_width_m": detected["plan_width_m"],
        "plan_depth_m": detected.get("plan_depth_m"),
        "door_gaps": detected.get("door_gaps", []),
        "method": detected.get("method"),
        "read_at": datetime.datetime.utcnow().isoformat(),
    }


def ensure_plan(db: Session, typology: Typology, *, refresh: bool = False) -> Optional[dict[str, Any]]:
    """read_plan, stored on the layout so it is only ever done once."""
    if typology.plan_cache and not refresh:
        return typology.plan_cache
    try:
        plan = read_plan(typology, refresh=refresh)
    except Exception:
        log.exception("could not read the plan for layout %s", typology.id)
        return None
    if plan:
        typology.plan_cache = plan
        db.commit()
    return plan


def apply_to_project(db: Session, project: Project, typology: Optional[Typology]) -> bool:
    """Design this home against the chosen layout's plan.

    Returns whether a plan was applied. False means the home keeps the standard
    arrangement for its configuration, which is what happens when the layout has
    no drawing or its drawing could not be read.

    A plan the customer uploaded themselves is never overwritten: they went to
    the trouble of giving us their own flat, which beats the builder's generic
    drawing for that layout.
    """
    from ..routers.design_studio import _mark_glb_stale, sync_room_sizes
    from .plan_layout import build_plan_variant
    from .ids_service import build_viewer_brief

    current = project.plan_layout if isinstance(project.plan_layout, dict) else {}
    # Any live plan that did not come from a layout was put there by the
    # customer, and their own flat beats the builder's drawing for this layout.
    # Plans predating this feature carry no source at all, which is why the
    # test is "not ours" rather than "theirs".
    if current.get("status") == "active" and current.get("source") != "typology":
        return False

    if typology is None:
        # The choice was cleared. Drop a plan that came from a layout, and leave
        # anything the customer uploaded alone.
        if current.get("source") == "typology":
            project.plan_layout = None
            _mark_glb_stale(project)
            db.commit()
        return False

    plan = ensure_plan(db, typology)
    if not plan:
        return False

    try:
        cleaned = clean_plan(plan["rooms"], plan["plan_width_m"],
                             plan["image_w"], plan["image_h"], plan.get("plan_depth_m"))
        rooms = db.query(Room).filter(Room.project_id == project.id).all()
        variant = build_plan_variant({**cleaned, "door_gaps": plan.get("door_gaps") or []},
                                     build_viewer_brief(project, rooms))
    except PlanError as exc:
        log.warning("layout %s produced an unusable plan: %s", typology.id, exc)
        return False
    except Exception:
        log.exception("could not build the model for layout %s", typology.id)
        return False

    project.plan_layout = {
        **cleaned,
        "image_url": plan.get("image_url"),
        "image_w": plan["image_w"],
        "image_h": plan["image_h"],
        "door_gaps": plan.get("door_gaps") or [],
        "method": plan.get("method"),
        # Live straight away: the customer picked this layout deliberately, so
        # there is nothing left for them to confirm. They can still edit every
        # room afterwards, exactly as with a plan they uploaded.
        "status": "active",
        "source": "typology",
        "typology_id": typology.id,
        "typology_name": typology.name,
        "summary": variant["summary"],
        "notes": [f"Rooms taken from {typology.name}. Adjust any of them below."],
        "confirmed_at": datetime.datetime.utcnow().isoformat(),
    }
    # Everything that shops against room sizes follows the chosen layout.
    sync_room_sizes(project, cleaned, db)
    _mark_glb_stale(project)
    db.commit()
    return True
