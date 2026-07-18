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

router = APIRouter()

GST_RATE = 0.18
PDF_DIR = os.getenv("PDF_OUTPUT_DIR", "./pdfs")


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

    subtotal = sum(li["total"] for li in line_items)
    gst = round(subtotal * GST_RATE, 2)
    total = round(subtotal + gst, 2)
    valid_until = (datetime.datetime.utcnow() + datetime.timedelta(days=30)).strftime("%Y-%m-%d")

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
    )

    pdf_url = f"http://localhost:8000/static/pdfs/{os.path.basename(pdf_path)}"

    # Save to DB
    quotation = Quotation(
        id=quot_id,
        project_id=project.id,
        subtotal=subtotal,
        gst=gst,
        total=total,
        pdf_url=pdf_url,
        valid_until=valid_until,
        status="generated",
        line_items=line_items,
    )
    db.add(quotation)
    db.commit()

    # Sync assignments per RoomItem to vendor side automatically
    from ..db import sync_project_vendor_assignments
    sync_project_vendor_assignments(project.id, db)

    # Update project status
    project.status = "quoted"
    db.commit()

    return {
        "id": quot_id,
        "quotation_id": quot_id,
        "subtotal": subtotal,
        "gst": gst,
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
        "subtotal": q.subtotal,
        "gst": q.gst,
        "total": q.total,
        "pdf_url": q.pdf_url,
        "valid_until": q.valid_until,
        "status": q.status,
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
        raise HTTPException(404, "Quotation not found")
        
    pdf_filename = f"quotation_{q.id[:8]}.pdf"
    filepath = os.path.join(PDF_DIR, pdf_filename)
    if not os.path.exists(filepath):
        raise HTTPException(404, f"Quotation PDF file not found on disk: {pdf_filename}")
        
    return FileResponse(
        filepath,
        media_type="application/pdf",
        filename=f"Quotation_{q.id[:8]}.pdf"
    )
