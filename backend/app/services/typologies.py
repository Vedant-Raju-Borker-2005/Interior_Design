"""Which layouts a customer may choose from, and what one looks like.

A builder's brochure prints several layouts per configuration: two 1 BHKs that
differ in where the kitchen sits, three 2 BHKs of different carpet areas. The
customer knows which flat is theirs. Asking them is both more accurate than
guessing from the configuration alone and the only way to get the right floor
plan in front of them before they start choosing furniture.

Where the layouts come from depends on who is asking:

* a buyer in a builder's tower sees that tower's layouts, through the flat they
  were invited to or through the project's parent;
* everybody else sees the catalogue layouts, the ones with no project of their
  own.

Both are filtered by the configuration the customer has already given, so a
2 BHK buyer is never shown a 3 BHK plan.
"""
from __future__ import annotations

from typing import Any, Optional

from sqlalchemy.orm import Session

from ..models import Flat, Project, Typology


def normalise_bhk(value: Optional[str]) -> str:
    """"2 bhk", "2BHK", "2-BHK" -> "2BHK". Empty stays empty."""
    if not value:
        return ""
    return "".join(str(value).split()).replace("-", "").replace("_", "").upper()


def as_dict(t: Typology, *, assigned: int = 0) -> dict[str, Any]:
    """One layout, in the shape the onboarding screen reads."""
    plan_url = t.floor_plan.file_url if t.floor_plan else None
    return {
        "id": t.id,
        "name": t.name,
        "bhk_type": t.bhk_type,
        "carpet_area_sqft": t.carpet_area_sqft,
        "description": t.description,
        # The picture the customer recognises their flat by. The floor plan is
        # the better one when there is a choice, because that is what a builder
        # prints and what the buyer has seen before.
        "image_url": plan_url or t.image_url,
        "floor_plan_url": plan_url,
        "floor_plan_id": t.floor_plan_id,
        "project_id": t.project_id,
        "is_catalogue": t.project_id is None,
        "assigned_count": assigned,
    }


def source_project_id(project: Optional[Project], db: Session) -> Optional[str]:
    """The builder project whose layouts this customer should see, if any.

    A customer's own project is a child of the builder's, or is pointed at by
    the flat they were invited to. Either route leads to the same tower.
    """
    if project is None:
        return None
    if getattr(project, "parent_project_id", None):
        return project.parent_project_id
    flat = db.query(Flat).filter(Flat.customer_project_id == project.id).first()
    return flat.project_id if flat else None


def available(db: Session, *, bhk: Optional[str] = None,
              project: Optional[Project] = None) -> list[dict[str, Any]]:
    """The layouts this customer may pick from, best match first.

    A tower with no layouts loaded falls back to the catalogue, so the step
    never shows the customer an empty screen.
    """
    wanted = normalise_bhk(bhk)
    tower_id = source_project_id(project, db)

    rows: list[Typology] = []
    if tower_id:
        rows = db.query(Typology).filter(Typology.project_id == tower_id).all()
    if not rows:
        rows = db.query(Typology).filter(Typology.project_id.is_(None)).all()

    if wanted:
        matching = [t for t in rows if normalise_bhk(t.bhk_type) == wanted]
        # A layout that never said which configuration it belongs to is still
        # offered, rather than hidden: the builder's own data is often partial,
        # and showing nothing is worse than showing one the customer can reject.
        if matching:
            rows = matching
        else:
            rows = [t for t in rows if not t.bhk_type] or rows

    rows.sort(key=lambda t: (t.carpet_area_sqft or 0, t.name or ""))
    return [as_dict(t) for t in rows]


def chosen(db: Session, project: Project) -> Optional[dict[str, Any]]:
    """The layout this customer has already picked, if they have."""
    typology_id = getattr(project, "typology_id", None)
    if not typology_id:
        flat = db.query(Flat).filter(Flat.customer_project_id == project.id).first()
        typology_id = flat.typology_id if flat else None
    if not typology_id:
        return None
    t = db.query(Typology).filter(Typology.id == typology_id).first()
    return as_dict(t) if t else None


def apply_choice(db: Session, project: Project, typology_id: Optional[str]) -> Optional[Typology]:
    """Record the customer's layout on the project, and on their flat.

    Clearing it is allowed: a customer who no longer recognises any of the
    layouts should be able to go on without one rather than be stuck.
    """
    typology: Optional[Typology] = None
    if typology_id:
        typology = db.query(Typology).filter(Typology.id == typology_id).first()
        if typology is None:
            raise ValueError("That layout is no longer available.")

    project.typology_id = typology.id if typology else None
    # The flat is what the builder's side reads, so it is kept in step.
    flat = db.query(Flat).filter(Flat.customer_project_id == project.id).first()
    if flat is not None:
        flat.typology_id = project.typology_id

    # The layout carries the carpet area and the plan the customer confirmed,
    # so the configuration follows it rather than an earlier guess.
    if typology is not None and typology.bhk_type:
        project.bhk_type = normalise_bhk(typology.bhk_type)
    db.commit()

    # And the layout's own drawing becomes the plan the home is designed
    # against, so the 2D plan and the 3D model show these rooms and not a
    # generic arrangement for the configuration.
    from . import typology_plan
    typology_plan.apply_to_project(db, project, typology)
    return typology
