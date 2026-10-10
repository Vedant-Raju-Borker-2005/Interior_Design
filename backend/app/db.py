import logging
import os
import time
from sqlalchemy import create_engine, event, exc
from sqlalchemy.orm import sessionmaker, Session
from .models import Base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./interior_ai.db")

# Supabase sits far enough away that one round trip costs well over a tenth of a
# second, so a connection is only tested when it has actually been sitting idle.
PING_AFTER_IDLE_SECONDS = 60.0

if "sqlite" in DATABASE_URL:
    engine = create_engine(
        DATABASE_URL, connect_args={"check_same_thread": False, "timeout": 30})
else:
    # A hosted Postgres (Supabase) drops idle connections: replace each one every
    # few minutes, and keep the TCP link alive in between.
    engine = create_engine(
        DATABASE_URL,
        pool_recycle=280,
        connect_args={"keepalives": 1, "keepalives_idle": 30, "keepalives_interval": 10,
                      "keepalives_count": 5, "connect_timeout": 15},
    )

    @event.listens_for(engine, "checkin")
    def _note_idle_since(dbapi_connection, connection_record):
        connection_record.info["idle_since"] = time.monotonic()

    @event.listens_for(engine, "checkout")
    def _ping_if_idle(dbapi_connection, connection_record, connection_proxy):
        """Pre-ping, but only for a connection that has been idle long enough to
        have been dropped. A busy request reuses a warm connection untested and
        saves itself a round trip."""
        idle_since = connection_record.info.get("idle_since")
        if idle_since is not None and time.monotonic() - idle_since < PING_AFTER_IDLE_SECONDS:
            return
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("SELECT 1")
            cursor.close()
        except Exception:
            # Tells the pool to throw this connection away and hand out a fresh one.
            raise exc.DisconnectionError()

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _missing_tables() -> set[str]:
    """Mapped tables that the database does not have yet.

    create_all(checkfirst=True) asks the server about each table in turn, which
    is 60-odd round trips. Against a database in another region that is most of
    the time a cold start spends before it can answer anything, and on a
    deployment where the schema is already there it buys nothing. One listing
    answers the same question."""
    from sqlalchemy import inspect
    try:
        present = set(inspect(engine).get_table_names())
    except Exception:
        return set(Base.metadata.tables)      # cannot tell: let create_all decide
    return set(Base.metadata.tables) - present


# Columns added after a table first shipped. create_all() creates tables but
# never alters one that already exists, so a deployed database keeps the shape
# it was created with until something widens it. Checked in one catalogue query
# and applied only where a column is genuinely absent.
LATER_COLUMNS: tuple[tuple[str, str, str], ...] = (
    ("typologies", "bhk_type", "VARCHAR"),
    ("typologies", "image_url", "VARCHAR"),
    ("typologies", "description", "VARCHAR"),
    ("typologies", "plan_cache", "JSON"),
    ("projects", "typology_id", "VARCHAR"),
)


def _add_later_columns():
    """Bring an existing database up to the columns the models expect.

    Works on both backends: SQLAlchemy's inspector reads the live columns, and
    both Postgres and SQLite accept a plain ADD COLUMN for a nullable column.
    """
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    live = set(insp.get_table_names())
    for table in sorted({t for t, _, _ in LATER_COLUMNS}):
        if table not in live:
            continue                             # create_all will make it whole
        have = {c["name"] for c in insp.get_columns(table)}
        absent = [(c, t) for tbl, c, t in LATER_COLUMNS if tbl == table and c not in have]
        if not absent:
            continue
        with engine.begin() as conn:
            for column, sqltype in absent:
                conn.execute(text(f'ALTER TABLE {table} ADD COLUMN "{column}" {sqltype}'))
                logging.getLogger(__name__).info("added %s.%s", table, column)

    # A catalogue layout belongs to no project, so this can no longer be
    # required.
    if "postgres" in DATABASE_URL and "typologies" in live:
        try:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE typologies ALTER COLUMN project_id DROP NOT NULL"))
        except Exception:
            pass
    elif "sqlite" in DATABASE_URL and "typologies" in live:
        try:
            with engine.begin() as conn:
                info = conn.exec_driver_sql("PRAGMA table_info(typologies)").fetchall()
                proj_col = next((c for c in info if c[1] == "project_id"), None)
                if proj_col and proj_col[3] == 1:
                    conn.exec_driver_sql("""
                        CREATE TABLE typologies_migration_tmp (
                            id VARCHAR PRIMARY KEY,
                            project_id VARCHAR,
                            name VARCHAR NOT NULL,
                            carpet_area_sqft FLOAT,
                            floor_plan_id VARCHAR,
                            created_at DATETIME,
                            bhk_type VARCHAR,
                            image_url VARCHAR,
                            description VARCHAR,
                            plan_cache JSON,
                            FOREIGN KEY(project_id) REFERENCES projects (id) ON DELETE CASCADE,
                            FOREIGN KEY(floor_plan_id) REFERENCES floor_plans (id) ON DELETE SET NULL
                        )
                    """)
                    conn.exec_driver_sql("INSERT INTO typologies_migration_tmp SELECT id, project_id, name, carpet_area_sqft, floor_plan_id, created_at, bhk_type, image_url, description, plan_cache FROM typologies")
                    conn.exec_driver_sql("DROP TABLE typologies")
                    conn.exec_driver_sql("ALTER TABLE typologies_migration_tmp RENAME TO typologies")
        except Exception:
            pass



