import os
import asyncio
import random
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from .db import init_db, SessionLocal
from .seed_data import seed_database
from .routers import auth, projects, catalog, ai_render, quotations, vendors, inquiry, tracking, admin, recommendations, customer_routes, vendor_routes, project_team, enterprise
# Stakeholder-feedback modules
from .routers import (
    approvals,            # 4.2-4.5 approval queue & supplier allocation, 2.1-2.4 B2B pricing
    design_studio,        # full-page 2D/3D studio: edit design, GLB export
    item_tracking,        # 3.1-3.5 vendor vs technician status tracks
    premium_render,       # 1.1 plan-specific render, 1.7 free tier, 1.8 paid batch
    quotation_admin,      # 1.5 search, 1.9 mark paid, 1.10 convert, 1.11 full payment
    special_services,     # 5.1-5.8 consultants, leads, commissions
    vendor_availability,  # 4.1 supplier availability switch
)

DEFAULT_CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
    if origin.strip()
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs("assets", exist_ok=True)
    os.makedirs("assets/floor_plans", exist_ok=True)
    init_db()
    db = SessionLocal()
    try:
        seed_database(db)
        from .db import sync_demo_data
        sync_demo_data(db)
    finally:
        db.close()

    # Load the IDS design engine in the background: its first use otherwise
    # makes whichever request triggers it wait several seconds.
    def _warm_ids():
        try:
            from .services.ids_service import get_ids_pipeline_instance
            get_ids_pipeline_instance()
        except Exception:
            pass
    import threading
    threading.Thread(target=_warm_ids, name="ids-warmup", daemon=True).start()
    yield


app = FastAPI(
    title="Interior AI Platform API",
    version="2.0.0",
    description="AI-Based Modular Interior Design & Visualization Platform - Reloaded",
    lifespan=lifespan,
)

@app.middleware("http")
async def json_errors(request, call_next):
    """Turn an unexpected crash into a JSON 500. Registered before CORS so the
    response still carries CORS headers — otherwise the browser reports a
    network failure and the real error is lost."""
    try:
        return await call_next(request)
    except Exception as exc:  # noqa: BLE001
        import logging
        from fastapi.responses import JSONResponse
        logging.getLogger("app").exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(status_code=500, content={
            "detail": f"Something went wrong on the server ({type(exc).__name__}). Please try again."})


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files (for serving catalog assets, floor plans, proof images, and generated PDFs)
os.makedirs("assets", exist_ok=True)
# Windows' MIME registry often lacks .webp, which makes StaticFiles label the
# catalog images text/plain. Register it explicitly so browsers and image
# loaders are handed the right type on every platform.
import mimetypes
mimetypes.add_type("image/webp", ".webp")
mimetypes.add_type("model/gltf-binary", ".glb")   # exported 3D models

# Catalog images were re-encoded to WebP (feedback 1.6). Stored URLs were
# migrated, but a link baked into an already-issued PDF, a browser cache or a
# vendor's bookmark still says .png/.jpg — serve the WebP twin for those rather
# than a 404.
_LEGACY_IMAGE_EXTS = (".png", ".jpg", ".jpeg")


@app.middleware("http")
async def legacy_catalog_image_fallback(request, call_next):
    path = request.scope.get("path", "")
    if path.startswith("/static/assets/catalog/") and path.lower().endswith(_LEGACY_IMAGE_EXTS):
        from urllib.parse import unquote
        rel = unquote(path[len("/static/assets/"):])
        original = os.path.join("assets", rel)
        if not os.path.exists(original):
            webp_rel = os.path.splitext(rel)[0] + ".webp"
            if os.path.exists(os.path.join("assets", webp_rel)):
                new_path = "/static/assets/" + webp_rel
                request.scope["path"] = new_path
                request.scope["raw_path"] = new_path.encode("utf-8")
    return await call_next(request)


app.mount("/static/assets", StaticFiles(directory="assets"), name="assets")
app.mount("/static/pdfs", StaticFiles(directory="assets"), name="assets_legacy")

# Mount Backend-AI interactive studio & rendered assets
from pathlib import Path
BACKEND_AI_DIR = Path(__file__).resolve().parents[2] / "backend-ai"
ai_fe = BACKEND_AI_DIR / "frontend"
if ai_fe.exists():
    app.mount("/static/ai-viewer", StaticFiles(directory=str(ai_fe)), name="ai_viewer")
ai_out = BACKEND_AI_DIR / "out"
if ai_out.exists():
    app.mount("/static/ai-out", StaticFiles(directory=str(ai_out)), name="ai_out")


# Routers
app.include_router(auth.router,             prefix="/api/v1/auth",            tags=["Auth"])
app.include_router(projects.router,         prefix="/api/v1/projects",        tags=["Projects"])
app.include_router(catalog.router,          prefix="/api/v1/catalog",         tags=["Catalog"])
app.include_router(ai_render.router,        prefix="/api/v1/ai",              tags=["AI Render"])
app.include_router(quotations.router,       prefix="/api/v1/quotations",      tags=["Quotations"])
app.include_router(vendors.router,          prefix="/api/v1/vendors",         tags=["Vendors"])
app.include_router(inquiry.router,          prefix="/api/v1/inquiry",         tags=["Inquiry"])
app.include_router(tracking.router,         prefix="/api/v1/tracking",        tags=["Tracking"])
app.include_router(admin.router,            prefix="/api/v1/admin",           tags=["Admin"])
app.include_router(recommendations.router,  prefix="/api/v1/recommendations", tags=["Recommendations"])
app.include_router(customer_routes.router,  prefix="/api/v1/customer",        tags=["Customer"])
app.include_router(vendor_routes.router,    prefix="/api/v1/vendor",          tags=["Vendor"])
app.include_router(enterprise.router,       prefix="/api/v1/enterprise",      tags=["Enterprise"])
app.include_router(project_team.router,     prefix="/api",                    tags=["Project Team Legacy"])
app.include_router(project_team.router,     prefix="/api/v1/team",            tags=["Project Team"])

# ── Stakeholder feedback (Sept 2026 review) ──────────────────────────────────
app.include_router(quotation_admin.router,  prefix="/api/v1/quotation-admin", tags=["Quotation Admin"])
app.include_router(approvals.router,        prefix="/api/v1/approvals",       tags=["Approvals & B2B"])
app.include_router(item_tracking.router,    prefix="/api/v1/item-tracking",   tags=["Item Tracking"])
app.include_router(vendor_availability.router, prefix="/api/v1/vendor",       tags=["Vendor Availability"])
app.include_router(special_services.router, prefix="/api/v1/special-services", tags=["Special Services"])
app.include_router(premium_render.router,   prefix="/api/v1/ai",              tags=["AI Render"])
app.include_router(design_studio.router,    prefix="/api/v1/ai",              tags=["Design Studio"])


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "Interior AI Platform", "version": "2.0.0"}


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Interior AI Platform API v2 — Reloaded",
        "docs": "/docs",
        "health": "/health",
    }

