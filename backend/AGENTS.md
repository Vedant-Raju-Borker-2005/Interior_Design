# Backend Architecture & Conventions — InteriorAI

The backend is built with Python 3.10+, using FastAPI, SQLAlchemy, and SQLite.

## Code Structure

* [`app/main.py`](file:///d:/MyFiles/Interior_Design/backend/app/main.py): Entry point, mounts static directories and boots routers.
* [`app/models.py`](file:///d:/MyFiles/Interior_Design/backend/app/models.py): Declarative SQLite schema models via SQLAlchemy.
* [`app/schemas.py`](file:///d:/MyFiles/Interior_Design/backend/app/schemas.py): Pydantic input/output schemas for API request and response validation.
* [`app/routers`](file:///d:/MyFiles/Interior_Design/backend/app/routers): Routing definitions (auth, projects, catalog, quotations, etc.).
* [`app/services`](file:///d:/MyFiles/Interior_Design/backend/app/services): Modular services including AI rendering engines, PDF generation, and project workflows.

---

## Core Database Contracts

### SQLite Schema (`interior_ai.db`)
* **Project**: Tracks project preferences (`interior_material_preference`, `fabric_preference`, `color_preferences`, `bhk_type`, `property_name`, `budget`).
* **Package**: Pre-defined price tiers (`basic`, `premium`, `luxury`) containing `base_price` and `style_tags`.
* **Room & RoomItem**: Room-level modular configurations. Each `RoomItem` references a catalog `Product` and stores customizations.

### Image Storage
* All product thumbnails and materials are stored in `backend/pdfs/catalog` and exposed via FastAPI's `StaticFiles` mapping at `/static/pdfs/catalog/`.

---

## API Guidelines

* **Project Summaries**:
  * The `_project_summary(p: Project)` function in `app/routers/projects.py` MUST serialize the associated `package` details (`id`, `name`, `base_price`, `tier`) if selected, to enable live cost-tracking calculations on the client.
* **Database Operations**:
  * Commit transactions explicitly inside routers using `db.commit()`.
  * Create folder structures (like `pdfs/floor_plans`) programmatically if they do not exist.
