# Backend Architecture & Conventions — InteriorAI

The backend is built with Python 3.10+, FastAPI, SQLAlchemy ORM, and SQLite database (`interior_ai.db`).

---

## Code Structure

* [`app/main.py`](file:///d:/MyFiles/Interior_Design/backend/app/main.py): Entry point, mounts CORS middleware, mounts `/static/assets` static directories, executes database initialization and seeding on startup, and boots all 14 API routers.
* [`app/models.py`](file:///d:/MyFiles/Interior_Design/backend/app/models.py): Declarative SQLite schema models via SQLAlchemy (880 lines).
* [`app/schemas.py`](file:///d:/MyFiles/Interior_Design/backend/app/schemas.py): Pydantic input/output schemas for API request and response serialization and validation.
* [`app/db.py`](file:///d:/MyFiles/Interior_Design/backend/app/db.py): Database engine, session setup, and `sync_demo_data()` seeder (includes pre-registered demo accounts for customer, vendor, enterprise, site team, and admin roles).
* [`app/auth_utils.py`](file:///d:/MyFiles/Interior_Design/backend/app/auth_utils.py): JWT token issuance, password hashing (`passlib`/`bcrypt`), and `current_user` dependency.
* [`app/seed_data.py`](file:///d:/MyFiles/Interior_Design/backend/app/seed_data.py) & [`app/seed_catalog_images.py`](file:///d:/MyFiles/Interior_Design/backend/app/seed_catalog_images.py): Product catalog seeding, design package initialization, and multi-view catalog image mapping.

---

## API Router Directory (`app/routers`)

1. **`auth.py`** (`/api/v1/auth`): OTP-based authentication, user registration, role detection (`customer`, `vendor`, `enterprise`, `admin`), and fallback credential generation to prevent `UNIQUE constraint` errors.
2. **`projects.py`** (`/api/v1/projects`): Project CRUD, room generation via `BHK_ROOMS`, room item customization, room deletion, and floor plan PDF presentation export (`download_floor_plan_pdf`).
3. **`catalog.py`** (`/api/v1/catalog`): Product catalog search with custom room category normalization, budget-aware scoring, matching flags (`is_color_match`, `is_material_match`, `is_fabric_match`, `is_price_match`), master color family explorer, and interior material list.
4. **`ai_render.py`** (`/api/v1/ai`): AI render generation trigger compiling prompts from project style, wood finish, fabric, colors, and 4-wall dimensions; status polling.
5. **`quotations.py`** (`/api/v1/quotations`): Dynamic quotation generation, line item serialization, GST calculation, auto-regeneration when previous quote was revised/rejected, and PDF file generation via `pdf_service.py`.
6. **`vendors.py`** (`/api/v1/vendors`): Legacy vendor listing, pincode serviceability check, and vendor detail endpoints.
7. **`vendor_routes.py`** (`/api/v1/vendor`): Vendor portal API for profile submission, GST/PAN document uploads, product inventory management with 3-view image uploads, assignment acceptance, shipping tracking (courier, vehicle details, AWB), proof photo uploads, vendor issues aggregation, and payout tracking.
8. **`enterprise.py`** (`/api/v1/enterprise`): Enterprise B2B2C API for parent project creation, unit mix generation (1BHK-5BHK), flat assignments, invitation token generation (`/invite`), and flat status tracking.
9. **`project_team.py`** (`/api/v1/team` & `/api`): Operations console for Site Managers, Coordinators, and Technicians. Endpoints for role-scoped projects listing (`/team/projects`), team directory (`/team/directory`), multi-role KPI metrics (`/team/dashboard`), direct multipart photo proof uploads (`POST /projects/{project_id}/photos`), member assignments with permission checks, task management, daily checklists, site visits, comms logs, document uploads, delay SLA reporting, and progress history.
10. **`admin.py`** (`/api/v1/admin`): Administrative portal API for user CRM (`/admin/customers`), vendor onboarding approvals/rejections (`/admin/vendors`), team onboarding approvals (`/admin/team-approvals`), project control center (`/admin/projects`), master catalog CRUD & CSV import/export (`/admin/master-data`), operational CSV reports streaming (`/admin/reports`), quote audit logs (`QuoteAudit`), package configuration tuning (`PackageConfiguration`), pricing rules engine (`PricingRule`), system settings (`SystemSetting`), and administrative audit trail logs (`AuditLog`).
11. **`customer_routes.py`** (`/api/v1/customer`): Customer tracking bar updates, delivery and installation verification confirmations.
12. **`tracking.py`** (`/api/v1/tracking`): Real-time item tracking logs and milestone status updates.
13. **`recommendations.py`** (`/api/v1/recommendations`): AI-ranked package and product recommendations based on style compatibility matrices.
14. **`inquiry.py`** (`/api/v1/inquiry`): General web and consultation inquiry submissions.

---

## Core Services (`app/services`)

* [`app/services/pdf_service.py`](file:///d:/MyFiles/Interior_Design/backend/app/services/pdf_service.py): Generates bank-compliant PDF quotes using ReportLab with detailed line item tables, GST breakdown, terms & conditions, and branding headers.
* [`app/services/render_mock.py`](file:///d:/MyFiles/Interior_Design/backend/app/services/render_mock.py): Gemini AI / Imagen 3 / ControlNet rendering pipeline mock for photorealistic 3D room renders.

---

## Database Models Summary (`app/models.py`)

* **User**: Customer, Vendor, Enterprise, Admin, and Site Team profiles.
* **Project**: Core project model supporting parent-child hierarchy (`parent_project_id`), BHK type, budget, preferences (wood laminate, fabric, colors), and status.
* **Flat**: Enterprise unit record linked to parent project, invited customer, and assigned floor plan.
* **Package**: Base tier packages (`basic`, `premium`, `luxury`).
* **Room & RoomItem**: Room configuration and customized product selections (`custom_color`, `custom_wood_finish`, `custom_fabric`, `custom_size`).
* **Product & VendorProduct**: Catalog product models with multi-view image arrays, dimensions, primary material, style tags, and variants.
* **Quotation & QuotationRevision**: Financial quotes with GST calculations and audit revision history.
* **Vendor, VendorDocument, VendorAssignment, VendorPayout**: Complete vendor lifecycle models including document approvals, project item assignments, shipping details, and payouts.
* **ProjectTeamMember, Task, DailyChecklist, SiteVisit, ProjectDelay, CommunicationLog, ProjectDocument**: Site execution and operations models.
* **AdminRole, QuoteAudit, PackageConfiguration, PricingRule, SystemSetting, AuditLog**: Administrative governance and platform settings models.

---

## Technical Guidelines & API Conventions

* **Quotation Approval Vendor Syncing**:
  * `update_quotation_status` (`customer_routes.py`) calls `sync_project_vendor_assignments(project.id, db)` directly when quotation `status == "approved"`.
  * `sync_project_vendor_assignments` (`db.py`) queries all live `RoomItem` records directly from SQLite for the project, matches registered or pincode-serviceable vendors, and populates `VendorAssignment` records immediately.
* **Project Serialization (`_project_summary`)**:
  * `_project_summary(p: Project)` in `projects.py` MUST serialize associated `package` details (`id`, `name`, `base_price`, `tier`) and `created_at` timestamp.
* **Catalog Query Scoring**:
  * Custom room types (`bedroom_3`–`bedroom_5`, `bathroom_2`–`bathroom_4`, `balcony`) map to normalized base categories (`bedroom_2`, `bathroom`, `living_room`) when querying products.
  * Products return individual compatibility flags: `is_color_match`, `is_material_match`, `is_fabric_match`, `is_price_match`.
  * Sorting ranks items by match quality first (Perfect Match $\rightarrow$ Exceeds Budget $\rightarrow$ Mismatched Material $\rightarrow$ Mismatched Color), then vendor pincode tier (local $\rightarrow$ nearby $\rightarrow$ national).
* **Static Asset Pathing**:
  * Product images and floor plans are served under `/static/assets/`. Construct paths using `BACKEND_URL` environment variable.
