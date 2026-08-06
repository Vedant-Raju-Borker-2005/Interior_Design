"""Admin Router — platform analytics, client CRM, vendor approvals, quote audits, assignments, master data management, pricing rules, settings, documents vault, and reporting."""
import csv
import io
import uuid
import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, HTTPException, UploadFile, File, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, and_
from pydantic import BaseModel

from ..db import get_db
from ..models import (
    User, Project, Quotation, Inquiry, Vendor, Package, Product, Room, RoomItem,
    AdminRole, QuoteAudit, ProjectAssignmentHistory, PackageConfiguration, PackageItems,
    PricingRule, SystemSetting, AuditLog, Payment, VendorDocument, SupportTicket,
    ActivityLog, ProjectTeamMember, ProjectAssignment, ItemTracking, ProjectDocument, Issue
)
from ..auth_utils import current_user

router = APIRouter()

# ── Pydantic Request Schemas ──

class CustomerProfileReq(BaseModel):
    name: str
    email: str
    phone: str
    city: str

class VendorStatusReq(BaseModel):
    status: str  # APPROVED, REJECTED
    rejection_reason: Optional[str] = None

class QuoteReq(BaseModel):
    project_id: str
    subtotal: float
    gst: float
    total: float
    customer_notes: Optional[str] = None
    line_items: list = []

class ProjectReq(BaseModel):
    user_id: str
    property_name: str
    bhk_type: str
    city: str
    budget: float
    pincode: Optional[str] = None
    package_id: Optional[str] = None

class AssignmentReq(BaseModel):
    assignee_id: str
    role: str  # VENDOR, COORDINATOR, TECHNICIAN
    target_item_id: Optional[str] = None

class MasterProductReq(BaseModel):
    sku: str
    name: str
    category: str
    subcategory: str
    price: float
    description: Optional[str] = None
    thumbnail_url: Optional[str] = None

class PackageConfigReq(BaseModel):
    name: str
    tier: str
    pricing: float
    timeline_days: int
    included_services: list = []

class PricingRuleReq(BaseModel):
    rule_type: str  # PRODUCT, PACKAGE, VENDOR, DISCOUNT, GST
    name: str
    value: float
    effective_date: str  # YYYY-MM-DD
    expiry_date: str     # YYYY-MM-DD

class AssignRoleReq(BaseModel):
    user_id: str
    role_name: str  # SUPER_ADMIN, OPERATIONS_ADMIN, SALES_ADMIN, FINANCE_ADMIN

class DocUploadReq(BaseModel):
    title: str
    type: str  # QUOTATION, INVOICE, FLOOR_PLAN, SITE_REPORT, COMPLETION_CERTIFICATE
    project_id: str

class SystemSettingReq(BaseModel):
    key: str
    value: str
    category: str


# ── Role Dependency Guards ──

def get_admin_user(allowed_roles: List[str] = None):
    def dependency(user: User = Depends(current_user), db: Session = Depends(get_db)):
        if user.role == "admin":
            return user
        
        # Check AdminRole association
        admin_role = db.query(AdminRole).filter(AdminRole.user_id == user.id).first()
        if not admin_role:
            raise HTTPException(status_code=403, detail="Not authorized as administrator")
        
        if allowed_roles and admin_role.role_name not in allowed_roles and admin_role.role_name != "SUPER_ADMIN":
            raise HTTPException(status_code=403, detail=f"Permission denied for role: {admin_role.role_name}")
        
        return user
    return dependency


