"""Item tracking — feedback section 3.

The old flow put vendor steps and technician steps in one `status` dropdown, so
a technician was offered "in production" and a vendor was offered "installed".
Here the two tracks are separate fields with separate vocabularies, each role
only ever sees its own (3.1/3.3), the technician's action is Installation
(3.2), and the photo upload sits on the same record as the status so product,
photo and status move together (3.4/3.5).
"""
from __future__ import annotations

import datetime
import os
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth_utils import current_user
from ..db import get_db
from ..models import (
    TECHNICIAN_STATUSES,
    VENDOR_HANDOVER_STATUS,
    VENDOR_STATUSES,
    ItemTracking,
    Product,
    Project,
    User,
)

router = APIRouter()

ASSET_DIR = os.getenv("ASSET_DIR", "./assets")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")

# Labels the UI shows; the stored value stays the stable upper-case token.
STATUS_LABELS = {
    "ORDERED": "Ordered",
    "ACCEPTED": "Accepted by vendor",
    "IN_PRODUCTION": "In production",
    "READY": "Ready for dispatch",
    "DISPATCHED": "Dispatched",
    "DELIVERED": "Delivered to site",
    "NOT_RECEIVED": "Not yet received",
    "RECEIVED": "Received by technician",
    "INSTALLATION": "Installation in progress",
    "INSTALLED": "Installed",
    "SNAG": "Snag / rework needed",
}


# The legacy single `status` column and the progress bar still read the old
# lower-case vocabulary, so every change on either track is mirrored onto it.
LEGACY_STATUS = {
    "ORDERED": "ordered", "ACCEPTED": "accepted", "IN_PRODUCTION": "production",
    "READY": "ready", "DISPATCHED": "dispatched", "DELIVERED": "delivered",
    "RECEIVED": "delivered", "INSTALLATION": "delivered", "SNAG": "delivered",
    "INSTALLED": "installed",
}

# Progress weight per item: vendor stages up to handover, then installation.
PROGRESS_WEIGHT = {
    "ORDERED": 10, "ACCEPTED": 20, "IN_PRODUCTION": 30, "READY": 40,
    "DISPATCHED": 50, "DELIVERED": 75,
    "RECEIVED": 75, "INSTALLATION": 85, "SNAG": 80, "INSTALLED": 100,
}


def _item_weight(t: ItemTracking) -> int:
    if t.technician_status and t.technician_status != "NOT_RECEIVED":
        return PROGRESS_WEIGHT.get(t.technician_status, 75)
    return PROGRESS_WEIGHT.get(t.vendor_status or "ORDERED", 10)


def _after_change(row: ItemTracking, user: User, db: Session, note: str) -> None:
    """Write the history row the execution page shows and refresh progress."""
    from ..models import ProjectItemTrackingHistory, ProjectProgress, ProjectProgressHistory

    db.add(ProjectItemTrackingHistory(
        id=str(uuid.uuid4()),
        tracking_id=row.id,
        status=row.status,
        expected_date=row.expected_date,
        actual_date=row.actual_date,
        updated_by=user.name or user.email or user.id,
        remarks=note,
    ))

    rows = db.query(ItemTracking).filter(ItemTracking.project_id == row.project_id).all()
    progress = float(round(sum(_item_weight(t) for t in rows) / len(rows))) if rows else 0.0
    db.add(ProjectProgressHistory(
        id=str(uuid.uuid4()), project_id=row.project_id, progress=progress,
        reason="Recalculated from vendor/technician item tracks",
    ))
    cached = db.query(ProjectProgress).filter(ProjectProgress.project_id == row.project_id).first()
    if cached:
        cached.current_progress = progress
    else:
        db.add(ProjectProgress(id=str(uuid.uuid4()), project_id=row.project_id, current_progress=progress))


def _roles(user: User) -> list[str]:
    return [r.strip() for r in (user.role or "").split(",") if r.strip()]


