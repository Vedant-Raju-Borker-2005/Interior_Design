# Frontend Architecture & Conventions — InteriorAI

The frontend is a single-page application built with Next.js 14 (App Router), React 18, TypeScript, TailwindCSS, Zustand state management, and Framer Motion.

---

## Directory & Page Routes Index (`src/app`)

### 1. Customer (B2C) Portal Routes
* [`src/app/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/page.tsx): Atelier landing page featuring a full-width 4-vibe carousel (`Modern`, `Scandinavian`, `Japandi`, `Indo-Minimalistic`), centralized headline (*"Transform Your Home with Handcrafted Interiors & Master Artisans"*), stats bar (50K+ Homes, 500+ Elements, 4.9★), and dark charcoal footer.
* [`src/app/login/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/login/page.tsx): Unified OTP login portal for Customer, Vendor, Enterprise, Site Team, and Admin roles with smart customer routing (0 projects $\rightarrow$ `/onboarding`, >0 projects $\rightarrow$ `/dashboard`).
* [`src/app/onboarding/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/onboarding/page.tsx): 6-step customer wizard with Step 0 PIN code auto-lookup (India Post API), 4 signature design vibes (`Modern`, `Scandinavian`, `Japandi`, `Indo-Minimalistic`), and Step 5 pure 3D glossy liquid paint droplets with hover shade tooltips. Scrim overlay reduced to 15-20% for background architectural visibility.
* [`src/app/packages/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/packages/page.tsx): Design package catalogue with dynamic pricing (`Basic` = budget, `Premium` = budget + ₹2L, `Luxury` = budget + ₹5L).
* [`src/app/floor-layout/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/floor-layout/[projectId]/page.tsx): Layout blueprint selector / custom floor plan file uploader.
* [`src/app/customize/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/customize/[projectId]/page.tsx): Atelier customizer studio with top action bar (`←` back arrow, compact budget/variation sub-boxes, `Proceed to AI Render →`), full-width harmonization banner, room spaces list (strictly zero balconies across all BHKs), collection grid, and floating product customizer overlay modal.
* [`src/app/visualize/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/visualize/[projectId]/page.tsx): 4-wall AI Render Studio (Wall A, B, C, D perspectives) supporting blueprint templates, photo uploads, room dimension inputs, and Gemini render triggers.
* [`src/app/quotation/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/quotation/[projectId]/page.tsx): PDF quotation view, line item breakdown, GST breakdown, auto-regeneration trigger, atomic stock reservation, and PDF download.
* [`src/app/dashboard/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/dashboard/page.tsx): Customer active projects dashboard.
* [`src/app/track/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/track/[projectId]/page.tsx): Consolidated customer progress cockpit with circular hero progress gauge (0–100%, 6 milestone stages with strictly zero dates/days), 7-stage item filter chips, dual-track status bars (Sourcing vs Site Installation), photo proof gallery with full-screen lightbox modal, and multi-photo snag reporting form.
* [`src/app/track/[projectId]/execution/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/track/[projectId]/execution/page.tsx): Seamlessly redirects to the consolidated `/track/[projectId]` progress cockpit.
* [`src/app/track/[projectId]/floorplans/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/track/[projectId]/floorplans/page.tsx): Customer floor plan documents repository.
* [`src/app/track/[projectId]/payments/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/track/[projectId]/payments/page.tsx): Customer milestone payment advance checkout.

### 2. Enterprise / Builder (B2B2C) Portal Routes
* [`src/app/enterprise/dashboard/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/enterprise/dashboard/page.tsx): Builder portfolio metrics, flat allocation statuses, bulk volume discount totals, and recent project activity.
* [`src/app/enterprise/create-project/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/enterprise/create-project/page.tsx): 4-step parent project creation wizard with Step 1 Typology Setup (typology count, custom cards: name, BHK, area, blueprint upload) and unit mix distribution.
* [`src/app/enterprise/project/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/enterprise/project/[projectId]/page.tsx): Project flat grid with Project Typologies shelf, interactive multi-column BHK allocation modal (click flat cards to assign/reassign to typologies), portfolio summary cards (Bulk Volume Discount calculation), and units customization breakdown table.
* [`src/app/invite/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/invite/page.tsx): Homebuyer invitation token redemption portal inheriting assigned flat's typology BHK and floor plan.

### 3. Vendor (B2B) Portal Routes
* [`src/app/vendor/dashboard/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/vendor/dashboard/page.tsx): Vendor business hub.
* [`src/app/vendor/onboarding/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/vendor/onboarding/page.tsx): Vendor profile & GST/PAN document upload portal.
* [`src/app/vendor/products/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/vendor/products/page.tsx): Product catalog manager with multi-view image uploads (Front, Side, Perspective).
* [`src/app/vendor/inventory/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/vendor/inventory/page.tsx): Real-time inventory ledger manager displaying physical stock, reserved stock, and available stock (`available_stock = physical_stock - reserved_stock`).
* [`src/app/vendor/assignments/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/vendor/assignments/page.tsx): Project item assignment fulfillment, 6-stage milestone tracker, proof photo uploader, and courier tracking details.
* [`src/app/vendor/payouts/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/vendor/payouts/page.tsx): Milestone payouts and financial statements.
* [`src/app/vendor/issues/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/vendor/issues/page.tsx): Customer-reported product issues and snags tracker.