def log_admin_action(db: Session, user_id: str, action: str, entity_type: str, entity_id: str):
    log = AuditLog(
        id=str(uuid.uuid4()),
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(log)
    db.commit()


# ── Endpoints ──

@router.get("/stats", summary="Platform metrics & KPIs dashboard")
def get_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN", "SALES_ADMIN", "FINANCE_ADMIN"]))
):
    total_users = db.query(User).count()
    total_projects = db.query(Project).count()
    total_quotations = db.query(Quotation).count()
    total_inquiries = db.query(Inquiry).count()
    total_vendors = db.query(Vendor).count()

    budgets = db.query(Project.budget).all()
    revenue_pipeline = sum(b[0] for b in budgets if b[0])

    status_rows = db.query(Project.status, func.count(Project.id)).group_by(Project.status).all()
    projects_by_status = {s: c for s, c in status_rows}

    inq_rows = db.query(Inquiry.status, func.count(Inquiry.id)).group_by(Inquiry.status).all()
    inquiries_by_status = {s: c for s, c in inq_rows}

    # PRD metrics
    total_clients = db.query(User).filter(User.role == "customer").count()
    active_projects = db.query(Project).filter(Project.status.notin_(["done", "cancelled", "closed"])).count()
    total_revenue = db.query(func.sum(Payment.amount)).filter(Payment.status == "completed").scalar() or 0.0
    pending_payments = db.query(Payment).filter(Payment.status == "pending").count()
    delayed_projects = db.query(Project).filter(Project.status == "delayed").count()
    active_vendors = db.query(Vendor).filter(Vendor.status == "APPROVED").count()
    open_issues = db.query(Issue).filter(Issue.status.notin_(["resolved", "closed"])).count()

    # Trends
    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    revenue_trend = [{"month": m, "amount": 0.0} for m in months]
    project_trend = [{"month": m, "count": 0} for m in months]
    customer_growth = [{"month": m, "count": 0} for m in months]

    # Populate monthly mock trends
    current_year = datetime.datetime.utcnow().year
    payments = db.query(Payment).filter(Payment.status == "completed").all()
    for p in payments:
        if p.payment_date and p.payment_date.year == current_year:
            m_idx = p.payment_date.month - 1
            if 0 <= m_idx < 12:
                revenue_trend[m_idx]["amount"] += p.amount

    all_projs = db.query(Project).all()
    for p in all_projs:
        if p.created_at and p.created_at.year == current_year:
            m_idx = p.created_at.month - 1
            if 0 <= m_idx < 12:
                project_trend[m_idx]["count"] += 1

    all_custs = db.query(User).filter(User.role == "customer").all()
    for c in all_custs:
        if c.created_at and c.created_at.year == current_year:
            m_idx = c.created_at.month - 1
            if 0 <= m_idx < 12:
                customer_growth[m_idx]["count"] += 1

    return {
        "total_users": total_users,
        "total_projects": total_projects,
        "total_quotations": total_quotations,
        "total_inquiries": total_inquiries,
        "total_vendors": total_vendors,
        "revenue_pipeline": revenue_pipeline,
        "projects_by_status": projects_by_status,
        "inquiries_by_status": inquiries_by_status,
        
        "total_clients": total_clients,
        "active_projects": active_projects,
        "total_revenue": total_revenue,
        "pending_payments": pending_payments,
        "delayed_projects": delayed_projects,
        "active_vendors": active_vendors,
        "open_issues": open_issues,
        
        "revenue_trend": revenue_trend,
        "project_trend": project_trend,
        "customer_growth": customer_growth
    }


# ── CLIENT MANAGEMENT ──

@router.get("/customers", summary="List all platform customers")
def list_customers(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "SALES_ADMIN"]))
):
    q = db.query(User).filter(User.role == "customer")
    if search:
        q = q.filter(or_(User.name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%"), User.phone.ilike(f"%{search}%")))
    if status:
        q = q.filter(User.status == status)
    
    total = q.count()
    users = q.order_by(User.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    return {
        "customers": [
            {
                "id": u.id,
                "name": u.name,
                "email": u.email,
                "phone": u.phone,
                "city": u.city,
                "status": u.status or "active",
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "project_count": db.query(Project).filter(Project.user_id == u.id).count(),
            }
            for u in users
        ],
        "total": total,
        "page": page,
        "limit": limit
    }

@router.get("/customers/{customer_id}", summary="Get customer profile details & logs")
def get_customer_detail(
    customer_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "SALES_ADMIN"]))
):
    user = db.query(User).filter(User.id == customer_id, User.role == "customer").first()
    if not user:
        raise HTTPException(404, "Customer not found")

    inquiries = db.query(Inquiry).filter(Inquiry.email == user.email).all()
    projects = db.query(Project).filter(Project.user_id == user.id).all()
    
    proj_ids = [p.id for p in projects]
    quotations = db.query(Quotation).filter(Quotation.project_id.in_(proj_ids)).all() if proj_ids else []
    payments = db.query(Payment).filter(Payment.project_id.in_(proj_ids)).all() if proj_ids else []
    activity_logs = db.query(ActivityLog).filter(ActivityLog.user_id == user.id).order_by(ActivityLog.created_at.desc()).all()

    return {
        "profile": {
            "id": user.id,
            "name": user.name,
            "email": user.email,
            "phone": user.phone,
            "city": user.city,
            "status": user.status or "active",
            "style_tags": user.style_tags or [],
            "budget_min": user.budget_min,
            "budget_max": user.budget_max,
            "created_at": user.created_at.isoformat() if user.created_at else None
        },
        "inquiries": inquiries,
        "projects": projects,
        "quotations": quotations,
        "payments": payments,
        "activity_logs": activity_logs
    }

@router.put("/customers/{customer_id}", summary="Edit customer profile")
def edit_customer(
    customer_id: str,
    req: CustomerProfileReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "SALES_ADMIN"]))
):
    user = db.query(User).filter(User.id == customer_id, User.role == "customer").first()
    if not user:
        raise HTTPException(404, "Customer not found")
    
    user.name = req.name
    user.email = req.email
    user.phone = req.phone
    user.city = req.city
    db.commit()
    log_admin_action(db, admin.id, "EDIT_CUSTOMER_PROFILE", "User", customer_id)
    return {"message": "Profile updated successfully"}