def _has_any(user: User, *wanted: str) -> bool:
    mine = _roles(user)
    return any(w in mine for w in wanted)


def _project_role(user: User, project_id: str, db: Session) -> Optional[str]:
    """The user's role on this specific project (MANAGER / COORDINATOR /
    TECHNICIAN), which is what decides the track they may move."""
    from ..models import ProjectTeamMember

    member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_id == project_id,
        ProjectTeamMember.user_id == user.id,
        ProjectTeamMember.status == "ACTIVE",
    ).first()
    return member.role.upper() if member and member.role else None


def _can_move_vendor_track(user: User, project_id: str, db: Session) -> bool:
    # The supplier owns this track. A project's manager or coordinator may
    # record it on the supplier's behalf; a technician never can (3.2/3.3).
    if _has_any(user, "admin", "vendor"):
        return True
    return _project_role(user, project_id, db) in ("MANAGER", "COORDINATOR")


class VendorStatusReq(BaseModel):
    vendor_status: str
    remarks: Optional[str] = None
    expected_date: Optional[str] = None


class TechnicianStatusReq(BaseModel):
    technician_status: str
    remarks: Optional[str] = None


class TrackingCreateReq(BaseModel):
    project_id: str
    room_name: str
    item_name: str
    product_id: Optional[str] = None
    expected_date: Optional[str] = None


def _out(t: ItemTracking, db: Session) -> dict[str, Any]:
    product = db.query(Product).filter(Product.id == t.product_id).first() if t.product_id else None
    handed_over = t.vendor_status == VENDOR_HANDOVER_STATUS
    return {
        "id": t.id,
        "project_id": t.project_id,
        "room_name": t.room_name,
        "item_name": t.item_name,
        "product_id": t.product_id,
        # 3.5 — the product the row is about travels with the row.
        "product": {
            "id": product.id,
            "name": product.name,
            "sku": product.sku,
            "category": product.category,
            "thumbnail_url": product.thumbnail_url,
        } if product else None,
        "vendor_status": t.vendor_status,
        "vendor_status_label": STATUS_LABELS.get(t.vendor_status, t.vendor_status),
        "technician_status": t.technician_status,
        "technician_status_label": STATUS_LABELS.get(t.technician_status, t.technician_status),
        # 3.2 — the technician can only act once the vendor has handed over.
        "awaiting_handover": not handed_over,
        "technician_id": t.technician_id,
        "expected_date": t.expected_date,
        "actual_date": t.actual_date,
        "handover_at": t.handover_at.isoformat() if t.handover_at else None,
        "installed_at": t.installed_at.isoformat() if t.installed_at else None,
        "remarks": t.remarks,
        # 3.4/3.5 — photos live on the item, not in a separate gallery.
        "photos": t.photos or [],
        "photo_count": len(t.photos or []),
    }


# ═══════════════════════════════════════════ 3.3 role-scoped vocabularies ═══
@router.get("/statuses", summary="3.1/3.3 — statuses for one role only")
def statuses(role: str = Query(..., description="vendor | technician")):
    role = role.lower()
    if role == "vendor":
        values = VENDOR_STATUSES
    elif role == "technician":
        values = TECHNICIAN_STATUSES
    else:
        raise HTTPException(400, "role must be 'vendor' or 'technician'")
    return {
        "role": role,
        "statuses": [{"value": v, "label": STATUS_LABELS.get(v, v)} for v in values],
        "handover_status": VENDOR_HANDOVER_STATUS,
    }


