from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
import os, shutil

from ..db import get_db
from ..models import Project, Room, RoomItem, Product, User
from ..schemas import CreateProjectReq, UpdateRoomReq, AddRoomItemReq, AddRoomReq
from ..auth_utils import current_user
import uuid

router = APIRouter()

BHK_ROOMS = {
    "1BHK": ["living_room", "bedroom_master", "kitchen", "bathroom"],
    "2BHK": ["living_room", "bedroom_master", "bedroom_2", "kitchen", "bathroom", "balcony"],
    "3BHK": ["living_room", "bedroom_master", "bedroom_2", "bedroom_3", "kitchen", "bathroom", "bathroom_2", "balcony"],
    "4BHK": ["living_room", "bedroom_master", "bedroom_2", "bedroom_3", "bedroom_4", "kitchen", "bathroom", "bathroom_2", "bathroom_3", "balcony"],
    "5BHK": ["living_room", "bedroom_master", "bedroom_2", "bedroom_3", "bedroom_4", "bedroom_5", "kitchen", "bathroom", "bathroom_2", "bathroom_3", "dining_room", "balcony", "home_office"],
}

ROOM_DEFAULTS = {
    "living_room":    {"length_ft": 18, "width_ft": 14, "height_ft": 9},
    "bedroom_master": {"length_ft": 14, "width_ft": 12, "height_ft": 9},
    "bedroom_2":      {"length_ft": 12, "width_ft": 10, "height_ft": 9},
    "bedroom_3":      {"length_ft": 11, "width_ft": 10, "height_ft": 9},
    "bedroom_4":      {"length_ft": 10, "width_ft": 10, "height_ft": 9},
    "bedroom_5":      {"length_ft": 10, "width_ft": 10, "height_ft": 9},
    "kitchen":        {"length_ft": 10, "width_ft": 8,  "height_ft": 9},
    "bathroom":       {"length_ft": 7,  "width_ft": 5,  "height_ft": 9},
    "bathroom_2":     {"length_ft": 6,  "width_ft": 5,  "height_ft": 9},
    "bathroom_3":     {"length_ft": 6,  "width_ft": 4,  "height_ft": 9},
    "balcony":        {"length_ft": 10, "width_ft": 5,  "height_ft": 9},
    "dining_room":    {"length_ft": 12, "width_ft": 10, "height_ft": 9},
    "home_office":    {"length_ft": 10, "width_ft": 9,  "height_ft": 9},
}


@router.post("", summary="Create a new design project")
def create_project(
    req: CreateProjectReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    # Check if a project with the same name already exists for this user
    existing = db.query(Project).filter(
        Project.user_id == user.id,
        Project.property_name.ilike(req.property_name)
    ).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A project named '{req.property_name}' already exists for this customer."
        )

    pid = str(uuid.uuid4())
    project = Project(
        id=pid,
        user_id=user.id,
        bhk_type=req.bhk_type,
        property_name=req.property_name,
        city=req.city,
        budget=req.budget,
        package_id=req.package_id,
        total_area_sqft=req.total_area_sqft,
        material_preference=getattr(req, 'material_preference', None),
        furnishing_type=getattr(req, 'furnishing_type', None),
        pincode=getattr(req, 'pincode', None),
        status="draft",
        color_preferences=req.color_preferences or [],
    )
    db.add(project)

    # Increment selection counts in ColorAnalytics for popularity ranking
    if req.color_preferences:
        from .catalog import classify_color_family
        from ..models import ColorAnalytics
        import datetime
        for color_name in req.color_preferences:
            cname = color_name.strip().title()
            analytics = db.query(ColorAnalytics).filter(ColorAnalytics.color_name == cname).first()
            if not analytics:
                cat = classify_color_family(cname)
                analytics = ColorAnalytics(
                    color_name=cname,
                    selection_count=1,
                    last_selected=datetime.datetime.utcnow(),
                    category=cat
                )
                db.add(analytics)
            else:
                analytics.selection_count += 1
                analytics.last_selected = datetime.datetime.utcnow()

    rooms_out = []
    for rtype in BHK_ROOMS.get(req.bhk_type, []):
        defaults = ROOM_DEFAULTS.get(rtype, {})
        room = Room(
            id=str(uuid.uuid4()),
            project_id=pid,
            room_type=rtype,
            length_ft=defaults.get("length_ft", 12),
            width_ft=defaults.get("width_ft", 10),
            height_ft=defaults.get("height_ft", 9),
        )
        db.add(room)
        rooms_out.append({"id": room.id, "type": rtype, **defaults})

    db.commit()
    return {"project_id": pid, "rooms": rooms_out}


