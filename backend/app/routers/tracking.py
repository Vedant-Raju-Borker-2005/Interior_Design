"""Project Tracking Router — milestones and execution timeline."""
import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from ..db import get_db
from ..models import Project, Milestone, Vendor, User
from ..schemas import MilestoneOut, UpdateMilestoneReq
from ..auth_utils import current_user

router = APIRouter()

DEFAULT_MILESTONES = [
    {"title": "Design Finalized",        "description": "Final design and quotation approved by customer.", "order": 1},
    {"title": "Materials Ordered",       "description": "All furniture, flooring, and fixtures ordered from vendors.", "order": 2},
    {"title": "Site Preparation",        "description": "Civil work, false ceiling, and electrical groundwork.", "order": 3},
    {"title": "Installation Begins",     "description": "Furniture, modular kitchen, and fixtures installation.", "order": 4},
    {"title": "Quality Inspection",      "description": "Full site inspection and punch-list completion.", "order": 5},
    {"title": "Project Handover",        "description": "Keys and warranty documents handed over to customer.", "order": 6},
]

TIMELINE_WEEKS = [0, 1, 3, 6, 10, 14]   # cumulative weeks after start


@router.get("/{project_id}", summary="Get project milestones")
def get_milestones(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    milestones = (
        db.query(Milestone)
        .filter(Milestone.project_id == project_id)
        .order_by(Milestone.order)
        .all()
    )

    # Auto-create milestones on first access
    if not milestones:
        milestones = _create_default_milestones(project_id, db)

    # Mark first milestone as completed if project is quoted/ordered
    if project.status in ("quoted", "ordered", "done") and milestones:
        m = milestones[0]
        if m.status == "pending":
            m.status = "completed"
            m.completed_date = datetime.datetime.utcnow().strftime("%Y-%m-%d")
            db.commit()

    return {
        "project_id": project_id,
        "project_status": project.status,
        "milestones": [_ms_out(m, db) for m in milestones],
    }


@router.put("/{project_id}/milestones/{milestone_id}", summary="Update milestone status (admin/vendor)")
def update_milestone(
    project_id: str,
    milestone_id: str,
    req: UpdateMilestoneReq,
    db: Session = Depends(get_db),
):
    milestone = db.query(Milestone).filter(
        Milestone.id == milestone_id,
        Milestone.project_id == project_id
    ).first()
    if not milestone:
        raise HTTPException(404, "Milestone not found")

    if req.status is not None:
        milestone.status = req.status
    if req.completed_date is not None:
        milestone.completed_date = req.completed_date
    elif req.status == "completed" and not milestone.completed_date:
        milestone.completed_date = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    if req.notes is not None:
        milestone.notes = req.notes
    if req.vendor_id is not None:
        milestone.vendor_id = req.vendor_id

    db.commit()

    # Auto-advance project status
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        all_ms = db.query(Milestone).filter(Milestone.project_id == project_id).all()
        if all(m.status == "completed" for m in all_ms):
            project.status = "done"
            db.commit()

    return {"message": "milestone updated"}


# ── Helpers ───────────────────────────────────────────────────────────────────
def _create_default_milestones(project_id: str, db: Session) -> List[Milestone]:
    today = datetime.datetime.utcnow()
    created = []
    for i, m in enumerate(DEFAULT_MILESTONES):
        due = today + datetime.timedelta(weeks=TIMELINE_WEEKS[i])
        ms = Milestone(
            id=str(uuid.uuid4()),
            project_id=project_id,
            title=m["title"],
            description=m["description"],
            order=m["order"],
            status="pending",
            due_date=due.strftime("%Y-%m-%d"),
        )
        db.add(ms)
        created.append(ms)
    db.commit()
    return created


def _ms_out(m: Milestone, db: Session) -> dict:
    vendor_name = None
    if m.vendor_id:
        v = db.query(Vendor).filter(Vendor.id == m.vendor_id).first()
        vendor_name = v.name if v else None
    return {
        "id": m.id,
        "project_id": m.project_id,
        "title": m.title,
        "description": m.description,
        "status": m.status,
        "order": m.order,
        "due_date": m.due_date,
        "completed_date": m.completed_date,
        "vendor_id": m.vendor_id,
        "vendor_name": vendor_name,
        "notes": m.notes,
    }
