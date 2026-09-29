"""Design studio — edit the design and keep the 2D plan / 3D model in step.

The full-page studio shows the customer's home as a synchronized 2D plan and
3D model. "Edit design" writes to the project's own preference fields (the same
ones onboarding fills), so the viewer, product recommendations and quotation
all read one source of truth. The 3D model is also exported as a real GLB and
kept on the server, so there is always a downloadable file of the current design.
"""
from __future__ import annotations

import datetime
import mimetypes
import os
import re
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth_utils import current_user
from ..db import get_db
from ..models import FloorPlan, Project, Quotation, Room, User
from ..services.business_rules import normalize_bhk
from ..services.ids_service import (
    VIEWER_COLORS,
    VIEWER_FABRICS,
    VIEWER_STYLES,
    VIEWER_WOODS,
    active_plan_layout,
    build_viewer_brief,
)
from ..services.plan_layout import (
    IMAGE_EXTS,
    MAX_PLAN_BYTES,
    PlanError,
    build_plan_variant,
    clean_plan,
    detect_rooms,
    load_plan_image,
    plan_bhk,
    room_type_options,
)

router = APIRouter()

ASSET_DIR = os.getenv("ASSET_DIR", "./assets")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
MAX_GLB_BYTES = 80 * 1024 * 1024

# The vocabularies onboarding already uses, so edits land in the same shape.
BHK_OPTIONS = ["1BHK", "2BHK", "3BHK", "4BHK", "5BHK"]
STYLE_OPTIONS = {
    "modern": "Modern", "scandinavian": "Scandinavian",
    "indian_contemporary": "Indian Contemporary", "luxury": "Luxury",
    "mediterranean": "Mediterranean", "boho": "Boho",
}
BUDGET_OPTIONS = [  # stored as the band's upper bound, exactly like onboarding
    {"value": 500000, "label": "₹3L – ₹5L"},
    {"value": 800000, "label": "₹5L – ₹8L"},
    {"value": 1200000, "label": "₹8L – ₹12L"},
    {"value": 2000000, "label": "₹12L – ₹20L"},
    {"value": 9999999, "label": "₹20L+"},
]
QUALITY_OPTIONS = {"budget": "Budget", "standard": "Standard", "premium": "Premium"}
TIMELINE_OPTIONS = {
    "1_month": "ASAP (< 1 month)", "3_months": "1–3 months",
    "6_months": "3–6 months", "flexible": "Flexible / Planning",
}
SCOPE_OPTIONS = {"new": "New Home", "upgrade": "Upgrading"}
CITY_OPTIONS = ["Bangalore", "Mumbai", "Delhi", "Chennai", "Hyderabad", "Pune", "Kolkata", "Ahmedabad", "Other"]


def _roles(user: User) -> list[str]:
    return [r.strip() for r in (user.role or "").split(",") if r.strip()]


