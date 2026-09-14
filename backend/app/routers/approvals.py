"""Approvals & B2B Router — feedback sections 4.2-4.5 and 2.1-2.4.

4.2/4.3  No project flows straight through to delivery. Everything lands in an
         admin queue and is explicitly approved or rejected.
4.4/4.5  An approved project is then allocated to a supplier, and the
         allocation is what lets that supplier see the items.
2.1-2.4  Bulk discounting sits at project level so per-unit and total pricing
         can both be shown without touching product prices.
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
    Product,
    Project,
    ProjectApprovalEvent,
    Room,
    RoomItem,
    User,
    Vendor,
    VendorAssignment,
)
from ..services.business_rules import (
    DISCOUNT_TYPES,
    compute_discount,
    effective_discount,
    quote_totals,
    unit_projects,
)

router = APIRouter()

APPROVAL_STATUSES = ["PENDING", "APPROVED", "REJECTED"]


def _roles(user: User) -> list[str]:
    return [r.strip() for r in (user.role or "").split(",") if r.strip()]


def _require_admin(user: User) -> User:
    if "admin" not in _roles(user):
        raise HTTPException(403, "Admin access required")
    return user


class RejectReq(BaseModel):
    reason: str


class ApproveReq(BaseModel):
    note: Optional[str] = None


class AllocateReq(BaseModel):
    vendor_id: str
    note: Optional[str] = None


class DiscountReq(BaseModel):
    discount_type: str          # PERCENT / FLAT_PER_UNIT / FLAT_TOTAL
    discount_value: float
    note: Optional[str] = None


def _project_subtotal(project: Project, db: Session) -> float:
    """Sum of everything currently specified across the project's rooms.

    Feedback 2.4 — customisations ride on RoomItem.unit_price, so a customised
    basket prices differently from a stock one without any special-casing here.
    """
    rooms = db.query(Room).filter(Room.project_id == project.id).all()
    total = 0.0
    for room in rooms:
        for item in db.query(RoomItem).filter(RoomItem.room_id == room.id).all():
            unit = item.unit_price
            if unit is None:
                product = db.query(Product).filter(Product.id == item.product_id).first()
                unit = product.price if product else 0
            total += (unit or 0) * (item.qty or 1)
    return round(total, 2)


def _customisations(project: Project, db: Session) -> list[dict[str, Any]]:
    """Feedback 2.4 — what was customised, so it can be shown on the quote."""
    out: list[dict[str, Any]] = []
    rooms = db.query(Room).filter(Room.project_id == project.id).all()
    for room in rooms:
        for item in db.query(RoomItem).filter(RoomItem.room_id == room.id).all():
            chosen = {
                k: v for k, v in {
                    "colour": item.custom_color,
                    "material": item.custom_material,
                    "size": item.custom_size,
                    "fabric": item.custom_fabric,
                    "wood_finish": item.custom_wood_finish,
                    "texture": item.custom_texture,
                    "cushion_style": item.custom_cushion_style,
                }.items() if v
            }
            if not chosen:
                continue
            product = db.query(Product).filter(Product.id == item.product_id).first()
            out.append({
                "room": room.room_type,
                "product": product.name if product else item.product_id,
                "qty": item.qty,
                "unit_price": item.unit_price,
                "customisations": chosen,
            })
    return out


def _project_out(p: Project, db: Session) -> dict[str, Any]:
    owner = db.query(User).filter(User.id == p.user_id).first()
    vendor = (
        db.query(Vendor).filter(Vendor.id == p.allocated_vendor_id).first()
        if p.allocated_vendor_id else None
    )
    return {
        "id": p.id,
        "property_name": p.property_name,
        "bhk_type": p.bhk_type,
        "city": p.city,
        "budget": p.budget,
        "status": p.status,
        "approval_status": p.approval_status,
        "approved_by": p.approved_by,
        "approved_at": p.approved_at.isoformat() if p.approved_at else None,
        "rejection_reason": p.rejection_reason,
        "allocated_vendor_id": p.allocated_vendor_id,
        "allocated_vendor_name": vendor.name if vendor else None,
        "allocated_at": p.allocated_at.isoformat() if p.allocated_at else None,
        "total_units": p.total_units or 0,
        "customer": {
            "id": owner.id if owner else None,
            "name": owner.name if owner else None,
            "email": owner.email if owner else None,
            "phone": owner.phone if owner else None,
        },
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _log(db: Session, project: Project, action: str, actor: str,
         reason: Optional[str] = None, vendor_id: Optional[str] = None):
    db.add(ProjectApprovalEvent(
        project_id=project.id, action=action, actor=actor,
        reason=reason, vendor_id=vendor_id,
    ))


# ═════════════════════════════════════════ 4.2/4.3 admin approval queue ═════
@router.get("/queue", summary="4.2/4.3 — projects awaiting admin decision")
def approval_queue(
    status: str = Query("PENDING"),
    include_drafts: bool = Query(
        False,
        description="Onboarding drafts that were never quoted are hidden by default "
                    "so the queue shows work that actually needs a decision.",
    ),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    if status.upper() not in APPROVAL_STATUSES + ["ALL"]:
        raise HTTPException(400, f"status must be one of {APPROVAL_STATUSES + ['ALL']}")

    def scoped(q):
        return q if include_drafts else q.filter(Project.status != "draft")

    query = scoped(db.query(Project))
    if status.upper() != "ALL":
        query = query.filter(Project.approval_status == status.upper())
    rows = query.order_by(Project.created_at.desc()).all()

    counts = {
        s: scoped(db.query(Project)).filter(Project.approval_status == s).count()
        for s in APPROVAL_STATUSES
    }
    return {"projects": [_project_out(p, db) for p in rows], "counts": counts}


@router.post("/projects/{project_id}/approve", summary="4.3 — approve a project")
def approve_project(
    project_id: str,
    req: ApproveReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    if p.approval_status == "APPROVED":
        raise HTTPException(400, "Project is already approved")

    p.approval_status = "APPROVED"
    p.approved_by = user.id
    p.approved_at = datetime.datetime.utcnow()
    p.rejection_reason = None
    _log(db, p, "APPROVED", user.id, req.note)
    db.commit()
    db.refresh(p)
    return _project_out(p, db)


@router.post("/projects/{project_id}/reject", summary="4.3 — reject a project")
def reject_project(
    project_id: str,
    req: RejectReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    if not req.reason.strip():
        raise HTTPException(400, "A rejection reason is required")

    p.approval_status = "REJECTED"
    p.approved_by = user.id
    p.approved_at = datetime.datetime.utcnow()
    p.rejection_reason = req.reason
    _log(db, p, "REJECTED", user.id, req.reason)
    db.commit()
    db.refresh(p)
    return _project_out(p, db)


# ═══════════════════════════════════════ 4.4/4.5 supplier allocation ════════
@router.post("/projects/{project_id}/allocate", summary="4.4 — allocate to a supplier")
def allocate_project(
    project_id: str,
    req: AllocateReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    # 4.4 is explicit that allocation follows approval.
    if p.approval_status != "APPROVED":
        raise HTTPException(400, "Project must be approved before it can be allocated")

    vendor = db.query(Vendor).filter(Vendor.id == req.vendor_id).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    if vendor.status != "APPROVED":
        raise HTTPException(400, f"Vendor is {vendor.status}; only approved vendors can be allocated")

    p.allocated_vendor_id = vendor.id
    p.allocated_at = datetime.datetime.utcnow()
    p.allocated_by = user.id

    # 4.5 — the allocation is what surfaces the items to that supplier, so give
    # every specified item an assignment row the vendor portal already reads.
    created = 0
    rooms = db.query(Room).filter(Room.project_id == p.id).all()
    for room in rooms:
        for item in db.query(RoomItem).filter(RoomItem.room_id == room.id).all():
            exists = db.query(VendorAssignment).filter(
                VendorAssignment.project_id == p.id,
                VendorAssignment.item_id == item.id,
            ).first()
            if exists:
                continue
            db.add(VendorAssignment(
                project_id=p.id, item_id=item.id, vendor_id=vendor.id,
                status="ASSIGNED", remarks=req.note,
            ))
            created += 1

    _log(db, p, "ALLOCATED", user.id, req.note, vendor.id)
    db.commit()
    db.refresh(p)
    return {**_project_out(p, db), "assignments_created": created}


@router.get("/projects/{project_id}/history", summary="4.3 — approval audit trail")
def approval_history(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    rows = (
        db.query(ProjectApprovalEvent)
        .filter(ProjectApprovalEvent.project_id == project_id)
        .order_by(ProjectApprovalEvent.created_at.desc())
        .all()
    )
    return {
        "events": [
            {
                "action": e.action,
                "actor": e.actor,
                "reason": e.reason,
                "vendor_id": e.vendor_id,
                "at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in rows
        ]
    }


# ═══════════════════════════════════════════ 2.1-2.4 B2B pricing ════════════
@router.get("/projects/{project_id}/pricing", summary="2.2/2.3 — unit-wise pricing breakdown")
def project_pricing(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    roles = _roles(user)
    if "admin" not in roles and p.user_id != user.id:
        raise HTTPException(403, "Not your project")

    discount_type, discount_value = effective_discount(p, db)
    children = unit_projects(p, db)

    if children:
        # 2.3 — a bulk project is priced unit by unit: each flat carries its
        # own BHK and customisations (2.4), so units can differ in value.
        lines = []
        for child in children:
            gross_unit = _project_subtotal(child, db)
            one = compute_discount(gross_unit, *(
                ("FLAT_PER_UNIT", discount_value) if discount_type == "FLAT_PER_UNIT"
                else ("PERCENT", discount_value) if discount_type == "PERCENT"
                else (None, 0.0)
            ), units=1)
            lines.append({
                "project_id": child.id,
                "unit": child.property_name,
                "bhk_type": child.bhk_type,
                "original_price": one["original_total"],
                "discount": one["discount_amount"],
                "discounted_price": one["discounted_total"],
                "customisation_count": len(_customisations(child, db)),
            })
        gross = sum(l["original_price"] for l in lines)
        units = len(lines)
        totals = quote_totals(subtotal=gross, discount_type=discount_type,
                              discount_value=discount_value, units=units)
        if discount_type == "FLAT_TOTAL" and gross:
            ratio = totals["discounted_total"] / gross
            for l in lines:
                l["discount"] = round(l["original_price"] * (1 - ratio), 2)
                l["discounted_price"] = round(l["original_price"] - l["discount"], 2)
        customisations = [c for child in children for c in _customisations(child, db)]
    else:
        per_unit_subtotal = _project_subtotal(p, db)
        units = max(1, p.total_units or 1)
        # Items are specified once per show-flat and repeated across units.
        gross = per_unit_subtotal * units
        totals = quote_totals(subtotal=gross, discount_type=discount_type,
                              discount_value=discount_value, units=units)
        lines = []
        customisations = _customisations(p, db)

    return {
        "project_id": p.id,
        "property_name": p.property_name,
        "is_bulk": units > 1,
        "units_total": p.total_units or units,
        "units_priced": units,
        "discount_type": discount_type,
        "discount_value": discount_value,
        "discount_note": p.discount_note,
        "discount_inherited": bool(discount_type) and not p.discount_type,
        **totals,
        "unit_lines": lines,
        # Feedback 2.4 — customisations listed alongside the money.
        "customisations": customisations,
    }


@router.post("/projects/{project_id}/discount", summary="2.1 — apply a bulk discount")
def set_discount(
    project_id: str,
    req: DiscountReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    if req.discount_type not in DISCOUNT_TYPES:
        raise HTTPException(400, f"discount_type must be one of {DISCOUNT_TYPES}")
    if req.discount_value < 0:
        raise HTTPException(400, "Discount cannot be negative")
    if req.discount_type == "PERCENT" and req.discount_value > 100:
        raise HTTPException(400, "Percentage discount cannot exceed 100")

    children = unit_projects(p, db)
    if children:
        values = [_project_subtotal(c, db) for c in children]
        per_unit_subtotal = round(sum(values) / len(values), 2) if values else 0.0
    else:
        per_unit_subtotal = _project_subtotal(p, db)
    p.discount_type = req.discount_type
    p.discount_value = req.discount_value
    p.discount_note = req.note
    p.original_unit_price = per_unit_subtotal
    db.commit()
    db.refresh(p)

    return project_pricing(project_id, user, db)


@router.delete("/projects/{project_id}/discount", summary="2.1 — clear the discount")
def clear_discount(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    p = db.query(Project).filter(Project.id == project_id).first()
    if not p:
        raise HTTPException(404, "Project not found")
    p.discount_type = None
    p.discount_value = 0.0
    p.discount_note = None
    db.commit()
    return project_pricing(project_id, user, db)
