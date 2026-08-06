"""Full Vendor Router — listing, filtering, allocation."""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from ..db import get_db
from ..models import Vendor, Project, User
from ..schemas import VendorOut
from ..auth_utils import current_user

router = APIRouter()


@router.get("", summary="List vendors with optional filtering")
def list_vendors(
    category: Optional[str] = Query(None),
    pincode: Optional[str] = Query(None),
    active: bool = True,
    db: Session = Depends(get_db),
):
    vendors = db.query(Vendor).filter(Vendor.active == active).all()

    if category:
        vendors = [v for v in vendors if category.lower() in [c.lower() for c in (v.categories or [])]]

    if pincode:
        vendors = [v for v in vendors if pincode in (v.serviceable_pincodes or [])]

    # Sort by rating descending
    vendors.sort(key=lambda v: v.rating, reverse=True)

    return {
        "vendors": [_vendor_out(v) for v in vendors],
        "total": len(vendors),
    }


@router.get("/{vendor_id}", summary="Get vendor details")
def get_vendor(vendor_id: str, db: Session = Depends(get_db)):
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        from fastapi import HTTPException
        raise HTTPException(404, "Vendor not found")
    return _vendor_out(vendor)


@router.post("/{project_id}/allocate/{vendor_id}", summary="Allocate vendor to a project")
def allocate_vendor(
    project_id: str,
    vendor_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        from fastapi import HTTPException
        raise HTTPException(404, "Project not found")
    vendor = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not vendor:
        from fastapi import HTTPException
        raise HTTPException(404, "Vendor not found")
    project.status = "ordered"
    db.commit()
    return {"message": f"Vendor '{vendor.name}' allocated to project", "project_id": project_id}


def _vendor_out(v: Vendor) -> dict:
    return {
        "id": v.id,
        "name": v.name,
        "phone": v.phone,
        "gst_no": v.gst_no,
        "categories": v.categories or [],
        "rating": v.rating,
        "active": v.active,
        "serviceable_pincodes": v.serviceable_pincodes or [],
    }