def _owned(project_id: str, user: User, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    if project.user_id != user.id and "admin" not in _roles(user):
        raise HTTPException(403, "Not your project")
    return project


def _bhk_locked(project: Project, db: Session) -> Optional[str]:
    """Rooms, items and prices are built per BHK. Once a quotation exists,
    changing BHK here would silently desync them, so it is locked."""
    if db.query(Quotation).filter(Quotation.project_id == project.id).first():
        return "BHK is fixed once a quotation has been generated for this project."
    if project.flat_id:
        return "BHK is set by the builder for this flat."
    return None


class DesignBriefReq(BaseModel):
    bhk_type: Optional[str] = None
    style: Optional[str] = None
    budget: Optional[float] = None
    quality: Optional[str] = None
    wood: Optional[str] = None
    fabric: Optional[str] = None
    colors: Optional[list[str]] = Field(default=None, description="1–3 palette colour names")
    city: Optional[str] = None
    timeline: Optional[str] = None
    scope: Optional[str] = None


def _form_values(project: Project) -> dict[str, Any]:
    tags = project.style_tags or []
    return {
        "bhk_type": normalize_bhk(project.bhk_type) or "2BHK",
        "style": tags[0] if tags else None,
        "budget": project.budget,
        "quality": project.material_preference,
        "wood": project.interior_material_preference,
        "fabric": project.fabric_preference,
        "colors": list(project.color_preferences or []),
        "city": project.city,
        "timeline": project.timeline,
        "scope": project.furnishing_type,
    }


def _payload(project: Project, db: Session) -> dict[str, Any]:
    rooms = db.query(Room).filter(Room.project_id == project.id).all()
    glb_url = (project.defaults or {}).get("scene_glb_url") if isinstance(project.defaults, dict) else None
    return {
        "project_id": project.id,
        "property_name": project.property_name,
        "values": _form_values(project),
        # What the 2D/3D viewer renders after mapping to its vocabulary.
        "brief": build_viewer_brief(project, rooms),
        "locks": {"bhk_type": _bhk_locked(project, db)},
        "options": {
            "bhk_type": BHK_OPTIONS,
            "style": [{"value": k, "label": v} for k, v in STYLE_OPTIONS.items()],
            "budget": BUDGET_OPTIONS,
            "quality": [{"value": k, "label": v} for k, v in QUALITY_OPTIONS.items()],
            "wood": VIEWER_WOODS,
            "fabric": VIEWER_FABRICS,
            "colors": VIEWER_COLORS,
            "city": CITY_OPTIONS,
            "timeline": [{"value": k, "label": v} for k, v in TIMELINE_OPTIONS.items()],
            "scope": [{"value": k, "label": v} for k, v in SCOPE_OPTIONS.items()],
        },
        "glb": {
            "url": glb_url,
            "updated_at": (project.defaults or {}).get("scene_glb_updated_at") if isinstance(project.defaults, dict) else None,
            # True after an edit until the studio re-exports the new model.
            "stale": bool((project.defaults or {}).get("scene_glb_stale")) if isinstance(project.defaults, dict) else False,
        },
        "plan": _plan_brief(project),
    }


def _plan_brief(project: Project) -> Optional[dict[str, Any]]:
    plan = project.plan_layout if isinstance(project.plan_layout, dict) else None
    if not plan:
        return None
    return {
        "status": plan.get("status"),
        "image_url": plan.get("image_url"),
        "bhk": plan_bhk(plan.get("rooms") or []) if plan.get("rooms") else None,
        "summary": plan.get("summary"),
        "active": active_plan_layout(project) is not None,
    }


def _mark_glb_stale(project: Project) -> None:
    defaults = dict(project.defaults or {}) if isinstance(project.defaults, dict) else {}
    if defaults.get("scene_glb_url"):
        defaults["scene_glb_stale"] = True
    defaults["design_edited_at"] = datetime.datetime.utcnow().isoformat()
    project.defaults = defaults


@router.get("/design-brief/{project_id}", summary="Design studio — current design and edit options")
def get_design_brief(project_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return _payload(_owned(project_id, user, db), db)


@router.put("/design-brief/{project_id}", summary="Design studio — edit the design (updates 2D + 3D)")
def update_design_brief(
    project_id: str,
    req: DesignBriefReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _owned(project_id, user, db)
    errors: list[str] = []

    if req.bhk_type is not None:
        bhk = normalize_bhk(req.bhk_type)
        if bhk not in BHK_OPTIONS:
            errors.append(f"BHK must be one of {', '.join(BHK_OPTIONS)}")
        elif bhk != normalize_bhk(project.bhk_type):
            locked = _bhk_locked(project, db)
            if locked:
                errors.append(locked)
            else:
                project.bhk_type = bhk

    if req.style is not None:
        if req.style not in STYLE_OPTIONS:
            errors.append(f"Unknown style '{req.style}'")
        else:
            project.style_tags = [req.style]
            # Keep room-level style in step so room renders agree with the plan.
            for room in db.query(Room).filter(Room.project_id == project.id).all():
                room.style_preference = req.style

    if req.budget is not None:
        if req.budget <= 0:
            errors.append("Budget must be positive")
        else:
            project.budget = float(req.budget)

    if req.quality is not None:
        if req.quality not in QUALITY_OPTIONS:
            errors.append(f"Quality must be one of {', '.join(QUALITY_OPTIONS)}")
        else:
            project.material_preference = req.quality

    if req.wood is not None:
        if req.wood not in VIEWER_WOODS:
            errors.append(f"Wood must be one of {', '.join(VIEWER_WOODS)}")
        else:
            project.interior_material_preference = req.wood

    if req.fabric is not None:
        if req.fabric not in VIEWER_FABRICS:
            errors.append(f"Fabric must be one of {', '.join(VIEWER_FABRICS)}")
        else:
            project.fabric_preference = req.fabric

    if req.colors is not None:
        unknown = [c for c in req.colors if c not in VIEWER_COLORS]
        if unknown:
            errors.append(f"Unknown colours: {', '.join(unknown)}")
        elif not 1 <= len(req.colors) <= 3:
            errors.append("Pick between 1 and 3 colours")
        else:
            project.color_preferences = list(dict.fromkeys(req.colors))

    if req.city is not None:
        if req.city not in CITY_OPTIONS:
            errors.append(f"City must be one of {', '.join(CITY_OPTIONS)}")
        else:
            project.city = req.city

    if req.timeline is not None:
        if req.timeline not in TIMELINE_OPTIONS:
            errors.append("Unknown timeline")
        else:
            project.timeline = req.timeline

    if req.scope is not None:
        if req.scope not in SCOPE_OPTIONS:
            errors.append("Scope must be 'new' or 'upgrade'")
        else:
            project.furnishing_type = req.scope

    if errors:
        db.rollback()
        raise HTTPException(400, "; ".join(errors))

    # The saved GLB describes the previous design; mark it stale until the
    # studio re-exports the updated model.
    defaults = dict(project.defaults or {}) if isinstance(project.defaults, dict) else {}
    if defaults.get("scene_glb_url"):
        defaults["scene_glb_stale"] = True
    defaults["design_edited_at"] = datetime.datetime.utcnow().isoformat()
    project.defaults = defaults

    db.commit()
    db.refresh(project)
    return _payload(project, db)


# ═══════════════════════════════════════════════════════════ GLB model ═════
@router.post("/scene-glb/{project_id}", summary="Design studio — store the exported 3D model (.glb)")
async def upload_scene_glb(
    project_id: str,
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _owned(project_id, user, db)
    data = await file.read()
    if len(data) > MAX_GLB_BYTES:
        raise HTTPException(413, "3D model is larger than 80 MB")
    # A binary glTF starts with the ASCII magic 'glTF' and version 2.
    if len(data) < 20 or data[:4] != b"glTF" or int.from_bytes(data[4:8], "little") != 2:
        raise HTTPException(400, "Not a glTF 2.0 binary (.glb) file")

    model_dir = os.path.join(ASSET_DIR, "models")
    os.makedirs(model_dir, exist_ok=True)
    path = os.path.join(model_dir, f"{project.id}.glb")
    with open(path, "wb") as fh:
        fh.write(data)

    stamp = datetime.datetime.utcnow()
    url = f"{BACKEND_URL}/static/assets/models/{project.id}.glb?v={int(stamp.timestamp())}"
    defaults = dict(project.defaults or {}) if isinstance(project.defaults, dict) else {}
    defaults.update(scene_glb_url=url, scene_glb_updated_at=stamp.isoformat(),
                    scene_glb_bytes=len(data), scene_glb_stale=False)
    project.defaults = defaults
    db.commit()
    return {"project_id": project.id, "url": url, "bytes": len(data), "updated_at": stamp.isoformat()}


@router.get("/scene-glb/{project_id}", summary="Design studio — download the 3D model (.glb)")
def download_scene_glb(project_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    project = _owned(project_id, user, db)
    path = os.path.join(ASSET_DIR, "models", f"{project.id}.glb")
    if not os.path.exists(path):
        raise HTTPException(404, "No 3D model has been exported for this project yet")
    safe = "".join(ch if ch.isalnum() or ch in "-_ " else "_" for ch in (project.property_name or "design")).strip()
    return FileResponse(path, media_type="model/gltf-binary", filename=f"{safe or 'design'}.glb")


# ═══════════════════════════════════════════════════ uploaded floor plan ═════
class PlanRoomReq(BaseModel):
    id: Optional[str] = None
    label: Optional[str] = None
    room_type: str
    box: list[float] = Field(..., description="[x0, y0, x1, y1] as fractions of the plan image")


class PlanLayoutReq(BaseModel):
    rooms: list[PlanRoomReq]
    plan_width_m: float = Field(..., description="Real-world width of the whole plan image, in metres")
    plan_depth_m: Optional[float] = Field(None, description="Real-world height of the image, when it is stretched")
    activate: bool = True
    sync_bhk: bool = Field(False, description="Also set the project's BHK to match the plan")


def _save_panel(img, detected: dict[str, Any], project_id: str, plan_dir: str, ext: str) -> str:
    """Save the flat that was read out of a multi-flat sheet, and return its URL."""
    box = detected["panels"][detected["panel"]]["box"]
    w, h = img.size
    crop = img.crop((round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h)))
    name = f"plan_{project_id[:8]}_{uuid.uuid4().hex[:8]}_flat{detected['panel'] + 1}{ext}"
    crop.convert("RGB").save(os.path.join(plan_dir, name), quality=92)
    return f"{BACKEND_URL}/static/assets/floor_plans/{name}"


def _plan_payload(project: Project, db: Session) -> dict[str, Any]:
    plan = project.plan_layout if isinstance(project.plan_layout, dict) else None
    return {
        "project_id": project.id,
        "project_bhk": normalize_bhk(project.bhk_type) or "2BHK",
        "bhk_locked": _bhk_locked(project, db),
        "plan": plan,
        "plan_bhk": plan_bhk(plan["rooms"]) if plan and plan.get("rooms") else None,
        "active": active_plan_layout(project) is not None,
        "room_types": room_type_options(),
        "gemini": bool(os.getenv("GEMINI_KEY")),
    }


@router.get("/plan-layout/{project_id}", summary="Floor plan — the traced rooms for this project")
def get_plan_layout(project_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    # The customer is about to upload or re-detect: have the label reader
    # loaded by then instead of making that request wait for it.
    from ..services.plan_ocr import warm_up_in_background
    warm_up_in_background()
    return _plan_payload(_owned(project_id, user, db), db)


@router.post("/plan-layout/{project_id}/detect", summary="Floor plan — upload an image and detect its rooms")
async def detect_plan_layout(
    project_id: str,
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _owned(project_id, user, db)
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in IMAGE_EXTS:
        raise HTTPException(400, "Upload the floor plan as a JPG, PNG or WebP image. "
                                 "(A PDF can't be traced — take a screenshot of the plan page instead.)")
    data = await file.read()
    if len(data) > MAX_PLAN_BYTES:
        raise HTTPException(413, "Floor plan must be 10 MB or smaller")
    try:
        img = load_plan_image(data)
    except Exception:
        raise HTTPException(400, "That file isn't a readable image")
    if min(img.size) < 200:
        raise HTTPException(400, "The image is too small to read — upload a plan at least 600 px wide")

    plan_dir = os.path.join(ASSET_DIR, "floor_plans")
    os.makedirs(plan_dir, exist_ok=True)
    name = f"plan_{project.id[:8]}_{uuid.uuid4().hex[:8]}{ext}"
    with open(os.path.join(plan_dir, name), "wb") as fh:
        fh.write(data)
    url = f"{BACKEND_URL}/static/assets/floor_plans/{name}"

    digits = re.findall(r"\d", normalize_bhk(project.bhk_type) or "2")
    hint = int(digits[0]) if digits else 2
    mime = file.content_type or mimetypes.guess_type(name)[0] or "image/png"
    detected = await run_in_threadpool(detect_rooms, img, bhk_hint=hint, raw=data, mime=mime)
    # A sheet of several flats is read one flat at a time, so the picture the
    # customer checks has to be that flat, not the whole sheet.
    sheet_url = None
    if detected.get("panels"):
        sheet_url, url = url, _save_panel(img, detected, project.id, plan_dir, ext)

    project.floor_plan_url = url
    db.add(FloorPlan(project_id=project.id, file_url=url, file_type=ext.lstrip("."), uploaded_by=user.id))
    previous = project.plan_layout if isinstance(project.plan_layout, dict) else {}
    project.plan_layout = {
        # A fresh upload is a draft: the customer checks the tracing, and picks
        # which flat is theirs on a multi-flat sheet, before it goes live.
        "status": "draft",
        "image_url": url,
        "image_w": detected["image_w"],
        "image_h": detected["image_h"],
        "rooms": detected["rooms"],
        "plan_width_m": detected["plan_width_m"],
        "plan_depth_m": detected.get("plan_depth_m"),
        "door_gaps": detected.get("door_gaps", []),
        "method": detected["method"],
        "notes": detected["notes"],
        "uploaded_at": datetime.datetime.utcnow().isoformat(),
        "sheet_url": sheet_url,
        "panels": detected.get("panels"),
        "panel": detected.get("panel"),
        # Keep the last confirmed layout live until the new one is confirmed.
        "previous_active": previous if previous.get("status") == "active" else previous.get("previous_active"),
    }
    db.commit()
    db.refresh(project)
    return _plan_payload(project, db)


@router.post("/plan-layout/{project_id}/redetect", summary="Floor plan — detect the rooms again on the uploaded image")
async def redetect_plan_layout(project_id: str, panel: Optional[int] = None,
                               user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Re-run room detection on the plan already uploaded (e.g. after the
    detector improves), without uploading the file again.

    `panel` picks a different flat when the upload was a sheet of several.
    """
    project = _owned(project_id, user, db)
    current = project.plan_layout if isinstance(project.plan_layout, dict) else None
    # Re-read the whole sheet when one is kept, so another flat can be chosen.
    source = (current or {}).get("sheet_url") or (current or {}).get("image_url") or ""
    name = os.path.basename(source)
    path = os.path.join(ASSET_DIR, "floor_plans", name)
    if not name or not os.path.isfile(path):
        raise HTTPException(400, "Upload the floor plan image first")
    with open(path, "rb") as fh:
        data = fh.read()
    try:
        img = load_plan_image(data)
    except Exception:
        raise HTTPException(400, "The uploaded plan can no longer be read — upload it again")

    digits = re.findall(r"\d", normalize_bhk(project.bhk_type) or "2")
    hint = int(digits[0]) if digits else 2
    mime = mimetypes.guess_type(name)[0] or "image/png"
    detected = await run_in_threadpool(detect_rooms, img, bhk_hint=hint, raw=data, mime=mime, panel=panel)
    plan_dir = os.path.join(ASSET_DIR, "floor_plans")
    ext = os.path.splitext(name)[1] or ".png"
    image_url = current.get("image_url")
    sheet_url = current.get("sheet_url")
    if detected.get("panels"):
        sheet_url = sheet_url or current.get("image_url")
        image_url = _save_panel(img, detected, project.id, plan_dir, ext)
        project.floor_plan_url = image_url

    project.plan_layout = {
        **{k: v for k, v in current.items() if k not in ("summary", "confirmed_at")},
        "status": "draft",
        "image_url": image_url,
        "sheet_url": sheet_url,
        "panels": detected.get("panels"),
        "panel": detected.get("panel"),
        "rooms": detected["rooms"],
        "plan_width_m": detected["plan_width_m"],
        "plan_depth_m": detected.get("plan_depth_m"),
        "door_gaps": detected.get("door_gaps", []),
        "method": detected["method"],
        "notes": detected["notes"],
        "image_w": detected["image_w"],
        "image_h": detected["image_h"],
        "previous_active": current if current.get("status") == "active" else current.get("previous_active"),
    }
    db.commit()
    db.refresh(project)
    return _plan_payload(project, db)


M_TO_FT = 3.28084


def _family(room_type: str) -> str:
    """Bedrooms and bathrooms are numbered in the database but not on a plan."""
    t = (room_type or "").lower()
    if t.startswith("bedroom") or t == "master_bedroom":
        return "bedroom"
    if t.startswith("bathroom") or t in ("wc", "toilet"):
        return "bathroom"
    return t


def _db_room_order(room) -> tuple:
    """Master first, then 2, 3 ... so the biggest traced room becomes the master."""
    t = (room.room_type or "").lower()
    if t.endswith("_master") or t == "master_bedroom":
        return (0, t)
    tail = t.rsplit("_", 1)[-1]
    return (int(tail), t) if tail.isdigit() else (1, t)


def sync_room_sizes(project, plan: dict, db) -> int:
    """Copy the traced room sizes onto the project's rooms.

    Until this ran, the rooms table kept the defaults a BHK is seeded with —
    a 14x12 ft master bedroom — while the customer's own plan said 8.6x11.5.
    Everything that shops for furniture reads the table, so it was sizing a
    room that did not exist and recommending sets that could never fit.
    """
    width_m = float(plan.get("plan_width_m") or 0)
    image_w = float(plan.get("image_w") or 0)
    image_h = float(plan.get("image_h") or 0)
    if width_m <= 0 or image_w <= 0 or image_h <= 0:
        return 0
    depth_m = float(plan.get("plan_depth_m") or (width_m * image_h / image_w))

    traced: dict[str, list[tuple[float, float]]] = {}
    for r in plan.get("rooms") or []:
        box = r.get("box") or []
        if len(box) != 4:
            continue
        w = abs(box[2] - box[0]) * width_m * M_TO_FT
        d = abs(box[3] - box[1]) * depth_m * M_TO_FT
        if w < 2 or d < 2:
            continue
        traced.setdefault(_family(r.get("room_type") or ""), []).append((w, d))

    rows: dict[str, list] = {}
    for room in db.query(Room).filter(Room.project_id == project.id).all():
        rows.setdefault(_family(room.room_type), []).append(room)

    changed = 0
    for family, sizes in traced.items():
        targets = sorted(rows.get(family) or [], key=_db_room_order)
        if not targets:
            continue
        # Largest traced room to the master, next to bedroom 2, and so on.
        sizes.sort(key=lambda wd: -(wd[0] * wd[1]))
        for room, (w, d) in zip(targets, sizes):
            length, width = max(w, d), min(w, d)
            if (round(room.length_ft or 0, 1), round(room.width_ft or 0, 1)) ==                     (round(length, 1), round(width, 1)):
                continue
            room.length_ft = round(length, 1)
            room.width_ft = round(width, 1)
            changed += 1
    return changed


@router.put("/plan-layout/{project_id}", summary="Floor plan — confirm the rooms and build the 2D plan + 3D model")
def save_plan_layout(
    project_id: str,
    req: PlanLayoutReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _owned(project_id, user, db)
    current = project.plan_layout if isinstance(project.plan_layout, dict) else None
    if not current or not current.get("image_url"):
        raise HTTPException(400, "Upload the floor plan image first")
    try:
        cleaned = clean_plan([r.model_dump() for r in req.rooms], req.plan_width_m,
                             current.get("image_w"), current.get("image_h"), req.plan_depth_m)
        rooms = db.query(Room).filter(Room.project_id == project.id).all()
        variant = build_plan_variant({**cleaned, "door_gaps": current.get("door_gaps") or []},
                                     build_viewer_brief(project, rooms))
    except PlanError as exc:
        raise HTTPException(400, str(exc))

    if req.sync_bhk:
        target = variant["bhk"].replace(" ", "")
        if target != normalize_bhk(project.bhk_type):
            locked = _bhk_locked(project, db)
            if locked:
                raise HTTPException(400, locked)
            project.bhk_type = target

    project.plan_layout = {
        **{k: v for k, v in current.items() if k != "previous_active"},
        **cleaned,
        "status": "active" if req.activate else "draft",
        "summary": variant["summary"],
        "confirmed_at": datetime.datetime.utcnow().isoformat(),
    }
    if req.activate:
        # A confirmed plan is the truth about this flat from here on, so the
        # rooms everything else shops against are resized to match it.
        sync_room_sizes(project, cleaned, db)
    _mark_glb_stale(project)
    db.commit()
    db.refresh(project)
    return _plan_payload(project, db)


@router.delete("/plan-layout/{project_id}", summary="Floor plan — switch back to the standard layout")
def disable_plan_layout(project_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    project = _owned(project_id, user, db)
    plan = project.plan_layout if isinstance(project.plan_layout, dict) else None
    if plan and plan.get("status") == "active":
        project.plan_layout = {**plan, "status": "inactive"}
        _mark_glb_stale(project)
        db.commit()
        db.refresh(project)
    return _plan_payload(project, db)
