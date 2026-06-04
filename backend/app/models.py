import uuid
import datetime
from sqlalchemy import (
    Column, String, Float, Integer, Boolean, Text,
    ForeignKey, DateTime, JSON
)
from sqlalchemy.orm import declarative_base
from sqlalchemy.orm import relationship, backref

Base = declarative_base()


def gen_uuid():
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True, default=gen_uuid)
    phone = Column(String, unique=True, nullable=True)
    email = Column(String, unique=True, nullable=True)
    name = Column(String)
    city = Column(String)
    style_tags = Column(JSON, default=list)
    budget_min = Column(Float, default=0)
    budget_max = Column(Float, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    projects = relationship("Project", back_populates="user")


class Package(Base):
    __tablename__ = "packages"
    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String)
    tier = Column(String)          # basic / premium / luxury
    bhk = Column(String)           # 1BHK .. 5BHK
    base_price = Column(Float)
    style_tags = Column(JSON, default=list)
    images = Column(JSON, default=list)
    thumbnail_url = Column(String)
    featured = Column(Boolean, default=False)
    description = Column(Text)
    projects = relationship("Project", back_populates="package")


class Project(Base):
    __tablename__ = "projects"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id"))
    bhk_type = Column(String)
    property_name = Column(String)
    city = Column(String)
    pincode = Column(String)
    total_area_sqft = Column(Integer)
    budget = Column(Float)
    package_id = Column(String, ForeignKey("packages.id"), nullable=True)
    status = Column(String, default="draft")
    floor_plan_url = Column(String)
    material_preference = Column(String)
    furnishing_type = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="projects")
    rooms = relationship("Room", back_populates="project", cascade="all, delete-orphan")
    quotations = relationship("Quotation", back_populates="project")
    package = relationship("Package", back_populates="projects")

    # Project Team Module relations
    team_members = relationship("ProjectTeamMember", back_populates="project", cascade="all, delete-orphan")
    project_assignments = relationship("ProjectAssignment", back_populates="project", cascade="all, delete-orphan")
    progress_history = relationship("ProjectProgressHistory", back_populates="project", cascade="all, delete-orphan")
    tasks = relationship("Task", back_populates="project", cascade="all, delete-orphan")
    daily_checklists = relationship("DailyChecklist", back_populates="project", cascade="all, delete-orphan")
    site_visits = relationship("SiteVisit", back_populates="project", cascade="all, delete-orphan")
    delays = relationship("ProjectDelay", back_populates="project", cascade="all, delete-orphan")
    comms_logs = relationship("CommunicationLog", back_populates="project", cascade="all, delete-orphan")
    documents = relationship("ProjectDocument", back_populates="project", cascade="all, delete-orphan")


class Room(Base):
    __tablename__ = "rooms"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    room_type = Column(String)
    length_ft = Column(Float, default=12.0)
    width_ft = Column(Float, default=10.0)
    height_ft = Column(Float, default=9.0)
    style_preference = Column(String, default="modern")
    color_palette = Column(JSON, default=list)
    custom_config = Column(JSON, default=dict)

    project = relationship("Project", back_populates="rooms")
    items = relationship("RoomItem", back_populates="room", cascade="all, delete-orphan")
    renders = relationship("Render", back_populates="room")


class Product(Base):
    __tablename__ = "products"
    id = Column(String, primary_key=True, default=gen_uuid)
    sku = Column(String, unique=True)
    name = Column(String)
    category = Column(String)
    room_type = Column(String)
    price = Column(Float)
    dimensions_l = Column(Float, default=0)
    dimensions_w = Column(Float, default=0)
    dimensions_h = Column(Float, default=0)
    materials = Column(JSON, default=list)
    color_variants = Column(JSON, default=list)
    thumbnail_url = Column(String)
    model_url = Column(String)
    style_tags = Column(JSON, default=list)


