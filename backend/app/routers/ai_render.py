"""
AI Render Router — async job queue simulation.
In production this would publish to RabbitMQ/Kafka and GPU workers would process.
Here we simulate with asyncio background tasks and real interior image URLs.
"""
import asyncio
import uuid
import random
import datetime
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from ..db import get_db, SessionLocal
from ..models import Render, Room, User
from ..schemas import RenderReq
from ..auth_utils import current_user
from ..services.render_mock import build_prompt, get_render_images

router = APIRouter()

# In-memory job status store (Redis in production)
_job_status: dict[str, dict] = {}


@router.post("/render", summary="Queue an AI render job")
def queue_render(
    req: RenderReq,
    background_tasks: BackgroundTasks,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    # Validate room exists
    room = db.query(Room).filter(Room.id == req.room_id).first()
    if not room:
        raise HTTPException(404, "Room not found")

    job_id = str(uuid.uuid4())
    render = Render(
        id=job_id,
        room_id=req.room_id,
        project_id=room.project_id,
        mode=req.mode,
        style=req.style,
        color_palette=req.color_palette,
        prompt=build_prompt(req.style, req.color_palette, room.room_type),
        status="queued",
    )
    db.add(render)
    db.commit()

    _job_status[job_id] = {"status": "queued", "image_url": None, "thumbnail_url": None}

    # Schedule mock processing in background
    eta = 4 if req.mode == "template" else (8 if req.mode == "sdxl" else 12)
    background_tasks.add_task(_process_render, job_id, req.style, req.mode, room.room_type)

    return {
        "job_id": job_id,
        "status": "queued",
        "eta_seconds": eta,
    }


@router.get("/render/{job_id}", summary="Poll render job status")
def get_render_status(job_id: str, db: Session = Depends(get_db)):
    # Check in-memory first
    job = _job_status.get(job_id)
    if job:
        return {"job_id": job_id, **job}

    # Fallback to DB
    render = db.query(Render).filter(Render.id == job_id).first()
    if not render:
        raise HTTPException(404, "Render job not found")

    return {
        "job_id": job_id,
        "status": render.status,
        "image_url": render.image_url,
        "thumbnail_url": render.thumbnail_url,
        "style": render.style,
        "created_at": render.created_at.isoformat() if render.created_at else None,
    }


@router.get("/renders/{room_id}", summary="Get all renders for a room")
def get_room_renders(room_id: str, db: Session = Depends(get_db)):
    renders = (
        db.query(Render)
        .filter(Render.room_id == room_id, Render.status == "completed")
        .order_by(Render.created_at.desc())
        .all()
    )
    return {
        "renders": [
            {
                "id": r.id,
                "style": r.style,
                "mode": r.mode,
                "image_url": r.image_url,
                "thumbnail_url": r.thumbnail_url,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in renders
        ]
    }


async def _process_render(job_id: str, style: str, mode: str, room_type: str):
    """Simulate GPU processing, calling Gemini Imagen or fallback to mock."""
    db = SessionLocal()
    prompt = ""
    try:
        render = db.query(Render).filter(Render.id == job_id).first()
        if render:
            prompt = render.prompt
    except Exception as e:
        print(f"Failed to query render prompt: {e}")
    finally:
        db.close()

    image_url = None
    if prompt:
        from ..services.render_mock import get_gemini_render
        image_url = get_gemini_render(prompt)

    if image_url:
        thumb_url = image_url
    else:
        # Fallback to local mockup
        delay = random.uniform(3, 6) if mode == "template" else random.uniform(6, 12)
        await asyncio.sleep(delay)
        from ..services.render_mock import get_render_images
        images = get_render_images(style, room_type)
        image_url = random.choice(images)
        thumb_url = image_url.replace("w=1200&h=800", "w=400&h=267")

    # Update in-memory
    _job_status[job_id] = {
        "status": "completed",
        "image_url": image_url,
        "thumbnail_url": thumb_url,
    }

    # Update DB
    db = SessionLocal()
    try:
        render = db.query(Render).filter(Render.id == job_id).first()
        if render:
            render.status = "completed"
            render.image_url = image_url
            render.thumbnail_url = thumb_url
            db.commit()
    finally:
        db.close()
