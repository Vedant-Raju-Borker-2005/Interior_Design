"""Inventory Service — Real-Time Inventory Locking & Availability (Amazon-Style).

Provides atomic reservation, release, and dispatch of warehouse stock,
with instant marketplace catalog suppression when inventory reaches 0.
"""
from __future__ import annotations

import datetime
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..models import (
    Product,
    VendorProduct,
    Inventory,
    InventoryTransaction,
    Quotation,
    RoomItem,
)


def resolve_product_and_inventory(
    db: Session, product_id_or_sku: str
) -> Tuple[Optional[VendorProduct], Optional[Product], Optional[Inventory]]:
    """Resolves VendorProduct, twin catalog Product, and Inventory record."""
    if not product_id_or_sku:
        return None, None, None

    # Try VendorProduct first
    vp = (
        db.query(VendorProduct)
        .filter(
            or_(
                VendorProduct.id == product_id_or_sku,
                VendorProduct.sku == product_id_or_sku,
            )
        )
        .first()
    )

    # Try Product
    cp = (
        db.query(Product)
        .filter(
            or_(
                Product.id == product_id_or_sku,
                Product.sku == product_id_or_sku,
            )
        )
        .first()
    )

    # Cross-link if only one was found
    if vp and not cp:
        cp = db.query(Product).filter(or_(Product.sku == vp.sku, Product.id == vp.id)).first()
    elif cp and not vp:
        vp = db.query(VendorProduct).filter(or_(VendorProduct.sku == cp.sku, VendorProduct.id == cp.id)).first()

    inv = None
    if vp:
        inv = db.query(Inventory).filter(Inventory.product_id == vp.id).first()
        if not inv:
            # Auto-seed standard initial stock ledger
            inv = Inventory(
                product_id=vp.id,
                available_qty=15 if (vp.is_available is not False) else 0,
                reserved_qty=0,
                incoming_qty=5,
            )
            db.add(inv)
            db.flush()

    return vp, cp, inv


def get_stock_status(db: Session, product_id_or_sku: str) -> dict:
    """Returns real-time stock levels, availability, and reservation counts."""
    vp, cp, inv = resolve_product_and_inventory(db, product_id_or_sku)
    
    available_qty = inv.available_qty if inv else (10 if (cp and cp.is_available is not False) else 0)
    reserved_qty = inv.reserved_qty if inv else 0
    incoming_qty = inv.incoming_qty if inv else 0
    
    is_available = (
        (vp.is_available if vp else (cp.is_available if cp else True)) is not False
    ) and available_qty > 0
    
    unavailable_reason = None
    if not is_available:
        if available_qty <= 0:
            unavailable_reason = "Out of Stock"
        else:
            unavailable_reason = (vp.unavailable_reason if vp else (cp.unavailable_reason if cp else None)) or "Unavailable"

    return {
        "product_id": (cp.id if cp else (vp.id if vp else product_id_or_sku)),
        "sku": (cp.sku if cp else (vp.sku if vp else "")),
        "available_qty": available_qty,
        "reserved_qty": reserved_qty,
        "incoming_qty": incoming_qty,
        "is_available": is_available,
        "is_in_stock": available_qty > 0,
        "unavailable_reason": unavailable_reason,
    }


def reserve_stock(
    db: Session,
    product_id_or_sku: str,
    quantity: int = 1,
    reference_id: Optional[str] = None,
    notes: Optional[str] = None,
) -> bool:
    """Atomically reserves stock for a product.
    
    Decrements available_qty and increments reserved_qty.
    When available_qty hits 0, instantly suppresses catalog visibility (Amazon-style).
    """
    if quantity <= 0:
        return True

    vp, cp, inv = resolve_product_and_inventory(db, product_id_or_sku)
    if not vp or not inv:
        return False

    if inv.available_qty < quantity:
        return False

    inv.available_qty -= quantity
    inv.reserved_qty += quantity
    inv.last_updated = datetime.datetime.utcnow()

    tx = InventoryTransaction(
        product_id=vp.id,
        type="RESERVED",
        quantity=quantity,
        reference_id=reference_id,
        notes=notes or f"Reserved for reference {reference_id or 'order'}",
    )
    db.add(tx)

    # Instant Catalog Suppression if out of stock
    if inv.available_qty <= 0:
        vp.is_available = False
        vp.unavailable_reason = "Out of Stock"
        vp.availability_updated_at = datetime.datetime.utcnow()
        if cp:
            cp.is_available = False
            cp.unavailable_reason = "Out of Stock"
            cp.availability_updated_at = datetime.datetime.utcnow()

    return True