def init_db():
    missing = _missing_tables()
    if missing:
        Base.metadata.create_all(bind=engine)
    _add_later_columns()
    if "sqlite" in DATABASE_URL:
        import sqlite3
        db_path = DATABASE_URL.replace("sqlite:///", "")
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path, timeout=30)
                cursor = conn.cursor()
                # Enable WAL mode: readers never block writers and vice-versa.
                cursor.execute("PRAGMA journal_mode=WAL")
                cursor.execute("PRAGMA busy_timeout=30000")
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
                if "interior_material_preference" not in proj_cols:
                    cursor.execute("ALTER TABLE projects ADD COLUMN interior_material_preference VARCHAR")
                if "fabric_preference" not in proj_cols:
                    cursor.execute("ALTER TABLE projects ADD COLUMN fabric_preference VARCHAR")
                if "parent_project_id" not in proj_cols:
                    cursor.execute("ALTER TABLE projects ADD COLUMN parent_project_id VARCHAR")
                if "earliest_start_date" not in proj_cols:
                    cursor.execute("ALTER TABLE projects ADD COLUMN earliest_start_date VARCHAR")
                if "defaults" not in proj_cols:
                    cursor.execute("ALTER TABLE projects ADD COLUMN defaults TEXT DEFAULT '{}'")
                if "total_units" not in proj_cols:
                    cursor.execute("ALTER TABLE projects ADD COLUMN total_units INTEGER DEFAULT 0")
                if "flat_id" not in proj_cols:
                    cursor.execute("ALTER TABLE projects ADD COLUMN flat_id VARCHAR")
                if "locality" not in proj_cols:
                    cursor.execute("ALTER TABLE projects ADD COLUMN locality VARCHAR")
                if "timeline" not in proj_cols:
                    cursor.execute("ALTER TABLE projects ADD COLUMN timeline VARCHAR")



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

                # Migrate users table to add role & status columns if missing
                cursor.execute("PRAGMA table_info(users)")
                user_columns = [row[1] for row in cursor.fetchall()]
                if "role" not in user_columns:
                    cursor.execute("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'customer'")
                if "status" not in user_columns:
                    cursor.execute("ALTER TABLE users ADD COLUMN status VARCHAR DEFAULT 'active'")

                # ── Stakeholder-feedback columns ──────────────────────────────
                # SQLite cannot add these through create_all() once the table
                # exists, so every new column is declared here as well.
                def add_cols(table, cols):
                    cursor.execute(f"PRAGMA table_info({table})")
                    existing = [row[1] for row in cursor.fetchall()]
                    if not existing:
                        return  # table not created yet; create_all will handle it
                    for name, ddl in cols.items():
                        if name not in existing:
                            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}")

                add_cols("users", {           # 1.3 GST & billing
                    "gst_number": "VARCHAR",
                    "company_name": "VARCHAR",
                    "pan_number": "VARCHAR",
                    "billing_address": "TEXT",
                    "billing_city": "VARCHAR",
                    "billing_pincode": "VARCHAR",
                    "billing_state": "VARCHAR",
                })
                add_cols("projects", {        # 4.2-4.5 approval + allocation, 2.1-2.3 B2B, 1.8 credits
                    "approval_status": "VARCHAR DEFAULT 'PENDING'",
                    "approved_by": "VARCHAR",
                    "approved_at": "DATETIME",
                    "rejection_reason": "TEXT",
                    "allocated_vendor_id": "VARCHAR",
                    "allocated_at": "DATETIME",
                    "allocated_by": "VARCHAR",
                    "discount_type": "VARCHAR",
                    "discount_value": "FLOAT DEFAULT 0",
                    "original_unit_price": "FLOAT DEFAULT 0",
                    "discount_note": "VARCHAR",
                    "premium_render_credits": "INTEGER DEFAULT 0",
                    "style_tags": "TEXT DEFAULT '[]'",
                    "plan_layout": "TEXT",
                })
                add_cols("quotations", {      # 1.3, 1.4, 1.9, 1.10, 2.2
                    "quotation_no": "VARCHAR",
                    "gst_number": "VARCHAR",
                    "billing_snapshot": "TEXT DEFAULT '{}'",
                    "original_total": "FLOAT DEFAULT 0",
                    "discount_amount": "FLOAT DEFAULT 0",
                    "paid_at": "DATETIME",
                    "paid_by": "VARCHAR",
                    "payment_mode": "VARCHAR",
                    "payment_reference": "VARCHAR",
                    "converted_project_id": "VARCHAR",
                    "converted_at": "DATETIME",
                })
                add_cols("renders", {         # 1.7/1.8 free vs premium
                    "tier": "VARCHAR DEFAULT 'free'",
                    "batch_id": "VARCHAR",
                })
                add_cols("payments", {        # 1.11 full-payment model
                    "payment_type": "VARCHAR DEFAULT 'FULL'",
                    "quotation_id": "VARCHAR",
                    "payment_mode": "VARCHAR",
                    "recorded_by": "VARCHAR",
                    "notes": "TEXT",
                })
                for _t in ("products", "vendor_products"):   # 4.1 availability
                    add_cols(_t, {
                        "is_available": "BOOLEAN DEFAULT 1",
                        "unavailable_reason": "VARCHAR",
                        "availability_updated_at": "DATETIME",
                    })
                add_cols("room_items", {      # every variant option the customer picked
                    "custom_attributes": "TEXT",
                })
                add_cols("item_trackings", {  # 3.1-3.5 split statuses
                    "vendor_status": "VARCHAR DEFAULT 'ORDERED'",
                    "technician_status": "VARCHAR DEFAULT 'NOT_RECEIVED'",
                    "vendor_updated_at": "DATETIME",
                    "technician_updated_at": "DATETIME",
                    "product_id": "VARCHAR",
                    "technician_id": "VARCHAR",
                    "handover_at": "DATETIME",
                    "installed_at": "DATETIME",
                    "photos": "TEXT DEFAULT '[]'",
                })

                # Backfill: projects that existed before the approval queue was
                # introduced are already live work — they must not be frozen
                # behind a PENDING gate. Only new projects enter the queue.
                cursor.execute(
                    "UPDATE projects SET approval_status='APPROVED' "
                    "WHERE approval_status IS NULL OR "
                    "(approval_status='PENDING' AND status NOT IN ('draft',''))"
                )
                # Backfill: give pre-existing quotations a readable number.
                cursor.execute(
                    "SELECT id FROM quotations WHERE quotation_no IS NULL OR quotation_no=''"
                )
                legacy = [r[0] for r in cursor.fetchall()]
                # Continue after numbers handed out on earlier starts, so they never repeat.
                cursor.execute("SELECT quotation_no FROM quotations WHERE quotation_no LIKE 'QT-LEGACY-%'")
                used = [int(n.rsplit("-", 1)[1]) for (n,) in cursor.fetchall() if n.rsplit("-", 1)[1].isdigit()]
                for i, qid in enumerate(legacy, start=max(used, default=0) + 1):
                    cursor.execute(
                        "UPDATE quotations SET quotation_no=? WHERE id=?",
                        (f"QT-LEGACY-{i:05d}", qid),
                    )
                # Backfill: mirror the old combined status onto the vendor track
                # so existing tracking rows keep showing the right stage.
                cursor.execute(
                    "UPDATE item_trackings SET vendor_status=UPPER(status) "
                    "WHERE (vendor_status IS NULL OR vendor_status='ORDERED') "
                    "AND status IS NOT NULL AND status<>''"
                )
                cursor.execute(
                    "UPDATE item_trackings SET technician_status='INSTALLED', "
                    "vendor_status='DELIVERED' WHERE LOWER(status)='installed'"
                )

                # Catalog images were re-encoded from 6-10 MB PNG/JPEG to WebP
                # (feedback 1.6: product images failing to load). Point stored
                # URLs at the new files — but only where the .webp really exists,
                # so a vendor's own later upload is never rewritten to a 404.
                _migrate_catalog_image_urls(cursor)

                # BHK is keyed as '3BHK' by packages and room templates; rows
                # written as '3 BHK' could not find their packages.
                for _table in ("projects", "flats"):
                    cursor.execute(f"PRAGMA table_info({_table})")
                    if "bhk_type" in [row[1] for row in cursor.fetchall()]:
                        cursor.execute(
                            f"UPDATE {_table} SET bhk_type = REPLACE(UPPER(bhk_type), ' ', '') "
                            f"WHERE bhk_type LIKE '% %'"
                        )

                conn.commit()
            except Exception as e:
                print(f"Database auto-migration failed: {e}")
            finally:
                try:
                    conn.close()
                except Exception:
                    pass


