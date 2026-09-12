"""Automated Interior Design System (IDS) Package."""
from __future__ import annotations

from .catalog import Brief, Catalog, Palette
from .pipeline import DesignPipeline, DesignResult
from .scene import Box, Opening, Room, Scene, SceneObject, Violation, validate
from .solver import CPSATBackend, SpatialSolver, SweepBackend

__all__ = [
    "Brief",
    "Catalog",
    "Palette",
    "DesignPipeline",
    "DesignResult",
    "Box",
    "Opening",
    "Room",
    "Scene",
    "SceneObject",
    "Violation",
    "validate",
    "CPSATBackend",
    "SpatialSolver",
    "SweepBackend",
]