@router.post("/customers/{customer_id}/suspend", summary="Suspend customer account")
def suspend_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "SALES_ADMIN"]))
):
    user = db.query(User).filter(User.id == customer_id, User.role == "customer").first()
    if not user:
        raise HTTPException(404, "Customer not found")
    
    user.status = "suspended"
    db.commit()
    log_admin_action(db, admin.id, "SUSPEND_CUSTOMER", "User", customer_id)
    return {"message": "Customer account suspended"}

@router.post("/customers/{customer_id}/reactivate", summary="Reactivate customer account")
def reactivate_customer(
    customer_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "SALES_ADMIN"]))
):
    user = db.query(User).filter(User.id == customer_id, User.role == "customer").first()
    if not user:
        raise HTTPException(404, "Customer not found")
    
    user.status = "active"
    db.commit()
    log_admin_action(db, admin.id, "REACTIVATE_CUSTOMER", "User", customer_id)
    return {"message": "Customer account reactivated"}


# ── VENDOR APPROVALS ──

@router.get("/vendors", summary="List all vendor profiles & onboarding documents")
def list_vendors(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    q = db.query(Vendor)
    if status:
        q = q.filter(Vendor.status == status)
    vendors = q.all()
    
    out = []
    for v in vendors:
        doc = db.query(VendorDocument).filter(VendorDocument.vendor_id == v.id).first()
        out.append({
            "id": v.id,
            "name": v.name,
            "business_name": v.business_name,
            "owner_name": v.owner_name,
            "email": v.email,
            "phone": v.phone,
            "status": v.status or "SUBMITTED",
            "active": v.active,
            "rating": v.rating or 5.0,
            "categories": v.categories or [],
            "documents": {
                "gst_certificate": doc.gst_certificate if doc else None,
                "pan_card": doc.pan_card if doc else None,
                "bank_details": doc.bank_details if doc else None,
                "approval_status": doc.approval_status if doc else "PENDING"
            } if doc else None
        })
    return out

@router.post("/vendors/{vendor_id}/approve", summary="Approve vendor onboarding status")
def approve_vendor(
    vendor_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    
    vendor.status = "APPROVED"
    vendor.active = True
    
    doc = db.query(VendorDocument).filter(VendorDocument.vendor_id == vendor_id).first()
    if doc:
        doc.approval_status = "APPROVED"
        doc.approved_by = admin.name
        doc.approved_at = datetime.datetime.utcnow()
        
    db.commit()
    log_admin_action(db, admin.id, "VENDOR_APPROVED", "Vendor", vendor_id)
    return {"message": "Vendor approved and activated successfully"}

@router.post("/vendors/{vendor_id}/reject", summary="Reject vendor onboarding status")
def reject_vendor(
    vendor_id: str,
    req: VendorStatusReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    
    vendor.status = "REJECTED"
    vendor.active = False
    
    doc = db.query(VendorDocument).filter(VendorDocument.vendor_id == vendor_id).first()
    if doc:
        doc.approval_status = "REJECTED"
        doc.rejection_reason = req.rejection_reason
        
    db.commit()
    log_admin_action(db, admin.id, "VENDOR_REJECTED", "Vendor", vendor_id)
    return {"message": "Vendor rejected"}

@router.post("/vendors/{vendor_id}/request-docs", summary="Request additional vendor onboarding documents")
def request_vendor_docs(
    vendor_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    doc = db.query(VendorDocument).filter(VendorDocument.vendor_id == vendor_id).first()
    if not doc:
        doc = VendorDocument(id=str(uuid.uuid4()), vendor_id=vendor_id)
        db.add(doc)
    doc.approval_status = "UNDER_REVIEW"
    db.commit()
    log_admin_action(db, admin.id, "VENDOR_DOCS_REQUESTED", "Vendor", vendor_id)
    return {"message": "Additional documents requested"}

@router.post("/vendors/{vendor_id}/suspend", summary="Suspend vendor operations")
def suspend_vendor(
    vendor_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    vendor.active = False
    db.commit()
    log_admin_action(db, admin.id, "VENDOR_SUSPENDED", "Vendor", vendor_id)
    return {"message": "Vendor operations suspended"}

@router.post("/vendors/{vendor_id}/reactivate", summary="Reactivate vendor operations")
def reactivate_vendor(
    vendor_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    vendor.active = True
    db.commit()
    log_admin_action(db, admin.id, "VENDOR_REACTIVATED", "Vendor", vendor_id)
    return {"message": "Vendor operations reactivated"}

@router.get("/vendors/{vendor_id}/performance", summary="Get vendor performance statistics")
def get_vendor_performance(
    vendor_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        raise HTTPException(404, "Vendor not found")
    
    from .project_team import calculate_vendor_performance_metrics
    perf = calculate_vendor_performance_metrics(vendor_id, db)
    return perf


# ── QUOTATION ADMINISTRATION ──

@router.get("/quotations", summary="List all quotations")
def list_quotations(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "SALES_ADMIN"]))
):
    quotations = db.query(Quotation).all()
    return quotations

@router.post("/quotations", summary="Create direct quotation")
def create_quotation(
    req: QuoteReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "SALES_ADMIN"]))
):
    qid = str(uuid.uuid4())
    quote = Quotation(
        id=qid,
        project_id=req.project_id,
        subtotal=req.subtotal,
        gst=req.gst,
        total=req.total,
        status="draft",
        customer_notes=req.customer_notes,
        line_items=req.line_items
    )
    db.add(quote)
    db.commit()
    
    # Audit log
    audit = QuoteAudit(
        id=str(uuid.uuid4()),
        quotation_id=qid,
        action="CREATED",
        changed_by=admin.id,
        details="Quotation generated by administrator"
    )
    db.add(audit)
    db.commit()
    
    log_admin_action(db, admin.id, "QUOTE_CREATED", "Quotation", qid)
    return quote

@router.put("/quotations/{quotation_id}", summary="Edit existing quotation & log revision")
def edit_quotation(
    quotation_id: str,
    req: QuoteReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "SALES_ADMIN"]))
):
    quote = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quote:
        raise HTTPException(404, "Quotation not found")
    
    # Track previous details
    prev_details = f"Subtotal: {quote.subtotal} -> {req.subtotal}, Total: {quote.total} -> {req.total}"
    
    quote.subtotal = req.subtotal
    quote.gst = req.gst
    quote.total = req.total
    quote.customer_notes = req.customer_notes
    quote.line_items = req.line_items
    db.commit()
    
    audit = QuoteAudit(
        id=str(uuid.uuid4()),
        quotation_id=quotation_id,
        action="EDITED",
        changed_by=admin.id,
        details=f"Quotation edited. Changes: {prev_details}"
    )
    db.add(audit)
    db.commit()
    
    log_admin_action(db, admin.id, "QUOTE_EDITED", "Quotation", quotation_id)
    return {"message": "Quotation updated and version logged"}

