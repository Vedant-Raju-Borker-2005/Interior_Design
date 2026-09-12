"""FastAPI production REST API surface."""
from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .catalog import Brief, Catalog
from .pipeline import DesignPipeline

BASE_DIR = Path(__file__).resolve().parents[1]

_blobs_env = os.environ.get("IDS_BLOBS")
if _blobs_env and Path(_blobs_env).exists():
    DEF_BLOBS = _blobs_env
elif Path("build/data_blobs.js").exists():
    DEF_BLOBS = "build/data_blobs.js"
else:
    DEF_BLOBS = str(BASE_DIR / "build" / "data_blobs.js")

_art_env = os.environ.get("IDS_ARTIFACTS")
if _art_env and Path(_art_env).exists():
    DEF_ARTIFACTS = _art_env
elif Path("artifacts/latest").exists():
    DEF_ARTIFACTS = "artifacts/latest"
else:
    DEF_ARTIFACTS = str(BASE_DIR / "artifacts" / "latest")

FRONTEND_DIR = BASE_DIR / "frontend"
OUT_DIR = BASE_DIR / "out"


class DesignRequest(BaseModel):
    city: str = Field(default="Mumbai")
    bhk: str = Field(default="2 BHK")
    scope: str = Field(default="Full Home")
    budget: str = Field(default="₹8L–₹12L")
    quality: str = Field(default="Standard")
    timeline: str = Field(default="45 Days")
    style: str = Field(default="Modern")
    wood: str = Field(default="Teak Laminate")
    fabric: str = Field(default="Woven Fabric")
    colors: list[str] = Field(default_factory=lambda: ["Off White", "Charcoal Grey", "Burnt Orange"])
    solve: bool = Field(default=True)


pipeline_instance: DesignPipeline | None = None


def get_pipeline() -> DesignPipeline:
    global pipeline_instance
    if pipeline_instance is None:
        art_path = Path(DEF_ARTIFACTS)
        if (art_path / "bundle.joblib").exists():
            pipeline_instance = DesignPipeline.load(art_path, blobs=DEF_BLOBS)
        else:
            pipeline_instance = DesignPipeline.build(blobs=DEF_BLOBS)
    return pipeline_instance


@asynccontextmanager
async def lifespan(app: FastAPI):
    get_pipeline()
    yield


def build_app() -> FastAPI:
    app = FastAPI(
        title="Automated Interior Design System API",
        description="Spatial constraint solving, associative recommendation & price prediction.",
        version="1.0.0",
        lifespan=lifespan,
    )

    if FRONTEND_DIR.exists():
        app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

        @app.get("/", include_in_schema=False)
        def index():
            index_file = FRONTEND_DIR / "index.html"
            if index_file.exists():
                return FileResponse(index_file)
            return {"message": "index.html not found"}

    @app.get("/health")
    def health():
        pipe = get_pipeline()
        meta = pipe.bundle.export().get("meta", {})
        return {
            "status": "healthy",
            "version": meta.get("version", "v1"),
            "models": meta,
        }

    @app.get("/options")
    def options():
        pipe = get_pipeline()
        cat = pipe.catalog
        return {
            "styles": list(cat.styles),
            "woods": list(cat.woods),
            "fabrics": list(cat.fabrics),
            "budgets": list(cat.budgets),
            "qualities": list(cat.qualities),
            "colors": sorted(cat.KNOWN_COLORS),
        }

    @app.post("/design")
    def design(req: DesignRequest):
        pipe = get_pipeline()
        try:
            brief = Brief(
                city=req.city,
                bhk=req.bhk,
                scope=req.scope,
                budget=req.budget,
                quality=req.quality,
                timeline=req.timeline,
                style=req.style,
                wood=req.wood,
                fabric=req.fabric,
                colors=tuple(req.colors),
            )
            res = pipe.design(brief, solve=req.solve)
            return {
                "feasible": res.feasible,
                "tier": res.tier,
                "price": round(res.price),
                "price_with_recommendations": round(res.price_with_recommendations),
                "palette": {
                    "dominant": res.palette.dominant,
                    "secondary": res.palette.secondary,
                    "accent": res.palette.accent,
                },
                "recommendations": res.recommendations,
                "scene": res.scene.to_dict(),
                "violations": [str(v) for v in res.violations],
            }
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))

    return app


app = build_app()
