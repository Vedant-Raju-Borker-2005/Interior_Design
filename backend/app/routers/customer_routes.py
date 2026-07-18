import os
import uuid
import datetime
import random
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional

from ..db import get_db
from ..models import (
    User, Project, FloorPlan, Quotation, QuotationRevision, 
    ActivityLog, ItemTracking, ProjectPhoto, Issue, SupportTicket, 
    ServiceRequest, Notification, Inquiry, Payment, ProjectDocument
)
from ..auth_utils import current_user

router = APIRouter()

# ── FLOOR PLAN MANAGEMENT ─────────────────────────────────────────────────────

@router.get("/projects/{project_id}/floorplans")
def get_floorplans(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return db.query(FloorPlan).filter(FloorPlan.project_id == project_id).all()


@router.post("/projects/{project_id}/floorplans")
def upload_floorplan(
    project_id: str,
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    file_id = str(uuid.uuid4())
    ext = file.filename.split(".")[-1]
    filename = f"{file_id}.{ext}"
    os.makedirs("pdfs/floor_plans", exist_ok=True)
    filepath = f"pdfs/floor_plans/{filename}"
    
    with open(filepath, "wb") as f:
        f.write(file.file.read())

    file_url = f"/static/pdfs/floor_plans/{filename}"

    floorplan = FloorPlan(
        id=file_id,
        project_id=project_id,
        file_url=file_url,
        file_type=file.content_type,
        uploaded_by=user.id
    )
    db.add(floorplan)

    # Log activity
    log = ActivityLog(
        user_id=user.id,
        action="floorplan_uploaded",
        resource_type="floorplan",
        resource_id=file_id,
        metadata_json={"filename": file.filename, "project_id": project_id}
    )
    db.add(log)

    db.commit()
    db.refresh(floorplan)
    return floorplan


@router.delete("/projects/{project_id}/floorplans/{floorplan_id}")
def delete_floorplan(
    project_id: str,
    floorplan_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    fp = db.query(FloorPlan).filter(FloorPlan.id == floorplan_id, FloorPlan.project_id == project_id).first()
    if not fp:
        raise HTTPException(404, "Floor plan not found")
        
    db.delete(fp)
    db.commit()
    return {"message": "floor plan deleted"}


# ── ADVANCED QUOTATION MANAGEMENT ─────────────────────────────────────────────

@router.get("/projects/{project_id}/quotations/revisions")
def get_quotation_revisions(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    revisions = []
    for q in project.quotations:
        revs = db.query(QuotationRevision).filter(QuotationRevision.quotation_id == q.id).order_by(QuotationRevision.revision_number.desc()).all()
        revisions.extend(revs)
    return revisions


@router.post("/projects/{project_id}/quotations/revisions")
def request_quotation_revision(
    project_id: str,
    customer_notes: str = Form(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    quotation = db.query(Quotation).filter(Quotation.project_id == project_id).order_by(Quotation.created_at.desc()).first()
    if not quotation:
        raise HTTPException(404, "No quotation found to revise")
        
    rev_count = db.query(QuotationRevision).filter(QuotationRevision.quotation_id == quotation.id).count()
    
    revision = QuotationRevision(
        quotation_id=quotation.id,
        revision_number=rev_count + 1,
        subtotal=quotation.subtotal,
        gst=quotation.gst,
        total=quotation.total,
        line_items=quotation.line_items,
        status="pending",
        customer_notes=customer_notes
    )
    db.add(revision)
    
    quotation.status = "under_revision"
    
    notif = Notification(
        user_id=user.id,
        title="Quotation Revision Requested",
        message=f"Your request for revision has been logged with notes: {customer_notes}",
        type="info"
    )
    db.add(notif)

    log = ActivityLog(
        user_id=user.id,
        action="quote_revision_requested",
        resource_type="quotation_revision",
        resource_id=revision.id,
        metadata_json={"notes": customer_notes}
    )
    db.add(log)

    db.commit()
    db.refresh(revision)
    return revision


@router.put("/projects/{project_id}/quotations/{quotation_id}/status")
def update_quotation_status(
    project_id: str,
    quotation_id: str,
    status: str = Form(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id, Quotation.project_id == project_id).first()
    if not quotation:
        raise HTTPException(404, "Quotation not found")
        
    quotation.status = status
    if status == "approved":
        # Idempotency: skip if project already ordered (prevents double-assign)
        already_ordered = project.status == "ordered"
        project.status = "ordered"
        
        # Populate trackings (only once)
        if not already_ordered:
            _populate_default_tracking(project_id, project, db)

        # Trigger Vendor Assignments — only if not already ordered
        from ..models import Vendor, VendorAssignment, VendorNotification, Product
        if quotation.line_items and not already_ordered:
            for item in quotation.line_items:
                if item.get("sku") in ["PKG", "SVC"]: continue
                
                prod_id = item.get("product_id")
                assigned_vendor_id = None
                
                # 1. Attempt to match the actual vendor who registered this product
                if prod_id:
                    product_obj = db.query(Product).filter(Product.id == prod_id).first()
                    if product_obj and product_obj.vendor_id:
                        assigned_vendor_id = product_obj.vendor_id
                
                # 2. Pincode/General vendor fallback if product is a generic catalog template
                if not assigned_vendor_id:
                    vendors = db.query(Vendor).filter(Vendor.active == True).all()
                    matching_vendors = [v for v in vendors if project.pincode in (v.serviceable_pincodes or [])]
                    if not matching_vendors and vendors:
                        matching_vendors = vendors
                    if matching_vendors:
                        assigned_vendor_id = matching_vendors[0].id
                
                if assigned_vendor_id:
                    # Auto-assign directly to RECEIVED_ORDER — vendor does not need to accept/decline
                    assignment = VendorAssignment(
                        project_id=project.id,
                        item_id=prod_id or item.get("sku"),
                        vendor_id=assigned_vendor_id,
                        status="RECEIVED_ORDER",
                        remarks=f"Auto-assigned upon customer quotation approval. Qty: {item.get('qty', 1)}. Vendor action required: update production status."
                    )
                    db.add(assignment)
                    
                    # Notify vendor
                    notif = VendorNotification(
                        vendor_id=assigned_vendor_id,
                        type="NEW_ASSIGNMENT",
                        message=f"New order received for Project '{project.property_name}': {item.get('name')}. Please update production status."
                    )
                    db.add(notif)


    notif = Notification(
        user_id=user.id,
        title=f"Quotation {status.capitalize()}",
        message=f"You have {status} the quotation for {project.property_name}.",
        type="success" if status == "approved" else "warning"
    )
    db.add(notif)

    log = ActivityLog(
        user_id=user.id,
        action=f"quote_{status}",
        resource_type="quotation",
        resource_id=quotation.id,
        metadata_json={"project_id": project_id}
    )
    db.add(log)

    db.commit()
    return {"message": f"Quotation status updated to {status}", "project_status": project.status}


# ── CUSTOMER ACTIVITY FEED ───────────────────────────────────────────────────

@router.get("/activity")
def get_activity_log(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    return db.query(ActivityLog).filter(ActivityLog.user_id == user.id).order_by(ActivityLog.created_at.desc()).all()


# ── PROJECT EXECUTION DETAILS ─────────────────────────────────────────────────

@router.get("/projects/{project_id}/tracking")
def get_tracking(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    trackings = db.query(ItemTracking).filter(ItemTracking.project_id == project_id).all()
    if not trackings:
        trackings = _populate_default_tracking(project_id, project, db)
        
    return trackings


@router.put("/projects/{project_id}/tracking/{tracking_id}")
def update_tracking_status(
    project_id: str,
    tracking_id: str,
    status: str = Form(...),
    remarks: Optional[str] = Form(None),
    actual_date: Optional[str] = Form(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    track = db.query(ItemTracking).filter(ItemTracking.id == tracking_id, ItemTracking.project_id == project_id).first()
    if not track:
        raise HTTPException(404, "Tracking item not found")
        
    track.status = status
    if remarks is not None:
        track.remarks = remarks
    if actual_date is not None:
        track.actual_date = actual_date
    elif status == "installed" and not track.actual_date:
        track.actual_date = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        
    log = ActivityLog(
        user_id=user.id,
        action="item_status_updated",
        resource_type="item_tracking",
        resource_id=track.id,
        metadata_json={"item_name": track.item_name, "status": status}
    )
    db.add(log)
    
    db.commit()
    db.refresh(track)
    return track


# ── PROJECT PHOTO GALLERY ─────────────────────────────────────────────────────

@router.get("/projects/{project_id}/photos")
def get_photos(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return db.query(ProjectPhoto).filter(ProjectPhoto.project_id == project_id).order_by(ProjectPhoto.uploaded_at.desc()).all()


@router.post("/projects/{project_id}/photos")
def upload_photo(
    project_id: str,
    room_name: str = Form(...),
    caption: Optional[str] = Form(None),
    image_url: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    url = image_url
    if file:
        file_id = str(uuid.uuid4())
        ext = file.filename.split(".")[-1]
        filename = f"{file_id}.{ext}"
        os.makedirs("pdfs/floor_plans", exist_ok=True)
        filepath = f"pdfs/floor_plans/{filename}"
        with open(filepath, "wb") as f:
            f.write(file.file.read())
        url = f"/static/pdfs/floor_plans/{filename}"

    if not url:
        url = "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace"

    photo = ProjectPhoto(
        project_id=project_id,
        room_name=room_name,
        uploaded_by=user.name or user.email or user.id,
        image_url=url,
        caption=caption or "Verification photo",
    )
    db.add(photo)
    
    log = ActivityLog(
        user_id=user.id,
        action="project_photo_uploaded",
        resource_type="project_photo",
        resource_id=photo.id,
        metadata_json={"room": room_name}
    )
    db.add(log)

    db.commit()
    db.refresh(photo)
    return photo


# ── ISSUE MANAGEMENT ──────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/issues")
def get_issues(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return db.query(Issue).filter(Issue.project_id == project_id).order_by(Issue.created_at.desc()).all()


@router.post("/projects/{project_id}/issues")
def create_issue(
    project_id: str,
    type: str = Form(...),
    priority: str = Form(...),
    description: str = Form(...),
    item_id: Optional[str] = Form(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    issue = Issue(
        project_id=project_id,
        type=type,
        priority=priority,
        description=description,
        item_id=item_id,
        status="open",
        created_by=user.name or user.email or user.id
    )
    db.add(issue)
    
    log = ActivityLog(
        user_id=user.id,
        action="issue_created",
        resource_type="issue",
        resource_id=issue.id,
        metadata_json={"type": type, "priority": priority}
    )
    db.add(log)
    
    db.commit()
    db.refresh(issue)
    return issue


# ── CUSTOMER SUPPORT PANEL ────────────────────────────────────────────────────

@router.get("/support/tickets")
def get_support_tickets(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    projects = db.query(Project).filter(Project.user_id == user.id).all()
    project_ids = [p.id for p in projects]
    if project_ids:
        return db.query(SupportTicket).filter(
            (SupportTicket.project_id.in_(project_ids)) | (SupportTicket.user_id == user.id)
        ).order_by(SupportTicket.created_at.desc()).all()
    else:
        return db.query(SupportTicket).filter(SupportTicket.user_id == user.id).order_by(SupportTicket.created_at.desc()).all()


@router.post("/support/tickets")
def create_support_ticket(
    subject: str = Form(...),
    description: str = Form(...),
    project_id: Optional[str] = Form(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    if project_id and project_id != "general":
        project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
        if not project:
            raise HTTPException(404, "Project not found")
    else:
        project_id = None
        
    ticket = SupportTicket(
        project_id=project_id,
        user_id=user.id,
        subject=subject,
        description=description,
        status="open"
    )
    db.add(ticket)
    
    log = ActivityLog(
        user_id=user.id,
        action="support_ticket_created",
        resource_type="support_ticket",
        resource_id=ticket.id,
        metadata_json={"subject": subject, "project_id": project_id}
    )
    db.add(log)
    
    db.commit()
    db.refresh(ticket)
    return ticket


# ── SPECIAL SERVICES MODULE ───────────────────────────────────────────────────

@router.get("/services")
def get_service_requests(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    return db.query(ServiceRequest).filter(ServiceRequest.user_id == user.id).order_by(ServiceRequest.created_at.desc()).all()


@router.post("/services")
def create_service_request(
    service_type: str = Form(...),
    requirements: str = Form(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    amount = 5000.0
    if "rendering" in service_type.lower() or "3d" in service_type.lower():
        amount = 5000.0
    elif "custom" in service_type.lower():
        amount = 12000.0
    elif "advanced" in service_type.lower():
        amount = 8000.0
    else:
        amount = 1500.0

    req = ServiceRequest(
        user_id=user.id,
        service_type=service_type,
        requirements=requirements,
        status="completed",
        quote_amount=amount
    )
    db.add(req)
    
    # Spawn a new shell project (status: ordered) matching the service type
    project_title = f"{service_type} Service Project"
    shell_project = Project(
        id=str(uuid.uuid4()),
        user_id=user.id,
        bhk_type="Special Service",
        property_name=project_title,
        city=user.city or "Bangalore",
        pincode="560001",
        total_area_sqft=1000,
        budget=amount,
        status="ordered",
        material_preference="standard",
        furnishing_type="semi"
    )
    db.add(shell_project)
    
    # Flush to get the shell project ID for relations
    db.flush()
    
    # Add a mock quotation for it so it displays values properly
    mock_quotation = Quotation(
        id=str(uuid.uuid4()),
        project_id=shell_project.id,
        subtotal=amount / 1.18,
        gst=amount - (amount / 1.18),
        total=amount,
        status="approved",
        line_items=[
            {"room": "General", "name": f"{service_type} Service Package", "category": "special", "qty": 1, "unit_price": amount / 1.18, "total": amount / 1.18}
        ]
    )
    db.add(mock_quotation)
    
    # Also spawn a tracking item for the service project so progress tracking starts
    track = ItemTracking(
        project_id=shell_project.id,
        room_name="General",
        item_name=f"{service_type} execution plan",
        status="ordered",
        expected_date=(datetime.datetime.utcnow() + datetime.timedelta(days=7)).strftime("%Y-%m-%d"),
        actual_date="",
        remarks="Service initialization"
    )
    db.add(track)
    
    # Record payment transaction
    tx_id = f"TXN{int(datetime.datetime.utcnow().timestamp())}{random.randint(1000, 9999)}"
    pay = Payment(
        id=str(uuid.uuid4()),
        project_id=shell_project.id,
        amount=amount,
        status="completed",
        milestone_name="100% Full Payment",
        transaction_id=tx_id
    )
    db.add(pay)

    log = ActivityLog(
        user_id=user.id,
        action="service_requested",
        resource_type="service_request",
        resource_id=req.id,
        metadata_json={"service_type": service_type, "amount": amount, "project_id": shell_project.id}
    )
    db.add(log)
    
    db.commit()
    db.refresh(req)
    return req


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _populate_default_tracking(project_id: str, project: Project, db: Session):
    trackings = []
    # Try using room items first
    for room in project.rooms:
        for item in room.items:
            track = ItemTracking(
                project_id=project_id,
                room_name=room.room_type,
                item_name=item.product.name if item.product else "Furniture Item",
                status="ordered",
                expected_date=(datetime.datetime.utcnow() + datetime.timedelta(days=14)).strftime("%Y-%m-%d"),
                actual_date="",
                remarks=""
            )
            db.add(track)
            trackings.append(track)
            
    if not trackings:
        # Fallback to standard BHK defaults
        default_items = [
            ("Hall", "Velvet Sofa"),
            ("Hall", "TV Unit"),
            ("Bedroom", "King Size Bed"),
            ("Bedroom", "Wardrobe"),
            ("Kitchen", "Modular Cabinets"),
            ("Kitchen", "Granite Counter")
        ]
        for room, item in default_items:
            track = ItemTracking(
                project_id=project_id,
                room_name=room,
                item_name=item,
                status="ordered",
                expected_date=(datetime.datetime.utcnow() + datetime.timedelta(days=14)).strftime("%Y-%m-%d"),
                actual_date="",
                remarks=""
            )
            db.add(track)
            trackings.append(track)
            
    db.commit()
    return db.query(ItemTracking).filter(ItemTracking.project_id == project_id).all()


@router.get("/stats")
def get_customer_stats(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    from ..db import sync_demo_data
    sync_demo_data(db)
    projects = db.query(Project).filter(Project.user_id == user.id).all()
    project_ids = [p.id for p in projects]
    
    active_projects = db.query(Project).filter(
        Project.user_id == user.id,
        Project.status.in_(["quoted", "ordered"])
    ).count()
    
    total_quotations = db.query(Quotation).filter(Quotation.project_id.in_(project_ids)).count() if project_ids else 0
    
    email_match = user.email if user.email else "___unknown___"
    phone_match = user.phone if user.phone else "___unknown___"
    total_inquiries = db.query(Inquiry).filter(
        (Inquiry.email == email_match) | 
        (Inquiry.phone == phone_match) | 
        (Inquiry.project_id.in_(project_ids))
    ).count() if project_ids else db.query(Inquiry).filter(
        (Inquiry.email == email_match) | 
        (Inquiry.phone == phone_match)
    ).count()

    total_payments = db.query(Payment).filter(Payment.project_id.in_(project_ids)).count() if project_ids else 0
    
    return {
        "totalInquiries": total_inquiries,
        "totalQuotations": total_quotations,
        "activeProjects": active_projects,
        "totalPayments": total_payments
    }


@router.get("/inquiries")
def get_customer_inquiries(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    projects = db.query(Project).filter(Project.user_id == user.id).all()
    project_ids = [p.id for p in projects]
    email_match = user.email if user.email else "___unknown___"
    phone_match = user.phone if user.phone else "___unknown___"
    
    q = db.query(Inquiry)
    if project_ids:
        q = q.filter(
            (Inquiry.email == email_match) | 
            (Inquiry.phone == phone_match) | 
            (Inquiry.project_id.in_(project_ids))
        )
    else:
        q = q.filter(
            (Inquiry.email == email_match) | 
            (Inquiry.phone == phone_match)
        )
        
    inquiries = q.order_by(Inquiry.created_at.desc()).all()
    return [
        {
            "id": i.id,
            "name": i.name,
            "phone": i.phone,
            "email": i.email,
            "city": i.city,
            "bhk_type": i.bhk_type,
            "message": i.message,
            "project_id": i.project_id,
            "status": i.status,
            "source": i.source,
            "created_at": i.created_at.isoformat() if i.created_at else None
        }
        for i in inquiries
    ]


@router.put("/inquiries/{inquiry_id}/close")
def close_customer_inquiry(
    inquiry_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    inquiry = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inquiry:
        raise HTTPException(404, "Inquiry not found")
        
    has_auth = False
    if inquiry.email == user.email or inquiry.phone == user.phone:
        has_auth = True
    elif inquiry.project_id:
        proj = db.query(Project).filter(Project.id == inquiry.project_id, Project.user_id == user.id).first()
        if proj:
            has_auth = True
            
    if not has_auth:
        raise HTTPException(403, "Access denied")
        
    inquiry.status = "closed"
    db.commit()
    return {"message": "Inquiry closed successfully"}


@router.get("/projects/{project_id}/payments")
def get_project_payments(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    quotation = db.query(Quotation).filter(Quotation.project_id == project_id).order_by(Quotation.created_at.desc()).first()
    contract_value = quotation.total if quotation else 0.0
    
    payments = db.query(Payment).filter(Payment.project_id == project_id).all()
    total_paid = sum(p.amount for p in payments if p.status == "completed")
    pending_amount = max(0.0, contract_value - total_paid)
    
    docs = db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_id,
        ProjectDocument.type.in_(["INVOICE", "RECEIPT"])
    ).all()
    
    milestones = [
        {"name": "Booking Advance (10%)", "pct": 10, "amount": contract_value * 0.1},
        {"name": "Sourcing & Production (40%)", "pct": 40, "amount": contract_value * 0.4},
        {"name": "Delivery & Installation (40%)", "pct": 40, "amount": contract_value * 0.4},
        {"name": "Final Handover (10%)", "pct": 10, "amount": contract_value * 0.1},
    ]
    
    milestone_statuses = []
    for m in milestones:
        pay = next((p for p in payments if p.milestone_name == m["name"] and p.status == "completed"), None)
        doc_invoice = next((d for d in docs if d.title == f"Invoice - {m['name']}"), None)
        doc_receipt = next((d for d in docs if d.title == f"Receipt - {m['name']}"), None)
        
        milestone_statuses.append({
            "name": m["name"],
            "amount": m["amount"],
            "pct": m["pct"],
            "status": "paid" if pay else "pending",
            "date": pay.payment_date.isoformat() if pay else None,
            "transactionId": pay.transaction_id if pay else None,
            "invoiceUrl": doc_invoice.url if doc_invoice else None,
            "receiptUrl": doc_receipt.url if doc_receipt else None
        })
        
    return {
        "contractValue": contract_value,
        "totalPaid": total_paid,
        "pendingAmount": pending_amount,
        "milestones": milestone_statuses
    }


@router.post("/projects/{project_id}/payments")
def create_project_payment(
    project_id: str,
    payload: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    milestone_name = payload.get("milestoneName")
    amount = payload.get("amount")
    if not milestone_name or amount is None:
        raise HTTPException(400, "milestoneName and amount are required")
        
    tx_id = f"TXN{int(datetime.datetime.utcnow().timestamp())}{random.randint(1000, 9999)}"
    payment = Payment(
        id=str(uuid.uuid4()),
        project_id=project_id,
        amount=float(amount),
        status="completed",
        milestone_name=milestone_name,
        transaction_id=tx_id
    )
    db.add(payment)
    
    os.makedirs("pdfs/documents", exist_ok=True)
    
    invoice_filename = f"invoice_{project_id}_{int(datetime.datetime.utcnow().timestamp())}.pdf"
    receipt_filename = f"receipt_{project_id}_{int(datetime.datetime.utcnow().timestamp())}.pdf"
    
    with open(f"pdfs/documents/{invoice_filename}", "w") as f:
        f.write(f"INVOICE\nProject: {project.property_name}\nMilestone: {milestone_name}\nAmount: INR {amount}\nTxn: {tx_id}")
    with open(f"pdfs/documents/{receipt_filename}", "w") as f:
        f.write(f"RECEIPT\nProject: {project.property_name}\nMilestone: {milestone_name}\nAmount: INR {amount}\nTxn: {tx_id}\nStatus: PAID")
        
    doc_invoice = ProjectDocument(
        id=str(uuid.uuid4()),
        project_id=project_id,
        title=f"Invoice - {milestone_name}",
        type="INVOICE",
        url=f"/static/pdfs/documents/{invoice_filename}"
    )
    doc_receipt = ProjectDocument(
        id=str(uuid.uuid4()),
        project_id=project_id,
        title=f"Receipt - {milestone_name}",
        type="RECEIPT",
        url=f"/static/pdfs/documents/{receipt_filename}"
    )
    db.add(doc_invoice)
    db.add(doc_receipt)
    
    log = ActivityLog(
        user_id=user.id,
        action="payment_made",
        resource_type="payment",
        resource_id=payment.id,
        metadata_json={"milestone": milestone_name, "amount": amount}
    )
    db.add(log)
    
    notif = Notification(
        user_id=user.id,
        title="Payment Successful",
        message=f"Received payment of ₹{amount:,.2f} for {milestone_name}.",
        type="success"
    )
    db.add(notif)
    
    db.commit()
    return {"status": "success", "transactionId": tx_id}


@router.get("/notifications")
def get_customer_notifications(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    notifs = db.query(Notification).filter(Notification.user_id == user.id).order_by(Notification.created_at.desc()).all()
    return notifs


@router.patch("/notifications/{notification_id}")
def mark_customer_notification_read(
    notification_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    notif = db.query(Notification).filter(Notification.id == notification_id, Notification.user_id == user.id).first()
    if not notif:
        raise HTTPException(404, "Notification not found")
    notif.read = True
    db.commit()
    return {"success": True}


@router.post("/notifications/mark-all-read")
def mark_all_customer_notifications_read(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    notifs = db.query(Notification).filter(Notification.user_id == user.id, Notification.read == False).all()
    for n in notifs:
        n.read = True
    db.commit()
    return {"success": True}


# ── DELETE PROJECT (only draft/quoted) ───────────────────────────────────────

@router.delete("/projects/{project_id}", summary="Delete a project (only draft or quoted)")
def delete_project(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    
    if project.status not in ["draft", "quoted"]:
        raise HTTPException(
            400,
            f"Cannot delete a project in '{project.status}' status. Only draft or quoted projects can be deleted."
        )
    
    # Explicitly cascade delete related vendor assignments, payouts, status histories, and proofs
    from ..models import VendorAssignment, VendorPayout, ItemStatusHistory, ItemProofImage
    
    assignment_ids = [r[0] for r in db.query(VendorAssignment.id).filter(VendorAssignment.project_id == project_id).all()]
    if assignment_ids:
        db.query(ItemStatusHistory).filter(ItemStatusHistory.assignment_id.in_(assignment_ids)).delete(synchronize_session=False)
        db.query(ItemProofImage).filter(ItemProofImage.assignment_id.in_(assignment_ids)).delete(synchronize_session=False)
        
    db.query(VendorAssignment).filter(VendorAssignment.project_id == project_id).delete(synchronize_session=False)
    db.query(VendorPayout).filter(VendorPayout.project_id == project_id).delete(synchronize_session=False)

    db.delete(project)
    db.commit()
    return {"success": True, "message": f"Project '{project.property_name}' deleted successfully."}


# ── VENDOR PROOF PHOTOS FOR CUSTOMER ─────────────────────────────────────────

@router.get("/projects/{project_id}/proof-photos", summary="Get vendor proof photos for a project (customer view)")
def get_proof_photos(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    from ..models import VendorAssignment, ItemProofImage, Product
    assignments = db.query(VendorAssignment).filter(VendorAssignment.project_id == project_id).all()
    
    result = []
    for assignment in assignments:
        proofs = db.query(ItemProofImage).filter(ItemProofImage.assignment_id == assignment.id).all()
        if proofs:
            # Get product name
            product_name = assignment.item_id
            prod = db.query(Product).filter(Product.id == assignment.item_id).first()
            if prod:
                product_name = prod.name

            result.append({
                "assignment_id": assignment.id,
                "product_name": product_name,
                "status": assignment.status,
                "proofs": [
                    {
                        "id": p.id,
                        "image_url": p.image_url,
                        "image_type": p.image_type,
                        "caption": p.caption,
                        "created_at": p.uploaded_at.isoformat() if p.uploaded_at else None,
                    }
                    for p in proofs
                ]
            })
    
    return {"proof_photos": result}