class RoomItem(Base):
    __tablename__ = "room_items"
    id = Column(String, primary_key=True, default=gen_uuid)
    room_id = Column(String, ForeignKey("rooms.id", ondelete="CASCADE"))
    product_id = Column(String, ForeignKey("products.id"))
    qty = Column(Integer, default=1)
    custom_color = Column(String)
    custom_material = Column(String)
    unit_price = Column(Float)

    room = relationship("Room", back_populates="items")
    product = relationship("Product")


class Quotation(Base):
    __tablename__ = "quotations"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id"))
    subtotal = Column(Float, default=0)
    gst = Column(Float, default=0)
    total = Column(Float, default=0)
    pdf_url = Column(String)
    valid_until = Column(String)
    status = Column(String, default="draft")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    line_items = Column(JSON, default=list)

    project = relationship("Project", back_populates="quotations")


class Render(Base):
    __tablename__ = "renders"
    id = Column(String, primary_key=True, default=gen_uuid)
    room_id = Column(String, ForeignKey("rooms.id"))
    project_id = Column(String)
    prompt = Column(Text)
    mode = Column(String, default="sdxl")
    image_url = Column(String)
    thumbnail_url = Column(String)
    status = Column(String, default="queued")   # queued/processing/completed/failed
    style = Column(String, default="modern")
    color_palette = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    room = relationship("Room", back_populates="renders")


class Vendor(Base):
    __tablename__ = "vendors"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String)
    phone = Column(String)
    gst_no = Column(String)
    categories = Column(JSON, default=list)
    rating = Column(Float, default=4.0)
    active = Column(Boolean, default=True)
    serviceable_pincodes = Column(JSON, default=list)
    business_name = Column(String, nullable=True)
    owner_name = Column(String, nullable=True)
    email = Column(String, nullable=True)
    pan_no = Column(String, nullable=True)
    warehouse_address = Column(String, nullable=True)
    status = Column(String, default="SUBMITTED") # SUBMITTED / UNDER_REVIEW / APPROVED / REJECTED
    rejection_reason = Column(Text, nullable=True)
    approved_by = Column(String, nullable=True)
    approved_at = Column(String, nullable=True)

    document = relationship("VendorDocument", back_populates="vendor", uselist=False, cascade="all, delete-orphan")
    products = relationship("VendorProduct", back_populates="vendor", cascade="all, delete-orphan")
    assignments = relationship("VendorAssignment", back_populates="vendor", cascade="all, delete-orphan")
    payouts = relationship("VendorPayout", back_populates="vendor", cascade="all, delete-orphan")
    notifications = relationship("VendorNotification", back_populates="vendor", cascade="all, delete-orphan")
    performance = relationship("VendorPerformance", back_populates="vendor", uselist=False, cascade="all, delete-orphan")


class Inquiry(Base):
    __tablename__ = "inquiries"
    id = Column(String, primary_key=True, default=gen_uuid)
    name = Column(String)
    phone = Column(String)
    email = Column(String)
    city = Column(String)
    bhk_type = Column(String)
    message = Column(Text)
    project_id = Column(String, ForeignKey("projects.id"), nullable=True)
    quotation_id = Column(String, nullable=True)
    status = Column(String, default="new")   # new / contacted / converted
    source = Column(String, default="web")   # web / whatsapp / phone
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Milestone(Base):
    __tablename__ = "milestones"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    title = Column(String)
    description = Column(Text)
    status = Column(String, default="pending")  # pending / in_progress / completed
    order = Column(Integer, default=0)
    due_date = Column(String)
    completed_date = Column(String)
    vendor_id = Column(String, ForeignKey("vendors.id"), nullable=True)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class FloorPlan(Base):
    __tablename__ = "floor_plans"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    file_url = Column(String)
    file_type = Column(String)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)
    uploaded_by = Column(String)