def _migrate_catalog_image_urls(cursor):
    import re
    from pathlib import Path

    catalog = Path(__file__).resolve().parents[1] / "assets" / "catalog"
    pattern = re.compile(r"(/static/assets/catalog/)([^\"'\s]+?)\.(png|jpe?g)\b", re.IGNORECASE)

    def rewrite(text):
        if not text or "/static/assets/catalog/" not in text:
            return text

        def swap(m):
            from urllib.parse import unquote
            stem = m.group(2)
            if (catalog / (unquote(stem) + ".webp")).exists():
                return f"{m.group(1)}{stem}.webp"
            return m.group(0)

        return pattern.sub(swap, text)

    targets = [
        ("products", "thumbnail_url"), ("products", "images"),
        ("vendor_products", "images"),
        ("packages", "thumbnail_url"), ("packages", "images"),
    ]
    for table, column in targets:
        cursor.execute(f"PRAGMA table_info({table})")
        if column not in [row[1] for row in cursor.fetchall()]:
            continue
        cursor.execute(
            f"SELECT id, {column} FROM {table} WHERE {column} LIKE '%/static/assets/catalog/%'"
        )
        for row_id, value in cursor.fetchall():
            updated = rewrite(value)
            if updated != value:
                cursor.execute(f"UPDATE {table} SET {column}=? WHERE id=?", (updated, row_id))


