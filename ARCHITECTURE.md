# 🏗️ InteriorAI — Comprehensive System Architecture & Stakeholder Flow Specification

> **End-to-End AI-Powered Interior Design & Modular Execution Platform**

This document serves as the authoritative architectural blueprint for **InteriorAI**, specifying the system layout, data flows, API boundaries, database schemas, and stakeholder interaction paths across all 5 unified platform portals.

---

## 📌 1. High-Level System Architecture

InteriorAI is built using a modern decoupled web architecture consisting of a **Next.js 14 (App Router)** single-page frontend application and a high-performance **FastAPI (Python 3.10+)** RESTful backend engine powered by **SQLAlchemy ORM** and an embedded **SQLite database** (`interior_ai.db`).

```mermaid
graph TD
    subgraph ClientLayer ["Frontend Layer (Next.js 14 SPA - Port 3000)"]
        UI_Cust[B2C Homeowner Portal]
        UI_Ent[B2B2C Enterprise Builder Portal]
        UI_Vend[B2B Vendor Portal]
        UI_Team[Site Execution Team Portal]
        UI_Admin[Platform Administration Portal]
    end

    subgraph StateStore ["Client State Management (Zustand)"]
        ST_Auth[authStore]
        ST_Proj[projectStore]
        ST_Cust[customerStore]
        ST_Vend[vendorStore]
        ST_Team[projectTeamStore]
    end

    subgraph APILayer ["API Client Layer (Axios Interceptors)"]
        API_Client[lib/api.ts REST Client]
    end

    subgraph BackendEngine ["Backend Layer (FastAPI REST API - Port 8000)"]
        AUTH_ROUTER[auth.py]
        PROJ_ROUTER[projects.py]
        CAT_ROUTER[catalog.py]
        AI_ROUTER[ai_render.py]
        QUOTE_ROUTER[quotations.py]
        VEND_ROUTER[vendor_routes.py]
        ENT_ROUTER[enterprise.py]
        TEAM_ROUTER[project_team.py]
        ADMIN_ROUTER[admin.py]
        CUST_ROUTER[customer_routes.py]
    end

    subgraph StorageEngine ["Persistence & File Storage Layer"]
        DB[(SQLite DB: interior_ai.db)]
        PDF_STATIC[/static/assets/ Catalog, Quotes, Proofs/]
    end

    ClientLayer --> StateStore
    StateStore --> API_Client
    API_Client <-->|REST API / JWT Token| BackendEngine
    BackendEngine <--> DB
    BackendEngine <--> PDF_STATIC
```

---

## 🔄 2. Stakeholder Workflows & Branching Flows

InteriorAI unifies 5 distinct stakeholder personas into a single web application. Each stakeholder operates through specialized workflows, security boundaries, and API routes.

```mermaid
graph LR
    UserType((Platform User)) -->|Role Router| RoleCheck{Identify User Role}
    
    RoleCheck -->|customer| Flow1[1. Customer B2C Portal]
    RoleCheck -->|enterprise| Flow2[2. Enterprise Builder Portal]
    RoleCheck -->|vendor| Flow3[3. Furniture Vendor Portal]
    RoleCheck -->|team_manager / team_coordinator / team_technician| Flow4[4. Site Execution Team Portal]
    RoleCheck -->|admin / super_admin| Flow5[5. Platform Administrator Hub]
```

---

### 2.1 Customer (B2C Homeowner) Flow

The Homeowner journey guides users from initial property details to AI 3D visualization, quotation approval, and real-time installation tracking.

```mermaid
graph TD
    Start((Homeowner Login / Guest)) --> Step1[6-Step Onboarding Wizard]
    Step1 -->|Select BHK & Budget| Step2[Dynamic Package Filter]
    Step2 -->|Choose Package: Basic / Premium / Luxury| Step3[Automatic Room Breakdown Generation]
    Step3 --> Step4[Interactive Room Product Customizer]
    
    subgraph CustomizerLoop ["Room Customization Engine"]
        Step4 --> ChecklistCheck{Category Checklist Complete?}
        ChecklistCheck -->|No| SelectProduct[Select Product & Wood/Fabric/Color Finish]
        SelectProduct --> BudgetUpdate[Update Dual Budget Sub-Boxes: Remaining & Variation]
        BudgetUpdate --> AutoTab[Auto Tab Progression to Next Room]
        AutoTab --> Step4
        ChecklistCheck -->|Balcony Room| AutoPass[Auto-Pass Completeness Check]
        ChecklistCheck -->|All Rooms Complete| ConfigDone[Configuration Complete Banner]
    end
    
    ConfigDone --> Step5[4-Wall AI Visualizer Studio]
    Step5 -->|Gemini / Imagen 3 AI| Render[Generate Photorealistic 3D Renders]
    Render --> Step6[Bank-Compliant Quotation Generation]
    Step6 -->|ReportLab Engine| QuotePDF[PDF Quote Download & Revision Tracker]
    QuotePDF --> Step7[Dual Sourcing & Verification Tracking Hub]
    Step7 -->|Vendor Status Bar| Track1[PO Approved → Production → Dispatched]
    Step7 -->|Customer Verification Bar| Track2[Confirm Delivery & Verify Installation]
```

