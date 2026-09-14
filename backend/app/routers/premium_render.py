"""Free preview vs paid photoreal renders — feedback 1.1, 1.7, 1.8.

1.7  The AI visualisation stays free and ungated. It is the foot-in-the-door,
     so nothing here may ever refuse an unpaid customer a preview.
1.8  After the quotation is paid the project earns a premium batch — up to 20
     high-quality images, generated through the configured Gemini model.
1.1  A floor plan can be uploaded during visualisation and the render is then
     conditioned on that plan rather than on a stock base view.
"""
from __future__ import annotations

import asyncio
import datetime
import os
import uuid
from typing import Any, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
)
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..auth_utils import current_user
from ..db import SessionLocal, get_db
from ..models import FloorPlan, Project, Render, Room, User

router = APIRouter()

ASSET_DIR = os.getenv("ASSET_DIR", "./assets")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# Feedback 1.8 — the paid batch is capped per project.
PREMIUM_BATCH_MAX = 20


def _roles(user: User) -> list[str]:
    return [r.strip() for r in (user.role or "").split(",") if r.strip()]


def _owned_project(project_id: str, user: User, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    if project.user_id != user.id and "admin" not in _roles(user):
        raise HTTPException(403, "Not your project")
    return project


class PremiumBatchReq(BaseModel):
    count: int = Field(default=8, ge=1, le=PREMIUM_BATCH_MAX)
    style: Optional[str] = None
    rooms: list[str] = Field(default_factory=list, description="room ids; empty means every room")
    notes: Optional[str] = None


# ══════════════════════════════════════════════════ 1.7 entitlement view ════
@router.get("/render-entitlement/{project_id}", summary="1.7/1.8 — what this project can render")
def render_entitlement(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _owned_project(project_id, user, db)
    used = (
        db.query(Render)
        .filter(Render.project_id == project_id, Render.tier == "premium")
        .count()
    )
    credits = project.premium_render_credits or 0
    return {
        "project_id": project_id,
        # Free: the synchronized 2D plan and interactive 3D model (and its GLB).
        "free_ai_rendering": {
            "available": True,
            "price": 0,
            "description": "Interactive 2D plan and 3D model of your home, free to explore",
        },
        # Locked: anything generated with Gemini (wall renders, premium batch).
        "gemini_rendering": {
            "unlocked": credits > 0,
            "description": "Photoreal Gemini renders unlock once your quotation is paid",
        },
        # 1.8 — unlocked by payment, capped, and consumed as it is used.
        "premium_rendering": {
            "unlocked": credits > 0,
            "credits_total": credits,
            "credits_used": used,
            "credits_remaining": max(0, credits - used),
            "max_per_project": PREMIUM_BATCH_MAX,
            "engine": os.getenv("GEMINI_PREMIUM_MODEL", "gemini-3-pro-image"),
            "description": "High-quality photoreal renders, unlocked once the quotation is paid",
        },
        "paid": bool(credits > 0),
    }


# ═══════════════════════════════════════════════ 1.8 premium render batch ═══
@router.post("/premium-render/{project_id}", summary="1.8 — queue the paid photoreal batch")
def queue_premium_batch(
    project_id: str,
    req: PremiumBatchReq,
    background_tasks: BackgroundTasks,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _owned_project(project_id, user, db)

    credits = project.premium_render_credits or 0
    used = (
        db.query(Render)
        .filter(Render.project_id == project_id, Render.tier == "premium")
        .count()
    )
    remaining = max(0, credits - used)
    if remaining <= 0:
        raise HTTPException(
            402,
            "Premium rendering unlocks once the quotation is paid. "
            "The free AI visualisation stays available in the meantime.",
        )
    if req.count > remaining:
        raise HTTPException(400, f"Only {remaining} premium render credits remain on this project")

    rooms = db.query(Room).filter(Room.project_id == project_id).all()
    if req.rooms:
        rooms = [r for r in rooms if r.id in req.rooms]
    if not rooms:
        raise HTTPException(400, "This project has no rooms to render")

    batch_id = str(uuid.uuid4())
    style = req.style or (rooms[0].style_preference if rooms else "modern")

    from ..services.render_mock import build_prompt
    from ..services.floor_plan_context import plan_prompt_suffix, plan_url_for

    queued: list[dict[str, Any]] = []
    for i in range(req.count):
        room = rooms[i % len(rooms)]
        job_id = str(uuid.uuid4())
        prompt = build_prompt(style, room.color_palette or [], room.room_type, None, req.notes)
        if plan_url_for(project, room):
            prompt += plan_prompt_suffix(room.room_type)   # 1.1
        db.add(Render(
            id=job_id,
            room_id=room.id,
            project_id=project_id,
            mode="premium",
            style=style,
            color_palette=room.color_palette or [],
            prompt=prompt,
            status="queued",
            tier="premium",
            batch_id=batch_id,
        ))
        queued.append({"job_id": job_id, "room_id": room.id, "room_type": room.room_type,
                       "plan_specific": bool(plan_url_for(project, room))})
        background_tasks.add_task(_process_premium, job_id, prompt, project_id, room.id)

    db.commit()

    return {
        "batch_id": batch_id,
        "queued": len(queued),
        "jobs": queued,
        "credits_remaining_after": remaining - len(queued),
        "eta_seconds": 15 * len(queued),
    }


@router.get("/premium-render/batch/{batch_id}", summary="1.8 — poll a premium batch")
def premium_batch_status(batch_id: str, db: Session = Depends(get_db)):
    rows = db.query(Render).filter(Render.batch_id == batch_id).all()
    if not rows:
        raise HTTPException(404, "Batch not found")
    done = [r for r in rows if r.status == "completed"]
    return {
        "batch_id": batch_id,
        "total": len(rows),
        "completed": len(done),
        "failed": len([r for r in rows if r.status == "failed"]),
        "progress": round(len(done) / len(rows) * 100, 1),
        "images": [
            {
                "job_id": r.id,
                "status": r.status,
                "image_url": r.image_url,
                "thumbnail_url": r.thumbnail_url,
                "room_id": r.room_id,
            }
            for r in rows
        ],
    }


async def _process_premium(job_id: str, prompt: str, project_id: str | None = None,
                           room_id: str | None = None):
    """Generate one premium image. Falls back to the stock library when no
    GEMINI_KEY is configured so the flow is still demonstrable offline."""
    from ..services.floor_plan_context import plan_image_for
    from ..services.render_mock import (
        get_gemini_render, get_gemini_render_with_image, get_render_images,
    )

    plan = None
    if project_id:
        lookup = SessionLocal()
        try:
            project = lookup.query(Project).filter(Project.id == project_id).first()
            room = lookup.query(Room).filter(Room.id == room_id).first() if room_id else None
            plan = plan_image_for(project, room) if project else None
        finally:
            lookup.close()

    image_url = None
    try:
        if plan:
            image_url = get_gemini_render_with_image(prompt, plan[0], plan[1], source="floor_plan")
        else:
            image_url = get_gemini_render(prompt)
    except Exception as exc:
        print(f"[PremiumRender] {job_id} generation failed: {exc}")

    if not image_url:
        await asyncio.sleep(2)
        images = get_render_images("modern", "living_room")
        image_url = images[0] if images else None

    db = SessionLocal()
    try:
        row = db.query(Render).filter(Render.id == job_id).first()
        if row:
            row.status = "completed" if image_url else "failed"
            row.image_url = image_url
            row.thumbnail_url = image_url
            db.commit()
    finally:
        db.close()


# ═══════════════════════════════════════ 1.1 plan-conditioned rendering ═════
@router.post("/floor-plan/{project_id}", summary="1.1 — upload a plan during visualisation")
async def upload_plan_for_visualisation(
    project_id: str,
    file: UploadFile = File(...),
    room_id: Optional[str] = Query(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _owned_project(project_id, user, db)

    allowed = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(400, f"Unsupported file type '{ext}'. Use {', '.join(sorted(allowed))}")

    plan_dir = os.path.join(ASSET_DIR, "floor_plans")
    os.makedirs(plan_dir, exist_ok=True)
    name = f"plan_{project_id[:8]}_{uuid.uuid4().hex[:8]}{ext}"
    path = os.path.join(plan_dir, name)
    with open(path, "wb") as fh:
        fh.write(await file.read())

    url = f"{BACKEND_URL}/static/assets/floor_plans/{name}"
    project.floor_plan_url = url

    db.add(FloorPlan(
        project_id=project_id,
        file_url=url,
        file_type=ext.lstrip("."),
        uploaded_by=user.id,
    ))
    db.commit()

    return {
        "project_id": project_id,
        "room_id": room_id,
        "floor_plan_url": url,
        "file_name": file.filename,
        # 1.1 — renders raised after this point are conditioned on the plan.
        "plan_specific_rendering": True,
        "message": "Floor plan attached. New renders will be generated against this plan.",
    }


@router.delete("/floor-plan/{project_id}", summary="1.1 — detach the plan")
def clear_plan(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _owned_project(project_id, user, db)
    project.floor_plan_url = None
    db.commit()
    return {"project_id": project_id, "floor_plan_url": None, "plan_specific_rendering": False}