@router.post("/quotations/{quotation_id}/approve", summary="Approve quotation")
def approve_quotation(
    quotation_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "SALES_ADMIN"]))
):
    quote = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quote:
        raise HTTPException(404, "Quotation not found")
    
    quote.status = "approved"
    
    audit = QuoteAudit(
        id=str(uuid.uuid4()),
        quotation_id=quotation_id,
        action="APPROVED",
        changed_by=admin.id,
        details="Quotation approved by administrator"
    )
    db.add(audit)
    db.commit()
    log_admin_action(db, admin.id, "QUOTE_APPROVED", "Quotation", quotation_id)
    return {"message": "Quotation approved"}

@router.post("/quotations/{quotation_id}/reject", summary="Reject quotation")
def reject_quotation(
    quotation_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "SALES_ADMIN"]))
):
    quote = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quote:
        raise HTTPException(404, "Quotation not found")
    
    quote.status = "rejected"
    
    audit = QuoteAudit(
        id=str(uuid.uuid4()),
        quotation_id=quotation_id,
        action="REJECTED",
        changed_by=admin.id,
        details="Quotation rejected by administrator"
    )
    db.add(audit)
    db.commit()
    log_admin_action(db, admin.id, "QUOTE_REJECTED", "Quotation", quotation_id)
    return {"message": "Quotation rejected"}

@router.post("/quotations/{quotation_id}/expire", summary="Expire quotation")
def expire_quotation(
    quotation_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "SALES_ADMIN"]))
):
    quote = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quote:
        raise HTTPException(404, "Quotation not found")
    
    quote.status = "expired"
    
    audit = QuoteAudit(
        id=str(uuid.uuid4()),
        quotation_id=quotation_id,
        action="EXPIRED",
        changed_by=admin.id,
        details="Quotation marked as expired by administrator"
    )
    db.add(audit)
    db.commit()
    log_admin_action(db, admin.id, "QUOTE_EXPIRED", "Quotation", quotation_id)
    return {"message": "Quotation expired"}

@router.post("/quotations/{quotation_id}/convert", summary="Convert quote to active project")
def convert_quotation(
    quotation_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "SALES_ADMIN"]))
):
    quote = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quote:
        raise HTTPException(404, "Quotation not found")
    
    quote.status = "ordered"
    
    project = db.query(Project).filter(Project.id == quote.project_id).first()
    if project:
        project.status = "ordered"
        
    audit = QuoteAudit(
        id=str(uuid.uuid4()),
        quotation_id=quotation_id,
        action="CONVERTED",
        changed_by=admin.id,
        details="Converted quote to active ordered project"
    )
    db.add(audit)
    db.commit()
    log_admin_action(db, admin.id, "QUOTE_CONVERTED", "Quotation", quotation_id)
    return {"message": "Quotation converted to project"}

