"""Special Services Router — feedback section 5.

The platform does not deliver these services itself (5.8). It keeps a directory
of partnered consultants (5.1), onboards them (5.2), routes inquiries to them
(5.3), gives them a view of their own leads (5.4), lets them move the status
along (5.5) and records the commission split on every lead (5.6/5.7).
"""
from __future__ import annotations

import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..auth_utils import current_user, optional_user
from ..db import get_db
from ..models import (
    SPECIAL_SERVICE_TYPES,
    Consultant,
    Project,
    ServiceLead,
    ServiceLeadEvent,
    User,
)
from ..services.business_rules import (
    commission_split,
    next_lead_no,
    recalc_lead_economics,
)

router = APIRouter()

LEAD_STATUSES = ["NEW", "ASSIGNED", "CONTACTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]


# ── role helpers ─────────────────────────────────────────────────────────────
def _roles(user: User) -> list[str]:
    """Roles are stored comma-separated on the user row."""
    return [r.strip() for r in (user.role or "").split(",") if r.strip()]


def _require_admin(user: User) -> User:
    if "admin" not in _roles(user):
        raise HTTPException(403, "Admin access required")
    return user


def _consultant_for(user: User, db: Session) -> Consultant:
    c = db.query(Consultant).filter(Consultant.user_id == user.id).first()
    if not c:
        raise HTTPException(403, "No consultant profile linked to this account")
    return c


# ── payloads ─────────────────────────────────────────────────────────────────
class ConsultantReq(BaseModel):
    name: str
    company_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    services: list[str] = Field(default_factory=list)
    commission_rate: float = 15.0
    notes: Optional[str] = None
    status: str = "ACTIVE"


class LeadReq(BaseModel):
    service_type: str
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    customer_email: Optional[str] = None
    city: Optional[str] = None
    requirements: Optional[str] = None
    project_id: Optional[str] = None
    service_value: float = 0.0


class AssignReq(BaseModel):
    consultant_id: str
    note: Optional[str] = None


class LeadStatusReq(BaseModel):
    status: str
    note: Optional[str] = None
    service_value: Optional[float] = None


class PayoutReq(BaseModel):
    payout_status: str  # PENDING / PAID


# ── serialisers ──────────────────────────────────────────────────────────────
def _consultant_out(c: Consultant, db: Session) -> dict[str, Any]:
    leads = db.query(ServiceLead).filter(ServiceLead.consultant_id == c.id).all()
    completed = [l for l in leads if l.status == "COMPLETED"]
    return {
        "id": c.id,
        "user_id": c.user_id,
        "name": c.name,
        "company_name": c.company_name,
        "email": c.email,
        "phone": c.phone,
        "city": c.city,
        "services": c.services or [],
        "commission_rate": c.commission_rate,
        "rating": c.rating,
        "status": c.status,
        "notes": c.notes,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "stats": {
            "total_leads": len(leads),
            "active_leads": len([l for l in leads if l.status in ("ASSIGNED", "CONTACTED", "IN_PROGRESS")]),
            "completed_leads": len(completed),
            "lifetime_value": round(sum(l.service_value or 0 for l in completed), 2),
            "payable": round(sum(l.consultant_payout or 0 for l in completed if l.payout_status != "PAID"), 2),
        },
    }


def _lead_out(l: ServiceLead, db: Session) -> dict[str, Any]:
    consultant = (
        db.query(Consultant).filter(Consultant.id == l.consultant_id).first()
        if l.consultant_id
        else None
    )
    return {
        "id": l.id,
        "lead_no": l.lead_no,
        "service_type": l.service_type,
        "customer_id": l.customer_id,
        "customer_name": l.customer_name,
        "customer_phone": l.customer_phone,
        "customer_email": l.customer_email,
        "city": l.city,
        "requirements": l.requirements,
        "project_id": l.project_id,
        "consultant_id": l.consultant_id,
        "consultant_name": consultant.name if consultant else None,
        "consultant_company": consultant.company_name if consultant else None,
        "status": l.status,
        "status_note": l.status_note,
        "service_value": l.service_value,
        "commission_rate": l.commission_rate,
        "platform_earning": l.platform_earning,
        "consultant_payout": l.consultant_payout,
        "payout_status": l.payout_status,
        "assigned_at": l.assigned_at.isoformat() if l.assigned_at else None,
        "created_at": l.created_at.isoformat() if l.created_at else None,
        "completed_at": l.completed_at.isoformat() if l.completed_at else None,
        "events": [
            {
                "status": e.status,
                "note": e.note,
                "actor": e.actor,
                "at": e.created_at.isoformat() if e.created_at else None,
            }
            for e in sorted(l.events, key=lambda x: x.created_at or datetime.datetime.min)
        ],
    }


def _log(db: Session, lead: ServiceLead, status: str, note: Optional[str], actor: Optional[str]):
    db.add(ServiceLeadEvent(lead_id=lead.id, status=status, note=note, actor=actor))


# ══════════════════════════════════════════════════════════ catalogue ═══════
@router.get("/types", summary="5.1 — special service types offered")
def list_service_types():
    return {"service_types": SPECIAL_SERVICE_TYPES, "lead_statuses": LEAD_STATUSES}


# ══════════════════════════════════════════ 5.1/5.2 consultant directory ════
@router.get("/consultants", summary="5.1 — directory of partnered consultants")
def list_consultants(
    service_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    query = db.query(Consultant)
    if status:
        query = query.filter(Consultant.status == status)
    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(Consultant.name.ilike(like), Consultant.company_name.ilike(like),
                Consultant.email.ilike(like), Consultant.phone.ilike(like))
        )
    rows = query.order_by(Consultant.created_at.desc()).all()
    if service_type:
        rows = [c for c in rows if service_type in (c.services or [])]
    return {"consultants": [_consultant_out(c, db) for c in rows]}


@router.post("/consultants", summary="5.2 — onboard a consultant")
def create_consultant(
    req: ConsultantReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    unknown = [s for s in req.services if s not in SPECIAL_SERVICE_TYPES]
    if unknown:
        raise HTTPException(400, f"Unknown service types: {', '.join(unknown)}")

    consultant = Consultant(
        name=req.name,
        company_name=req.company_name,
        email=req.email,
        phone=req.phone,
        city=req.city,
        services=req.services,
        commission_rate=req.commission_rate,
        status=req.status,
        notes=req.notes,
        onboarded_by=user.id,
    )
    # 5.4 — the consultant needs a sign-in to see their own leads. Reuse an
    # existing account with the same email/phone; otherwise create one. Either
    # way the account gains the `consultant` role, which is what the login
    # portal guard checks.
    if req.email or req.phone:
        account = None
        if req.email:
            account = db.query(User).filter(User.email == req.email).first()
        if account is None and req.phone:
            account = db.query(User).filter(User.phone == req.phone).first()
        if account is None:
            account = User(
                name=req.name,
                email=req.email,
                phone=req.phone,
                city=req.city,
                role="consultant",
                status="active",
            )
            db.add(account)
            db.flush()
        else:
            roles = _roles(account)
            if "consultant" not in roles:
                account.role = ",".join(roles + ["consultant"])
        consultant.user_id = account.id

    db.add(consultant)
    db.commit()
    db.refresh(consultant)
    return _consultant_out(consultant, db)


@router.put("/consultants/{consultant_id}", summary="5.2 — update a consultant")
def update_consultant(
    consultant_id: str,
    req: ConsultantReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    c = db.query(Consultant).filter(Consultant.id == consultant_id).first()
    if not c:
        raise HTTPException(404, "Consultant not found")
    for field, value in req.model_dump().items():
        setattr(c, field, value)
    db.commit()
    db.refresh(c)
    return _consultant_out(c, db)


@router.get("/consultants/{consultant_id}", summary="5.1 — consultant detail")
def get_consultant(consultant_id: str, db: Session = Depends(get_db)):
    c = db.query(Consultant).filter(Consultant.id == consultant_id).first()
    if not c:
        raise HTTPException(404, "Consultant not found")
    return _consultant_out(c, db)


# ═══════════════════════════════════════════════ 5.3/5.4/5.5 lead flow ══════
@router.post("/leads", summary="5.3 — raise a special-service inquiry")
def create_lead(
    req: LeadReq,
    db: Session = Depends(get_db),
    # Public visitors can ask for a survey or drawings before signing up, so an
    # account is optional here; a signed-in customer is linked automatically.
    user: Optional[User] = Depends(optional_user),
):
    if req.service_type not in SPECIAL_SERVICE_TYPES:
        raise HTTPException(400, f"Unknown service type '{req.service_type}'")

    lead = ServiceLead(
        lead_no=next_lead_no(db),
        service_type=req.service_type,
        customer_id=user.id if user else None,
        customer_name=req.customer_name or (user.name if user else None),
        customer_phone=req.customer_phone or (user.phone if user else None),
        customer_email=req.customer_email or (user.email if user else None),
        city=req.city or (user.city if user else None),
        requirements=req.requirements,
        project_id=req.project_id,
        service_value=req.service_value,
        status="NEW",
    )
    recalc_lead_economics(lead, db)
    db.add(lead)
    db.flush()
    _log(db, lead, "NEW", "Inquiry received", user.id if user else "public")
    db.commit()
    db.refresh(lead)
    return _lead_out(lead, db)


@router.get("/leads", summary="5.4 — leads, scoped to who is asking")
def list_leads(
    status: Optional[str] = Query(None),
    service_type: Optional[str] = Query(None),
    consultant_id: Optional[str] = Query(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ServiceLead)
    roles = _roles(user)

    if "admin" in roles:
        if consultant_id:
            query = query.filter(ServiceLead.consultant_id == consultant_id)
    elif "consultant" in roles:
        # 5.4 — a consultant sees only what was assigned to them.
        me = _consultant_for(user, db)
        query = query.filter(ServiceLead.consultant_id == me.id)
    else:
        query = query.filter(ServiceLead.customer_id == user.id)

    if status:
        query = query.filter(ServiceLead.status == status)
    if service_type:
        query = query.filter(ServiceLead.service_type == service_type)

    rows = query.order_by(ServiceLead.created_at.desc()).all()
    return {"leads": [_lead_out(l, db) for l in rows]}


@router.post("/leads/{lead_id}/assign", summary="5.3 — route a lead to a consultant")
def assign_lead(
    lead_id: str,
    req: AssignReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    lead = db.query(ServiceLead).filter(ServiceLead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    consultant = db.query(Consultant).filter(Consultant.id == req.consultant_id).first()
    if not consultant:
        raise HTTPException(404, "Consultant not found")
    if consultant.status != "ACTIVE":
        raise HTTPException(400, f"Consultant is {consultant.status}, cannot take new leads")
    if lead.service_type not in (consultant.services or []):
        raise HTTPException(
            400,
            f"{consultant.name} is not registered for '{lead.service_type}'",
        )

    lead.consultant_id = consultant.id
    lead.assigned_at = datetime.datetime.utcnow()
    lead.assigned_by = user.id
    lead.status = "ASSIGNED"
    lead.updated_at = datetime.datetime.utcnow()
    recalc_lead_economics(lead, db)
    _log(db, lead, "ASSIGNED", req.note or f"Assigned to {consultant.name}", user.id)
    db.commit()
    db.refresh(lead)
    return _lead_out(lead, db)


@router.patch("/leads/{lead_id}/status", summary="5.5 — consultant updates progress")
def update_lead_status(
    lead_id: str,
    req: LeadStatusReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    lead = db.query(ServiceLead).filter(ServiceLead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    if req.status not in LEAD_STATUSES:
        raise HTTPException(400, f"Status must be one of: {', '.join(LEAD_STATUSES)}")

    roles = _roles(user)
    if "admin" not in roles:
        me = _consultant_for(user, db)
        if lead.consultant_id != me.id:
            raise HTTPException(403, "This lead is not assigned to you")

    lead.status = req.status
    lead.status_note = req.note
    lead.updated_at = datetime.datetime.utcnow()
    if req.service_value is not None:
        lead.service_value = req.service_value
    if req.status == "COMPLETED":
        lead.completed_at = datetime.datetime.utcnow()
    recalc_lead_economics(lead, db)
    _log(db, lead, req.status, req.note, user.id)
    db.commit()
    db.refresh(lead)
    return _lead_out(lead, db)


@router.patch("/leads/{lead_id}/payout", summary="5.7 — mark the consultant paid")
def update_payout(
    lead_id: str,
    req: PayoutReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    _require_admin(user)
    lead = db.query(ServiceLead).filter(ServiceLead.id == lead_id).first()
    if not lead:
        raise HTTPException(404, "Lead not found")
    if req.payout_status not in ("PENDING", "PAID"):
        raise HTTPException(400, "payout_status must be PENDING or PAID")
    lead.payout_status = req.payout_status
    _log(db, lead, lead.status, f"Payout marked {req.payout_status}", user.id)
    db.commit()
    db.refresh(lead)
    return _lead_out(lead, db)


# ═══════════════════════════════════════ 1.12 pre-checkout capture ═════════
REQUIRED_CONFIRMATIONS = ["site_access", "scope_final", "full_payment_terms"]


class CheckoutServiceReq(BaseModel):
    service_type: str
    requirements: Optional[str] = None


class PreCheckoutReq(BaseModel):
    services: list[CheckoutServiceReq] = Field(default_factory=list)
    confirmations: dict[str, bool] = Field(default_factory=dict)
    site_access_from: Optional[str] = None
    notes: Optional[str] = None


def _owned_project(project_id: str, user: User, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    if project.user_id != user.id and "admin" not in _roles(user):
        raise HTTPException(403, "Not your project")
    return project


@router.get("/checkout/{project_id}", summary="1.12 — what was captured before checkout")
def get_pre_checkout(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _owned_project(project_id, user, db)
    leads = db.query(ServiceLead).filter(ServiceLead.project_id == project_id).all()
    saved = (project.defaults or {}).get("pre_checkout") if isinstance(project.defaults, dict) else None
    return {
        "project_id": project_id,
        "service_types": SPECIAL_SERVICE_TYPES,
        "required_confirmations": REQUIRED_CONFIRMATIONS,
        "saved": saved,
        "complete": bool(saved and all(saved.get("confirmations", {}).get(k) for k in REQUIRED_CONFIRMATIONS)),
        "leads": [_lead_out(l, db) for l in leads],
    }


@router.post("/checkout/{project_id}", summary="1.12 — capture special services & confirmations before checkout")
def save_pre_checkout(
    project_id: str,
    req: PreCheckoutReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _owned_project(project_id, user, db)

    missing = [k for k in REQUIRED_CONFIRMATIONS if not req.confirmations.get(k)]
    if missing:
        raise HTTPException(400, f"Please confirm: {', '.join(missing)}")
    unknown = [svc.service_type for svc in req.services if svc.service_type not in SPECIAL_SERVICE_TYPES]
    if unknown:
        raise HTTPException(400, f"Unknown service types: {', '.join(unknown)}")

    # One lead per service per project — revisiting checkout must not spam
    # partners with duplicate inquiries.
    existing = {
        l.service_type: l
        for l in db.query(ServiceLead).filter(ServiceLead.project_id == project_id).all()
    }
    created = []
    for svc in req.services:
        lead = existing.get(svc.service_type)
        if lead:
            if svc.requirements and svc.requirements != lead.requirements and lead.status == "NEW":
                lead.requirements = svc.requirements
                lead.updated_at = datetime.datetime.utcnow()
            continue
        lead = ServiceLead(
            lead_no=next_lead_no(db),
            service_type=svc.service_type,
            customer_id=project.user_id,
            project_id=project_id,
            customer_name=user.name,
            customer_phone=user.phone,
            customer_email=user.email,
            city=project.city,
            requirements=svc.requirements,
            status="NEW",
        )
        recalc_lead_economics(lead, db)
        db.add(lead)
        db.flush()
        _log(db, lead, "NEW", "Requested at checkout", user.id)
        created.append(lead)

    defaults = dict(project.defaults or {}) if isinstance(project.defaults, dict) else {}
    defaults["pre_checkout"] = {
        "confirmations": {k: bool(v) for k, v in req.confirmations.items()},
        "site_access_from": req.site_access_from,
        "notes": req.notes,
        "services": [svc.service_type for svc in req.services],
        "captured_at": datetime.datetime.utcnow().isoformat(),
        "captured_by": user.id,
    }
    project.defaults = defaults   # reassign so SQLAlchemy persists the JSON change
    db.commit()

    return {
        **get_pre_checkout(project_id, user, db),
        "created_leads": [l.lead_no for l in created],
    }


# ═══════════════════════════════════════════════ 5.6/5.7 commercials ════════
@router.get("/earnings", summary="5.6/5.7 — commission and payout ledger")
def earnings(
    consultant_id: Optional[str] = Query(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    roles = _roles(user)
    query = db.query(ServiceLead)

    if "admin" in roles:
        if consultant_id:
            query = query.filter(ServiceLead.consultant_id == consultant_id)
    elif "consultant" in roles:
        me = _consultant_for(user, db)
        query = query.filter(ServiceLead.consultant_id == me.id)
    else:
        raise HTTPException(403, "Admin or consultant access required")

    leads = query.all()
    completed = [l for l in leads if l.status == "COMPLETED"]

    by_consultant: dict[str, dict[str, Any]] = {}
    for l in completed:
        if not l.consultant_id:
            continue
        row = by_consultant.setdefault(
            l.consultant_id,
            {"consultant_id": l.consultant_id, "consultant_name": None,
             "leads": 0, "service_value": 0.0, "platform_earning": 0.0,
             "consultant_payout": 0.0, "unpaid": 0.0},
        )
        row["leads"] += 1
        row["service_value"] += l.service_value or 0
        row["platform_earning"] += l.platform_earning or 0
        row["consultant_payout"] += l.consultant_payout or 0
        if l.payout_status != "PAID":
            row["unpaid"] += l.consultant_payout or 0

    for cid, row in by_consultant.items():
        c = db.query(Consultant).filter(Consultant.id == cid).first()
        row["consultant_name"] = c.name if c else None
        for k in ("service_value", "platform_earning", "consultant_payout", "unpaid"):
            row[k] = round(row[k], 2)

    return {
        "summary": {
            "total_leads": len(leads),
            "completed_leads": len(completed),
            "gross_service_value": round(sum(l.service_value or 0 for l in completed), 2),
            "platform_earning": round(sum(l.platform_earning or 0 for l in completed), 2),
            "consultant_payout": round(sum(l.consultant_payout or 0 for l in completed), 2),
            "unpaid_payout": round(
                sum(l.consultant_payout or 0 for l in completed if l.payout_status != "PAID"), 2
            ),
        },
        "by_consultant": list(by_consultant.values()),
    }


@router.get("/quote", summary="5.6 — preview the commission split on a value")
def preview_commission(
    service_value: float = Query(..., ge=0),
    commission_rate: float = Query(15.0, ge=0, le=100),
):
    return commission_split(service_value, commission_rate)
