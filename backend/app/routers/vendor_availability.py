"""Supplier availability switch — feedback 4.1.

A supplier marks an item Not Available and it stops appearing in the customer
marketplace immediately. Both catalogue tables carry the flag: `products` is
what customers browse, `vendor_products` is the supplier's own listing.
"""
from __future__ import annotations

import datetime
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..auth_utils import current_user
from ..db import get_db
from ..models import Product, User, Vendor, VendorProduct

router = APIRouter()


def _roles(user: User) -> list[str]:
    return [r.strip() for r in (user.role or "").split(",") if r.strip()]


def _vendor_for(user: User, db: Session) -> Optional[Vendor]:
    return db.query(Vendor).filter(Vendor.user_id == user.id).first()


class AvailabilityReq(BaseModel):
    is_available: bool
    reason: Optional[str] = None


def _apply(obj, req: AvailabilityReq):
    obj.is_available = req.is_available
    obj.unavailable_reason = None if req.is_available else (req.reason or "Marked unavailable by supplier")
    obj.availability_updated_at = datetime.datetime.utcnow()


@router.patch("/products/{product_id}/availability", summary="4.1 — mark a catalogue product available/unavailable")
def set_catalog_availability(
    product_id: str,
    req: AvailabilityReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")

    roles = _roles(user)
    if "admin" not in roles:
        vendor = _vendor_for(user, db)
        if not vendor:
            raise HTTPException(403, "No vendor profile on this account")
        if product.vendor_id != vendor.id:
            raise HTTPException(403, "This product belongs to another supplier")

    _apply(product, req)
    db.commit()
    db.refresh(product)
    return {
        "id": product.id,
        "name": product.name,
        "is_available": product.is_available,
        "unavailable_reason": product.unavailable_reason,
        "updated_at": product.availability_updated_at.isoformat() if product.availability_updated_at else None,
        "message": (
            "Product is live in the marketplace"
            if product.is_available
            else "Product hidden from the customer marketplace"
        ),
    }


@router.patch("/my-products/{product_id}/availability", summary="4.1 — same switch on the supplier's own listing")
def set_vendor_product_availability(
    product_id: str,
    req: AvailabilityReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    item = db.query(VendorProduct).filter(VendorProduct.id == product_id).first()
    if not item:
        raise HTTPException(404, "Product not found")

    roles = _roles(user)
    if "admin" not in roles:
        vendor = _vendor_for(user, db)
        if not vendor or item.vendor_id != vendor.id:
            raise HTTPException(403, "This product belongs to another supplier")

    _apply(item, req)

    # Keep the customer-facing row in step when the SKUs line up.
    twin = db.query(Product).filter(Product.sku == item.sku).first()
    if twin:
        _apply(twin, req)

    db.commit()
    db.refresh(item)
    return {
        "id": item.id,
        "name": item.name,
        "sku": item.sku,
        "is_available": item.is_available,
        "unavailable_reason": item.unavailable_reason,
        "marketplace_synced": bool(twin),
    }


@router.get("/availability", summary="4.1 — availability overview for the supplier")
def availability_overview(
    only: Optional[str] = Query(None, description="available | unavailable"),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    roles = _roles(user)
    query = db.query(Product)
    if "admin" not in roles:
        vendor = _vendor_for(user, db)
        if not vendor:
            raise HTTPException(403, "No vendor profile on this account")
        query = query.filter(Product.vendor_id == vendor.id)

    rows = query.all()

    def live(p: Product) -> bool:
        return True if p.is_available is None else bool(p.is_available)

    if only == "available":
        rows = [p for p in rows if live(p)]
    elif only == "unavailable":
        rows = [p for p in rows if not live(p)]

    return {
        "counts": {
            "total": query.count(),
            "available": len([p for p in query.all() if live(p)]),
            "unavailable": len([p for p in query.all() if not live(p)]),
        },
        "products": [
            {
                "id": p.id,
                "sku": p.sku,
                "name": p.name,
                "category": p.category,
                "price": p.price,
                "thumbnail_url": p.thumbnail_url,
                "is_available": live(p),
                "unavailable_reason": p.unavailable_reason,
            }
            for p in rows
        ],
    }