**Key Customer Routes & APIs:**
* Onboarding: `/onboarding` $\rightarrow$ `POST /api/v1/projects`
* Packages: `/packages` $\rightarrow$ `GET /api/v1/recommendations/packages`
* Customizer: `/customize/[projectId]` $\rightarrow$ `PUT /api/v1/projects/{id}/rooms/{roomId}`
* AI Studio: `/visualize/[projectId]` $\rightarrow$ `POST /api/v1/ai/render`
* Quotation: `/quotation/[projectId]` $\rightarrow$ `POST /api/v1/quotations/{id}/generate`
* Verification: `/track/[projectId]/execution` $\rightarrow$ `PUT /api/v1/customer/projects/{id}/tracking/{trackingId}`

---

### 2.2 Enterprise / Builder (B2B2C) Flow

Real-estate developers setup parent properties, configure multi-unit flat mixes, assign buyers, and issue invitations.

```mermaid
graph TD
    EntStart((Builder / Developer Login)) --> Dashboard[Enterprise Portfolio Dashboard]
    Dashboard --> CreateWizard[4-Step Parent Project Creation Wizard]
    CreateWizard --> UnitMix[Configure Unit Mix: 1BHK - 5BHK Allocations]
    UnitMix --> FloorPlanUpload[Upload Floor Plan Blueprints]
    FloorPlanUpload --> FlatGrid[Flat Units Inventory Grid]
    
    FlatGrid --> AssignBuyer[Assign Buyer Name, Phone, & Email]
    AssignBuyer --> GenInvite[Generate Unique Invitation Token]
    GenInvite --> SendInvite[Send Invitation Link to Homebuyer]
    
    SendInvite --> BuyerAccept["Redeem Token at /invite?token=xyz"]
    BuyerAccept --> ChildProject[Auto-Create Linked Child Customer Project]
    ChildProject --> OnboardingComplete[Homebuyer Handoff to B2C Customizer]
```

**Key Enterprise Routes & APIs:**
* Dashboard: `/enterprise/dashboard` $\rightarrow$ `GET /api/v1/enterprise/projects`
* Creation Wizard: `/enterprise/create-project` $\rightarrow$ `POST /api/v1/enterprise/projects`
* Flat Inventory: `/enterprise/project/[id]` $\rightarrow$ `GET /api/v1/enterprise/projects/{id}/flats`
* Invitations: `/invite` $\rightarrow$ `POST /api/v1/enterprise/invitations/accept`

---

### 2.3 Furniture & Decor Vendor (B2B) Flow

Vendors manage product catalogs, inventory levels, order assignments, logistics tracking, and customer issues.

```mermaid
graph TD
    VendStart((Vendor Login)) --> Onboarding[Vendor Profile & GST/PAN Verification]
    Onboarding --> AdminApproval{Admin Document Review}
    AdminApproval -->|Approved| CatalogMgmt[Multi-View Catalog Management]
    
    CatalogMgmt --> UploadViews[Upload 3 Perspective Images: Front, Side, Perspective]
    UploadViews --> InventoryMgmt[Stock & Reserved Inventory Tracking]
    
    InventoryMgmt --> ReceiveAssign[Receive Project Item Assignments]
    ReceiveAssign --> MilestoneUpdate[Update 6-Stage Fulfillment Status]
    
    subgraph LogisticsPipeline ["6-Stage Fulfillment Pipeline"]
        MilestoneUpdate --> Stage1[PO Approved]
        Stage1 --> Stage2[In Production]
        Stage2 --> Stage3[Ready for Dispatch]
        Stage3 --> Stage4[Dispatched - Enter AWB / Courier Details]
        Stage4 --> Stage5[In Transit]
        Stage5 --> Stage6[Delivered to Site - Upload Proof Photos]
    end
    
    Stage6 --> IssueReview[Review Customer Issues: /vendor/issues]
    IssueReview --> PayoutRelease[Track Milestone Payout Releases]
```