class QuotationRevision(Base):
    __tablename__ = "quotation_revisions"
    id = Column(String, primary_key=True, default=gen_uuid)
    quotation_id = Column(String, ForeignKey("quotations.id", ondelete="CASCADE"))
    revision_number = Column(Integer)
    subtotal = Column(Float, default=0)
    gst = Column(Float, default=0)
    total = Column(Float, default=0)
    line_items = Column(JSON, default=list)
    status = Column(String, default="pending") # pending / approved / rejected
    customer_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    action = Column(String)
    resource_type = Column(String)
    resource_id = Column(String)
    metadata_json = Column(JSON, default=dict)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class ItemTracking(Base):
    __tablename__ = "item_trackings"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    room_name = Column(String)
    item_name = Column(String)
    status = Column(String, default="ordered") # ordered / accepted / production / ready / dispatched / delivered / installed
    expected_date = Column(String)
    actual_date = Column(String)
    remarks = Column(Text)


class ProjectPhoto(Base):
    __tablename__ = "project_photos"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    room_name = Column(String)
    uploaded_by = Column(String)
    image_url = Column(String)
    caption = Column(String)
    category = Column(String, nullable=True)  # SITE_VISIT, PRODUCTION_CHECK, etc.
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)


class Issue(Base):
    __tablename__ = "issues"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    item_id = Column(String, nullable=True)
    type = Column(String) # damaged_item / delay / wrong_product / installation_problem / other
    status = Column(String, default="open") # open / assigned / in_progress / resolved / closed
    priority = Column(String, default="low") # low / medium / high / critical
    description = Column(Text)
    resolution = Column(Text, nullable=True)
    resolved_at = Column(DateTime, nullable=True)
    created_by = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=True)
    subject = Column(String)
    description = Column(Text)
    status = Column(String, default="open") # open / resolved
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Payment(Base):
    __tablename__ = "payments"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    amount = Column(Float, nullable=False)
    payment_date = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="completed")  # completed / pending / failed
    milestone_name = Column(String)  # e.g., "10% Booking Advance"
    transaction_id = Column(String)



class ServiceRequest(Base):
    __tablename__ = "service_requests"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    service_type = Column(String) # 3d_rendering / custom_design / advanced_modeling / consultation
    requirements = Column(Text)
    status = Column(String, default="pending") # pending / in_progress / completed
    quote_amount = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(String, primary_key=True, default=gen_uuid)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"))
    title = Column(String)
    message = Column(Text)
    type = Column(String, default="info") # info / warning / error / success
    read = Column(Boolean, default=False)
    action_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class VendorDocument(Base):
    __tablename__ = "vendor_documents"
    id = Column(String, primary_key=True, default=gen_uuid)
    vendor_id = Column(String, ForeignKey("vendors.id", ondelete="CASCADE"), unique=True)
    gst_certificate = Column(String, nullable=True)
    pan_card = Column(String, nullable=True)
    bank_details = Column(String, nullable=True)
    approval_status = Column(String, default="PENDING")
    rejection_reason = Column(Text, nullable=True)
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)

    vendor = relationship("Vendor", back_populates="document")


class VendorProduct(Base):
    __tablename__ = "vendor_products"
    id = Column(String, primary_key=True, default=gen_uuid)
    vendor_id = Column(String, ForeignKey("vendors.id", ondelete="CASCADE"))
    name = Column(String, nullable=False)
    category = Column(String, nullable=False)
    subcategory = Column(String, nullable=False)
    sku = Column(String, unique=True, nullable=False)
    description = Column(Text, nullable=True)
    base_price = Column(Float, default=0.0)
    images = Column(JSON, default=list)
    is_archived = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    vendor = relationship("Vendor", back_populates="products")
    variants = relationship("ProductVariant", back_populates="product", cascade="all, delete-orphan")
    inventory = relationship("Inventory", back_populates="product", uselist=False, cascade="all, delete-orphan")


class ProductVariant(Base):
    __tablename__ = "product_variants"
    id = Column(String, primary_key=True, default=gen_uuid)
    product_id = Column(String, ForeignKey("vendor_products.id", ondelete="CASCADE"))
    color = Column(String, nullable=True)
    material = Column(String, nullable=True)
    size = Column(String, nullable=True)
    price_adjustment = Column(Float, default=0.0)
    sku_suffix = Column(String, nullable=True)

    product = relationship("VendorProduct", back_populates="variants")