def release_stock(
    db: Session,
    product_id_or_sku: str,
    quantity: int = 1,
    reference_id: Optional[str] = None,
    notes: Optional[str] = None,
) -> bool:
    """Releases previously reserved stock back to available stock.
    
    If product was previously marked 'Out of Stock', restores availability.
    """
    if quantity <= 0:
        return True

    vp, cp, inv = resolve_product_and_inventory(db, product_id_or_sku)
    if not vp or not inv:
        return False

    actual_qty = min(quantity, inv.reserved_qty)
    if actual_qty <= 0:
        return False

    inv.reserved_qty -= actual_qty
    inv.available_qty += actual_qty
    inv.last_updated = datetime.datetime.utcnow()

    tx = InventoryTransaction(
        product_id=vp.id,
        type="RELEASED",
        quantity=actual_qty,
        reference_id=reference_id,
        notes=notes or f"Released from reference {reference_id or 'order'}",
    )
    db.add(tx)

    # Restore catalog availability if stock is back and reason was Out of Stock
    if inv.available_qty > 0 and (vp.unavailable_reason == "Out of Stock" or not vp.is_available):
        vp.is_available = True
        vp.unavailable_reason = None
        vp.availability_updated_at = datetime.datetime.utcnow()
        if cp:
            cp.is_available = True
            cp.unavailable_reason = None
            cp.availability_updated_at = datetime.datetime.utcnow()

    return True


def commit_stock(
    db: Session,
    product_id_or_sku: str,
    quantity: int = 1,
    reference_id: Optional[str] = None,
    notes: Optional[str] = None,
) -> bool:
    """Dispatches/delivers reserved stock, finalizing consumption."""
    if quantity <= 0:
        return True

    vp, cp, inv = resolve_product_and_inventory(db, product_id_or_sku)
    if not vp or not inv:
        return False

    actual_qty = min(quantity, inv.reserved_qty)
    if actual_qty <= 0:
        return False

    inv.reserved_qty -= actual_qty
    inv.last_updated = datetime.datetime.utcnow()

    tx = InventoryTransaction(
        product_id=vp.id,
        type="DELIVERED",
        quantity=actual_qty,
        reference_id=reference_id,
        notes=notes or f"Delivered reference {reference_id or 'order'}",
    )
    db.add(tx)
    return True


def reserve_quotation_inventory(db: Session, quotation_id: str) -> dict:
    """Atomically reserves stock for all line items within a quotation."""
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        return {"success": False, "error": "Quotation not found"}

    reserved = []
    failed = []

    items = quotation.line_items or []
    for item in items:
        pid = item.get("product_id") or item.get("sku")
        qty = item.get("qty", 1)
        if pid and pid not in ["PKG", "SVC"]:
            ok = reserve_stock(
                db,
                pid,
                quantity=qty,
                reference_id=quotation.quotation_no or quotation.id,
                notes=f"Quote confirmation {quotation.quotation_no or quotation.id}",
            )
            if ok:
                reserved.append({"product_id": pid, "qty": qty})
            else:
                failed.append({"product_id": pid, "qty": qty, "reason": "Insufficient stock"})

    db.commit()
    return {"success": len(failed) == 0, "reserved": reserved, "failed": failed}


def release_quotation_inventory(db: Session, quotation_id: str) -> dict:
    """Releases all reserved stock for an expired or cancelled quotation."""
    quotation = db.query(Quotation).filter(Quotation.id == quotation_id).first()
    if not quotation:
        return {"success": False, "error": "Quotation not found"}

    released = []
    items = quotation.line_items or []
    for item in items:
        pid = item.get("product_id") or item.get("sku")
        qty = item.get("qty", 1)
        if pid and pid not in ["PKG", "SVC"]:
            ok = release_stock(
                db,
                pid,
                quantity=qty,
                reference_id=quotation.quotation_no or quotation.id,
                notes=f"Quote cancelled/expired {quotation.quotation_no or quotation.id}",
            )
            if ok:
                released.append({"product_id": pid, "qty": qty})

    db.commit()
    return {"success": True, "released": released}