@router.get("/quotations/{quotation_id}/history", summary="Get quote audit trail history")
def get_quote_history(
    quotation_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "SALES_ADMIN"]))
):
    audits = db.query(QuoteAudit).filter(QuoteAudit.quotation_id == quotation_id).order_by(QuoteAudit.timestamp.desc()).all()
    return audits


# ── PROJECT CONTROL CENTER ──

@router.get("/projects", summary="List all projects (admin view)")
def admin_list_projects(
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN", "SALES_ADMIN"]))
):
    q = db.query(Project)
    if status:
        q = q.filter(Project.status == status)
    if search:
        q = q.filter(or_(
            Project.property_name.ilike(f"%{search}%"),
            Project.city.ilike(f"%{search}%"),
            Project.bhk_type.ilike(f"%{search}%")
        ))
    total = q.count()
    projects = q.order_by(Project.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    result = []
    for p in projects:
        customer = db.query(User).filter(User.id == p.user_id).first()
        result.append({
            "id": p.id,
            "property_name": p.property_name,
            "bhk_type": p.bhk_type,
            "city": p.city,
            "budget": p.budget,
            "status": p.status,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "customer_name": customer.name if customer else "Unknown",
            "customer_phone": customer.phone if customer else None,
            "customer_email": customer.email if customer else None,
        })
    return {"projects": result, "total": total, "page": page, "limit": limit}


@router.post("/projects", summary="Create a new project")
def admin_create_project(
    req: ProjectReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    pid = str(uuid.uuid4())
    project = Project(
        id=pid,
        user_id=req.user_id,
        property_name=req.property_name,
        bhk_type=req.bhk_type,
        city=req.city,
        budget=req.budget,
        pincode=req.pincode,
        package_id=req.package_id,
        status="draft"
    )
    db.add(project)
    db.commit()
    log_admin_action(db, admin.id, "PROJECT_CREATED", "Project", pid)
    return project

@router.put("/projects/{project_id}", summary="Edit project details")
def admin_edit_project(
    project_id: str,
    req: ProjectReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    project.user_id = req.user_id
    project.property_name = req.property_name
    project.bhk_type = req.bhk_type
    project.city = req.city
    project.budget = req.budget
    project.pincode = req.pincode
    project.package_id = req.package_id
    db.commit()
    log_admin_action(db, admin.id, "PROJECT_EDITED", "Project", project_id)
    return {"message": "Project edited successfully"}

@router.post("/projects/{project_id}/close", summary="Close/complete project")
def admin_close_project(
    project_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    project.status = "done"
    db.commit()
    log_admin_action(db, admin.id, "PROJECT_CLOSED", "Project", project_id)
    return {"message": "Project closed/completed successfully"}

@router.post("/projects/{project_id}/cancel", summary="Cancel project")
def admin_cancel_project(
    project_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    project.status = "cancelled"
    db.commit()
    log_admin_action(db, admin.id, "PROJECT_CANCELLED", "Project", project_id)
    return {"message": "Project cancelled successfully"}

@router.post("/projects/{project_id}/assign", summary="Assign resources to project")
def admin_assign_project_resource(
    project_id: str,
    req: AssignmentReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    # Create project assignment history entry
    hist = ProjectAssignmentHistory(
        id=str(uuid.uuid4()),
        project_id=project_id,
        assignee_id=req.assignee_id,
        role=req.role,
        action="ASSIGNED",
        assigned_by=admin.id,
        timestamp=datetime.datetime.utcnow()
    )
    db.add(hist)
    
    if req.role in ["COORDINATOR", "TECHNICIAN", "MANAGER"]:
        # Project Team Member mapping
        member = db.query(ProjectTeamMember).filter(
            ProjectTeamMember.project_id == project_id,
            ProjectTeamMember.user_id == req.assignee_id,
            ProjectTeamMember.role == req.role
        ).first()
        if not member:
            member = ProjectTeamMember(
                id=str(uuid.uuid4()),
                project_id=project_id,
                user_id=req.assignee_id,
                role=req.role,
                status="ACTIVE"
            )
            db.add(member)
        else:
            member.status = "ACTIVE"
            
        # Add assignment log
        assignment = ProjectAssignment(
            id=str(uuid.uuid4()),
            project_id=project_id,
            assignee_id=req.assignee_id,
            assigned_by_id=admin.id,
            role=req.role,
            target_item_id=req.target_item_id
        )
        db.add(assignment)
        
    elif req.role == "VENDOR":
        # Check if vendor exists
        vendor = db.query(Vendor).filter(Vendor.user_id == req.assignee_id).first()
        if not vendor:
            raise HTTPException(404, "Vendor account not found for assigned user ID")
            
    db.commit()
    log_admin_action(db, admin.id, f"ASSIGN_{req.role}", "Project", project_id)
    return {"message": "Resource assigned successfully"}


# ── MASTER DATA MANAGEMENT ──

@router.get("/master/products", summary="List all products catalog")
def list_master_products(
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN", "SALES_ADMIN"]))
):
    q = db.query(Product)
    if category:
        q = q.filter(Product.category == category)
    return q.all()

@router.post("/master/products", summary="Create product")
def create_master_product(
    req: MasterProductReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    prod = Product(
        id=str(uuid.uuid4()),
        sku=req.sku,
        name=req.name,
        category=req.category,
        subcategory=req.subcategory,
        price=req.price,
        description=req.description,
        thumbnail_url=req.thumbnail_url
    )
    db.add(prod)
    db.commit()
    log_admin_action(db, admin.id, "CREATE_PRODUCT", "Product", prod.id)
    return prod

@router.put("/master/products/{product_id}", summary="Edit product details")
def edit_master_product(
    product_id: str,
    req: MasterProductReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(404, "Product not found")
        
    prod.sku = req.sku
    prod.name = req.name
    prod.category = req.category
    prod.subcategory = req.subcategory
    prod.price = req.price
    prod.description = req.description
    prod.thumbnail_url = req.thumbnail_url
    db.commit()
    log_admin_action(db, admin.id, "EDIT_PRODUCT", "Product", product_id)
    return {"message": "Product edited"}

@router.delete("/master/products/{product_id}", summary="Delete product catalog entry")
def delete_master_product(
    product_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    prod = db.query(Product).filter(Product.id == product_id).first()
    if not prod:
        raise HTTPException(404, "Product not found")
    db.delete(prod)
    db.commit()
    log_admin_action(db, admin.id, "DELETE_PRODUCT", "Product", product_id)
    return {"message": "Product deleted successfully"}

@router.post("/master/import", summary="Bulk import product catalog from CSV")
async def bulk_import_catalog(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    content = await file.read()
    stream = io.StringIO(content.decode("utf-8"))
    reader = csv.DictReader(stream)
    
    count = 0
    for row in reader:
        # Avoid duplicate SKUs
        existing = db.query(Product).filter(Product.sku == row["sku"]).first()
        if existing:
            continue
            
        prod = Product(
            id=str(uuid.uuid4()),
            sku=row["sku"],
            name=row["name"],
            category=row["category"],
            subcategory=row["subcategory"],
            price=float(row.get("price", 0.0)),
            description=row.get("description", ""),
            thumbnail_url=row.get("thumbnail_url", "")
        )
        db.add(prod)
        count += 1
    db.commit()
    log_admin_action(db, admin.id, "BULK_IMPORT_CATALOG", "Product", f"count_{count}")
    return {"message": f"Successfully imported {count} products"}

@router.get("/master/export", summary="Bulk export product catalog to CSV")
def bulk_export_catalog(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN", "SALES_ADMIN"]))
):
    products = db.query(Product).all()
    
    stream = io.StringIO()
    writer = csv.writer(stream)
    writer.writerow(["id", "sku", "name", "category", "subcategory", "price", "description", "thumbnail_url"])
    for p in products:
        writer.writerow([p.id, p.sku, p.name, p.category, p.subcategory, p.price, p.description, p.thumbnail_url])
        
    response = StreamingResponse(io.BytesIO(stream.getvalue().encode("utf-8")), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=catalog_export.csv"
    return response


# ── PACKAGE CONFIGURATION ──

@router.get("/packages/configurations", summary="List package configurations")
def list_package_configs(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN", "SALES_ADMIN"]))
):
    configs = db.query(PackageConfiguration).all()
    return configs

@router.post("/packages/configurations", summary="Create package configuration")
def create_package_config(
    req: PackageConfigReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    config = PackageConfiguration(
        id=str(uuid.uuid4()),
        name=req.name,
        tier=req.tier,
        pricing=req.pricing,
        timeline_days=req.timeline_days,
        included_services=req.included_services
    )
    db.add(config)
    db.commit()
    log_admin_action(db, admin.id, "CREATE_PACKAGE_CONFIG", "PackageConfiguration", config.id)
    return config

@router.put("/packages/configurations/{config_id}", summary="Edit package configuration")
def edit_package_config(
    config_id: str,
    req: PackageConfigReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    config = db.query(PackageConfiguration).filter(PackageConfiguration.id == config_id).first()
    if not config:
        raise HTTPException(404, "Package config not found")
        
    config.name = req.name
    config.tier = req.tier
    config.pricing = req.pricing
    config.timeline_days = req.timeline_days
    config.included_services = req.included_services
    db.commit()
    log_admin_action(db, admin.id, "EDIT_PACKAGE_CONFIG", "PackageConfiguration", config_id)
    return {"message": "Package configuration updated"}

@router.delete("/packages/configurations/{config_id}", summary="Delete package configuration")
def delete_package_config(
    config_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    config = db.query(PackageConfiguration).filter(PackageConfiguration.id == config_id).first()
    if not config:
        raise HTTPException(404, "Package config not found")
    db.delete(config)
    db.commit()
    log_admin_action(db, admin.id, "DELETE_PACKAGE_CONFIG", "PackageConfiguration", config_id)
    return {"message": "Package configuration deleted"}


# ── PRICING RULE ENGINE ──

@router.get("/pricing/rules", summary="List pricing rules")
def list_pricing_rules(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN", "FINANCE_ADMIN"]))
):
    rules = db.query(PricingRule).all()
    return rules

@router.post("/pricing/rules", summary="Create pricing rule")
def create_pricing_rule(
    req: PricingRuleReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "FINANCE_ADMIN"]))
):
    eff = datetime.datetime.strptime(req.effective_date, "%Y-%m-%d")
    exp = datetime.datetime.strptime(req.expiry_date, "%Y-%m-%d")
    rule = PricingRule(
        id=str(uuid.uuid4()),
        rule_type=req.rule_type,
        name=req.name,
        value=req.value,
        effective_date=eff,
        expiry_date=exp
    )
    db.add(rule)
    db.commit()
    log_admin_action(db, admin.id, "CREATE_PRICING_RULE", "PricingRule", rule.id)
    return rule

@router.put("/pricing/rules/{rule_id}", summary="Edit pricing rule")
def edit_pricing_rule(
    rule_id: str,
    req: PricingRuleReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "FINANCE_ADMIN"]))
):
    rule = db.query(PricingRule).filter(PricingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Pricing rule not found")
        
    eff = datetime.datetime.strptime(req.effective_date, "%Y-%m-%d")
    exp = datetime.datetime.strptime(req.expiry_date, "%Y-%m-%d")
    
    # Save change history
    history_entry = {
        "timestamp": datetime.datetime.utcnow().isoformat(),
        "changed_by": admin.name,
        "old_value": rule.value,
        "new_value": req.value
    }
    hist = list(rule.history or [])
    hist.append(history_entry)
    
    rule.rule_type = req.rule_type
    rule.name = req.name
    rule.value = req.value
    rule.effective_date = eff
    rule.expiry_date = exp
    rule.history = hist
    db.commit()
    
    log_admin_action(db, admin.id, "EDIT_PRICING_RULE", "PricingRule", rule_id)
    return {"message": "Pricing rule updated"}

@router.delete("/pricing/rules/{rule_id}", summary="Delete pricing rule")
def delete_pricing_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "FINANCE_ADMIN"]))
):
    rule = db.query(PricingRule).filter(PricingRule.id == rule_id).first()
    if not rule:
        raise HTTPException(404, "Pricing rule not found")
    db.delete(rule)
    db.commit()
    log_admin_action(db, admin.id, "DELETE_PRICING_RULE", "PricingRule", rule_id)
    return {"message": "Pricing rule deleted"}


# ── ROLE MATRIX PERMISSIONS ──

@router.post("/roles-permissions/assign", summary="Assign admin role to user")
def assign_admin_role(
    req: AssignRoleReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN"]))
):
    existing = db.query(AdminRole).filter(AdminRole.user_id == req.user_id).first()
    if existing:
        existing.role_name = req.role_name
    else:
        role = AdminRole(
            id=str(uuid.uuid4()),
            user_id=req.user_id,
            role_name=req.role_name
        )
        db.add(role)
    db.commit()
    log_admin_action(db, admin.id, f"ASSIGN_ADMIN_ROLE_{req.role_name}", "User", req.user_id)
    return {"message": "Role assigned successfully"}

@router.post("/roles-permissions/revoke", summary="Revoke admin role from user")
def revoke_admin_role(
    user_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN"]))
):
    existing = db.query(AdminRole).filter(AdminRole.user_id == user_id).first()
    if not existing:
        raise HTTPException(404, "Admin role mapping not found")
    db.delete(existing)
    db.commit()
    log_admin_action(db, admin.id, "REVOKE_ADMIN_ROLE", "User", user_id)
    return {"message": "Role revoked successfully"}


# ── DOCUMENT VAULT ──

@router.get("/documents", summary="Search and list documents vault")
def list_vault_documents(
    search: Optional[str] = Query(None),
    doc_type: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN", "SALES_ADMIN", "FINANCE_ADMIN"]))
):
    q = db.query(ProjectDocument)
    if doc_type:
        q = q.filter(ProjectDocument.type == doc_type)
    if search:
        q = q.filter(ProjectDocument.title.ilike(f"%{search}%"))
    return q.all()

@router.post("/documents", summary="Upload a project document")
async def upload_vault_document(
    title: str = Query(...),
    doc_type: str = Query(...),
    project_id: str = Query(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    import os, shutil
    upload_dir = os.path.join("pdfs", "documents")
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "file.pdf")[1] or ".pdf"
    filename = f"doc_{uuid.uuid4().hex[:8]}{ext}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
        
    doc = ProjectDocument(
        id=str(uuid.uuid4()),
        project_id=project_id,
        title=title,
        type=doc_type,
        url=f"/static/pdfs/documents/{filename}",
        version=1
    )
    db.add(doc)
    db.commit()
    log_admin_action(db, admin.id, "UPLOAD_DOCUMENT", "ProjectDocument", doc.id)
    return doc

@router.delete("/documents/{document_id}", summary="Archive project document")
def delete_vault_document(
    document_id: str,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "OPERATIONS_ADMIN"]))
):
    doc = db.query(ProjectDocument).filter(ProjectDocument.id == document_id).first()
    if not doc:
        raise HTTPException(404, "Document not found")
    db.delete(doc)
    db.commit()
    log_admin_action(db, admin.id, "DELETE_DOCUMENT", "ProjectDocument", document_id)
    return {"message": "Document archived successfully"}


# ── SYSTEM CONFIGURATION SETTINGS ──

@router.get("/settings", summary="Retrieve all system settings templates")
def get_system_settings(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN"]))
):
    return db.query(SystemSetting).all()

@router.put("/settings", summary="Update system setting templates")
def update_system_setting(
    req: SystemSettingReq,
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN"]))
):
    setting = db.query(SystemSetting).filter(SystemSetting.key == req.key).first()
    if not setting:
        setting = SystemSetting(
            id=str(uuid.uuid4()),
            key=req.key,
            value=req.value,
            category=req.category
        )
        db.add(setting)
    else:
        setting.value = req.value
        setting.category = req.category
    db.commit()
    log_admin_action(db, admin.id, f"UPDATE_SYSTEM_SETTING_{req.key}", "SystemSetting", req.key)
    return {"message": f"Setting key {req.key} updated successfully"}


# ── AUDIT LOGS & REPORTS ──

@router.get("/audit-logs", summary="List system admin audit logs")
def list_system_audit_logs(
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN"]))
):
    logs = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).all()
    out = []
    for l in logs:
        out.append({
            "id": l.id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
            "user_name": l.user.name if l.user else "System"
        })
    return out

@router.get("/reports", summary="Generate platform operational CSV reports")
def generate_reports(
    category: str = Query(...),  # sales / revenue / projects / vendors / customers
    db: Session = Depends(get_db),
    admin: User = Depends(get_admin_user(["SUPER_ADMIN", "FINANCE_ADMIN", "SALES_ADMIN"]))
):
    stream = io.StringIO()
    writer = csv.writer(stream)
    
    if category == "sales":
        writer.writerow(["Quotation ID", "Project ID", "Subtotal", "GST", "Total", "Status", "Date"])
        quotes = db.query(Quotation).all()
        for q in quotes:
            writer.writerow([q.id, q.project_id, q.subtotal, q.gst, q.total, q.status, q.created_at])
            
    elif category == "revenue":
        writer.writerow(["Payment ID", "Project ID", "Amount", "Milestone", "Status", "Date", "Transaction ID"])
        payments = db.query(Payment).all()
        for p in payments:
            writer.writerow([p.id, p.project_id, p.amount, p.milestone_name, p.status, p.payment_date, p.transaction_id])
            
    elif category == "projects":
        writer.writerow(["Project ID", "Customer Name", "BHK Type", "Property Name", "City", "Budget", "Status", "Created At"])
        projs = db.query(Project).all()
        for p in projs:
            cust = db.query(User).filter(User.id == p.user_id).first()
            writer.writerow([p.id, cust.name if cust else "N/A", p.bhk_type, p.property_name, p.city, p.budget, p.status, p.created_at])
            
    elif category == "vendors":
        writer.writerow(["Vendor ID", "Business Name", "Owner Name", "Email", "Phone", "Status", "Active", "Rating"])
        vendors = db.query(Vendor).all()
        for v in vendors:
            writer.writerow([v.id, v.business_name, v.owner_name, v.email, v.phone, v.status, v.active, v.rating])
            
    else:
        writer.writerow(["Customer ID", "Name", "Email", "Phone", "City", "Status", "Joined"])
        users = db.query(User).filter(User.role == "customer").all()
        for u in users:
            writer.writerow([u.id, u.name, u.email, u.phone, u.city, u.status, u.created_at])
            
    response = StreamingResponse(io.BytesIO(stream.getvalue().encode("utf-8")), media_type="text/csv")
    response.headers["Content-Disposition"] = f"attachment; filename=report_{category}.csv"
    return response