class Inventory(Base):
    __tablename__ = "inventory"
    id = Column(String, primary_key=True, default=gen_uuid)
    product_id = Column(String, ForeignKey("vendor_products.id", ondelete="CASCADE"), unique=True)
    available_qty = Column(Integer, default=0)
    reserved_qty = Column(Integer, default=0)
    incoming_qty = Column(Integer, default=0)
    last_updated = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    product = relationship("VendorProduct", back_populates="inventory")


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"
    id = Column(String, primary_key=True, default=gen_uuid)
    product_id = Column(String, ForeignKey("vendor_products.id", ondelete="CASCADE"))
    type = Column(String)  # ADDED, RESERVED, RELEASED, DELIVERED
    quantity = Column(Integer)
    reference_id = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class VendorAssignment(Base):
    __tablename__ = "vendor_assignments"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    item_id = Column(String)
    vendor_id = Column(String, ForeignKey("vendors.id", ondelete="CASCADE"))
    status = Column(String, default="ASSIGNED")  # ASSIGNED, ACCEPTED, REJECTED, PENDING
    remarks = Column(Text, nullable=True)
    accepted_at = Column(DateTime, nullable=True)
    rejected_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    vendor = relationship("Vendor", back_populates="assignments")
    project = relationship("Project", backref=backref("vendor_assignments", cascade="all, delete-orphan"))


class ItemStatusHistory(Base):
    __tablename__ = "item_status_history"
    id = Column(String, primary_key=True, default=gen_uuid)
    assignment_id = Column(String, ForeignKey("vendor_assignments.id", ondelete="CASCADE"))
    status = Column(String)
    updated_by = Column(String)  # Vendor User ID
    remarks = Column(Text, nullable=True)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    assignment = relationship("VendorAssignment", backref=backref("status_history", cascade="all, delete-orphan"))


class ItemProofImage(Base):
    __tablename__ = "item_proof_images"
    id = Column(String, primary_key=True, default=gen_uuid)
    assignment_id = Column(String, ForeignKey("vendor_assignments.id", ondelete="CASCADE"))
    image_url = Column(String)
    image_type = Column(String)  # PRODUCTION, PACKAGING, DISPATCH, DELIVERY, INSTALLATION
    caption = Column(String, nullable=True)
    uploaded_at = Column(DateTime, default=datetime.datetime.utcnow)

    assignment = relationship("VendorAssignment", backref=backref("proof_images", cascade="all, delete-orphan"))


class VendorPayout(Base):
    __tablename__ = "vendor_payouts"
    id = Column(String, primary_key=True, default=gen_uuid)
    vendor_id = Column(String, ForeignKey("vendors.id", ondelete="CASCADE"))
    amount = Column(Float, default=0.0)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"))
    payout_date = Column(DateTime, nullable=True)
    status = Column(String, default="PENDING")  # PENDING, PROCESSING, PAID
    statement_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    vendor = relationship("Vendor", back_populates="payouts")
    project = relationship("Project", backref=backref("payouts", cascade="all, delete-orphan"))


class VendorNotification(Base):
    __tablename__ = "vendor_notifications"
    id = Column(String, primary_key=True, default=gen_uuid)
    vendor_id = Column(String, ForeignKey("vendors.id", ondelete="CASCADE"))
    type = Column(String)  # NEW_ASSIGNMENT, STATUS_UPDATE, PAYOUT_RELEASED, DELAY_ALERT
    message = Column(Text)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    vendor = relationship("Vendor", back_populates="notifications")


class VendorPerformance(Base):
    __tablename__ = "vendor_performance"
    id = Column(String, primary_key=True, default=gen_uuid)
    vendor_id = Column(String, ForeignKey("vendors.id", ondelete="CASCADE"), unique=True)
    acceptance_rate = Column(Float, default=0.0)
    completion_rate = Column(Float, default=0.0)
    delay_percentage = Column(Float, default=0.0)
    customer_rating = Column(Float, default=0.0)
    avg_delivery_time = Column(Integer, default=0)  # in days
    last_updated = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    vendor = relationship("Vendor", back_populates="performance")


