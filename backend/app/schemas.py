from typing import Optional, List, Any
from pydantic import BaseModel
import datetime


# ── Auth ──────────────────────────────────────────────────────────────────────
class SignupReq(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None


class VerifyOTPReq(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None
    otp: str
    role: Optional[str] = None


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str


# ── Projects ──────────────────────────────────────────────────────────────────
class CreateProjectReq(BaseModel):
    bhk_type: str
    property_name: str
    city: str
    budget: float
    package_id: Optional[str] = None
    total_area_sqft: Optional[int] = None
    material_preference: Optional[str] = None
    pincode: Optional[str] = None
    furnishing_type: Optional[str] = None  # new / upgrade
    color_preferences: Optional[List[str]] = []



class RoomOut(BaseModel):
    id: str
    room_type: str
    length_ft: float
    width_ft: float
    height_ft: float
    style_preference: Optional[str] = None
    color_palette: Optional[List[str]] = []

    class Config:
        from_attributes = True


class ProjectOut(BaseModel):
    id: str
    bhk_type: str
    property_name: str
    city: str
    budget: float
    status: str
    package_id: Optional[str] = None
    created_at: datetime.datetime
    rooms: List[RoomOut] = []
    color_preferences: Optional[List[str]] = []


    class Config:
        from_attributes = True


class UpdateRoomReq(BaseModel):
    style_preference: Optional[str] = None
    color_palette: Optional[List[str]] = None
    length_ft: Optional[float] = None
    width_ft: Optional[float] = None
    height_ft: Optional[float] = None


class AddRoomItemReq(BaseModel):
    product_id: str
    qty: int = 1
    custom_color: Optional[str] = None
    custom_material: Optional[str] = None
    custom_size: Optional[str] = None
    custom_fabric: Optional[str] = None
    custom_wood_finish: Optional[str] = None
    custom_texture: Optional[str] = None
    custom_cushion_style: Optional[str] = None


class AddRoomReq(BaseModel):
    room_type: str
    length_ft: Optional[float] = 12.0
    width_ft: Optional[float] = 10.0
    height_ft: Optional[float] = 9.0


# ── Catalog ───────────────────────────────────────────────────────────────────
class PackageOut(BaseModel):
    id: str
    name: str
    tier: str
    bhk: str
    base_price: float
    style_tags: List[str]
    thumbnail_url: Optional[str] = None
    images: List[str]
    featured: bool
    description: Optional[str] = None

    class Config:
        from_attributes = True


class ProductOut(BaseModel):
    id: str
    sku: str
    name: str
    category: str
    room_type: str
    price: float
    materials: List[str]
    color_variants: List[str]
    variants: Optional[dict] = {}
    thumbnail_url: Optional[str] = None
    images: List[str] = []
    style_tags: List[str]
    primary_material: Optional[str] = None
    width: Optional[float] = None
    height: Optional[float] = None
    depth: Optional[float] = None
    weight: Optional[float] = None
    weight_capacity: Optional[float] = None
    style: Optional[str] = None
    finish: Optional[str] = None
    mounting_type: Optional[str] = None
    assembly_required: Optional[str] = None
    suitable_room: Optional[str] = None


    class Config:
        from_attributes = True


# ── AI Render ─────────────────────────────────────────────────────────────────
class RenderReq(BaseModel):
    room_id: str
    mode: str = "sdxl"
    style: str = "modern"
    color_palette: List[str] = []
    products: List[Any] = []
    layout_prompt: str = ""
    base_image_url: Optional[str] = None
    # Base64-encoded image data for img2img redesign
    base_image_data: Optional[str] = None
    base_image_mime: Optional[str] = "image/jpeg"


class RenderOut(BaseModel):
    job_id: str
    status: str
    image_url: Optional[str] = None
    thumbnail_url: Optional[str] = None
    eta_seconds: Optional[int] = None
    created_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True


# ── Quotation ─────────────────────────────────────────────────────────────────
class GenerateQuotationReq(BaseModel):
    project_id: str


class QuotationOut(BaseModel):
    id: str
    project_id: str
    subtotal: float
    gst: float
    total: float
    pdf_url: Optional[str] = None
    valid_until: Optional[str] = None
    status: str
    line_items: List[Any]
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# ── Inquiry ───────────────────────────────────────────────────────────────────
class InquiryReq(BaseModel):
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    bhk_type: Optional[str] = None
    message: Optional[str] = None
    project_id: Optional[str] = None
    quotation_id: Optional[str] = None
    source: str = "web"


class InquiryOut(BaseModel):
    id: str
    name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    bhk_type: Optional[str] = None
    message: Optional[str] = None
    project_id: Optional[str] = None
    status: str
    source: str
    created_at: datetime.datetime

    class Config:
        from_attributes = True


# ── Milestone ─────────────────────────────────────────────────────────────────
class MilestoneOut(BaseModel):
    id: str
    project_id: str
    title: str
    description: Optional[str] = None
    status: str
    order: int
    due_date: Optional[str] = None
    completed_date: Optional[str] = None
    vendor_id: Optional[str] = None
    notes: Optional[str] = None

    class Config:
        from_attributes = True


class UpdateMilestoneReq(BaseModel):
    status: Optional[str] = None
    completed_date: Optional[str] = None
    notes: Optional[str] = None
    vendor_id: Optional[str] = None


# ── Vendor ────────────────────────────────────────────────────────────────────
class VendorOut(BaseModel):
    id: str
    name: str
    phone: str
    gst_no: Optional[str] = None
    categories: List[str]
    rating: float
    active: bool
    serviceable_pincodes: List[str]

    class Config:
        from_attributes = True


# ── Recommendations ───────────────────────────────────────────────────────────
class RecommendationReq(BaseModel):
    bhk: str
    budget: float
    style_tags: List[str] = []
    room_type: Optional[str] = None


# ── Admin Analytics ───────────────────────────────────────────────────────────
class AdminStatsOut(BaseModel):
    total_users: int
    total_projects: int
    total_quotations: int
    total_inquiries: int
    total_vendors: int
    revenue_pipeline: float
    projects_by_status: dict
    inquiries_by_status: dict


# ── Vendor Shipments & Milestones ─────────────────────────────────────────────
class UpdateShipmentReq(BaseModel):
    courier: str
    vehicle_details: Optional[str] = None
    tracking_number: str
    dispatch_date: Optional[str] = None
    expected_arrival: Optional[str] = None
    shipment_status: str # Pending, Dispatched, In Transit, Delivered


class UpdateVendorMilestoneReq(BaseModel):
    milestone_name: str # po_approved, design_approved, etc.
    status: str # pending, approved, paid
