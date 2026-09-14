"""Quotation lifecycle for admins — feedback 1.5, 1.9, 1.10, 1.11.

Kept apart from `quotations.py` (which is the customer-facing generator) so the
admin-only surface is easy to guard and to reason about.
"""
from __future__ import annotations

import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth_utils import current_user
from ..db import get_db
from ..models import (
    Payment,
    Project,
    ProjectApprovalEvent,
    Quotation,
    Room,
    RoomItem,
    User,
)
from ..services.business_rules import PAYMENT_MODES

router = APIRouter()


def _roles(user: User) -> list[str]:
    return [r.strip() for r in (user.role or "").split(",") if r.strip()]


def _require_admin(user: User) -> User:
    if "admin" not in _roles(user):
        raise HTTPException(403, "Admin access required")
    return user


class MarkPaidReq(BaseModel):
    payment_mode: str = "BANK_TRANSFER"
    payment_reference: Optional[str] = None
    amount: Optional[float] = None
    notes: Optional[str] = None


class ConvertReq(BaseModel):
    property_name: Optional[str] = None
    note: Optional[str] = None


def _quotation_row(q: Quotation, db: Session) -> dict[str, Any]:
    project = db.query(Project).filter(Project.id == q.project_id).first()
    owner = db.query(User).filter(User.id == project.user_id).first() if project else None
    return {
        "id": q.id,
        "quotation_no": q.quotation_no,
        "status": q.status,
        "subtotal": q.subtotal,
        "gst": q.gst,
        "gst_number": q.gst_number,
        "total": q.total,
        "original_total": q.original_total,
        "discount_amount": q.discount_amount,
        "billing_snapshot": q.billing_snapshot or {},
        "pdf_url": q.pdf_url,
        "valid_until": q.valid_until,
        "created_at": q.created_at.isoformat() if q.created_at else None,
        "paid_at": q.paid_at.isoformat() if q.paid_at else None,
        "payment_mode": q.payment_mode,
        "payment_reference": q.payment_reference,
        "converted_project_id": q.converted_project_id,
        # Feedback 1.5 — enough on the row to jump to the customer or project.
        "project": {
            "id": project.id if project else None,
            "property_name": project.property_name if project else None,
            "city": project.city if project else None,
            "bhk_type": project.bhk_type if project else None,
        },
        "customer": {
            "id": owner.id if owner else None,
            "name": owner.name if owner else None,
            "email": owner.email if owner else None,
            "phone": owner.phone if owner else None,
            "company_name": getattr(owner, "company_name", None) if owner else None,
        },
    }


@router.get("/search", summary="1.5 — central quotation search")
def search_quotations(
    q: Optional[str] = Query(None, description="quotation no, customer, project, GST or phone"),
    status: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)

    query = db.query(Quotation)
    if status:
        query = query.filter(Quotation.status == status)
    rows = query.order_by(Quotation.created_at.desc()).all()

    if q:
        needle = q.strip().lower()
        projects = {p.id: p for p in db.query(Project).all()}
        users = {u.id: u for u in db.query(User).all()}

        def matches(quotation: Quotation) -> bool:
            project = projects.get(quotation.project_id)
            owner = users.get(project.user_id) if project else None
            haystack = [
                quotation.quotation_no, quotation.id, quotation.gst_number,
                project.property_name if project else None,
                project.city if project else None,
                owner.name if owner else None,
                owner.email if owner else None,
                owner.phone if owner else None,
                getattr(owner, "company_name", None) if owner else None,
            ]
            return any(h and needle in str(h).lower() for h in haystack)

        rows = [r for r in rows if matches(r)]

    rows = rows[:limit]
    return {"count": len(rows), "quotations": [_quotation_row(r, db) for r in rows]}


