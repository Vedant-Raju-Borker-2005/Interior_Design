"""Shared business rules introduced by the stakeholder feedback round.

Kept in one place so the quotation, admin, B2B and special-services routers all
compute identifiers, discounts, GST and commission the same way.
"""
from __future__ import annotations

import datetime
import os
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..models import Consultant, Quotation, ServiceLead

# India GST on interior fit-out work.
DEFAULT_GST_RATE = 18.0

# Feedback 1.9 — payment arrives offline far more often than through a gateway.
PAYMENT_MODES = ["BANK_TRANSFER", "UPI", "CHEQUE", "CASH", "GATEWAY"]

# Feedback 2.1 — how a bulk discount may be expressed.
DISCOUNT_TYPES = ["PERCENT", "FLAT_PER_UNIT", "FLAT_TOTAL"]


# ═══════════════════════════════════════════════════════════ BHK format ═════
def normalize_bhk(value: Optional[str]) -> Optional[str]:
    """'3 BHK', '3bhk', ' 3 Bhk ' -> '3BHK' (the catalogue / onboarding form).

    The codebase uses two spellings: onboarding, packages and room templates
    key on '3BHK', while the IDS 3D engine and some API callers send '3 BHK'.
    Every exact-match lookup goes through here so either spelling works.
    """
    if value is None:
        return None
    text = str(value).strip().upper().replace(" ", "")
    if text.isdigit():
        text = f"{text}BHK"
    return text or None


# ══════════════════════════════════════════════════ readable identifiers ════
def _next_sequence(db: Session, model, field: str, prefix: str) -> str:
    """`PREFIX-YYYY-00001`, counting only this year's rows.

    Note the scan is per-year and these documents are low-volume; if that ever
    changes this wants a real sequence table rather than a COUNT.
    """
    year = datetime.datetime.utcnow().year
    like = f"{prefix}-{year}-%"
    used = db.query(model).filter(getattr(model, field).like(like)).count()
    while True:
        used += 1
        candidate = f"{prefix}-{year}-{used:05d}"
        exists = db.query(model).filter(getattr(model, field) == candidate).first()
        if not exists:
            return candidate


def next_quotation_no(db: Session) -> str:
    """Feedback 1.4 — every quotation carries a unique, quotable reference."""
    return _next_sequence(db, Quotation, "quotation_no", "QT")


def next_lead_no(db: Session) -> str:
    """Feedback 5.3 — special-service leads are tracked by reference too."""
    return _next_sequence(db, ServiceLead, "lead_no", "SL")


# ═══════════════════════════════════════════════════ billing identity ═══════
def billing_snapshot_for(user) -> dict[str, Any]:
    """Feedback 1.3 — freeze the customer's billing identity onto the quotation.

    Frozen rather than joined: if the customer later edits their GST number, an
    already-issued quotation must keep showing what was invoiced.
    """
    if user is None:
        return {}
    return {
        "name": user.name,
        "company_name": getattr(user, "company_name", None),
        "gst_number": getattr(user, "gst_number", None),
        "pan_number": getattr(user, "pan_number", None),
        "email": user.email,
        "phone": user.phone,
        "billing_address": getattr(user, "billing_address", None),
        "billing_city": getattr(user, "billing_city", None) or user.city,
        "billing_state": getattr(user, "billing_state", None),
        "billing_pincode": getattr(user, "billing_pincode", None),
        "captured_at": datetime.datetime.utcnow().isoformat(),
    }


# ═════════════════════════════════════════════════════ B2B discounting ══════
def compute_discount(
    subtotal: float,
    discount_type: Optional[str],
    discount_value: float,
    units: int = 1,
) -> dict[str, float]:
    """Feedback 2.1/2.2 — the discount lives at project level.

    Product prices are deliberately left untouched; only the order total moves,
    so the customer can still see the original per-unit price beside the
    discounted one.
    """
    units = max(1, int(units or 1))
    subtotal = float(subtotal or 0)
    discount = 0.0

    if discount_type and discount_value:
        value = float(discount_value)
        if discount_type == "PERCENT":
            discount = subtotal * (value / 100.0)
        elif discount_type == "FLAT_PER_UNIT":
            discount = value * units
        elif discount_type == "FLAT_TOTAL":
            discount = value

    discount = max(0.0, min(discount, subtotal))
    discounted = subtotal - discount

    return {
        "units": units,
        "original_total": round(subtotal, 2),
        "discount_amount": round(discount, 2),
        "discounted_total": round(discounted, 2),
        "original_unit_price": round(subtotal / units, 2),
        "discounted_unit_price": round(discounted / units, 2),
        "savings_per_unit": round(discount / units, 2),
        "savings_percent": round((discount / subtotal * 100) if subtotal else 0.0, 2),
    }