**Key Vendor Routes & APIs:**
* Onboarding: `/vendor/onboarding` $\rightarrow$ `POST /api/v1/vendor/onboarding`
* Products Catalog: `/vendor/products` $\rightarrow$ `POST /api/v1/vendor/products/{id}/image?view_index=0`
* Assignments: `/vendor/assignments` $\rightarrow$ `PATCH /api/v1/vendor/assignments/{id}`
* Logistics: `/vendor/assignments` $\rightarrow$ `PUT /api/v1/vendor/assignments/{id}/shipment`
* Issues Tracker: `/vendor/issues` $\rightarrow$ `GET /api/v1/vendor/issues`

---

### 2.4 Project Team / Site Execution Flow

The execution team operates through a role-based router directing Site Managers, Coordinators, and Field Technicians to specialized consoles.

```mermaid
graph TD
    TeamStart((Team Login)) --> WelcomePortal[Welcome Portal Router: /team]
    WelcomePortal --> RoleSplit{User Sub-Role}
    
    RoleSplit -->|team_manager| MgrConsole[Manager Console: /team/manager]
    RoleSplit -->|team_coordinator| CoordConsole[Coordinator Console: /team/coordinator]
    RoleSplit -->|team_technician| TechConsole[Technician Console: /team/technician]
    
    MgrConsole --> MgrActions[Portfolio Analytics, Team Utilization, SLA Delays, Member Assignment]
    CoordConsole --> CoordActions[Item Sourcing Tracking, Site Visits, Daily Checklists, Delay Alerts]
    TechConsole --> TechActions[Daily Installation Tasks, Direct Multipart Proof Photo Uploads]
    
    MgrActions --> ExecWorkspace[Project Execution Center: /projects/id/execution]
    CoordActions --> ExecWorkspace
    TechActions --> ExecWorkspace
    
    subgraph SiteWorkspace ["Site Operations Module"]
        ExecWorkspace --> TaskSystem[Task Calendar & Priority Tracking]
        ExecWorkspace --> ChecklistSystem[Daily Coordinator & Technician Checklists]
        ExecWorkspace --> VisitSystem[Site Visit Logs & Customer Call Minutes]
        ExecWorkspace --> DocVault[Document Vault Uploads: PDF Quotes & Certificates]
        ExecWorkspace --> SLAEngine[Auto-Detect Project Delays & Escalations]
    end
```

**Key Team Routes & APIs:**
* Welcome Router: `/team` $\rightarrow$ `GET /api/v1/team/team/directory`
* Manager Console: `/team/manager` $\rightarrow$ `GET /api/v1/team/team/dashboard`
* Coordinator Console: `/team/coordinator` $\rightarrow$ `GET /api/v1/team/team/projects`
* Field Technician Console: `/team/technician` $\rightarrow$ `POST /api/v1/team/projects/{id}/photos`
* Execution Center: `/projects/[id]/execution` $\rightarrow$ `GET /api/v1/team/projects/{id}/tracking`

---

### 2.5 Platform Administrator Flow

Super Admins and Operations Managers manage the platform via a persistent navigation layout across 10 specialized sub-routes.

