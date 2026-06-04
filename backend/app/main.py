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
from .routers import auth, projects, catalog, ai_render, quotations, vendors, inquiry, tracking, admin, recommendations, customer_routes, vendor_routes, project_team

DEFAULT_CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
    if origin.strip()
]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    os.makedirs("pdfs", exist_ok=True)
    os.makedirs("pdfs/floor_plans", exist_ok=True)
    init_db()
    db = SessionLocal()
    try:
        seed_database(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title="Interior AI Platform API",
    version="2.0.0",
    description="AI-Based Modular Interior Design & Visualization Platform",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files (for serving generated PDFs and floor plans)
os.makedirs("pdfs", exist_ok=True)
app.mount("/static/pdfs", StaticFiles(directory="pdfs"), name="pdfs")

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
app.include_router(project_team.router,     prefix="/api",                    tags=["Project Team Legacy"])
app.include_router(project_team.router,     prefix="/api/v1/team",            tags=["Project Team"])


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "Interior AI Platform", "version": "2.0.0"}


@app.get("/", tags=["Root"])
def root():
    return {
        "message": "Interior AI Platform API v2",
        "docs": "/docs",
        "health": "/health",
    }