# ── PROJECT TEAM MODULE MODELS ──

class ProjectTeamMember(Base):
    __tablename__ = "project_team_members"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)  # MANAGER, COORDINATOR, TECHNICIAN
    status = Column(String, default="ACTIVE")  # ACTIVE, ON_LEAVE, REMOVED
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="team_members")
    user = relationship("User", backref=backref("team_members", cascade="all, delete-orphan"))


class ProjectAssignment(Base):
    __tablename__ = "project_assignments"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    assignee_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    assigned_by_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role = Column(String, nullable=False)  # MANAGER, COORDINATOR, TECHNICIAN
    target_item_id = Column(String, nullable=True)
    assigned_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="project_assignments")
    assignee = relationship("User", foreign_keys=[assignee_id], backref=backref("assigned_projects", cascade="all, delete-orphan"))
    assigned_by = relationship("User", foreign_keys=[assigned_by_id], backref=backref("created_assignments", cascade="all, delete-orphan"))


class ProjectProgressHistory(Base):
    __tablename__ = "project_progress_history"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    progress = Column(Float, nullable=False)  # 0.0 to 100.0
    reason = Column(String, nullable=True)
    recorded_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="progress_history")


class Task(Base):
    __tablename__ = "tasks"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    assigned_to = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    assigned_by = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    due_date = Column(DateTime, nullable=False)
    priority = Column(String, default="MEDIUM")  # LOW, MEDIUM, HIGH, CRITICAL
    status = Column(String, default="PENDING")  # PENDING, IN_PROGRESS, COMPLETED, CANCELLED

    project = relationship("Project", back_populates="tasks")
    assignee = relationship("User", foreign_keys=[assigned_to], backref=backref("assigned_tasks", cascade="all, delete-orphan"))
    creator = relationship("User", foreign_keys=[assigned_by], backref=backref("created_tasks", cascade="all, delete-orphan"))


class DailyChecklist(Base):
    __tablename__ = "daily_checklists"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    checklist_type = Column(String, nullable=False)  # COORDINATOR_CHECK, TECHNICIAN_CHECK
    items = Column(JSON, default=list)  # List of {title, checked}
    completed_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="daily_checklists")


class SiteVisit(Base):
    __tablename__ = "site_visits"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    visit_date = Column(DateTime, nullable=False)
    assigned_to = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    notes = Column(Text, nullable=True)
    outcome = Column(Text, nullable=True)
    status = Column(String, default="SCHEDULED")  # SCHEDULED, IN_PROGRESS, COMPLETED, CANCELLED

    project = relationship("Project", back_populates="site_visits")
    assignee = relationship("User", backref=backref("site_visits", cascade="all, delete-orphan"))


class ProjectDelay(Base):
    __tablename__ = "project_delays"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    reason = Column(String, nullable=False)
    severity = Column(String, nullable=False)  # LOW, MEDIUM, HIGH
    detected_at = Column(DateTime, default=datetime.datetime.utcnow)
    resolved_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="delays")


class CommunicationLog(Base):
    __tablename__ = "communication_logs"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    type = Column(String, nullable=False)  # CALL, EMAIL, WHATSAPP, MEETING
    notes = Column(Text, nullable=False)
    created_by = Column(String, nullable=False)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="comms_logs")


class ProjectDocument(Base):
    __tablename__ = "project_documents"
    id = Column(String, primary_key=True, default=gen_uuid)
    project_id = Column(String, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False)  # QUOTATION, INVOICE, FLOOR_PLAN, SITE_REPORT, COMPLETION_CERTIFICATE
    url = Column(String, nullable=False)
    version = Column(Integer, default=1)

    project = relationship("Project", back_populates="documents")
