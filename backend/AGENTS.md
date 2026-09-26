# Backend Architecture & Conventions — InteriorAI

The backend is built with Python 3.10+, FastAPI, SQLAlchemy ORM, and SQLite database (`interior_ai.db`).

---

## Code Structure

* [`app/main.py`](file:///d:/MyFiles/Interior_Design/backend/app/main.py): Entry point, mounts CORS middleware, mounts `/static/assets` static directories, executes database initialization and seeding on startup, and boots all 14 API routers.
* [`app/models.py`](file:///d:/MyFiles/Interior_Design/backend/app/models.py): Declarative SQLite schema models via SQLAlchemy (900+ lines). Includes core entities, enterprise typologies, inventory ledger fields, site operations, and customer snags.
* [`app/schemas.py`](file:///d:/MyFiles/Interior_Design/backend/app/schemas.py): Pydantic input/output schemas for API request and response serialization and validation.
* [`app/db.py`](file:///d:/MyFiles/Interior_Design/backend/app/db.py): Database engine, session setup, and `sync_demo_data()` seeder (includes pre-registered demo accounts for customer, vendor, enterprise, site team, and admin roles).
* [`app/auth_utils.py`](file:///d:/MyFiles/Interior_Design/backend/app/auth_utils.py): JWT token issuance, password hashing (`passlib`/`bcrypt`), and `current_user` dependency.
* [`app/seed_data.py`](file:///d:/MyFiles/Interior_Design/backend/app/seed_data.py) & [`app/seed_catalog_images.py`](file:///d:/MyFiles/Interior_Design/backend/app/seed_catalog_images.py): Product catalog seeding, design package initialization, stock level seeding, and multi-view catalog image mapping.
* [`app/services/inventory_service.py`](file:///d:/MyFiles/Interior_Design/backend/app/services/inventory_service.py): Atomic inventory ledger service managing reservations (`reserve_items_for_quotation`), cancellations/releases (`release_items_for_quotation`), and commitments (`commit_items_for_quotation`).
* [`app/services/business_rules.py`](file:///d:/MyFiles/Interior_Design/backend/app/services/business_rules.py): Shared business rules engine, BHK canonical normalization (`normalize_bhk`), product budget caps, and enterprise tiered bulk volume discounts.

---

## API Router Directory (`app/routers`)

1. **`auth.py`** (`/api/v1/auth`): OTP-based authentication, user registration, role detection (`customer`, `vendor`, `enterprise`, `admin`), and fallback credential generation to prevent `UNIQUE constraint` errors.
2. **`projects.py`** (`/api/v1/projects`): Project CRUD, room generation via `BHK_ROOMS`, room item customization, room deletion, and floor plan PDF presentation export (`download_floor_plan_pdf`).
3. **`catalog.py`** (`/api/v1/catalog`): Product catalog search with custom room category normalization, budget-aware scoring, real-time stock ledger calculation (`available_stock`), matching flags (`is_color_match`, `is_material_match`, `is_fabric_match`, `is_price_match`), master color family explorer, and out-of-stock suppression.
4. **`ai_render.py`** (`/api/v1/ai`): AI render generation trigger compiling prompts from project style, wood finish, fabric, colors, and 4-wall dimensions; status polling.
5. **`quotations.py`** (`/api/v1/quotations`): Dynamic quotation generation, line item serialization, GST calculation, auto-regeneration when previous quote was revised/rejected, ReportLab PDF generation, and real-time inventory atomic reservations and payment commitments via `inventory_service.py`.
6. **`vendors.py`** (`/api/v1/vendors`): Legacy vendor listing, pincode serviceability check, and vendor detail endpoints.
7. **`vendor_routes.py`** (`/api/v1/vendor`): Vendor portal API for profile submission, GST/PAN document uploads, product inventory management (physical stock, reserved stock, and available stock), 3-view image uploads, assignment acceptance, shipping tracking (courier, vehicle details, AWB), proof photo uploads, vendor issues aggregation, and payout tracking.
8. **`enterprise.py`** (`/api/v1/enterprise`): Enterprise B2B2C API for parent project creation, typology management (`Typology` model CRUD, blueprint uploads), unit mix generation (1BHK-5BHK), flat-to-typology assignments, invitation token generation (`/invite`), portfolio bulk discount summaries (5%, 10%, 15% tiers), and unit customization breakdown tables.
9. **`project_team.py`** (`/api/v1/team` & `/api`): Operations console for Site Managers, Coordinators, and Technicians. Endpoints for role-scoped projects listing (`/team/projects`), team directory (`/team/directory`), multi-role KPI metrics (`/team/dashboard`), direct multipart photo proof uploads (`POST /projects/{project_id}/photos`), member assignments with permission checks, task management, daily checklists, site visits, comms logs, document uploads, delay SLA reporting, and progress history.
10. **`admin.py`** (`/api/v1/admin`): Administrative portal API for user CRM (`/admin/customers`), vendor onboarding approvals/rejections (`/admin/vendors`), team onboarding approvals (`/admin/team-approvals`), project control center (`/admin/projects`), master catalog CRUD & CSV import/export (`/admin/master-data`), operational CSV reports streaming (`/admin/reports`), quote audit logs (`QuoteAudit`), package configuration tuning (`PackageConfiguration`), pricing rules engine (`PricingRule`), system settings (`SystemSetting`), and administrative audit trail logs (`AuditLog`).
11. **`customer_routes.py`** (`/api/v1/customer`): Customer tracking bar updates, delivery and installation verification confirmations, and customer snag reporting with multi-photo proof support (`POST /customer/projects/{project_id}/snags`).
12. **`tracking.py`** (`/api/v1/tracking`): Real-time item tracking logs and milestone status updates.
13. **`recommendations.py`** (`/api/v1/recommendations`): AI-ranked package and product recommendations based on style compatibility matrices.
14. **`inquiry.py`** (`/api/v1/inquiry`): General web and consultation inquiry submissions.

---

## Core Services (`app/services`)

* [`app/services/pdf_service.py`](file:///d:/MyFiles/Interior_Design/backend/app/services/pdf_service.py): Generates bank-compliant PDF quotes using ReportLab with detailed line item tables, GST breakdown, terms & conditions, and branding headers.
* [`app/services/inventory_service.py`](file:///d:/MyFiles/Interior_Design/backend/app/services/inventory_service.py): Real-time inventory ledger and stock reservation lifecycle manager (`reserve_items_for_quotation`, `release_items_for_quotation`, `commit_items_for_quotation`).
* [`app/services/business_rules.py`](file:///d:/MyFiles/Interior_Design/backend/app/services/business_rules.py): Standardized business rules engine containing canonical BHK normalization (`normalize_bhk`), product budget caps, and enterprise volume discount calculations.
* [`app/services/render_mock.py`](file:///d:/MyFiles/Interior_Design/backend/app/services/render_mock.py): Gemini AI / Imagen 3 / ControlNet rendering pipeline mock for photorealistic 3D room renders.

---

## Database Models Summary (`app/models.py`)

* **User**: Customer, Vendor, Enterprise, Admin, and Site Team profiles.
* **Project**: Core project model supporting parent-child hierarchy (`parent_project_id`), BHK type, budget, preferences (wood laminate, fabric, colors), status, and customer snags relationship.
* **Typology**: Enterprise property typologies (`name`, `bhk`, `area_sqft`, `floor_plan_url`, `parent_project_id`).
* **Flat**: Enterprise unit record linked to parent project, invited customer, assigned floor plan, and `typology_id` foreign key.
* **Package**: Base tier packages (`basic`, `premium`, `luxury`).
* **Room & RoomItem**: Room configuration and customized product selections (`custom_color`, `custom_wood_finish`, `custom_fabric`, `custom_size`).
* **Product & VendorProduct**: Catalog product models with multi-view image arrays, dimensions, primary material, style tags, variants, `stock_quantity` (physical stock), and `reserved_stock` (held in active quotes).
* **Quotation & QuotationRevision**: Financial quotes with GST calculations and audit revision history.
* **CustomerSnag**: Customer-reported site installation issues with photo URLs, title, description, and status.
* **Vendor, VendorDocument, VendorAssignment, VendorPayout**: Complete vendor lifecycle models including document approvals, project item assignments, shipping details, and payouts.
* **ProjectTeamMember, Task, DailyChecklist, SiteVisit, ProjectDelay, CommunicationLog, ProjectDocument**: Site execution and operations models.
* **AdminRole, QuoteAudit, PackageConfiguration, PricingRule, SystemSetting, AuditLog**: Administrative governance and platform settings models.

---

## Technical Guidelines & API Conventions

* **Supplier Assignment is Gated (stakeholder feedback 4.2–4.5)**:
  * `update_quotation_status` (`customer_routes.py`), quotation generation and the vendor dashboard all call `sync_project_vendor_assignments(project.id, db)`.
  * `sync_project_vendor_assignments` (`db.py`) does nothing until the project is `approval_status == "APPROVED"` **and** has `allocated_vendor_id`; it then creates `VendorAssignment` rows for every `RoomItem`, for the allocated supplier only. Approval and allocation happen in `routers/approvals.py`.
* **Stakeholder-feedback modules**: `approvals.py` (queue, allocation, B2B pricing), `quotation_admin.py` (search, mark paid, convert), `item_tracking.py` (vendor vs technician tracks), `vendor_availability.py`, `special_services.py` (consultants, leads, commission, pre-checkout), `premium_render.py` (free/paid renders, plan upload). Shared rules live in `services/business_rules.py`; end-to-end tests in `tests/test_feedback_features.py`.
* **Real-Time Inventory Ledger & Concurrency**:
  * Formula: `available_stock = physical_stock - reserved_stock`.
  * Quotation creation calls `reserve_items_for_quotation` to hold stock.
  * Quote cancellation, expiry, or modification triggers `release_items_for_quotation`.
  * Quotation payment triggers `commit_items_for_quotation` (deducting physical stock and releasing reserved stock).
  * Catalog queries automatically suppress products where `available_stock <= 0` during customer room customization.
* **Enterprise Bulk Volume Discount Engine**:
  * Automatically calculates volume discount tiers: 5–9 units (5%), 10–19 units (10%), 20+ units (15%).
  * Roll-up formula: `Net Contract Value = Base Units + Customization Upgrades - Volume Discount`.
* **Enterprise Typology Inheritance**:
  * Child projects linked to enterprise flats automatically inherit the assigned typology's BHK and floor plan.
  * Steps 0–2 of onboarding are locked, routing homebuyers directly to Step 3 (Design Vibe).
* **Customer Progress Zero-Date Policy**:
  * Execution progress is computed strictly as a completion percentage (0–100%) across 6 stages without date/day forecasts.
* **BHK lookups**: packages and `BHK_ROOMS` are keyed `3BHK`; always pass user input through `normalize_bhk()`.
* **New columns**: SQLite cannot add columns via `create_all()`; declare them in `init_db()`'s `add_cols(...)` block as well as on the model.
* **Project Serialization (`_project_summary`)**:
  * `_project_summary(p: Project)` in `projects.py` MUST serialize associated `package` details (`id`, `name`, `base_price`, `tier`) and `created_at` timestamp.
* **Catalog Query Scoring**:
  * Custom room types (`bedroom_3`–`bedroom_5`, `bathroom_2`–`bathroom_4`, `balcony`) map to normalized base categories (`bedroom_2`, `bathroom`, `living_room`) when querying products.
  * Products return individual compatibility flags: `is_color_match`, `is_material_match`, `is_fabric_match`, `is_price_match`.
  * Sorting ranks items by match quality first (Perfect Match $\rightarrow$ Exceeds Budget $\rightarrow$ Mismatched Material $\rightarrow$ Mismatched Color), then vendor pincode tier (local $\rightarrow$ nearby $\rightarrow$ national).
* **Static Asset Pathing**:
  * Product images and floor plans are served under `/static/assets/`. Construct paths using `BACKEND_URL` environment variable.

---

## DOX Child Indices

For system architecture and sub-system guides, refer to:
* **System Architecture Specification**: [`ARCHITECTURE.md`](file:///d:/MyFiles/Interior_Design/ARCHITECTURE.md)
* **Root Project Guide**: [`AGENTS.md`](file:///d:/MyFiles/Interior_Design/AGENTS.md)
* **Frontend Guide**: [`frontend/AGENTS.md`](file:///d:/MyFiles/Interior_Design/frontend/AGENTS.md)
* **AI Engine & 3D Solver Guide**: [`backend-ai/AGENTS.md`](file:///d:/MyFiles/Interior_Design/backend-ai/AGENTS.md)
