"""Inquiry Router — lead capture and management."""
import uuid
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from ..db import get_db
from ..models import Inquiry
from ..schemas import InquiryReq, InquiryOut

router = APIRouter()


@router.post("", summary="Submit an inquiry / lead")
def submit_inquiry(req: InquiryReq, db: Session = Depends(get_db)):
    inquiry = Inquiry(
        id=str(uuid.uuid4()),
        name=req.name,
        phone=req.phone,
        email=req.email,
        city=req.city,
        bhk_type=req.bhk_type,
        message=req.message,
        project_id=req.project_id,
        quotation_id=req.quotation_id,
        source=req.source,
        status="new",
    )
    db.add(inquiry)
    db.commit()

    # In production: send SMS/email via Twilio / SendGrid
    contact = req.phone or req.email or "unknown"
    print(f"\n{'='*40}")
    print(f"[INQUIRY] New inquiry from {req.name} ({contact})")
    print(f"          BHK: {req.bhk_type} | City: {req.city}")
    print(f"          Message: {req.message}")
    print(f"{'='*40}\n")

    return {
        "inquiry_id": inquiry.id,
        "status": "received",
        "message": f"Thank you {req.name}! Our team will contact you within 2 hours.",
    }


@router.get("", summary="List all inquiries (admin)")
def list_inquiries(
    status: Optional[str] = Query(None),
    limit: int = 50,
    db: Session = Depends(get_db),
):
    q = db.query(Inquiry).order_by(Inquiry.created_at.desc())
    if status:
        q = q.filter(Inquiry.status == status)
    inquiries = q.limit(limit).all()
    return {
        "inquiries": [_inq_out(i) for i in inquiries],
        "total": len(inquiries),
    }


@router.put("/{inquiry_id}", summary="Update inquiry status (admin)")
def update_inquiry(inquiry_id: str, payload: dict, db: Session = Depends(get_db)):
    inq = db.query(Inquiry).filter(Inquiry.id == inquiry_id).first()
    if not inq:
        from fastapi import HTTPException
        raise HTTPException(404, "Inquiry not found")
    for field in ["status"]:
        if field in payload:
            setattr(inq, field, payload[field])
    db.commit()
    return {"message": "updated"}


def _inq_out(i: Inquiry) -> dict:
    return {
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
        "created_at": i.created_at.isoformat() if i.created_at else None,
    }