def unit_projects(project, db: Session) -> list:
    """The per-flat child projects of a bulk (B2B) project.

    `flat_id` is what marks a real unit; a converted B2C delivery project also
    has a parent but no flat, and must not be counted here.
    """
    from ..models import Project

    return (
        db.query(Project)
        .filter(Project.parent_project_id == project.id, Project.flat_id.isnot(None))
        .all()
    )


def effective_discount(project, db: Session) -> tuple[Optional[str], float]:
    """Feedback 2.1 — the discount the admin set on a bulk project applies to
    every unit in it. A unit with its own discount keeps its own; a flat-total
    discount on the parent is shared equally across its units."""
    from ..models import Project

    if project.discount_type and project.discount_value:
        return project.discount_type, float(project.discount_value)
    if getattr(project, "flat_id", None) and project.parent_project_id:
        parent = db.query(Project).filter(Project.id == project.parent_project_id).first()
        if parent and parent.discount_type and parent.discount_value:
            if parent.discount_type == "FLAT_TOTAL":
                units = max(1, len(unit_projects(parent, db)) or (parent.total_units or 1))
                return "FLAT_PER_UNIT", float(parent.discount_value) / units
            return parent.discount_type, float(parent.discount_value)
    return None, 0.0


def apply_gst(amount: float, rate: float = DEFAULT_GST_RATE) -> dict[str, float]:
    """Feedback 1.3 — GST shown explicitly on the quotation."""
    amount = float(amount or 0)
    gst = amount * (rate / 100.0)
    return {
        "taxable_amount": round(amount, 2),
        "gst_rate": rate,
        "gst_amount": round(gst, 2),
        "total": round(amount + gst, 2),
    }


def quote_totals(
    subtotal: float,
    discount_type: Optional[str] = None,
    discount_value: float = 0.0,
    units: int = 1,
    gst_rate: float = DEFAULT_GST_RATE,
) -> dict[str, Any]:
    """One call that produces every number a quotation has to print."""
    d = compute_discount(subtotal, discount_type, discount_value, units)
    g = apply_gst(d["discounted_total"], gst_rate)
    return {**d, **g, "grand_total": g["total"]}


# ════════════════════════════════════════════════════ payment model ═════════
def is_b2b_project(project, db: Session) -> bool:
    """Feedback 1.11 applies to B2C only, so the payment schedule depends on
    which side of the business a project sits on.

    B2B work is a unit inside a bulk deal (flat_id set), a multi-unit project, or
    a project owned by an enterprise account.
    """
    from ..models import User

    if getattr(project, "flat_id", None):
        return True
    if (getattr(project, "total_units", 0) or 0) > 1:
        return True
    owner = db.query(User).filter(User.id == project.user_id).first()
    roles = [r.strip() for r in ((owner.role if owner else "") or "").split(",")]
    return "enterprise" in roles


def offline_payment_details() -> dict[str, Any]:
    """Bank details for offline payment (feedback 1.9).

    Read from the environment on purpose: account numbers must never be
    invented in code. When they are not configured the UI says the team will
    share them rather than showing placeholder numbers a customer might use.
    """
    details = {
        "account_name": os.getenv("PAYMENT_ACCOUNT_NAME"),
        "account_number": os.getenv("PAYMENT_ACCOUNT_NUMBER"),
        "ifsc": os.getenv("PAYMENT_IFSC"),
        "bank_name": os.getenv("PAYMENT_BANK_NAME"),
        "upi_id": os.getenv("PAYMENT_UPI_ID"),
    }
    configured = bool(details["account_number"] and details["ifsc"]) or bool(details["upi_id"])
    return {"configured": configured, **(details if configured else {})}


# ═══════════════════════════════════════════════════════ commissions ════════
def commission_split(service_value: float, commission_rate: float) -> dict[str, float]:
    """Feedback 5.6/5.7 — the platform refers, the consultant delivers.

    `commission_rate` is the share the platform keeps; the remainder is payable
    to the consultant.
    """
    value = float(service_value or 0)
    rate = max(0.0, min(100.0, float(commission_rate or 0)))
    platform = value * (rate / 100.0)
    return {
        "service_value": round(value, 2),
        "commission_rate": rate,
        "platform_earning": round(platform, 2),
        "consultant_payout": round(value - platform, 2),
    }


def recalc_lead_economics(lead: ServiceLead, db: Session) -> ServiceLead:
    """Keep a lead's money fields consistent with its consultant's rate."""
    rate = lead.commission_rate
    if lead.consultant_id:
        consultant = db.query(Consultant).filter(Consultant.id == lead.consultant_id).first()
        if consultant and consultant.commission_rate is not None:
            rate = consultant.commission_rate
    split = commission_split(lead.service_value or 0, rate)
    lead.commission_rate = split["commission_rate"]
    lead.platform_earning = split["platform_earning"]
    lead.consultant_payout = split["consultant_payout"]
    return lead