# Image URLs are stored absolute, and the seed data was written on a developer's
# machine, so a deployed copy serves "http://localhost:8000/static/..." to every
# visitor — which is the visitor's own computer, and shows a broken image. This
# repoints them at wherever this backend actually answers, on every start, so a
# fresh deployment heals itself instead of needing the database edited by hand.
STALE_ASSET_HOSTS = ("http://localhost:8000", "http://127.0.0.1:8000",
                     "https://localhost:8000")


def _repoint(value, public: str):
    """Swap a stale host inside a string, list or dict. Returns None if nothing changed."""
    if isinstance(value, str):
        out = value
        for stale in STALE_ASSET_HOSTS:
            out = out.replace(stale, public)
        return out if out != value else None
    if isinstance(value, list):
        swapped = [_repoint(v, public) for v in value]
        return [n if n is not None else v for n, v in zip(swapped, value)]             if any(n is not None for n in swapped) else None
    if isinstance(value, dict):
        swapped = {k: _repoint(v, public) for k, v in value.items()}
        return {k: (swapped[k] if swapped[k] is not None else v) for k, v in value.items()}             if any(n is not None for n in swapped.values()) else None
    return None


def normalise_asset_urls(db) -> int:
    """Point stored image URLs at BACKEND_URL. Does nothing when it is unset or
    still local, so a developer's machine is left exactly as it is.

    No longer called at startup. services/asset_urls.rehost() rewrites the host
    as a response goes out, which gets the same images to the browser without
    rewriting 124 rows on boot and without the stored URL deciding which machine
    can serve them -- writing the deployed host into the database is what used to
    break image loading in local development. Kept for a one-off repair."""
    public = os.getenv("BACKEND_URL", "").rstrip("/")
    if not public or "localhost" in public or "127.0.0.1" in public:
        return 0

    from .models import Package, Product, VendorProduct
    changed = 0
    for model, fields in ((Product, ("thumbnail_url", "images", "variants")),
                          (VendorProduct, ("thumbnail_url", "images", "variants")),
                          (Package, ("thumbnail_url", "images"))):
        for row in db.query(model).all():
            touched = False
            for field in fields:
                if not hasattr(row, field):
                    continue
                fixed = _repoint(getattr(row, field), public)
                if fixed is not None:
                    setattr(row, field, fixed)
                    touched = True
            changed += touched
    if changed:
        db.commit()
    return changed