```mermaid
graph TD
    AdminStart((Admin Login)) --> AdminLayout[Admin Persistent Sidebar Layout: /admin]
    
    AdminLayout --> Sub1[1. Customer CRM: /admin/customers]
    AdminLayout --> Sub2[2. Vendor Governance: /admin/vendors]
    AdminLayout --> Sub3[3. Team Approvals: /admin/project-team]
    AdminLayout --> Sub4[4. Project Control Center: /admin/projects]
    AdminLayout --> Sub5[5. Master Data Catalog CRUD: /admin/master-data]
    AdminLayout --> Sub6[6. Reports & CSV Exports: /admin/reports]
    AdminLayout --> Sub7[7. AI Engine Tuning: /admin/ai-engine]
    AdminLayout --> Sub8[8. IT Box & Settings: /admin/settings]
    AdminLayout --> Sub9[9. Activity Log Stream: /admin/activity-log]
    AdminLayout --> Sub10[10. Audit Trail Table: /admin/audit-log]
    
    Sub1 --> Actions1[View Profiles, Suspend / Reactivate Accounts]
    Sub2 --> Actions2[Review GST/PAN Docs, Approve / Reject Vendors]
    Sub3 --> Actions3[Review Pending Registrations, Assign Admin Roles]
    Sub4 --> Actions4[Create Projects, Assign Managers/Coordinators/Vendors, Close/Cancel]
    Sub5 --> Actions5[Product CRUD, CSV Bulk Import, Catalog CSV Export]
    Sub6 --> Actions6[Stream Live Sales, Revenue, Vendor, & Customer CSV Reports]
    Sub7 --> Actions7[Configure Gemini Prompt Templates & Render Limits]
    Sub8 --> Actions8[Manage Dynamic System Setting Key-Values]
    Sub9 --> Actions9[Real-Time Developer Activity Logs]
    Sub10 --> Actions10[Administrative Governance Action Audits]
```

**Key Admin Routes & APIs:**
* Customer CRM: `/admin/customers` $\rightarrow$ `GET /api/v1/admin/customers`
* Vendor Approvals: `/admin/vendors` $\rightarrow$ `POST /api/v1/admin/vendors/{id}/approve`
* Team Approvals: `/admin/project-team` $\rightarrow$ `GET /api/v1/admin/team-approvals`
* Master Data & CSV: `/admin/master-data` $\rightarrow$ `POST /api/v1/admin/master/import`
* Operational Reports: `/admin/reports` $\rightarrow$ `GET /api/v1/admin/reports?category=sales`

---

## 🗄️ 3. Database Entity Relationship Model (`models.py`)

The SQLite database (`interior_ai.db`) enforces declarative relational mappings via SQLAlchemy.

```mermaid
erDiagram
    User ||--o{ Project : owns
    User ||--o{ Flat : assigned_flats
    User ||--o{ AdminRole : has_admin_role
    
    Project ||--o{ Flat : contains_units
    Project ||--o{ Room : contains_rooms
    Project ||--o{ Quotation : generates
    Project ||--o{ ItemTracking : tracks_items
    Project ||--o{ Task : manages_tasks
    Project ||--o{ SiteVisit : schedules_visits
    Project ||--o{ ProjectDelay : records_delays
    Project ||--o{ ProjectTeamMember : assigned_team
    
    Room ||--o{ RoomItem : contains_items
    Room ||--o{ Render : visualizes
    
    Product ||--o{ RoomItem : provides
    Vendor ||--o{ Product : supplies
    Vendor ||--o{ VendorDocument : holds_docs
    Vendor ||--o{ VendorAssignment : receives_assignments
    
    ItemTracking ||--o{ ProjectItemTrackingHistory : logs_history
    Issue ||--o{ IssueComment : comments
    Issue ||--o{ IssueAttachment : attachments
```

---

## ⚙️ 4. Dynamic Platform Rules & Constraints

### 1. Dynamic Package Pricing Engine
* **Basic Package**: `budget`
* **Premium Package**: `budget + ₹2,00,000` (₹2L)
* **Luxury Package**: `budget + ₹5,00,000` (₹5L)

### 2. Custom BHK Mappings
* **1 BHK**: Living Room, Bedroom Master (labeled "Bedroom"), Kitchen, Bathroom, Balcony
* **2 BHK to 5 BHK**: Living Room, Bedroom Master, Bedroom 2–5, Kitchen, Bathroom, Bathroom 2–4, Balcony

### 3. Budget Recommendation Caps
* **₹3L – ₹5L Budget**: Max product price cap = **₹75,000**
* **₹5L – ₹8L Budget**: Max product price cap = **₹1,25,000**
* **₹8L – ₹12L Budget**: Max product price cap = **₹2,00,000**
* **₹12L – ₹20L Budget**: Max product price cap = **₹3,50,000**
* **₹20L+ Budget**: Max product price cap = **₹5,00,000**

---

## 🚀 5. Development & Deployment Operational Commands

### Click-to-Run Launcher (Windows)
Run the root batch launcher to validate environments, initialize `.venv`, seed test databases, handle port clearances, and start both servers:
```powershell
.\Click_Run.bat
```

* **Frontend Web App**: `http://localhost:3000`
* **FastAPI Backend API**: `http://localhost:8000`
* **Swagger API Documentation**: `http://localhost:8000/docs`
