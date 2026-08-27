# Frontend Architecture & Conventions — InteriorAI

The frontend is a single-page application built with Next.js 14 (App Router), React 18, TypeScript, TailwindCSS, Zustand state management, and Framer Motion.

---

## Directory & Page Routes Index (`src/app`)

### 1. Customer (B2C) Portal Routes
* [`src/app/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/page.tsx): High-conversion landing page (Headline: *"Designed & Delivered Starting Under ₹3 Lakhs"*, CTA: *"Design My Home Free"*).
* [`src/app/login/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/login/page.tsx): Unified OTP login portal for Customer, Vendor, Enterprise, Site Team, and Admin roles with contextual reviewer test account auto-fill.
* [`src/app/onboarding/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/onboarding/page.tsx): 6-step customer wizard (Property Details $\rightarrow$ Scope & BHK $\rightarrow$ Budget & Timeline $\rightarrow$ Design Vibe $\rightarrow$ Material & Fabric $\rightarrow$ Colors Explorer).
* [`src/app/packages/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/packages/page.tsx): Design package catalogue with dynamic pricing (`Basic` = budget, `Premium` = budget + ₹2L, `Luxury` = budget + ₹5L).
* [`src/app/floor-layout/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/floor-layout/[projectId]/page.tsx): Layout blueprint selector / custom floor plan file uploader.
* [`src/app/customize/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/customize/[projectId]/page.tsx): Live room product customizer with accordion room list, dual budget tracking sub-boxes, category checklist, auto tab progression, and all-complete panel.
* [`src/app/visualize/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/visualize/[projectId]/page.tsx): 4-wall AI Render Studio (Wall A, B, C, D perspectives) supporting blueprint templates, photo uploads, room dimension inputs, and Gemini render triggers.
* [`src/app/quotation/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/quotation/[projectId]/page.tsx): PDF quotation view, line item breakdown, GST breakdown, auto-regeneration trigger, and PDF download.
* [`src/app/dashboard/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/dashboard/page.tsx): Customer active projects dashboard.
* [`src/app/track/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/track/[projectId]/page.tsx): Customer project tracking hub.
* [`src/app/track/[projectId]/execution/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/track/[projectId]/execution/page.tsx): Customer dual tracking bar (Vendor Status Bar & Customer Verification Bar).
* [`src/app/track/[projectId]/floorplans/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/track/[projectId]/floorplans/page.tsx): Customer floor plan documents repository.
* [`src/app/track/[projectId]/payments/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/track/[projectId]/payments/page.tsx): Customer milestone payment advance checkout.

### 2. Enterprise / Builder (B2B2C) Portal Routes
* [`src/app/enterprise/dashboard/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/enterprise/dashboard/page.tsx): Builder portfolio metrics, flat allocation statuses, and recent project activity.
* [`src/app/enterprise/create-project/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/enterprise/create-project/page.tsx): 4-step parent project creation wizard with unit mix distribution.
* [`src/app/enterprise/project/[projectId]/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/enterprise/project/[projectId]/page.tsx): Project flat grid with customer allocation forms and invitation token management.
* [`src/app/invite/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/invite/page.tsx): Homebuyer invitation token redemption portal.

### 3. Vendor (B2B) Portal Routes
* [`src/app/vendor/dashboard/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/vendor/dashboard/page.tsx): Vendor business hub.
* [`src/app/vendor/onboarding/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/vendor/onboarding/page.tsx): Vendor profile & GST/PAN document upload portal.
* [`src/app/vendor/products/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/vendor/products/page.tsx): Product catalog manager with multi-view image uploads (Front, Side, Perspective).
* [`src/app/vendor/inventory/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/vendor/inventory/page.tsx): Stock and reserved inventory manager.
* [`src/app/vendor/assignments/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/vendor/assignments/page.tsx): Project item assignment fulfillment, 6-stage milestone tracker, proof photo uploader, and courier tracking details.
* [`src/app/vendor/payouts/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/vendor/payouts/page.tsx): Milestone payouts and financial statements.
* [`src/app/vendor/issues/page.tsx`](file:///d:/MyFiles/Interior_Design/frontend/src/app/vendor/issues/page.tsx): Customer-reported product issues tracker.

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
2. [`projectStore.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/stores/projectStore.ts): Current active project, room list, items, selected package, customizer selections, and debounced sync to backend.
3. [`customerStore.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/stores/customerStore.ts): Customer tracking state and delivery/installation confirmations.
4. [`vendorStore.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/stores/vendorStore.ts): Vendor assignments, inventory updates, and milestone tracking.
5. [`projectTeamStore.ts`](file:///d:/MyFiles/Interior_Design/frontend/src/stores/projectTeamStore.ts): Site execution tasks, daily checklists, site visits, and comms logs.

---

## UI Components (`src/components`)

* `Navbar.tsx`: Role-aware header navigation displaying contextual links based on active user role.
* `NotificationCenter.tsx`: Header notification bell with swipe-left-to-delete cards and click-outside dismissal.
* `CategoryDropdown.tsx`: Single-category selector with bounded height (`max-h-48`), downward drop (`top-full mt-1`), subcategory grouping, and click-outside auto-close.
* `BhkSelector.tsx`: Interactive BHK scope selector card grid.
* `RoomCanvas3D.tsx`: Three.js / React Three Fiber 3D viewport canvas.
* `ActivityFeed.tsx`, `ExecutionProgressBar.tsx`, `IssueTracker.tsx`, `TimelineView.tsx`: Reusable site execution widgets.

---

## Key Coding Guidelines & Behaviors

* **Styling**: Always use vanilla Tailwind CSS. Active selection styling uses `border-indigo-600` or `border-indigo-500` with subtle shadows. Dark navy containers use `bg-[#0f1129]` or `bg-slate-950/40`.
* **API Base URL**: All API calls construct backend endpoints via `lib/api.ts` utilizing `process.env.NEXT_PUBLIC_API_URL` or `http://localhost:8000`.
* **Single-Select Design Vibe**: Choosing a new style card in onboarding replaces the active choice (`toggleStyle`).
* **Balcony Auto-Complete**: `checkRoomCompleteness` treats `room_type === 'balcony'` as complete automatically.
* **Auto Tab Progression**: Saving selection for the last category of a room automatically shifts tabs to the next room.
* **Dual Budget Sub-Boxes**: Budget tracker bar renders two centered inner boxes (`Remaining Budget` and `Variation Spent`).
