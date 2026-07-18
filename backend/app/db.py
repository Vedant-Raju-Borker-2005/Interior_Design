import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from .models import Base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./interior_ai.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)
    if "sqlite" in DATABASE_URL:
        import sqlite3
        db_path = DATABASE_URL.replace("sqlite:///", "")
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("PRAGMA table_info(vendors)")
                columns = [row[1] for row in cursor.fetchall()]
                new_cols = {
                    "user_id": "VARCHAR",
                    "business_name": "VARCHAR",
                    "owner_name": "VARCHAR",
                    "email": "VARCHAR",
                    "pan_no": "VARCHAR",
                    "warehouse_address": "VARCHAR",
                    "status": "VARCHAR DEFAULT 'SUBMITTED'",
                    "rejection_reason": "TEXT",
                    "approved_by": "VARCHAR",
                    "approved_at": "VARCHAR"
                }
                for col_name, col_type in new_cols.items():
                    if col_name not in columns:
                        cursor.execute(f"ALTER TABLE vendors ADD COLUMN {col_name} {col_type}")
                
                # Migrate products table
                cursor.execute("PRAGMA table_info(products)")
                prod_cols = [row[1] for row in cursor.fetchall()]
                new_prod_cols = {
                    "primary_material": "VARCHAR DEFAULT 'Solid Wood'",
                    "width": "FLOAT DEFAULT 1200.0",
                    "height": "FLOAT DEFAULT 750.0",
                    "depth": "FLOAT DEFAULT 600.0",
                    "weight": "FLOAT DEFAULT 15.0",
                    "weight_capacity": "FLOAT DEFAULT 120.0",
                    "style": "VARCHAR DEFAULT 'Modern'",
                    "finish": "VARCHAR DEFAULT 'Matte'",
                    "mounting_type": "VARCHAR DEFAULT 'Floor Standing'",
                    "assembly_required": "VARCHAR DEFAULT 'No'",
                    "suitable_room": "VARCHAR DEFAULT 'Living Room'",
                    "description": "TEXT DEFAULT NULL"
                }
                for col_name, col_type in new_prod_cols.items():
                    if col_name not in prod_cols:
                        cursor.execute(f"ALTER TABLE products ADD COLUMN {col_name} {col_type}")

                # Migrate vendor_products table
                cursor.execute("PRAGMA table_info(vendor_products)")
                vprod_cols = [row[1] for row in cursor.fetchall()]
                for col_name, col_type in new_prod_cols.items():
                    if col_name not in vprod_cols:
                        cursor.execute(f"ALTER TABLE vendor_products ADD COLUMN {col_name} {col_type}")

                # Migrate projects table
                cursor.execute("PRAGMA table_info(projects)")
                proj_cols = [row[1] for row in cursor.fetchall()]
                if "color_preferences" not in proj_cols:
                    cursor.execute("ALTER TABLE projects ADD COLUMN color_preferences TEXT DEFAULT '[]'")

                # Migrate project_photos table to add category column if missing
                cursor.execute("PRAGMA table_info(project_photos)")
                photo_columns = [row[1] for row in cursor.fetchall()]
                if "category" not in photo_columns:
                    cursor.execute("ALTER TABLE project_photos ADD COLUMN category VARCHAR")
                
                # Check support_tickets project_id column nullability
                cursor.execute("PRAGMA table_info(support_tickets)")
                ticket_cols = cursor.fetchall()
                dropped = False
                for col in ticket_cols:
                    # col structure: (cid, name, type, notnull, dflt_value, pk)
                    if col[1] == "project_id" and col[3] == 1:
                        cursor.execute("DROP TABLE support_tickets")
                        dropped = True
                        break
                
                if dropped:
                    conn.commit()
                    # Recreate via metadata
                    Base.metadata.create_all(bind=engine)
                else:
                    # Add user_id column if missing
                    cursor.execute("PRAGMA table_info(support_tickets)")
                    ticket_columns = [row[1] for row in cursor.fetchall()]
                    if ticket_columns and "user_id" not in ticket_columns:
                        cursor.execute("ALTER TABLE support_tickets ADD COLUMN user_id VARCHAR")

                # Migrate users table to add role column if missing
                cursor.execute("PRAGMA table_info(users)")
                user_columns = [row[1] for row in cursor.fetchall()]
                if "role" not in user_columns:
                    cursor.execute("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'customer'")

                conn.commit()
                conn.close()
            except Exception as e:
                print(f"Database auto-migration failed: {e}")