### 4. Project Team / Site Execution Center Routes
* [`src/app/team/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/team/page.tsx): Team Welcome Portal & role router (`Project Manager`, `Project Coordinator`, `Technician / Installer`).
* [`src/app/team/manager/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/team/manager/page.tsx): Site Manager dashboard (active projects, delayed projects, team utilization rate, SLA metrics).
* [`src/app/team/coordinator/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/team/coordinator/page.tsx): Site Coordinator console (assigned projects, item sourcing tracking, delay alerts, site visits).
* [`src/app/team/technician/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/team/technician/page.tsx): Field Technician console (today's tasks, pending installations, direct proof photo uploads).
* [`src/app/projects/[projectId]/execution/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/projects/[projectId]/execution/page.tsx): Operations console for Managers, Coordinators, and Technicians featuring timeline history, tasks, daily checklists, site visits, comms logs, documents, and SLA delay reports.
* [`src/app/projects/[projectId]/team/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/projects/[projectId]/team/page.tsx): Team member assignment grid.

### 5. Admin Portal Routes
* [`src/app/admin/layout.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/admin/layout.tsx): Admin portal layout with persistent sidebar navigation across all admin sub-pages.
* [`src/app/admin/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/admin/page.tsx): Unified platform admin overview console.
* [`src/app/admin/customers/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/admin/customers/page.tsx): Client CRM, customer directory, account suspension, and reactivation.
* [`src/app/admin/vendors/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/admin/vendors/page.tsx): Vendor onboarding approvals, document review, and vendor status updates.
* [`src/app/admin/project-team/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/admin/project-team/page.tsx): Team registration approvals and role matrix permissions assignment.
* [`src/app/admin/projects/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/admin/projects/page.tsx): Project control center (project creation, manager/coordinator/technician/vendor resource assignment, closing, cancellation).
* [`src/app/admin/master-data/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/admin/master-data/page.tsx): Master product catalog CRUD with CSV bulk import and CSV export.
* [`src/app/admin/reports/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/admin/reports/page.tsx): Operational CSV report generator (sales, revenue, projects, vendors, customers).
* [`src/app/admin/ai-engine/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/admin/ai-engine/page.tsx): AI rendering engine control, model selection, and prompt tuning panel.
* [`src/app/admin/settings/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/admin/settings/page.tsx): System settings templates & configuration key-value manager.
* [`src/app/admin/activity-log/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/admin/activity-log/page.tsx): Developer and platform activity log stream.
* [`src/app/admin/audit-log/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/admin/audit-log/page.tsx): Administrative audit trail table (`AuditLog`).
* [`src/app/services/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/services/page.tsx): Special services checkout portal.
* [`src/app/support/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/support/page.tsx): Customer support tickets portal.

---

## State Management Stores (`src/stores`)

1. [`authStore.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/stores/authStore.ts): User authentication state, JWT tokens, active user role (`customer`, `vendor`, `enterprise`, `admin`, team roles), and reviewer test credentials.
2. [`projectStore.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/stores/projectStore.ts): Current active project, room list, items, selected package, customizer selections, real-time stock levels, and debounced sync to backend.
3. [`customerStore.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/stores/customerStore.ts): Consolidated tracking cockpit state, circular progress metrics, dual-track updates, proof photo lightbox state, and customer snag reporting.
4. [`vendorStore.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/stores/vendorStore.ts): Vendor assignments, real-time inventory ledger (physical stock, reserved stock, available stock), and milestone tracking.
5. [`projectTeamStore.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/stores/projectTeamStore.ts): Site execution tasks, daily checklists, site visits, and comms logs.

---

## UI Components (`src/components`)

* `Navbar.tsx`: Atelier header navigation featuring a sliding drawer trigger (Home, Customer Portal, Support), notifications bell, and circular profile avatar with initial and deterministic background color hash. Dropdown includes Name (Seeded), Edit Profile, and Logout (redirects to `/`).
* `NotificationCenter.tsx`: Header notification bell with swipe-left-to-delete cards and click-outside dismissal.
* `CategoryDropdown.tsx`: Single-category selector with bounded height (`max-h-48`), downward drop (`top-full mt-1`), subcategory grouping, and click-outside auto-close.
* `BhkSelector.tsx`: Interactive BHK scope selector card grid.
* `RoomCanvas3D.tsx`: Three.js / React Three Fiber 3D viewport canvas.
* `ActivityFeed.tsx`, `ExecutionProgressBar.tsx`, `IssueTracker.tsx`, `TimelineView.tsx`: Reusable site execution widgets.

---

## Key Coding Guidelines & Behaviors

* **Styling**: Always use vanilla Tailwind CSS. Active selection styling uses `border-indigo-600` or `border-indigo-500` with subtle shadows. Dark navy containers use `bg-[#0f1129]` or `bg-slate-950/40`.
* **API Base URL**: All API calls construct backend endpoints via `lib/api.ts` utilizing `process.env.NEXT_PUBLIC_API_URL` or `http://localhost:8000`.
* **4 Signature Design Vibes**: `Modern`, `Scandinavian`, `Japandi`, `Indo-Minimalistic`. Choosing a new style card in onboarding replaces the active choice (`toggleStyle`).
* **Onboarding Draft Tracking**: Auto-saves B2C draft project at Step 1 and updates preferences on every `handleNext`. Submitting Step 6 updates the existing draft (`projectsAPI.update`) to prevent duplicate project errors.
* **Universal Logout Redirect to Homepage (`/`)**: All portals and navigations redirect to `/` on logout, never `/login`.
* **Smart First-Project Routing on Login**: If a customer has 0 active projects upon login, they are routed directly to `/onboarding`; if projects exist, they are routed to `/dashboard`.
* **Balconies Strictly Excluded**: Balconies are excluded across all BHK configurations (1BHK to 5BHK) in backend and frontend. `getSortedRoomsList()` filters out `balcony` types.
* **Product Customization Floating Overlay Modal**: In `customize/[projectId]/page.tsx`, selecting a product opens a centered floating overlay modal (`fixed inset-0 z-50 bg-stone-900/60 backdrop-blur-sm p-3 sm:p-6 lg:p-10`) with generous margins on all sides.
* **Enterprise Locked Onboarding & Typology Inheritance**: Enterprise Child Projects (`isB2B2C`) lock Steps 0–2. Back button and step loading enforce a minimum step of Step 3 (Design Vibe). Homebuyers automatically inherit the assigned flat's typology BHK and floor plan.
* **Enterprise Typology Setup & Multi-Column Allocation**: Step 1 captures typology definitions with custom cards. The units view renders the Project Typologies shelf and launches the multi-column BHK allocation modal where developers assign flats to typologies with a single click.
* **Bulk Volume Discount Calculations**: Portfolio summaries calculate volume discounts (5% for 5–9 units, 10% for 10–19 units, 15% for 20+ units). Displays Net Contract Value (`Net = Base Units + Customization Upgrades - Volume Discount`) and unit-level customization upgrade tables.
* **Real-Time Stock Badges & Out-of-Stock Suppression**: Catalog cards display availability indicators ("In Stock (X left)", "Low Stock", "Out of Stock"). Items with `available_stock <= 0` are suppressed from customer customizer selection grids.
* **Unified Customer Progress Cockpit Zero Dates**: The `/track/[projectId]` hub computes circular progress (0–100%) and displays 6 milestone stages with strictly zero date or remaining day forecasts. Includes dual-track status bars, proof photo lightbox, and multi-photo snag submission.
* **Vendor Portal Order Tracking**: Vendor dashboard (`/vendor/dashboard`) loads assignments for approved vendor accounts. If a newly logged-in vendor user arrives, status is set to `APPROVED` and `sync_project_vendor_assignments` links orders.
* **Auto Tab Progression**: Saving selection for the last category of a room automatically shifts tabs to the next room.
* **Dual Budget Sub-Boxes**: Budget tracker bar renders two centered inner boxes (*Remaining Budget* and *Variation Spent*).

---

## DOX Child Indices

For system architecture and sub-system guides, refer to:
* **System Architecture Specification**: [`ARCHITECTURE.md`](file:///d:/MyFiles/Interior_Design/ARCHITECTURE.md)
* **Root Project Guide**: [`AGENTS.md`](file:///d:/MyFiles/Interior_Design/AGENTS.md)
* **Backend Guide**: [`backend/AGENTS.md`](file:///d:/MyFiles/Interior_Design/backend/AGENTS.md)
* **AI Engine & 3D Solver Guide**: [`backend-ai/AGENTS.md`](file:///d:/MyFiles/Interior_Design/backend-ai/AGENTS.md)
