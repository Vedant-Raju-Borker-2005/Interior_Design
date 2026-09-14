"""Design studio — edit the design and keep the 2D plan / 3D model in step.

The full-page studio shows the customer's home as a synchronized 2D plan and
3D model. "Edit design" writes to the project's own preference fields (the same
ones onboarding fills), so the viewer, product recommendations and quotation
all read one source of truth. The 3D model is also exported as a real GLB and
kept on the server, so there is always a downloadable file of the current design.
"""
from __future__ import annotations

import datetime
import os
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth_utils import current_user
from ..db import get_db
from ..models import Project, Quotation, Room, User
from ..services.business_rules import normalize_bhk
from ..services.ids_service import (
    VIEWER_COLORS,
    VIEWER_FABRICS,
    VIEWER_STYLES,
    VIEWER_WOODS,
    build_viewer_brief,
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
    }


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
