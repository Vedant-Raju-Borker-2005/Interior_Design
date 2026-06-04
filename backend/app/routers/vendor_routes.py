import os
import shutil
import datetime
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, EmailStr

from ..db import get_db
from ..models import (
    User, Vendor, VendorDocument, VendorProduct, ProductVariant,
    Inventory, InventoryTransaction, VendorAssignment, ItemStatusHistory,
    ItemProofImage, VendorPayout, VendorNotification, VendorPerformance, Project, RoomItem
)
from ..auth_utils import current_user

router = APIRouter()


# Pydantic schemas for request validation
class VendorOnboardIn(BaseModel):
    businessName: str
    ownerName: str
    email: EmailStr
    phone: Optional[str] = None
    gstNumber: Optional[str] = None
    panNumber: Optional[str] = None
    warehouseAddress: Optional[str] = None
    serviceLocations: List[str] = []


class VariantIn(BaseModel):
    color: Optional[str] = None
    material: Optional[str] = None
    size: Optional[str] = None
    priceAdjustment: float = 0.0


class ProductCreateIn(BaseModel):
    name: str
    category: str
    subcategory: str
    sku: str
    description: Optional[str] = None
    basePrice: float
    images: List[str] = []
    variants: List[VariantIn] = []


class ProductUpdateIn(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    basePrice: Optional[float] = None
    images: Optional[List[str]] = None
    availableQty: Optional[int] = None


class InventoryUpdateIn(BaseModel):
    productId: str
    quantity: int
    type: str  # ADDED, RESERVED, RELEASED, DELIVERED
    notes: Optional[str] = None


class AssignmentUpdateIn(BaseModel):
    status: str  # ACCEPTED, REJECTED
    remarks: Optional[str] = None


# --- ONBOARDING ENDPOINTS ---

@router.post("/onboarding", summary="Register vendor profile")
def register_vendor(
    payload: VendorOnboardIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    existing = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Vendor profile already exists")
    
    vendor = Vendor(
        user_id=user.id,
        business_name=payload.businessName,
        owner_name=payload.ownerName,
        email=payload.email,
        phone=payload.phone,
        gst_no=payload.gstNumber,
        pan_no=payload.panNumber,
        warehouse_address=payload.warehouseAddress,
        serviceable_pincodes=payload.serviceLocations,
        status="SUBMITTED",
        name=payload.ownerName
    )
    db.add(vendor)
    db.flush()

    # Create empty document profile
    doc = VendorDocument(
        vendor_id=vendor.id,
        approval_status="PENDING"
    )
    db.add(doc)

    # Initialize performance record
    perf = VendorPerformance(
        vendor_id=vendor.id,
        acceptance_rate=100.0,
        completion_rate=100.0,
        delay_percentage=0.0,
        customer_rating=5.0,
        avg_delivery_time=0
    )
    db.add(perf)

    # Welcome notification
    welcome_notif = VendorNotification(
        vendor_id=vendor.id,
        type="NEW_VENDOR",
        message="Welcome to the modular interior design vendor network! Please upload your documents for review."
    )
    db.add(welcome_notif)
    
    db.commit()
    db.refresh(vendor)
    return {
        "id": vendor.id,
        "businessName": vendor.business_name,
        "ownerName": vendor.owner_name,
        "email": vendor.email,
        "phone": vendor.phone,
        "status": vendor.status
    }


@router.get("/onboarding", summary="Get vendor onboarding status")
def get_onboarding_status(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
    
    doc = db.query(VendorDocument).filter(VendorDocument.vendor_id == vendor.id).first()
    
    return {
        "vendor": {
            "id": vendor.id,
            "businessName": vendor.business_name,
            "ownerName": vendor.owner_name,
            "email": vendor.email,
            "phone": vendor.phone,
            "gstNumber": vendor.gst_no,
            "panNumber": vendor.pan_no,
            "warehouseAddress": vendor.warehouse_address,
            "serviceLocations": vendor.serviceable_pincodes,
            "status": vendor.status,
            "rejectionReason": vendor.rejection_reason
        },
        "documents": {
            "gstCertificate": doc.gst_certificate if doc else None,
            "panCard": doc.pan_card if doc else None,
            "bankDetails": doc.bank_details if doc else None,
            "approvalStatus": doc.approval_status if doc else "PENDING"
        } if doc else None
    }


@router.put("/onboarding", summary="Upload vendor onboarding KYC documents")
def upload_vendor_documents(
    vendorId: str = Form(...),
    gstCertificate: Optional[UploadFile] = File(None),
    panCard: Optional[UploadFile] = File(None),
    bankDetails: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.id == vendorId).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")
    
    doc = db.query(VendorDocument).filter(VendorDocument.vendor_id == vendor.id).first()
    if not doc:
        doc = VendorDocument(vendor_id=vendor.id, approval_status="PENDING")
        db.add(doc)
    
    os.makedirs("pdfs/documents", exist_ok=True)
    uploaded_files = []

    def save_doc_file(file: UploadFile, label: str):
        file_ext = os.path.splitext(file.filename)[1]
        filename = f"{vendor.id}_{label}{file_ext}"
        filepath = os.path.join("pdfs", "documents", filename)
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        url = f"/static/pdfs/documents/{filename}"
        return url

    if gstCertificate:
        doc.gst_certificate = save_doc_file(gstCertificate, "gst_certificate")
        uploaded_files.append({"label": "gstCertificate", "url": doc.gst_certificate})
    if panCard:
        doc.pan_card = save_doc_file(panCard, "pan_card")
        uploaded_files.append({"label": "panCard", "url": doc.pan_card})
    if bankDetails:
        doc.bank_details = save_doc_file(bankDetails, "bank_details")
        uploaded_files.append({"label": "bankDetails", "url": doc.bank_details})

    # Auto review simulation: if all files are uploaded, auto-approve vendor in sandbox
    vendor.status = "UNDER_REVIEW"
    if doc.gst_certificate and doc.pan_card and doc.bank_details:
        doc.approval_status = "APPROVED"
        vendor.status = "APPROVED"
        vendor.active = True
        
        # Add approval notification
        approved_notif = VendorNotification(
            vendor_id=vendor.id,
            type="PROFILE_APPROVED",
            message="Your vendor profile has been APPROVED! You are now active in the directory."
        )
        db.add(approved_notif)

    db.commit()
    return {"success": True, "documents": uploaded_files, "status": vendor.status}


# --- DASHBOARD ENDPOINT ---

@router.get("/dashboard", summary="Get vendor dashboard data")
def get_vendor_dashboard(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found. Please complete onboarding first.")
    
    assignments = db.query(VendorAssignment).filter(VendorAssignment.vendor_id == vendor.id).all()
    payouts = db.query(VendorPayout).filter(VendorPayout.vendor_id == vendor.id).all()
    perf = db.query(VendorPerformance).filter(VendorPerformance.vendor_id == vendor.id).first()

    pending_items = [a for a in assignments if a.status == "ASSIGNED"]
    accepted_items = [a for a in assignments if a.status == "ACCEPTED"]

    now = datetime.datetime.utcnow()
    monthly_earnings = 0.0
    lifetime_earnings = 0.0
    for p in payouts:
        lifetime_earnings += p.amount
        if p.status == "PAID" and p.payout_date:
            if p.payout_date.month == now.month and p.payout_date.year == now.year:
                monthly_earnings += p.amount

    kpi = {
        "totalAssignments": len(assignments),
        "pendingItems": len(pending_items),
        "completedItems": len(accepted_items),
        "monthlyEarnings": monthly_earnings,
        "lifetimeEarnings": lifetime_earnings,
        "acceptanceRate": perf.acceptance_rate if perf else 100.0,
        "completionRate": perf.completion_rate if perf else 100.0,
        "customerRating": perf.customer_rating if perf else 5.0,
    }

    recent_assignments = db.query(VendorAssignment)\
        .filter(VendorAssignment.vendor_id == vendor.id)\
        .order_by(VendorAssignment.created_at.desc())\
        .limit(5).all()

    serialized_assignments = []
    for a in recent_assignments:
        project = db.query(Project).filter(Project.id == a.project_id).first()
        item = db.query(RoomItem).filter(RoomItem.id == a.item_id).first()
        product = item.product if (item and item.product) else None
        
        serialized_assignments.append({
            "id": a.id,
            "projectId": a.project_id,
            "projectName": project.property_name if project else "Unknown Project",
            "itemId": a.item_id,
            "itemName": product.name if product else "Custom Item",
            "quantity": item.qty if item else 1,
            "status": a.status,
            "createdAt": a.created_at,
            "remarks": a.remarks
        })

    notifications = db.query(VendorNotification)\
        .filter(VendorNotification.vendor_id == vendor.id)\
        .order_by(VendorNotification.created_at.desc())\
        .limit(5).all()

    return {
        "vendor": {
            "id": vendor.id,
            "businessName": vendor.business_name,
            "ownerName": vendor.owner_name,
            "status": vendor.status
        },
        "kpi": kpi,
        "recentAssignments": serialized_assignments,
        "notifications": [
            {
                "id": n.id,
                "type": n.type,
                "message": n.message,
                "isRead": n.is_read,
                "createdAt": n.created_at
            }
            for n in notifications
        ]
    }


# --- PRODUCT CATALOG & INVENTORY ENDPOINTS ---

@router.get("/products", summary="List vendor products")
def list_vendor_products(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    products = db.query(VendorProduct).filter(VendorProduct.vendor_id == vendor.id, VendorProduct.is_archived == False).all()
    
    res = []
    for p in products:
        variants = db.query(ProductVariant).filter(ProductVariant.product_id == p.id).all()
        inv = db.query(Inventory).filter(Inventory.product_id == p.id).first()
        res.append({
            "id": p.id,
            "name": p.name,
            "category": p.category,
            "subcategory": p.subcategory,
            "sku": p.sku,
            "description": p.description,
            "basePrice": p.base_price,
            "images": p.images or [],
            "variants": [
                {
                    "id": v.id,
                    "color": v.color,
                    "material": v.material,
                    "size": v.size,
                    "priceAdjustment": v.price_adjustment
                }
                for v in variants
            ],
            "inventory": {
                "availableQty": inv.available_qty if inv else 0,
                "reservedQty": inv.reserved_qty if inv else 0,
                "incomingQty": inv.incoming_qty if inv else 0
            } if inv else {"availableQty": 0, "reservedQty": 0, "incomingQty": 0}
        })
    return res


@router.post("/products", summary="Add new product to vendor catalog")
def create_vendor_product(
    payload: ProductCreateIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    existing_product = db.query(VendorProduct).filter(VendorProduct.sku == payload.sku).first()
    if existing_product:
        raise HTTPException(status_code=400, detail="Product SKU already exists")

    product = VendorProduct(
        vendor_id=vendor.id,
        name=payload.name,
        category=payload.category,
        subcategory=payload.subcategory,
        sku=payload.sku,
        description=payload.description,
        base_price=payload.basePrice,
        images=payload.images
    )
    db.add(product)
    db.flush()

    for var in payload.variants:
        v = ProductVariant(
            product_id=product.id,
            color=var.color,
            material=var.material,
            size=var.size,
            price_adjustment=var.priceAdjustment
        )
        db.add(v)

    inv = Inventory(
        product_id=product.id,
        available_qty=10,
        reserved_qty=0,
        incoming_qty=0
    )
    db.add(inv)

    db.commit()
    return {"success": True, "productId": product.id}


@router.put("/products/{product_id}", summary="Update vendor product details")
def update_vendor_product(
    product_id: str,
    payload: ProductUpdateIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    product = db.query(VendorProduct).filter(VendorProduct.id == product_id, VendorProduct.vendor_id == vendor.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or access denied")

    if payload.name is not None:
        product.name = payload.name
    if payload.category is not None:
        product.category = payload.category
    if payload.subcategory is not None:
        product.subcategory = payload.subcategory
    if payload.description is not None:
        product.description = payload.description
    if payload.basePrice is not None:
        product.base_price = payload.basePrice
    if payload.images is not None:
        product.images = payload.images

    if payload.availableQty is not None:
        inv = db.query(Inventory).filter(Inventory.product_id == product.id).first()
        if not inv:
            inv = Inventory(product_id=product.id, available_qty=0)
            db.add(inv)
        
        diff = payload.availableQty - inv.available_qty
        if diff != 0:
            inv.available_qty = payload.availableQty
            transaction = InventoryTransaction(
                product_id=product.id,
                type="ADDED" if diff > 0 else "RELEASED",
                quantity=abs(diff),
                notes="Manual stock adjustment via dashboard"
            )
            db.add(transaction)

    db.commit()
    return {"success": True}


# --- INVENTORY MANAGEMENT ENDPOINTS ---

@router.get("/inventory", summary="Get vendor inventory summary & logs")
def get_inventory_status(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    products = db.query(VendorProduct).filter(VendorProduct.vendor_id == vendor.id).all()
    product_ids = [p.id for p in products]

    inventory_records = db.query(Inventory).filter(Inventory.product_id.in_(product_ids)).all()
    
    transactions = db.query(InventoryTransaction)\
        .filter(InventoryTransaction.product_id.in_(product_ids))\
        .order_by(InventoryTransaction.created_at.desc())\
        .limit(20).all()

    inv_summary = []
    low_stock_alerts = []
    prod_map = {p.id: p for p in products}

    for inv in inventory_records:
        prod = prod_map.get(inv.product_id)
        if prod:
            inv_summary.append({
                "productId": inv.product_id,
                "productName": prod.name,
                "sku": prod.sku,
                "availableQty": inv.available_qty,
                "reservedQty": inv.reserved_qty,
                "incomingQty": inv.incoming_qty,
                "lastUpdated": inv.last_updated
            })
            if inv.available_qty < 5:
                low_stock_alerts.append({
                    "productId": inv.product_id,
                    "productName": prod.name,
                    "availableQty": inv.available_qty
                })

    tx_history = []
    for tx in transactions:
        prod = prod_map.get(tx.product_id)
        tx_history.append({
            "id": tx.id,
            "productId": tx.product_id,
            "productName": prod.name if prod else "Unknown",
            "type": tx.type,
            "quantity": tx.quantity,
            "notes": tx.notes,
            "createdAt": tx.created_at
        })

    return {
        "inventory": inv_summary,
        "lowStockAlerts": low_stock_alerts,
        "transactions": tx_history
    }


@router.post("/inventory", summary="Log inventory transactions manually")
def adjust_inventory(
    payload: InventoryUpdateIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    product = db.query(VendorProduct).filter(VendorProduct.id == payload.productId, VendorProduct.vendor_id == vendor.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or access denied")

    inv = db.query(Inventory).filter(Inventory.product_id == product.id).first()
    if not inv:
        inv = Inventory(product_id=product.id, available_qty=0)
        db.add(inv)

    qty = payload.quantity
    type_ = payload.type.upper()

    if type_ == "ADDED":
        inv.available_qty += qty
    elif type_ == "RESERVED":
        if inv.available_qty < qty:
            raise HTTPException(status_code=400, detail="Insufficient stock to reserve")
        inv.available_qty -= qty
        inv.reserved_qty += qty
    elif type_ == "RELEASED":
        if inv.reserved_qty < qty:
            raise HTTPException(status_code=400, detail="Insufficient reserved stock to release")
        inv.reserved_qty -= qty
        inv.available_qty += qty
    elif type_ == "DELIVERED":
        if inv.reserved_qty < qty:
            raise HTTPException(status_code=400, detail="Insufficient reserved stock to deliver")
        inv.reserved_qty -= qty
    else:
        raise HTTPException(status_code=400, detail="Invalid transaction type")

    tx = InventoryTransaction(
        product_id=product.id,
        type=type_,
        quantity=qty,
        notes=payload.notes or f"Stock {type_} adjustment",
    )
    db.add(tx)
    
    if inv.available_qty < 5:
        notif = VendorNotification(
            vendor_id=vendor.id,
            type="LOW_STOCK",
            message=f"Stock for '{product.name}' is low: {inv.available_qty} items left."
        )
        db.add(notif)

    db.commit()
    return {"success": True, "availableQty": inv.available_qty, "reservedQty": inv.reserved_qty}


# --- ASSIGNMENT WORKFLOW ENDPOINTS ---

@router.get("/assignments", summary="List assignments for the vendor")
def get_vendor_assignments(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    assignments = db.query(VendorAssignment).filter(VendorAssignment.vendor_id == vendor.id).all()
    
    res = []
    for a in assignments:
        project = db.query(Project).filter(Project.id == a.project_id).first()
        item = db.query(RoomItem).filter(RoomItem.id == a.item_id).first()
        room = item.room if (item and item.room) else None
        product = item.product if (item and item.product) else None

        history = db.query(ItemStatusHistory).filter(ItemStatusHistory.assignment_id == a.id).order_by(ItemStatusHistory.timestamp.asc()).all()
        proofs = db.query(ItemProofImage).filter(ItemProofImage.assignment_id == a.id).all()

        res.append({
            "id": a.id,
            "projectId": a.project_id,
            "projectName": project.property_name if project else "Unknown Project",
            "roomName": room.room_type if room else "General",
            "itemId": a.item_id,
            "itemName": product.name if product else "Custom Item",
            "sku": product.sku if product else "N/A",
            "quantity": item.qty if item else 1,
            "status": a.status,
            "remarks": a.remarks,
            "acceptedAt": a.accepted_at,
            "rejectedAt": a.rejected_at,
            "createdAt": a.created_at,
            "history": [
                {
                    "status": h.status,
                    "remarks": h.remarks,
                    "updatedBy": h.updated_by,
                    "timestamp": h.timestamp
                }
                for h in history
            ],
            "proofImages": [
                {
                    "id": p.id,
                    "imageUrl": p.image_url,
                    "imageType": p.image_type,
                    "caption": p.caption,
                    "uploadedAt": p.uploaded_at
                }
                for p in proofs
            ]
        })
    return res


@router.patch("/assignments/{assignment_id}", summary="Accept/Reject assigned project items")
def update_assignment_status(
    assignment_id: str,
    payload: AssignmentUpdateIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    assignment = db.query(VendorAssignment).filter(
        VendorAssignment.id == assignment_id, 
        VendorAssignment.vendor_id == vendor.id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found or access denied")

    status_upper = payload.status.upper()
    if status_upper not in ["ACCEPTED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Invalid status. Must be ACCEPTED or REJECTED")

    assignment.status = status_upper
    assignment.remarks = payload.remarks
    
    if status_upper == "ACCEPTED":
        assignment.accepted_at = datetime.datetime.utcnow()
        hist = ItemStatusHistory(
            assignment_id=assignment.id,
            status="ACCEPTED",
            updated_by=user.id,
            remarks=payload.remarks or "Accepted via dashboard"
        )
        db.add(hist)
    else:
        assignment.rejected_at = datetime.datetime.utcnow()
        hist = ItemStatusHistory(
            assignment_id=assignment.id,
            status="REJECTED",
            updated_by=user.id,
            remarks=payload.remarks or "Rejected via dashboard"
        )
        db.add(hist)

    db.flush()
    all_assignments = db.query(VendorAssignment).filter(VendorAssignment.vendor_id == vendor.id).all()
    total = len(all_assignments)
    accepted = len([a for a in all_assignments if a.status == "ACCEPTED"])
    
    perf = db.query(VendorPerformance).filter(VendorPerformance.vendor_id == vendor.id).first()
    if not perf:
        perf = VendorPerformance(vendor_id=vendor.id)
        db.add(perf)
    
    perf.acceptance_rate = (accepted / total) * 100.0 if total > 0 else 100.0
    
    db.commit()
    return {"success": True, "status": assignment.status}


@router.post("/assignments/{assignment_id}/milestones", summary="Add sourcing progress logs")
def add_assignment_milestone(
    assignment_id: str,
    status: str = Form(...),
    remarks: Optional[str] = Form(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    assignment = db.query(VendorAssignment).filter(
        VendorAssignment.id == assignment_id, 
        VendorAssignment.vendor_id == vendor.id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    hist = ItemStatusHistory(
        assignment_id=assignment.id,
        status=status.upper(),
        updated_by=user.id,
        remarks=remarks
    )
    db.add(hist)

    # Sync to general item tracking table
    item = db.query(RoomItem).filter(RoomItem.id == assignment.item_id).first()
    if item:
        from ..models import ItemTracking
        tracking = db.query(ItemTracking).filter(
            ItemTracking.project_id == assignment.project_id,
            ItemTracking.room_name == (item.room.room_type if item.room else "General"),
            ItemTracking.item_name == (item.product.name if item.product else "Custom Item")
        ).first()
        if tracking:
            tracking.status = status.lower()
            if status.lower() == "delivered":
                tracking.actual_date = datetime.datetime.utcnow().strftime("%Y-%m-%d")
            tracking.remarks = remarks

    # Auto Payout simulation when installed
    if status.upper() == "INSTALLED":
        payout = db.query(VendorPayout).filter(
            VendorPayout.vendor_id == vendor.id,
            VendorPayout.project_id == assignment.project_id
        ).first()
        if not payout:
            payout = VendorPayout(
                vendor_id=vendor.id,
                amount=float((item.unit_price or 1000.0) * (item.qty or 1)),
                project_id=assignment.project_id,
                status="PENDING"
            )
            db.add(payout)

    db.commit()
    return {"success": True}


@router.post("/assignments/{assignment_id}/proof", summary="Upload item dispatch/delivery photos proof")
def upload_proof_image(
    assignment_id: str,
    imageType: str = Form(...),
    caption: Optional[str] = Form(None),
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    assignment = db.query(VendorAssignment).filter(
        VendorAssignment.id == assignment_id, 
        VendorAssignment.vendor_id == vendor.id
    ).first()
    
    if not assignment:
        raise HTTPException(status_code=404, detail="Assignment not found")

    os.makedirs("pdfs/proofs", exist_ok=True)
    file_ext = os.path.splitext(file.filename)[1]
    filename = f"proof_{assignment.id}_{imageType.lower()}_{int(datetime.datetime.utcnow().timestamp())}{file_ext}"
    filepath = os.path.join("pdfs", "proofs", filename)
    
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    url = f"/static/pdfs/proofs/{filename}"

    proof = ItemProofImage(
        assignment_id=assignment.id,
        image_url=url,
        image_type=imageType.upper(),
        caption=caption
    )
    db.add(proof)
    db.commit()

    return {"success": True, "imageUrl": url}


# --- PAYOUT ENDPOINTS ---

@router.get("/payouts", summary="Get payout records and metrics")
def get_vendor_payouts(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    payouts = db.query(VendorPayout).filter(VendorPayout.vendor_id == vendor.id).all()
    
    serialized_payouts = []
    pending_total = 0.0
    paid_total = 0.0
    processing_total = 0.0

    for p in payouts:
        project = db.query(Project).filter(Project.id == p.project_id).first()
        serialized_payouts.append({
            "id": p.id,
            "amount": p.amount,
            "projectId": p.project_id,
            "projectName": project.property_name if project else "Unknown Project",
            "payoutDate": p.payout_date,
            "status": p.status,
            "statementUrl": p.statement_url,
            "createdAt": p.created_at
        })
        if p.status == "PENDING":
            pending_total += p.amount
        elif p.status == "PROCESSING":
            processing_total += p.amount
        elif p.status == "PAID":
            paid_total += p.amount

    return {
        "payouts": serialized_payouts,
        "summary": {
            "pending": pending_total,
            "processing": processing_total,
            "paid": paid_total,
            "total": pending_total + processing_total + paid_total
        }
    }


# --- NOTIFICATIONS ENDPOINTS ---

@router.get("/notifications", summary="Get vendor notices")
def get_vendor_notifications(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    notifications = db.query(VendorNotification).filter(VendorNotification.vendor_id == vendor.id).order_by(VendorNotification.created_at.desc()).all()
    
    return [
        {
            "id": n.id,
            "type": n.type,
            "message": n.message,
            "isRead": n.is_read,
            "createdAt": n.created_at
        }
        for n in notifications
    ]


@router.patch("/notifications", summary="Mark notices as read")
def mark_notifications_read(
    notificationIds: Optional[List[str]] = None,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    query = db.query(VendorNotification).filter(VendorNotification.vendor_id == vendor.id)
    if notificationIds:
        query = query.filter(VendorNotification.id.in_(notificationIds))
    
    notifications = query.all()
    for n in notifications:
        n.is_read = True
    
    db.commit()
    return {"success": True}