# ════════════════════════════════════════════════════════════ listing ══════
@router.get("/project/{project_id}", summary="3.5 — tracked items for a project")
def list_items(
    project_id: str,
    role: Optional[str] = Query(None, description="vendor | technician — trims the payload"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    rows = db.query(ItemTracking).filter(ItemTracking.project_id == project_id).all()
    items = [_out(t, db) for t in rows]

    project_role = _project_role(user, project_id, db)
    can_vendor = _can_move_vendor_track(user, project_id, db)
    can_technician = _has_any(user, "admin", "team", "team_technician", "team_manager", "team_coordinator") \
        or project_role is not None
    # 3.3 — a pure technician (on this project, or by account) only ever sees
    # the technician track, whatever the caller asked for.
    if project_role == "TECHNICIAN" and not _has_any(user, "admin"):
        role = "technician"

    return {
        "project_id": project_id,
        "items": items,
        # The UI renders controls from this rather than guessing from roles.
        "permissions": {
            "project_role": project_role,
            "view": role or "all",
            "can_move_vendor_track": can_vendor and role != "technician",
            "can_move_technician_track": can_technician,
            "can_upload_photos": can_technician or can_vendor,
        },
        "summary": {
            "total": len(rows),
            "with_vendor": len([r for r in rows if r.vendor_status != VENDOR_HANDOVER_STATUS]),
            "handed_over": len([r for r in rows if r.vendor_status == VENDOR_HANDOVER_STATUS]),
            "installed": len([r for r in rows if r.technician_status == "INSTALLED"]),
            "snags": len([r for r in rows if r.technician_status == "SNAG"]),
        },
    }


@router.post("", summary="Create a tracked item")
def create_item(
    req: TrackingCreateReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not _has_any(user, "admin", "vendor", "team", "team_manager", "team_coordinator"):
        raise HTTPException(403, "Not permitted to create tracking rows")
    project = db.query(Project).filter(Project.id == req.project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    row = ItemTracking(
        project_id=req.project_id,
        room_name=req.room_name,
        item_name=req.item_name,
        product_id=req.product_id,
        expected_date=req.expected_date,
        status="ordered",
        vendor_status="ORDERED",
        technician_status="NOT_RECEIVED",
        photos=[],
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return _out(row, db)


# ══════════════════════════════════════════════ 3.1 vendor-side updates ═════
@router.patch("/{item_id}/vendor-status", summary="3.1 — vendor moves its own track")
def update_vendor_status(
    item_id: str,
    req: VendorStatusReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    row = db.query(ItemTracking).filter(ItemTracking.id == item_id).first()
    if not row:
        raise HTTPException(404, "Tracked item not found")
    if not _can_move_vendor_track(user, row.project_id, db):
        raise HTTPException(403, "The vendor status is updated by the supplier or the project's coordinator")
    if req.vendor_status not in VENDOR_STATUSES:
        raise HTTPException(
            400, f"vendor_status must be one of: {', '.join(VENDOR_STATUSES)}"
        )

    previous = row.vendor_status
    row.vendor_status = req.vendor_status
    row.vendor_updated_at = datetime.datetime.utcnow()
    if req.remarks:
        row.remarks = req.remarks
    if req.expected_date:
        row.expected_date = req.expected_date

    if req.vendor_status == VENDOR_HANDOVER_STATUS:
        # Handover is the single point where the technician track opens up.
        row.handover_at = datetime.datetime.utcnow()
        row.actual_date = datetime.date.today().isoformat()
        if row.technician_status == "NOT_RECEIVED":
            row.technician_status = "RECEIVED"
            row.technician_updated_at = datetime.datetime.utcnow()

    if row.technician_status in (None, "NOT_RECEIVED"):
        row.status = LEGACY_STATUS.get(row.vendor_status, "ordered")
    _after_change(row, user, db,
                  req.remarks or f"Vendor: {STATUS_LABELS.get(previous, previous)} → "
                                 f"{STATUS_LABELS.get(row.vendor_status, row.vendor_status)}")
    db.commit()
    db.refresh(row)
    return _out(row, db)


# ═══════════════════════════════════════ 3.2 technician-side updates ════════
@router.patch("/{item_id}/technician-status", summary="3.2 — technician records installation")
def update_technician_status(
    item_id: str,
    req: TechnicianStatusReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    if not _has_any(user, "admin", "team", "team_technician", "team_manager", "team_coordinator"):
        raise HTTPException(403, "Only a technician or admin can set the technician status")
    row = db.query(ItemTracking).filter(ItemTracking.id == item_id).first()
    if not row:
        raise HTTPException(404, "Tracked item not found")
    if req.technician_status not in TECHNICIAN_STATUSES:
        raise HTTPException(
            400, f"technician_status must be one of: {', '.join(TECHNICIAN_STATUSES)}"
        )
    # 3.2 — nothing to install until the vendor has actually delivered it.
    if row.vendor_status != VENDOR_HANDOVER_STATUS and req.technician_status != "NOT_RECEIVED":
        raise HTTPException(
            400,
            f"Item has not been handed over yet (vendor status: {row.vendor_status}). "
            "It cannot be moved on the technician track.",
        )

    previous = row.technician_status
    row.technician_status = req.technician_status
    row.technician_updated_at = datetime.datetime.utcnow()
    row.technician_id = user.id
    if req.remarks:
        row.remarks = req.remarks
    if req.technician_status == "INSTALLED":
        row.installed_at = datetime.datetime.utcnow()
    row.status = LEGACY_STATUS.get(row.technician_status, row.status)

    _after_change(row, user, db,
                  req.remarks or f"Technician: {STATUS_LABELS.get(previous, previous)} → "
                                 f"{STATUS_LABELS.get(row.technician_status, row.technician_status)}")
    db.commit()
    db.refresh(row)
    return _out(row, db)


# ════════════════════════════════════ 3.4/3.5 photos on the same record ═════
@router.post("/{item_id}/photos", summary="3.4 — upload a photo against the item")
async def upload_item_photo(
    item_id: str,
    file: UploadFile = File(...),
    caption: Optional[str] = Query(None),
    stage: Optional[str] = Query(None, description="e.g. RECEIVED / INSTALLATION / INSTALLED"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    row = db.query(ItemTracking).filter(ItemTracking.id == item_id).first()
    if not row:
        raise HTTPException(404, "Tracked item not found")
    if not _has_any(user, "admin", "vendor", "team", "team_technician", "team_manager", "team_coordinator"):
        raise HTTPException(403, "Not permitted to upload against this item")

    allowed = {".jpg", ".jpeg", ".png", ".webp"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(400, f"Unsupported image type '{ext}'. Use {', '.join(sorted(allowed))}")

    proof_dir = os.path.join(ASSET_DIR, "proofs")
    os.makedirs(proof_dir, exist_ok=True)
    stem = f"item_{item_id[:8]}_{uuid.uuid4().hex[:8]}"
    raw = await file.read()
    # Site photos come straight off a phone camera; keep them light (1.6).
    from ..services.image_optimizer import optimise_to_webp
    name = optimise_to_webp(raw, proof_dir, stem)
    if name is None:
        name = f"{stem}{ext}"
        with open(os.path.join(proof_dir, name), "wb") as fh:
            fh.write(raw)

    entry = {
        "url": f"{BACKEND_URL}/static/assets/proofs/{name}",
        "caption": caption,
        "stage": stage or row.technician_status,
        "uploaded_at": datetime.datetime.utcnow().isoformat(),
        "uploaded_by": user.id,
    }
    # JSON columns need a new list object for SQLAlchemy to notice the change.
    row.photos = list(row.photos or []) + [entry]
    db.commit()
    db.refresh(row)
    return _out(row, db)


@router.delete("/{item_id}/photos", summary="3.4 — remove a photo from the item")
def delete_item_photo(
    item_id: str,
    url: str = Query(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    row = db.query(ItemTracking).filter(ItemTracking.id == item_id).first()
    if not row:
        raise HTTPException(404, "Tracked item not found")
    remaining = [p for p in (row.photos or []) if p.get("url") != url]
    if len(remaining) == len(row.photos or []):
        raise HTTPException(404, "Photo not found on this item")
    row.photos = remaining
    db.commit()
    db.refresh(row)
    return _out(row, db)