@router.post("/{quotation_id}/mark-paid", summary="1.9 — record an offline payment")
def mark_quotation_paid(
    quotation_id: str,
    req: MarkPaidReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        raise HTTPException(404, "Quotation not found")
    if quotation.status in ("paid", "converted"):
        raise HTTPException(400, f"Quotation is already {quotation.status}")
    if req.payment_mode not in PAYMENT_MODES:
        raise HTTPException(400, f"payment_mode must be one of {PAYMENT_MODES}")

    quotation.status = "paid"
    quotation.paid_at = datetime.datetime.utcnow()
    quotation.paid_by = user.id
    quotation.payment_mode = req.payment_mode
    quotation.payment_reference = req.payment_reference

    project = db.query(Project).filter(Project.id == quotation.project_id).first()
    if project:
        project.status = "paid"
        # Feedback 1.8 — payment is what unlocks the premium render batch.
        project.premium_render_credits = (project.premium_render_credits or 0) + 20

    # Feedback 1.11 — B2C is a single full payment, not a milestone schedule.
    db.add(Payment(
        project_id=quotation.project_id,
        quotation_id=quotation.id,
        amount=req.amount if req.amount is not None else quotation.total,
        status="completed",
        payment_type="FULL",
        payment_mode=req.payment_mode,
        transaction_id=req.payment_reference,
        recorded_by=user.id,
        notes=req.notes,
        milestone_name="Full Payment",
    ))
    db.commit()
    db.refresh(quotation)
    return _quotation_row(quotation, db)


@router.post("/{quotation_id}/convert-to-project", summary="1.10 — convert a paid quotation")
def convert_quotation_to_project(
    quotation_id: str,
    req: ConvertReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        raise HTTPException(404, "Quotation not found")
    if quotation.status != "paid":
        raise HTTPException(400, "Only a paid quotation can be converted")
    if quotation.converted_project_id:
        raise HTTPException(400, f"Already converted to project {quotation.converted_project_id}")

    source = db.query(Project).filter(Project.id == quotation.project_id).first()
    if not source:
        raise HTTPException(404, "Source project not found")

    delivery = Project(
        user_id=source.user_id,
        bhk_type=source.bhk_type,
        property_name=req.property_name or f"{source.property_name} — Execution",
        locality=source.locality,
        city=source.city,
        pincode=source.pincode,
        timeline=source.timeline,
        total_area_sqft=source.total_area_sqft,
        budget=quotation.total,
        package_id=source.package_id,
        status="execution",
        material_preference=source.material_preference,
        interior_material_preference=source.interior_material_preference,
        fabric_preference=source.fabric_preference,
        furnishing_type=source.furnishing_type,
        color_preferences=source.color_preferences,
        # Linked through `defaults`, not parent_project_id: the frontend treats
        # any project with a parent as an enterprise flat and locks onboarding.
        defaults={
            **(source.defaults if isinstance(source.defaults, dict) else {}),
            "converted_from_project_id": source.id,
            "converted_from_quotation_no": quotation.quotation_no,
        },
        # Feedback 4.2 — no straight-through flow. Payment and conversion put the
        # project in the admin approval queue; approval (4.3) and supplier
        # allocation (4.4) are separate, explicit steps.
        approval_status="PENDING",
        premium_render_credits=source.premium_render_credits or 0,
    )
    db.add(delivery)
    db.flush()

    # Carry rooms and their specified items across so execution starts populated.
    for room in db.query(Room).filter(Room.project_id == source.id).all():
        new_room = Room(
            project_id=delivery.id,
            room_type=room.room_type,
            length_ft=room.length_ft,
            width_ft=room.width_ft,
            height_ft=room.height_ft,
            style_preference=room.style_preference,
            color_palette=room.color_palette,
            custom_config=room.custom_config,
        )
        db.add(new_room)
        db.flush()
        for item in db.query(RoomItem).filter(RoomItem.room_id == room.id).all():
            db.add(RoomItem(
                room_id=new_room.id,
                product_id=item.product_id,
                qty=item.qty,
                custom_color=item.custom_color,
                custom_material=item.custom_material,
                custom_size=item.custom_size,
                custom_fabric=item.custom_fabric,
                custom_wood_finish=item.custom_wood_finish,
                custom_texture=item.custom_texture,
                custom_cushion_style=item.custom_cushion_style,
                unit_price=item.unit_price,
            ))

    quotation.converted_project_id = delivery.id
    quotation.converted_at = datetime.datetime.utcnow()
    quotation.status = "converted"
    source.status = "converted"

    db.add(ProjectApprovalEvent(
        project_id=delivery.id,
        action="SUBMITTED",
        actor=user.id,
        reason=f"Created from paid quotation {quotation.quotation_no}; awaiting approval",
    ))
    db.commit()
    db.refresh(delivery)

    return {
        "quotation_id": quotation.id,
        "quotation_no": quotation.quotation_no,
        "project_id": delivery.id,
        "property_name": delivery.property_name,
        "status": delivery.status,
        "approval_status": delivery.approval_status,
        "message": "Quotation converted into a project and sent to the approval queue",
    }


@router.get("/payment-modes", summary="1.9 — accepted offline payment modes")
def payment_modes():
    return {"payment_modes": PAYMENT_MODES}
