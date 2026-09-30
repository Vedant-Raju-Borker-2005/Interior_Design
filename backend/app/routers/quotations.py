import uuid
import datetime
import os
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Project, Room, RoomItem, Product, Quotation, User
from ..schemas import GenerateQuotationReq
from ..auth_utils import current_user
from ..services.pdf_service import generate_quotation_pdf
from ..services.business_rules import (
    billing_snapshot_for,
    compute_discount,
    effective_discount,
    next_quotation_no,
)

router = APIRouter()

GST_RATE = 0.18
# Read at call time, not import time: the output directory is set by the
# environment, and a caller (or a test) may set it after this module loads.
def _pdf_dir() -> str:
    return os.getenv("PDF_OUTPUT_DIR", "./pdfs")
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000")


@router.post("/{project_id}/generate", summary="Generate quotation PDF for a project")
def generate_quotation(
    project_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    # Collect all room items
    rooms = db.query(Room).filter(Room.project_id == project.id).all()
    line_items = []

    for room in rooms:
        items = db.query(RoomItem).filter(RoomItem.room_id == room.id).all()
        for item in items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if product:
                line_items.append({
                    "room": room.room_type.replace("_", " ").title(),
                    "product_id": product.id,
                    "sku": product.sku,
                    "name": product.name,
                    "category": product.category,
                    "qty": item.qty,
                    "unit_price": item.unit_price or product.price,
                    "total": (item.unit_price or product.price) * item.qty,
                    "custom_color": item.custom_color,
                    "custom_material": item.custom_material,
                    # Feedback 2.4 — the full customisation set reaches the quote
                    "custom_size": item.custom_size,
                    "custom_fabric": item.custom_fabric,
                    "custom_wood_finish": item.custom_wood_finish,
                    "custom_texture": item.custom_texture,
                    "custom_cushion_style": item.custom_cushion_style,
                })

    # If no items, add package base price as single line
    if not line_items and project.package_id:
        from ..models import Package
        pkg = db.query(Package).filter(Package.id == project.package_id).first()
        if pkg:
            line_items.append({
                "room": "All Rooms",
                "sku": "PKG",
                "name": pkg.name,
                "category": "Package",
                "qty": 1,
                "unit_price": pkg.base_price,
                "total": pkg.base_price,
            })
    elif not line_items:
        # Fallback
        line_items.append({
            "room": "All Rooms",
            "sku": "SVC",
            "name": "Interior Design Service",
            "category": "Service",
            "qty": 1,
            "unit_price": project.budget * 0.85,
            "total": project.budget * 0.85,
        })

    gross = sum(li["total"] for li in line_items)

    # Feedback 2.1/2.2 — a project-level bulk discount reduces the order total
    # without altering any product price.
    units = max(1, project.total_units or 1)
    discount_type, discount_value = effective_discount(project, db)   # 2.1 — inherited by units
    breakdown = compute_discount(gross, discount_type, discount_value, units)
    subtotal = breakdown["discounted_total"]
    gst = round(subtotal * GST_RATE, 2)
    total = round(subtotal + gst, 2)
    valid_until = (datetime.datetime.utcnow() + datetime.timedelta(days=30)).strftime("%Y-%m-%d")

    # Feedback 1.3 — freeze the billing identity as invoiced.
    billing = billing_snapshot_for(user)
    # Feedback 1.4 — a unique, quotable reference.
    quotation_no = next_quotation_no(db)

    # Generate PDF
    quot_id = str(uuid.uuid4())
    pdf_path = generate_quotation_pdf(
        quotation_id=quot_id,
        project=project,
        user=user,
        line_items=line_items,
        subtotal=subtotal,
        gst=gst,
        total=total,
        valid_until=valid_until,
        quotation_no=quotation_no,
        billing=billing,
        discount=breakdown,
    )

    pdf_url = f"{BACKEND_URL}/static/assets/{os.path.basename(pdf_path)}"

    # Save to DB
    quotation = Quotation(
        id=quot_id,
        project_id=project.id,
        quotation_no=quotation_no,
        subtotal=subtotal,
        gst=gst,
        total=total,
        pdf_url=pdf_url,
        valid_until=valid_until,
        status="generated",
        line_items=line_items,
        gst_number=billing.get("gst_number"),
        billing_snapshot=billing,
        original_total=breakdown["original_total"],
        discount_amount=breakdown["discount_amount"],
    )
    db.add(quotation)
    db.commit()

    # Feedback 3.x — Atomically reserve stock for quoted components
    from ..services.inventory_service import reserve_quotation_inventory
    reserve_quotation_inventory(db, quotation.id)

    # Sync assignments per RoomItem to vendor side automatically
    from ..db import sync_project_vendor_assignments
    sync_project_vendor_assignments(project.id, db)

    # Update project status
    project.status = "quoted"
    db.commit()

    return {
        "id": quot_id,
        "quotation_id": quot_id,
        "quotation_no": quotation_no,
        "subtotal": subtotal,
        "gst": gst,
        "gst_number": billing.get("gst_number"),
        "billing": billing,
        "original_total": breakdown["original_total"],
        "discount_amount": breakdown["discount_amount"],
        "discounted_unit_price": breakdown["discounted_unit_price"],
        "original_unit_price": breakdown["original_unit_price"],
        "savings_per_unit": breakdown["savings_per_unit"],
        "units": breakdown["units"],
        "total": total,
        "pdf_url": pdf_url,
        "valid_until": valid_until,
        "line_items": line_items,
        "status": "generated",
    }


@router.get("/{quotation_id_or_project_id}", summary="Get quotation details")
def get_quotation(quotation_id_or_project_id: str, db: Session = Depends(get_db)):
    q = db.query(Quotation).filter(
        (Quotation.id == quotation_id_or_project_id) |
        (Quotation.project_id == quotation_id_or_project_id)
    ).order_by(Quotation.created_at.desc()).first()
    
    if not q:
        raise HTTPException(404, "Quotation not found")
    return {
        "id": q.id,
        "project_id": q.project_id,
        "quotation_no": q.quotation_no,                 # 1.4
        "subtotal": q.subtotal,
        "gst": q.gst,
        "gst_number": q.gst_number,                     # 1.3
        "billing": q.billing_snapshot or {},            # 1.3
        "original_total": q.original_total,             # 2.2
        "discount_amount": q.discount_amount,           # 2.2
        "total": q.total,
        "pdf_url": q.pdf_url,
        "valid_until": q.valid_until,
        "status": q.status,
        "paid_at": q.paid_at.isoformat() if q.paid_at else None,
        "payment_mode": q.payment_mode,
        "payment_reference": q.payment_reference,
        "line_items": q.line_items or [],
        "created_at": q.created_at.isoformat() if q.created_at else None,
    }


@router.get("/{project_id_or_quotation_id}/download", summary="Download quotation PDF file")
def download_quotation(project_id_or_quotation_id: str, db: Session = Depends(get_db)):
    q = db.query(Quotation).filter(
        (Quotation.id == project_id_or_quotation_id) |
        (Quotation.project_id == project_id_or_quotation_id)
    ).order_by(Quotation.created_at.desc()).first()
    
    if not q:
        project = db.query(Project).filter(Project.id == project_id_or_quotation_id).first()
        if project:
            user = db.query(User).filter(User.id == project.user_id).first()
            if not user:
                user = db.query(User).filter(User.role.ilike("%admin%")).first()
            if user:
                gen_res = generate_quotation(project.id, user=user, db=db)
                q = db.query(Quotation).filter(Quotation.id == gen_res["id"]).first()
    
    if not q:
        raise HTTPException(404, "Quotation not found for this project")
        
    safe_ref = (q.quotation_no or q.id[:8]).replace("/", "-")
    pdf_filename = f"quotation_{safe_ref}.pdf"
    filepath = os.path.join(_pdf_dir(), pdf_filename)
    
    if not os.path.exists(filepath):
        alt_path = os.path.join("assets", pdf_filename)
        if os.path.exists(alt_path):
            filepath = alt_path
        else:
            project = db.query(Project).filter(Project.id == q.project_id).first()
            user = db.query(User).filter(User.id == project.user_id).first() if project else None
            if not user:
                user = db.query(User).first()
            if project and user:
                filepath = generate_quotation_pdf(
                    quotation_id=q.id,
                    project=project,
                    user=user,
                    line_items=q.line_items or [],
                    subtotal=q.subtotal or 0,
                    gst=q.gst or 0,
                    total=q.total or 0,
                    valid_until=q.valid_until or (datetime.datetime.utcnow() + datetime.timedelta(days=30)).strftime("%Y-%m-%d"),
                    quotation_no=q.quotation_no,
                    billing=q.billing_snapshot or {},
                    discount={"original_total": q.original_total, "discount_amount": q.discount_amount}
                )

    if not os.path.exists(filepath):
        raise HTTPException(500, "Quotation PDF file could not be created")
        
    filename = f"Quotation_{safe_ref}.pdf"
    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=filename
    )