def sync_demo_data(db):
    from .models import User, Project, Vendor, ProjectTeamMember, ProjectAssignment, VendorAssignment, Room
    import uuid
    import datetime

    # 1. Ensure test users exist with correct roles
    users_data = [
        {"name": "Seeded Customer", "phone": "+919900004444", "email": "customer@example.com", "role": "customer"},
        {"name": "Seeded Vendor", "phone": "+919900001111", "email": "vendor@example.com", "role": "vendor"},
        {"name": "Seeded Team Member", "phone": "+919900002222", "email": "team@example.com", "role": "team"},
        {"name": "Seeded Admin", "phone": "+919900003333", "email": "admin@example.com", "role": "admin"}
    ]

    users = {}
    for ud in users_data:
        u = db.query(User).filter(User.phone == ud["phone"]).first()
        if not u:
            u = User(
                id=str(uuid.uuid4()),
                name=ud["name"],
                phone=ud["phone"],
                email=ud["email"],
                role=ud["role"],
                city="Bangalore"
            )
            db.add(u)
            db.commit()
            db.refresh(u)
        elif u.role != ud["role"]:
            u.role = ud["role"]
            db.commit()
        users[ud["role"]] = u

    # 2. Ensure Vendor record exists and is linked to the vendor user
    vendor_user = users.get("vendor")
    vendor = None
    if vendor_user:
        vendor = db.query(Vendor).filter(Vendor.user_id == vendor_user.id).first()
        if not vendor:
            # Let's see if there is an unlinked vendor record
            unlinked_vendor = db.query(Vendor).filter(Vendor.user_id.is_(None)).first()
            if unlinked_vendor:
                unlinked_vendor.user_id = vendor_user.id
                unlinked_vendor.status = "APPROVED"
                vendor = unlinked_vendor
                db.commit()
            else:
                # Create a new vendor record
                vendor = Vendor(
                    id=str(uuid.uuid4()),
                    user_id=vendor_user.id,
                    name=vendor_user.name,
                    phone=vendor_user.phone,
                    email=vendor_user.email,
                    gst_no="29AABCS1429B1Z1",
                    categories=["Carpentry", "Modular Furniture"],
                    rating=4.7,
                    active=True,
                    serviceable_pincodes=["560001", "560002", "560078", "560100"],
                    business_name="HomeCraft Carpentry Pvt Ltd",
                    owner_name=vendor_user.name,
                    status="APPROVED"
                )
                db.add(vendor)
                db.commit()
                db.refresh(vendor)
        elif vendor.status != "APPROVED":
            vendor.status = "APPROVED"
            db.commit()

    # 3. Auto-assign all existing projects to the team user and the vendor
    team_user = users.get("team")
    all_projects = db.query(Project).all()
    roles = ["MANAGER", "COORDINATOR", "TECHNICIAN"]
    for i, proj in enumerate(all_projects):
        # Assign to Team User
        if team_user:
            role = roles[i % len(roles)]
            member = db.query(ProjectTeamMember).filter(
                ProjectTeamMember.project_id == proj.id,
                ProjectTeamMember.user_id == team_user.id
            ).first()
            if not member:
                member = ProjectTeamMember(
                    id=str(uuid.uuid4()),
                    project_id=proj.id,
                    user_id=team_user.id,
                    role=role,
                    status="ACTIVE"
                )
                db.add(member)
                # Also add project assignment
                assignment = ProjectAssignment(
                    id=str(uuid.uuid4()),
                    project_id=proj.id,
                    assignee_id=team_user.id,
                    assigned_by_id=team_user.id,
                    role=role
                )
                db.add(assignment)
                db.commit()
            elif member.role != role:
                member.role = role
                db.commit()

        # Sync assignments per RoomItem
        sync_project_vendor_assignments(proj.id, db)


def sync_project_vendor_assignments(project_id: str, db: Session):
    from .models import Room, RoomItem, VendorAssignment, Product, Vendor
    import uuid

    rooms = db.query(Room).filter(Room.project_id == project_id).all()
    for room in rooms:
        items = db.query(RoomItem).filter(RoomItem.room_id == room.id).all()
        for item in items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if not product or not product.vendor_id:
                continue

            vendor = db.query(Vendor).filter(Vendor.id == product.vendor_id).first()
            if not vendor:
                continue

            # Verify if VendorAssignment already exists for this RoomItem
            va = db.query(VendorAssignment).filter(
                VendorAssignment.project_id == project_id,
                VendorAssignment.vendor_id == vendor.id,
                VendorAssignment.item_id == item.id
            ).first()

            if not va:
                milestones = {
                    "po_approved": "paid" if item.unit_price and item.unit_price > 0 else "pending",
                    "design_approved": "pending",
                    "manufacturing_started": "pending",
                    "material_delivered": "pending",
                    "installation_complete": "pending"
                }
                va = VendorAssignment(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    vendor_id=vendor.id,
                    item_id=item.id,
                    status="RECEIVED_ORDER",
                    remarks=f"Fulfillment started for {product.name}",
                    milestones_status=milestones,
                    shipment_status="Pending"
                )
                db.add(va)
                db.commit()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
