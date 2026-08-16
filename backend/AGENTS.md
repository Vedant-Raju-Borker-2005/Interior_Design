# Backend Architecture & Conventions — InteriorAI

The backend is built with Python 3.10+, using FastAPI, SQLAlchemy, and SQLite.

## Code Structure

* [`app/main.py`](file:///d:/MyFiles/Interior_Design/backend/app/main.py): Entry point, mounts static directories and boots routers.
* [`app/models.py`](file:///d:/MyFiles/Interior_Design/backend/app/models.py): Declarative SQLite schema models via SQLAlchemy. Key models: `User`, `Project`, `Room`, `RoomItem`, `Product`, `Package`, `Flat`, `AuditLog`.
* [`app/schemas.py`](file:///d:/MyFiles/Interior_Design/backend/app/schemas.py): Pydantic input/output schemas for API request and response validation.
* [`app/db.py`](file:///d:/MyFiles/Interior_Design/backend/app/db.py): Database engine, session setup, and `sync_demo_data()` seeder (includes enterprise demo user).
* [`app/routers`](file:///d:/MyFiles/Interior_Design/backend/app/routers): Routing definitions:
  * `auth.py` — OTP-based login/signup for customer, vendor, enterprise, and admin roles.
  * `projects.py` — Project CRUD, room generation, BHK mappings, and room-item management.
  * `catalog.py` — Product catalog search with room-type normalization and budget-aware scoring.
  * `enterprise.py` — Enterprise project creation, unit mix, flat assignments, and invitation tokens.
  * `ai.py`, `quotations.py`, `notifications.py`, `vendors.py`, etc.
* [`app/services`](file:///d:/MyFiles/Interior_Design/backend/app/services): Modular services including AI rendering engines, PDF generation, and project workflows.

---

## Core Database Contracts

### SQLite Schema (`interior_ai.db`)
* **Project**: Tracks project preferences (`interior_material_preference`, `fabric_preference`, `color_preferences`, `bhk_type`, `property_name`, `budget`, `created_at`). `created_at` is always stored and used for "Recent Activity" display in Enterprise Dashboard.
* **Package**: Pre-defined price tiers (`basic`, `premium`, `luxury`) containing `base_price` and `style_tags`.
* **Room & RoomItem**: Room-level modular configurations. Each `RoomItem` references a catalog `Product` and stores customizations (`custom_color`, `custom_fabric`, `custom_wood_finish`, etc.).
* **Flat**: Enterprise-level unit record linked to a parent `Project`. Tracks allocation status and invited customer references.

### Image Storage
* All product thumbnails and materials are stored in `backend/pdfs/catalog` and exposed via FastAPI's `StaticFiles` mapping at `/static/pdfs/catalog/`.

---

## API Guidelines

* **Project Summaries**:
  * The `_project_summary(p: Project)` function in `app/routers/projects.py` MUST serialize the associated `package` details (`id`, `name`, `base_price`, `tier`) if selected, to enable live cost-tracking calculations on the client.
  * Must also include `created_at` timestamp for dashboard "Recent Activity" tracking.
* **Database Operations**:
  * Commit transactions explicitly inside routers using `db.commit()`.
  * Create folder structures (like `pdfs/floor_plans`) programmatically if they do not exist.
* **Catalog Query Normalization & Recommendation Logic (Phase 9)**:
  * Custom room types (bedroom 3–5, bathroom 2–4, balcony) resolve to database-base room categories (`bedroom_2`, `bathroom`, `living_room`) when querying catalog products.
  * Products are not hard-filtered out on mismatch; instead, the backend calculates and returns matching status flags (`is_color_match`, `is_material_match`, `is_fabric_match`, `is_price_match`) in the serialized response.
  * Catalog items are sorted combined by matching rank (Perfect Match first, then exceeding budget, then mismatched material, color, etc.) and vendor serviceable tier (local first, then nearby, then national).
* **BHK Room Mappings (Phase 9)**:
  * `BHK_ROOMS` in `projects.py` defines exact room distributions:
    * 1 BHK: `living_room`, `bedroom_master`, `kitchen`, `bathroom`, `balcony`
    * 2–5 BHK: `living_room`, `bedroom_master`, `bedroom_2`–`bedroom_5`, `kitchen`, `bathroom`–`bathroom_4`, `balcony`
* **Enterprise Router (Phase 5+)**:
  * Mounted at `/api/v1/enterprise`. Handles project creation with unit mix generation, floor plan associations, flat assignment, and secure invitation token validation.
  * Seeded enterprise demo user: `phone="+919900005555"`, `email="enterprise@example.com"`, `role="enterprise"`.