@router.get("", summary="List current user's projects")
def list_projects(user: User = Depends(current_user), db: Session = Depends(get_db)):
    projects = db.query(Project).filter(Project.user_id == user.id).order_by(Project.created_at.desc()).all()
    return {"projects": [_project_summary(p) for p in projects]}


@router.get("/{project_id}", summary="Get project detail with rooms")
def get_project(project_id: str, user: User = Depends(current_user), db: Session = Depends(get_db)):
    project = _get_project_or_404(project_id, user.id, db)
    rooms = db.query(Room).filter(Room.project_id == project_id).all()
    return {
        **_project_summary(project),
        "rooms": [_room_detail(r, db) for r in rooms],
    }


@router.put("/{project_id}", summary="Update project status / package")
def update_project(
    project_id: str,
    payload: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(project_id, user.id, db)
    for field in ["status", "package_id", "budget", "property_name"]:
        if field in payload:
            setattr(project, field, payload[field])
    db.commit()
    return {"message": "updated"}


@router.put("/{project_id}/rooms/{room_id}", summary="Update room preferences")
def update_room(
    project_id: str,
    room_id: str,
    req: UpdateRoomReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(project_id, user.id, db)
    room = db.query(Room).filter(Room.id == room_id, Room.project_id == project_id).first()
    if not room:
        raise HTTPException(404, "Room not found")
    if req.style_preference is not None:
        room.style_preference = req.style_preference
    if req.color_palette is not None:
        room.color_palette = req.color_palette
    if req.length_ft is not None:
        room.length_ft = req.length_ft
    if req.width_ft is not None:
        room.width_ft = req.width_ft
    if req.height_ft is not None:
        room.height_ft = req.height_ft
    db.commit()
    return {"message": "room updated"}


@router.post("/{project_id}/rooms/{room_id}/items", summary="Add product to room")
def add_room_item(
    project_id: str,
    room_id: str,
    req: AddRoomItemReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(project_id, user.id, db)
    room = db.query(Room).filter(Room.id == room_id, Room.project_id == project_id).first()
    if not room:
        raise HTTPException(404, "Room not found")
    product = db.query(Product).filter(Product.id == req.product_id).first()
    if not product:
        raise HTTPException(404, "Product not found")

    # Check if already added
    existing = db.query(RoomItem).filter(RoomItem.room_id == room_id, RoomItem.product_id == req.product_id).first()
    if existing:
        existing.qty = req.qty
        existing.custom_color = req.custom_color
        existing.custom_material = req.custom_material
        existing.custom_size = req.custom_size
        existing.custom_fabric = req.custom_fabric
        existing.custom_wood_finish = req.custom_wood_finish
        existing.custom_texture = req.custom_texture
        existing.custom_cushion_style = req.custom_cushion_style
        existing.unit_price = product.price
        db.commit()
        return {"message": "item updated", "item_id": existing.id}

    item = RoomItem(
        id=str(uuid.uuid4()),
        room_id=room_id,
        product_id=req.product_id,
        qty=req.qty,
        custom_color=req.custom_color,
        custom_material=req.custom_material,
        custom_size=req.custom_size,
        custom_fabric=req.custom_fabric,
        custom_wood_finish=req.custom_wood_finish,
        custom_texture=req.custom_texture,
        custom_cushion_style=req.custom_cushion_style,
        unit_price=product.price,
    )
    db.add(item)
    db.commit()
    return {"message": "item added", "item_id": item.id}


@router.delete("/{project_id}/rooms/{room_id}/items/{item_id}", summary="Remove product from room")
def remove_room_item(
    project_id: str, room_id: str, item_id: str,
    user: User = Depends(current_user), db: Session = Depends(get_db),
):
    project = _get_project_or_404(project_id, user.id, db)
    item = db.query(RoomItem).filter(RoomItem.id == item_id, RoomItem.room_id == room_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    db.delete(item)
    db.commit()
    return {"message": "item removed"}


@router.post("/{project_id}/rooms", summary="Add a new room to a project")
def add_room(
    project_id: str,
    req: AddRoomReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(project_id, user.id, db)
    defaults = ROOM_DEFAULTS.get(req.room_type, {})
    room = Room(
        id=str(uuid.uuid4()),
        project_id=project_id,
        room_type=req.room_type,
        length_ft=req.length_ft or defaults.get("length_ft", 12),
        width_ft=req.width_ft or defaults.get("width_ft", 10),
        height_ft=req.height_ft or defaults.get("height_ft", 9),
    )
    db.add(room)
    db.commit()
    return {"message": "room added", "room_id": room.id, "room_type": req.room_type}


@router.delete("/{project_id}/rooms/{room_id}", summary="Remove a room from a project")
def delete_room(
    project_id: str, room_id: str,
    user: User = Depends(current_user), db: Session = Depends(get_db),
):
    project = _get_project_or_404(project_id, user.id, db)
    room = db.query(Room).filter(Room.id == room_id, Room.project_id == project_id).first()
    if not room:
        raise HTTPException(404, "Room not found")
    db.delete(room)
    db.commit()
    return {"message": "room deleted"}


@router.post("/{project_id}/floor-plan", summary="Upload floor plan image or PDF")
async def upload_floor_plan(
    project_id: str,
    file: UploadFile = File(...),
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    project = _get_project_or_404(project_id, user.id, db)
    upload_dir = os.path.join("pdfs", "floor_plans")
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "plan.jpg")[1] or ".jpg"
    filename = f"fp_{project_id[:8]}{ext}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        shutil.copyfileobj(file.file, f)
    url = f"http://localhost:8000/static/pdfs/floor_plans/{filename}"
    project.floor_plan_url = url
    db.commit()
    return {"message": "uploaded", "floor_plan_url": url}


# ── Helpers ───────────────────────────────────────────────────────────────────
def _get_project_or_404(project_id: str, user_id: str, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    return project


def _project_summary(p: Project) -> dict:
    return {
        "id": p.id,
        "bhk_type": p.bhk_type,
        "property_name": p.property_name,
        "city": p.city,
        "budget": p.budget,
        "status": p.status,
        "package_id": p.package_id,
        "total_area_sqft": p.total_area_sqft,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


def _room_detail(r: Room, db: Session) -> dict:
    items = db.query(RoomItem).filter(RoomItem.room_id == r.id).all()
    return {
        "id": r.id,
        "room_type": r.room_type,
        "length_ft": r.length_ft,
        "width_ft": r.width_ft,
        "height_ft": r.height_ft,
        "style_preference": r.style_preference,
        "color_palette": r.color_palette or [],
        "items": [
            {
                "id": it.id,
                "product_id": it.product_id,
                "qty": it.qty,
                "custom_color": it.custom_color,
                "custom_material": it.custom_material,
                "custom_size": it.custom_size,
                "custom_fabric": it.custom_fabric,
                "custom_wood_finish": it.custom_wood_finish,
                "custom_texture": it.custom_texture,
                "custom_cushion_style": it.custom_cushion_style,
                "unit_price": it.unit_price,
                "product": {
                    "id": it.product.id,
                    "sku": it.product.sku,
                    "name": it.product.name,
                    "category": it.product.category,
                    "thumbnail_url": it.product.thumbnail_url,
                    "price": it.product.price,
                    "variants": it.product.variants or {},
                } if it.product else None,
            }
            for it in items
        ],
    }
