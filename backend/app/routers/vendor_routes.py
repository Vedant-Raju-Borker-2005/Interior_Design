import os
import shutil
import datetime
import uuid
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, EmailStr

from ..db import get_db
from ..models import (
    User, Vendor, VendorDocument, VendorProduct, ProductVariant,
    Inventory, InventoryTransaction, VendorAssignment, ItemStatusHistory,
    ItemProofImage, VendorPayout, VendorNotification, VendorPerformance, Project, RoomItem, Product
)
from ..auth_utils import current_user
from ..schemas import UpdateShipmentReq, UpdateVendorMilestoneReq

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
    categories: List[str] = []


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
    availableQty: int = 10
    images: List[str] = []
    variantOptions: dict = {}   # {"color": ["Yellow","Red"], "fabric": ["Velvet"], ...}
    colorStock: dict = {}       # {"Yellow": 2, "Red": 3} — vendor-only breakdown
    variants: List[VariantIn] = []
    primaryMaterial: str
    width: float
    height: float
    depth: float
    weight: float
    weightCapacity: float
    style: str
    finish: str
    mountingType: str
    assemblyRequired: str
    suitableRoom: str


class ProductUpdateIn(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    description: Optional[str] = None
    basePrice: Optional[float] = None
    images: Optional[List[str]] = None
    availableQty: Optional[int] = None
    variantOptions: Optional[dict] = None
    colorStock: Optional[dict] = None
    primaryMaterial: Optional[str] = None
    width: Optional[float] = None
    height: Optional[float] = None
    depth: Optional[float] = None
    weight: Optional[float] = None
    weightCapacity: Optional[float] = None
    style: Optional[str] = None
    finish: Optional[str] = None
    mountingType: Optional[str] = None
    assemblyRequired: Optional[str] = None
    suitableRoom: Optional[str] = None



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
        categories=payload.categories,
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
            "rejectionReason": vendor.rejection_reason,
            "categories": vendor.categories or []
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
    from ..db import sync_demo_data, sync_project_vendor_assignments
    sync_demo_data(db)
    
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        vendor = Vendor(
            id=str(uuid.uuid4()),
            user_id=user.id,
            name=user.name or "Vendor Partner",
            phone=user.phone or "+919900001111",
            email=user.email or "vendor@example.com",
            gst_no="29AABCS1429B1Z1",
            categories=["Furniture", "Lighting", "Kitchen Cabinets", "Wardrobes", "Flooring", "Curtains", "Decor"],
            rating=4.5,
            active=True,
            serviceable_pincodes=["560001", "560002", "560078", "560100"],
            business_name=f"{user.name or 'Vendor'} Interiors",
            owner_name=user.name or "Vendor Partner",
            status="APPROVED"
        )
        db.add(vendor)
        db.commit()
        db.refresh(vendor)
    
    # Self-healing sync hook for assignments
    all_projects = db.query(Project).all()
    for proj in all_projects:
        sync_project_vendor_assignments(proj.id, db)

    assignments = db.query(VendorAssignment).filter(VendorAssignment.vendor_id == vendor.id).all()
    payouts = db.query(VendorPayout).filter(VendorPayout.vendor_id == vendor.id).all()
    perf = db.query(VendorPerformance).filter(VendorPerformance.vendor_id == vendor.id).first()

    pending_items = [a for a in assignments if a.status in ["ASSIGNED", "RECEIVED_ORDER"]]
    accepted_items = [a for a in assignments if a.status not in ["ASSIGNED", "RECEIVED_ORDER", "REJECTED"]]

    # Financial KPI calculation from milestone payments
    total_order_value = 0.0
    paid_amount = 0.0
    pending_amount = 0.0
    
    milestone_order = ["po_approved", "design_approved", "manufacturing_started", "material_delivered", "installation_complete"]
    milestone_labels = {
        "po_approved": "Purchase Order Approved",
        "design_approved": "Design Approved",
        "manufacturing_started": "Manufacturing Started",
        "material_delivered": "Material Delivered",
        "installation_complete": "Installation Complete"
    }
    upcoming_counter = {m: 0 for m in milestone_order}

    for a in assignments:
        item = db.query(RoomItem).filter(RoomItem.id == a.item_id).first()
        product = item.product if (item and item.product) else None
        price = item.unit_price if (item and item.unit_price) else (product.price if product else 0.0)
        qty = item.qty if item else 1
        val = price * qty
        total_order_value += val
        
        mst = a.milestones_status or {}
        paid_pct = 0
        found_upcoming = False
        
        for m_key in milestone_order:
            m_status = mst.get(m_key, "pending")
            if m_status == "paid":
                paid_pct += 20
            elif not found_upcoming:
                upcoming_counter[m_key] += 1
                found_upcoming = True
                
        paid_val = val * (paid_pct / 100.0)
        paid_amount += paid_val
        pending_amount += (val - paid_val)

    # Determine the most common upcoming milestone
    upcoming_milestone_key = max(upcoming_counter, key=upcoming_counter.get) if assignments else "po_approved"
    upcoming_milestone = milestone_labels.get(upcoming_milestone_key, "Purchase Order Approved")

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
        "totalOrderValue": total_order_value,
        "paidAmount": paid_amount,
        "pendingAmount": pending_amount,
        "upcomingMilestone": upcoming_milestone,
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
            "projectName": f"{project.property_name} ({project.pincode})" if project else "Unknown Project",
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
        vendor = Vendor(
            id=str(uuid.uuid4()),
            user_id=user.id,
            name=user.name or "Vendor Partner",
            phone=user.phone or "+919900001111",
            email=user.email or "vendor@example.com",
            gst_no="29AABCS1429B1Z1",
            categories=["Furniture", "Lighting", "Kitchen Cabinets", "Wardrobes", "Flooring", "Curtains", "Decor"],
            rating=4.5,
            active=True,
            serviceable_pincodes=["560001", "560002", "560078", "560100"],
            business_name=f"{user.name or 'Vendor'} Interiors",
            owner_name=user.name or "Vendor Partner",
            status="APPROVED"
        )
        db.add(vendor)
        db.commit()
        db.refresh(vendor)

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

        # Also fetch full variant options from customer-facing Product table
        cust = db.query(Product).filter(Product.id == p.id).first()
        if cust:
            res[-1]["variants"] = cust.variants or {}
            res[-1]["colorStock"] = {}
            # Reconstruct colorStock from ProductVariant rows if available
            for v in variants:
                if v.color:
                    res[-1]["colorStock"][v.color] = getattr(v, "available_qty", 1)
    return res


def get_default_image_for_category(category: str, subcategory: str) -> str:
    combined = ((category or "") + " " + (subcategory or "")).lower()
    # Sofas / couches
    if any(k in combined for k in ["sofa", "couch", "sectional", "loveseat"]):
        return "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80"
    # Coffee / side / accent tables
    if any(k in combined for k in ["coffee table", "side table", "end table", "accent table", "table"]):
        return "https://images.unsplash.com/photo-1549187774-b4e9b0445b41?w=600&q=80"
    # Beds
    if any(k in combined for k in ["bed", "headboard"]):
        return "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=600&q=80"
    # Wardrobes
    if any(k in combined for k in ["wardrobe", "closet", "almirah"]):
        return "https://images.unsplash.com/photo-1558997519-83ea9252eeb8?w=600&q=80"
    # Chairs
    if any(k in combined for k in ["chair", "recliner", "stool", "ottoman"]):
        return "https://images.unsplash.com/photo-1567538096630-e0c55bd6374c?w=600&q=80"
    # Lighting
    if any(k in combined for k in ["light", "lamp", "chandelier", "pendant", "sconce"]):
        return "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&q=80"
    # Kitchen
    if any(k in combined for k in ["kitchen", "cabinet", "counter"]):
        return "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&q=80"
    # Decor
    if any(k in combined for k in ["decor", "vase", "art", "frame", "mirror"]):
        return "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&q=80"
    # Rugs
    if any(k in combined for k in ["rug", "carpet", "mat"]):
        return "https://images.unsplash.com/photo-1600121848594-d8644e57abab?w=600&q=80"
    # Generic fallback (sofa)
    return "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80"


def get_room_type_for_category(category: str, subcategory: str) -> str:
    cat = (category or "").lower()
    sub = (subcategory or "").lower()
    if "kitchen" in cat or "kitchen" in sub:
        return "kitchen"
    if "bed" in cat or "bed" in sub or "wardrobe" in cat or "wardrobe" in sub:
        return "bedroom_master"
    if "bath" in cat or "bath" in sub:
        return "bathroom"
    return "living_room"


@router.post("/products", summary="Add new product to vendor catalog")
def create_vendor_product(
    payload: ProductCreateIn,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        vendor = Vendor(
            id=str(uuid.uuid4()),
            user_id=user.id,
            name=user.name or "Vendor Partner",
            phone=user.phone or "+919900001111",
            email=user.email or "vendor@example.com",
            gst_no="29AABCS1429B1Z1",
            categories=["Furniture", "Lighting", "Kitchen Cabinets", "Wardrobes", "Flooring", "Curtains", "Decor"],
            rating=4.5,
            active=True,
            serviceable_pincodes=["560001", "560002", "560078", "560100"],
            business_name=f"{user.name or 'Vendor'} Interiors",
            owner_name=user.name or "Vendor Partner",
            status="APPROVED"
        )
        db.add(vendor)
        db.commit()
        db.refresh(vendor)

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
        images=payload.images,
        primary_material=payload.primaryMaterial,
        width=payload.width,
        height=payload.height,
        depth=payload.depth,
        weight=payload.weight,
        weight_capacity=payload.weightCapacity,
        style=payload.style,
        finish=payload.finish,
        mounting_type=payload.mountingType,
        assembly_required=payload.assemblyRequired,
        suitable_room=payload.suitableRoom
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
        available_qty=payload.availableQty,
        reserved_qty=0,
        incoming_qty=0
    )
    db.add(inv)

    # Sync to customer-facing catalog Product table
    variant_opts = payload.variantOptions or {}
    color_list = variant_opts.get("color", [])
    room_type = get_room_type_for_category(payload.category, payload.subcategory)
    cust_product = Product(
        id=product.id,
        sku=product.sku,
        name=product.name,
        category=product.category,
        subcategory=product.subcategory,
        vendor_id=vendor.id,
        room_type=room_type,
        price=product.base_price,
        thumbnail_url=product.images[0] if product.images else "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=85&fit=crop",
        materials=variant_opts.get("fabric", []),
        color_variants=color_list,
        variants={
            "color": variant_opts.get("color", []),
            "fabric": variant_opts.get("fabric", []),
            "size": variant_opts.get("size", []),
            "texture": variant_opts.get("texture", []),
            "wood_finish": variant_opts.get("wood_finish", []),
            "cushion_style": variant_opts.get("cushion_style", []),
        },
        style_tags=["modern"],
        primary_material=payload.primaryMaterial,
        width=payload.width,
        height=payload.height,
        depth=payload.depth,
        weight=payload.weight,
        weight_capacity=payload.weightCapacity,
        style=payload.style,
        finish=payload.finish,
        mounting_type=payload.mountingType,
        assembly_required=payload.assemblyRequired,
        suitable_room=payload.suitableRoom
    )
    db.add(cust_product)

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

    # Sync to customer-facing catalog Product table
    cust_product = db.query(Product).filter(Product.id == product.id).first()
    if cust_product:
        if payload.name is not None:
            cust_product.name = payload.name
        if payload.category is not None or payload.subcategory is not None:
            cat = payload.category if payload.category is not None else product.category
            sub = payload.subcategory if payload.subcategory is not None else product.subcategory
            cust_product.category = cat
            cust_product.subcategory = sub
            cust_product.room_type = get_room_type_for_category(cat, sub)
        if payload.basePrice is not None:
            cust_product.price = payload.basePrice
        if payload.images is not None:
            cust_product.thumbnail_url = payload.images[0] if payload.images else "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=85&fit=crop"

    # Update specifications on both models
    spec_fields = {
        "primaryMaterial": "primary_material",
        "width": "width",
        "height": "height",
        "depth": "depth",
        "weight": "weight",
        "weightCapacity": "weight_capacity",
        "style": "style",
        "finish": "finish",
        "mountingType": "mounting_type",
        "assemblyRequired": "assembly_required",
        "suitableRoom": "suitable_room"
    }
    for req_field, db_field in spec_fields.items():
        val = getattr(payload, req_field, None)
        if val is not None:
            setattr(product, db_field, val)
            if cust_product:
                setattr(cust_product, db_field, val)

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


@router.delete("/products/{product_id}", summary="Delete vendor product")
def delete_vendor_product(
    product_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    product = db.query(VendorProduct).filter(VendorProduct.id == product_id, VendorProduct.vendor_id == vendor.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or access denied")

    db.query(ProductVariant).filter(ProductVariant.product_id == product_id).delete()
    db.query(Inventory).filter(Inventory.product_id == product_id).delete()
    db.query(InventoryTransaction).filter(InventoryTransaction.product_id == product_id).delete()
    db.query(Product).filter(Product.id == product_id).delete()
    db.delete(product)
    db.commit()
    return {"success": True, "message": "Product deleted successfully"}


@router.post("/products/{product_id}/image", summary="Upload product photo for vendor catalog")
async def upload_product_image(
    product_id: str,
    view_index: int = 0,
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    """Upload a real product photo — this image will be shown to customers in the catalog."""
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor profile not found")

    product = db.query(VendorProduct).filter(VendorProduct.id == product_id, VendorProduct.vendor_id == vendor.id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found or access denied")

    # Save image file
    ext = os.path.splitext(file.filename or "product.jpg")[1].lower() or ".jpg"
    allowed = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
    if ext not in allowed:
        raise HTTPException(400, "Invalid image format. Use JPG, PNG, or WebP.")

    os.makedirs(os.path.join("pdfs", "product_images"), exist_ok=True)
    filename = f"product_{product_id}_{view_index}_{int(datetime.datetime.utcnow().timestamp())}{ext}"
    filepath = os.path.join("pdfs", "product_images", filename)

    contents = await file.read()
    with open(filepath, "wb") as f:
        f.write(contents)

    image_url = f"/static/pdfs/product_images/{filename}"

    # Update vendor product images array at view_index
    images = list(product.images) if product.images else []
    while len(images) <= view_index:
        images.append("")
    images[view_index] = image_url
    
    # Filter out trailing empty slots
    while images and not images[-1]:
        images.pop()
        
    product.images = images
    
    # Update customer-facing catalog Product table thumbnail
    cust_product = db.query(Product).filter(Product.id == product_id).first()
    if cust_product:
        cust_product.thumbnail_url = images[0] if (images and images[0]) else ""
        cust_product.images = images
        
        # Save images list to variants["images"] as well
        vars_dict = dict(cust_product.variants) if cust_product.variants else {}
        vars_dict["images"] = images
        cust_product.variants = vars_dict

    db.commit()
    return {"success": True, "image_url": image_url, "images": images}


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

        customer = project.user if (project and project.user) else None
        expected_delivery = (a.created_at + datetime.timedelta(days=30)).strftime("%d-%b-%Y") if a.created_at else "N/A"

        res.append({
            "id": a.id,
            "projectId": a.project_id,
            "projectName": f"{project.property_name} ({project.pincode})" if project else "Unknown Project",
            "customerName": customer.name if customer else "Unknown Customer",
            "customerPhone": customer.phone if customer else "N/A",
            "city": project.city if project else "N/A",
            "pincode": project.pincode if project else "N/A",
            "expectedDeliveryDate": expected_delivery,
            "roomName": room.room_type if room else "General",
            "itemId": a.item_id,
            "itemName": product.name if product else "Custom Item",
            "sku": product.sku if product else "N/A",
            "quantity": item.qty if item else 1,
            "price": item.unit_price if (item and item.unit_price) else (product.price if product else 0.0),
            "customColor": item.custom_color if item else None,
            "customMaterial": item.custom_material if item else None,
            "customSize": item.custom_size if item else None,
            "customFabric": item.custom_fabric if item else None,
            "customWoodFinish": item.custom_wood_finish if item else None,
            "customTexture": item.custom_texture if item else None,
            "customCushionStyle": item.custom_cushion_style if item else None,
            "status": a.status,
            "remarks": a.remarks,
            "acceptedAt": a.accepted_at,
            "rejectedAt": a.rejected_at,
            "createdAt": a.created_at,
            "shipmentId": a.shipment_id,
            "courier": a.courier,
            "vehicleDetails": a.vehicle_details,
            "trackingNumber": a.tracking_number,
            "dispatchDate": a.dispatch_date,
            "expectedArrival": a.expected_arrival,
            "shipmentStatus": a.shipment_status,
            "milestonesStatus": a.milestones_status,
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


@router.put("/assignments/{assignment_id}/shipment", summary="Update shipment details for assignment")
def update_assignment_shipment(
    assignment_id: str,
    payload: UpdateShipmentReq,
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

    assignment.courier = payload.courier
    assignment.vehicle_details = payload.vehicle_details
    assignment.tracking_number = payload.tracking_number
    assignment.dispatch_date = payload.dispatch_date or datetime.datetime.utcnow().strftime("%Y-%m-%d")
    assignment.expected_arrival = payload.expected_arrival
    assignment.shipment_status = payload.shipment_status
    if not assignment.shipment_id:
        import uuid
        assignment.shipment_id = f"TRK-{uuid.uuid4().hex[:8].upper()}"

    if payload.shipment_status == "Delivered":
        assignment.status = "COMPLETED"
    elif payload.shipment_status in ["Dispatched", "In Transit"]:
        assignment.status = "DISPATCHED"

    hist = ItemStatusHistory(
        assignment_id=assignment.id,
        status=assignment.status,
        updated_by=user.id,
        remarks=f"Shipment status updated to {payload.shipment_status}. Courier: {payload.courier}, tracking: {payload.tracking_number}"
    )
    db.add(hist)

    item = db.query(RoomItem).filter(RoomItem.id == assignment.item_id).first()
    if item:
        from ..models import ItemTracking
        tracking = db.query(ItemTracking).filter(
            ItemTracking.project_id == assignment.project_id,
            ItemTracking.room_name == (item.room.room_type if item.room else "General"),
            ItemTracking.item_name == (item.product.name if item.product else "Custom Item")
        ).first()
        if tracking:
            if payload.shipment_status == "Delivered":
                tracking.status = "delivered"
                tracking.actual_date = datetime.datetime.utcnow().strftime("%Y-%m-%d")
            elif payload.shipment_status in ["Dispatched", "In Transit"]:
                tracking.status = "dispatched"
            tracking.remarks = f"Shipment status: {payload.shipment_status}"

    db.commit()
    return {"success": True, "shipmentStatus": assignment.shipment_status, "status": assignment.status}


@router.put("/assignments/{assignment_id}/milestones", summary="Update milestone payment status")
def update_assignment_milestones(
    assignment_id: str,
    payload: UpdateVendorMilestoneReq,
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

    mst = dict(assignment.milestones_status or {})
    m_name = payload.milestone_name.lower()
    if m_name not in ["po_approved", "design_approved", "manufacturing_started", "material_delivered", "installation_complete"]:
        raise HTTPException(status_code=400, detail="Invalid milestone name")

    mst[m_name] = payload.status.lower()
    assignment.milestones_status = mst

    if mst.get("installation_complete") == "paid":
        assignment.status = "COMPLETED"
    elif mst.get("material_delivered") == "paid":
        assignment.status = "DELIVERED"
    elif mst.get("manufacturing_started") in ["paid", "approved"]:
        assignment.status = "PRODUCTION"
    elif mst.get("design_approved") in ["paid", "approved"]:
        assignment.status = "ACCEPTED"

    hist = ItemStatusHistory(
        assignment_id=assignment.id,
        status=assignment.status,
        updated_by=user.id,
        remarks=f"Milestone '{payload.milestone_name}' status updated to {payload.status}."
    )
    db.add(hist)

    item = db.query(RoomItem).filter(RoomItem.id == assignment.item_id).first()
    if item:
        from ..models import ItemTracking
        tracking = db.query(ItemTracking).filter(
            ItemTracking.project_id == assignment.project_id,
            ItemTracking.room_name == (item.room.room_type if item.room else "General"),
            ItemTracking.item_name == (item.product.name if item.product else "Custom Item")
        ).first()
        if tracking:
            if mst.get("installation_complete") == "paid":
                tracking.status = "installed"
                tracking.actual_date = datetime.datetime.utcnow().strftime("%Y-%m-%d")
            elif mst.get("material_delivered") == "paid":
                tracking.status = "delivered"
            elif mst.get("manufacturing_started") in ["paid", "approved"]:
                tracking.status = "production"
            elif mst.get("design_approved") in ["paid", "approved"]:
                tracking.status = "accepted"
            tracking.remarks = f"Milestone {payload.milestone_name}: {payload.status}"

    if mst.get("installation_complete") == "paid":
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
    return {"success": True, "milestonesStatus": assignment.milestones_status, "status": assignment.status}


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
    if status_upper == "REJECTED":
        raise HTTPException(status_code=400, detail="Vendor rejection is disabled. Rejection of assignments is not permitted.")
    if status_upper != "ACCEPTED":
        raise HTTPException(status_code=400, detail="Invalid status. Must be ACCEPTED")

    assignment.status = status_upper
    assignment.remarks = payload.remarks
    
    if status_upper == "ACCEPTED":
        already_accepted = db.query(VendorAssignment).filter(
            VendorAssignment.project_id == assignment.project_id,
            VendorAssignment.item_id == assignment.item_id,
            VendorAssignment.id != assignment.id,
            VendorAssignment.status == "ACCEPTED"
        ).first()
        if already_accepted:
            raise HTTPException(status_code=400, detail="This item has already been accepted by another vendor.")

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
            "projectName": f"{project.property_name} ({project.pincode})" if project else "Unknown Project",
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