# Keeping the demo accounts in step costs ~57 queries. That is nothing against a
# local file, but on a hosted database it is seconds, and it used to run on every
# dashboard load. It now runs at startup and at most every few minutes after.
_DEMO_SYNC = {"at": 0.0}
DEMO_SYNC_EVERY_SECONDS = 300.0


def sync_demo_data(db, force: bool = False):
    try:
        from .seed_master_data import seed_master_data
        seed_master_data()
    except Exception as e:
        pass
    import time

    now = time.monotonic()
    if not force and _DEMO_SYNC["at"] and now - _DEMO_SYNC["at"] < DEMO_SYNC_EVERY_SECONDS:
        return
    _DEMO_SYNC["at"] = now

    from .models import User, Project, Vendor, ProjectTeamMember, ProjectAssignment, VendorAssignment, Room, Product, RoomItem, Quotation, Flat
    import uuid
    import datetime

    # 1. Ensure test users exist with correct roles
    users_data = [
        {"name": "Seeded Customer", "phone": "+919900004444", "email": "customer@example.com", "role": "customer"},
        {"name": "Seeded Vendor", "phone": "+919900001111", "email": "vendor@example.com", "role": "vendor"},
        {"name": "Seeded Team Member", "phone": "+919900002222", "email": "team@example.com", "role": "team,team_manager,team_coordinator,team_technician"},
        {"name": "Seeded Admin", "phone": "+919900003333", "email": "admin@example.com", "role": "admin"},
        {"name": "Seeded Enterprise", "phone": "+919900005555", "email": "enterprise@example.com", "role": "enterprise"}
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
        else:
            # Ensure team roles are appended if missing
            current_roles = [r.strip() for r in (u.role or "").split(",")]
            target_roles = [r.strip() for r in ud["role"].split(",")]
            merged_roles = list(dict.fromkeys(current_roles + target_roles))
            u.role = ",".join([r for r in merged_roles if r])
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

    all_projects = db.query(Project).all()

    # What follows used to ask the database about each project in turn: its
    # rooms, its items, its quotation, its team member, five round trips a
    # project. That is the whole sync's cost once the demo data is in place, it
    # runs on every boot, and it grew with every project a customer created.
    # The same questions are answered here in four queries for all projects at
    # once, and the loop below reads the answers from memory.
    rooms_by_project: dict[str, list] = {}
    for room in db.query(Room).all():
        rooms_by_project.setdefault(room.project_id, []).append(room)
    rooms_with_items = {rid for (rid,) in db.query(RoomItem.room_id).distinct().all()}
    projects_with_quote = {pid for (pid,) in db.query(Quotation.project_id).distinct().all()}

    _products: list = []

    def products_once() -> list:
        """The catalogue, fetched at most once and only if an item is missing."""
        if not _products:
            _products.extend(db.query(Product).all())
        return _products

    for proj in all_projects:
        # Check if project has rooms
        existing_rooms = rooms_by_project.get(proj.id, [])
        if not existing_rooms:
            r1 = Room(id=f"room-living-{proj.id}", project_id=proj.id, room_type="living_room")
            r2 = Room(id=f"room-master-{proj.id}", project_id=proj.id, room_type="bedroom_master")
            r3 = Room(id=f"room-kitchen-{proj.id}", project_id=proj.id, room_type="kitchen")
            db.add_all([r1, r2, r3])
            db.commit()

            r1, r2, r3 = r1, r2, r3
        else:
            r1, r2, r3 = existing_rooms[0], existing_rooms[1] if len(existing_rooms) > 1 else existing_rooms[0], existing_rooms[2] if len(existing_rooms) > 2 else existing_rooms[0]

        existing_items = [r for r in existing_rooms if r.id in rooms_with_items]
        if not existing_items:
            prods = products_once()
            if prods:
                sofa_prod = next((p for p in prods if "Sofa" in p.name), prods[0])
                bed_prod = next((p for p in prods if "Bed" in p.name), prods[0])
                cab_prod = next((p for p in prods if "Cabinets" in p.name), prods[0])

                items = [
                    RoomItem(id=f"item-sofa-{proj.id[:6]}", room_id=r1.id, product_id=sofa_prod.id, unit_price=sofa_prod.price, qty=1, custom_color="Warm Beige", custom_wood_finish="Teak Laminated"),
                    RoomItem(id=f"item-bed-{proj.id[:6]}", room_id=r2.id, product_id=bed_prod.id, unit_price=bed_prod.price, qty=1, custom_color="Blush Pink", custom_wood_finish="Oak Laminated"),
                    RoomItem(id=f"item-cab-{proj.id[:6]}", room_id=r3.id, product_id=cab_prod.id, unit_price=cab_prod.price, qty=1, custom_color="Royal Navy Blue", custom_wood_finish="Walnut Laminated"),
                ]
                db.add_all(items)
                db.commit()

        # Check if project has quotation
        if proj.id not in projects_with_quote:
            from .services.business_rules import next_quotation_no
            subtotal = 650000.0
            gst = subtotal * 0.18
            demo_quote = Quotation(
                id=f"quote-{proj.id[:6]}",
                quotation_no=next_quotation_no(db),
                project_id=proj.id,
                subtotal=subtotal,
                gst=gst,
                total=subtotal + gst,
                status="APPROVED",
                created_at=datetime.datetime.utcnow()
            )
            db.add(demo_quote)
            db.commit()

    # 4. Auto-assign all existing projects to the team user and the vendor
    team_user = users.get("team")
    roles = ["MANAGER", "COORDINATOR", "TECHNICIAN"]
    # One query for this user's memberships rather than one per project, and the
    # project list from step 3 rather than a second pass over the table.
    member_by_project = {}
    if team_user:
        for m in db.query(ProjectTeamMember).filter(
                ProjectTeamMember.user_id == team_user.id).all():
            member_by_project.setdefault(m.project_id, m)

    # Read what the loop needs as plain values first. A commit expires every
    # object in the session, so reading proj.approval_status after one sends
    # SQLAlchemy back to the server for that row -- once per project, which is
    # where most of this function's round trips were going.
    project_rows = [(p.id, p.approval_status, p.allocated_vendor_id) for p in all_projects]

    for i, (pid, approval_status, allocated_vendor_id) in enumerate(project_rows):
        # Assign to Team User
        if team_user:
            role = roles[i % len(roles)]
            member = member_by_project.get(pid)
            if not member:
                member = ProjectTeamMember(
                    id=str(uuid.uuid4()),
                    project_id=pid,
                    user_id=team_user.id,
                    role=role,
                    status="ACTIVE"
                )
                db.add(member)
                # Also add project assignment
                assignment = ProjectAssignment(
                    id=str(uuid.uuid4()),
                    project_id=pid,
                    assignee_id=team_user.id,
                    assigned_by_id=team_user.id,
                    role=role
                )
                db.add(assignment)
                db.commit()
            elif member.role != role:
                member.role = role
                db.commit()

        # Sync assignments per RoomItem. Its own first check is this one, made
        # against a project it re-reads; we are holding the project already, so
        # an unapproved or unallocated one costs nothing instead of a round trip.
        if approval_status == "APPROVED" and allocated_vendor_id:
            sync_project_vendor_assignments(pid, db)


def sync_project_vendor_assignments(project_id: str, db: Session, project=None):
    from .models import Room, RoomItem, VendorAssignment, Product, Vendor, Project
    import uuid

    # Stakeholder feedback 4.2/4.4/4.5 — there is no straight-through flow.
    # A supplier receives a project's items only after an admin has approved
    # the project AND allocated it to that supplier. Until then this is a no-op,
    # whichever path calls it (quotation, vendor dashboard, demo sync).
    # A caller that already holds the project passes it in rather than making us
    # read it again; the demo sync calls this once per project, so on a hosted
    # database those were twenty-odd needless round trips every boot.
    if project is None:
        project = db.query(Project).filter(Project.id == project_id).first()
    if not project or project.approval_status != "APPROVED" or not project.allocated_vendor_id:
        return
    allocated = db.query(Vendor).filter(Vendor.id == project.allocated_vendor_id).first()
    if not allocated:
        return
    active_vendors = [allocated]

    rooms = db.query(Room).filter(Room.project_id == project_id).all()
    for room in rooms:
        items = db.query(RoomItem).filter(RoomItem.room_id == room.id).all()
        for item in items:
            product = db.query(Product).filter(Product.id == item.product_id).first()
            if not product:
                continue

            # The whole order goes to the supplier the admin allocated.
            target_vendors = active_vendors

            for vendor in target_vendors:
                # Verify if VendorAssignment already exists for this RoomItem and Vendor
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
