import secrets
import uuid
import datetime
import os
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Project, Flat, User, FloorPlan, Room, RoomItem, Product, ProjectTeamMember, ProjectAssignment
from ..schemas import (
    CreateEnterpriseProjectReq, ConfigureUnitMixReq, UpdateFlatReq,
    AssignCustomerReq, AcceptInvitationReq, UpdateCustomerOnboardingReq
)
from ..auth_utils import current_user

router = APIRouter()

# Helper: Require Enterprise Role
def require_enterprise(user: User = Depends(current_user)):
    user_roles = [r.strip() for r in (user.role or "customer").split(",")]
    if "enterprise" not in user_roles and "admin" not in user_roles:
        raise HTTPException(
            status_code=403,
            detail="Only enterprise accounts are authorized to perform this operation."
        )
    return user


@router.post("/projects", summary="Create an Enterprise project")
def create_enterprise_project(
    req: CreateEnterpriseProjectReq,
    user: User = Depends(require_enterprise),
    db: Session = Depends(get_db)
):
    pid = str(uuid.uuid4())
    project = Project(
        id=pid,
        user_id=user.id,
        property_name=req.property_name,
        city=req.city,
        pincode=req.pincode,
        furnishing_type=req.furnishing_type,
        total_units=req.total_units,
        earliest_start_date=req.earliest_start_date,
        status="draft",
        defaults={}
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return {"project_id": pid, "property_name": project.property_name}


@router.get("/projects", summary="List Enterprise projects")
def list_enterprise_projects(
    user: User = Depends(require_enterprise),
    db: Session = Depends(get_db)
):
    projects = db.query(Project).filter(
        Project.user_id == user.id,
        Project.parent_project_id.is_(None)
    ).order_by(Project.created_at.desc()).all()
    
    out = []
    for p in projects:
        # Calculate stats
        total = db.query(Flat).filter(Flat.project_id == p.id).count()
        completed = db.query(Flat).filter(Flat.project_id == p.id, Flat.status == "Completed").count()
        in_progress = db.query(Flat).filter(Flat.project_id == p.id, Flat.status.in_(["Onboarding", "Onboarding Complete", "Customization", "AI Rendering"])).count()
        not_started = total - completed - in_progress
        
        out.append({
            "id": p.id,
            "property_name": p.property_name,
            "city": p.city,
            "total_units": p.total_units,
            "earliest_start_date": p.earliest_start_date,
            "flats_count": total,
            "stats": {
                "completed": completed,
                "in_progress": in_progress,
                "not_started": not_started
            }
        })
    return {"projects": out}


@router.get("/projects/{project_id}", summary="Get Enterprise project detail")
def get_enterprise_project(
    project_id: str,
    user: User = Depends(require_enterprise),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user.id
    ).first()
    if not project:
        raise HTTPException(404, "Enterprise project not found")
        
    flats = db.query(Flat).filter(Flat.project_id == project_id).all()
    
    # Calculate stats
    total = len(flats)
    completed = sum(1 for f in flats if f.status == "Completed")
    started = sum(1 for f in flats if f.status in ["Onboarding", "Onboarding Complete", "Customization", "AI Rendering"])
    invited = sum(1 for f in flats if f.status == "Invited")
    unassigned = sum(1 for f in flats if f.status == "Unassigned")
    not_invited = sum(1 for f in flats if f.status == "Not Invited")
    
    return {
        "id": project.id,
        "property_name": project.property_name,
        "city": project.city,
        "pincode": project.pincode,
        "furnishing_type": project.furnishing_type,
        "total_units": project.total_units,
        "earliest_start_date": project.earliest_start_date,
        "defaults": project.defaults or {},
        "stats": {
            "total": total,
            "completed": completed,
            "started": started,
            "invited": invited,
            "unassigned": unassigned,
            "not_invited": not_invited
        }
    }


@router.post("/projects/{project_id}/unit-mix", summary="Configure BHK Unit Mix and generate flats")
def configure_unit_mix(
    project_id: str,
    req: ConfigureUnitMixReq,
    user: User = Depends(require_enterprise),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(
        Project.id == project_id,
        Project.user_id == user.id
    ).first()
    if not project:
        raise HTTPException(404, "Project not found")

    # Validate unit mix sum equals total flats
    total_mix = sum(req.bhk_mix.values())
    if total_mix != project.total_units:
        raise HTTPException(
            status_code=400,
            detail=f"The sum of BHK units ({total_mix}) must equal the total number of flats ({project.total_units})."
        )

    # Remove existing unassigned flats to reconfigure
    db.query(Flat).filter(Flat.project_id == project_id, Flat.status == "Unassigned").delete()

    generated_flats = []
    # Loop over BHK types to generate sequential flats
    floor = 1
    for bhk_type, count in req.bhk_mix.items():
        # Clean BHK type name to get a prefix digit (e.g. '2BHK' -> 2)
        digit = "".join(filter(str.isdigit, bhk_type))
        prefix = int(digit) if digit else floor
        
        for i in range(1, count + 1):
            flat_no = f"{prefix}{i:02d}"
            
            flat = Flat(
                id=str(uuid.uuid4()),
                project_id=project_id,
                flat_number=flat_no,
                bhk_type=bhk_type,
                status="Unassigned"
            )
            db.add(flat)
            generated_flats.append(flat)
        floor += 1

    db.commit()
    return {"message": "Unit mix configured", "generated_units": len(generated_flats)}


@router.get("/projects/{project_id}/flats", summary="List flats of an Enterprise project")
def list_project_flats(
    project_id: str,
    user: User = Depends(require_enterprise),
    db: Session = Depends(get_db)
):
    # Security check: verify project ownership
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found or unauthorized")
        
    flats = db.query(Flat).filter(Flat.project_id == project_id).all()
    
    out = []
    for f in flats:
        cust = db.query(User).filter(User.id == f.customer_id).first() if f.customer_id else None
        
        # Calculate customization cost variation if customer has project setup
        cost = 0
        variation = 0
        if f.customer_project_id:
            proj_data = db.query(Project).filter(Project.id == f.customer_project_id).first()
            if proj_data:
                for room in proj_data.rooms:
                    for item in room.items:
                        cost += (item.unit_price or 0) * (item.qty or 1)
                
                base_price = proj_data.package.base_price if proj_data.package else 0
                variation = cost - base_price

        out.append({
            "id": f.id,
            "flat_number": f.flat_number,
            "bhk_type": f.bhk_type,
            "floor_plan_id": f.floor_plan_id,
            "floor_plan_name": f.floor_plan.file_type if f.floor_plan else None,
            "floor_plan_url": f.floor_plan.file_url if f.floor_plan else None,
            "customer_id": f.customer_id,
            "customer_name": cust.name if cust else None,
            "customer_phone": cust.phone if cust else None,
            "customer_email": cust.email if cust else None,
            "invitation_token": f.invitation_token,
            "status": f.status,
            "overall_progress": f.overall_progress,
            "customer_project_id": f.customer_project_id,
            "current_cost": cost,
            "cost_variation": variation
        })
    return {"flats": out}


@router.post("/projects/{project_id}/floor-plans", summary="Upload enterprise floor plan template")
def upload_enterprise_floor_plan(
    project_id: str,
    layout_name: str = Form(...),
    file: UploadFile = File(...),
    user: User = Depends(require_enterprise),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")

    upload_dir = os.path.join("pdfs", "floor_plans")
    os.makedirs(upload_dir, exist_ok=True)
    ext = os.path.splitext(file.filename or "plan.jpg")[1] or ".jpg"
    
    file_id = str(uuid.uuid4())
    filename = f"fp_ent_{file_id[:8]}{ext}"
    filepath = os.path.join(upload_dir, filename)
    with open(filepath, "wb") as f:
        import shutil
        shutil.copyfileobj(file.file, f)
    
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    url = f"{backend_url}/static/pdfs/floor_plans/{filename}"
    
    fp = FloorPlan(
        id=file_id,
        project_id=project_id,
        file_url=url,
        file_type=layout_name, # Storing layout description name
        uploaded_by=user.id
    )
    db.add(fp)
    db.commit()
    db.refresh(fp)
    
    return {"id": fp.id, "layout_name": fp.file_type, "file_url": fp.file_url}


@router.get("/projects/{project_id}/floor-plans", summary="List enterprise floor plan templates")
def list_enterprise_floor_plans(
    project_id: str,
    user: User = Depends(require_enterprise),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    plans = db.query(FloorPlan).filter(FloorPlan.project_id == project_id).all()
    return [{"id": p.id, "layout_name": p.file_type, "file_url": p.file_url} for p in plans]


@router.put("/flats/{flat_id}", summary="Edit Flat number/name, BHK type, or Floor plan layout")
def update_flat(
    flat_id: str,
    req: UpdateFlatReq,
    user: User = Depends(require_enterprise),
    db: Session = Depends(get_db)
):
    flat = db.query(Flat).filter(Flat.id == flat_id).first()
    if not flat:
        raise HTTPException(404, "Flat not found")
        
    project = db.query(Project).filter(Project.id == flat.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(403, "Not authorized to modify this flat")

    if req.flat_number is not None:
        flat.flat_number = req.flat_number
    if req.bhk_type is not None:
        flat.bhk_type = req.bhk_type
    if req.floor_plan_id is not None:
        if req.floor_plan_id == "":
            flat.floor_plan_id = None
        else:
            fp = db.query(FloorPlan).filter(FloorPlan.id == req.floor_plan_id, FloorPlan.project_id == project.id).first()
            if not fp:
                raise HTTPException(400, "Invalid floor plan layout ID")
            flat.floor_plan_id = req.floor_plan_id

    db.commit()
    return {"message": "Flat details updated"}


@router.post("/flats/{flat_id}/assign", summary="Assign customer to flat")
def assign_customer(
    flat_id: str,
    req: AssignCustomerReq,
    user: User = Depends(require_enterprise),
    db: Session = Depends(get_db)
):
    flat = db.query(Flat).filter(Flat.id == flat_id).first()
    if not flat:
        raise HTTPException(404, "Flat not found")
        
    project = db.query(Project).filter(Project.id == flat.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(403, "Not authorized to assign customer to this flat")

    cust_user = None
    if req.phone:
        cust_user = db.query(User).filter(User.phone == req.phone).first()
    if not cust_user and req.email:
        cust_user = db.query(User).filter(User.email == req.email).first()

    if not cust_user:
        cust_user = User(
            id=str(uuid.uuid4()),
            name=req.name,
            phone=req.phone,
            email=req.email,
            role="customer",
            city=project.city
        )
        db.add(cust_user)
        db.commit()
        db.refresh(cust_user)

    flat.customer_id = cust_user.id
    flat.status = "Not Invited"
    db.commit()
    
    return {"message": "Customer assigned", "customer_id": cust_user.id}


@router.post("/flats/{flat_id}/invite", summary="Generate customer invitation token")
def generate_invitation_token(
    flat_id: str,
    user: User = Depends(require_enterprise),
    db: Session = Depends(get_db)
):
    flat = db.query(Flat).filter(Flat.id == flat_id).first()
    if not flat:
        raise HTTPException(404, "Flat not found")
        
    project = db.query(Project).filter(Project.id == flat.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(403, "Not authorized")
        
    if not flat.customer_id:
        raise HTTPException(400, "Please assign a customer to this flat before generating an invitation link.")

    token = secrets.token_urlsafe(32)
    flat.invitation_token = token
    flat.status = "Invited"
    db.commit()
    
    return {"invitation_token": token}


@router.post("/flats/{flat_id}/revoke-invite", summary="Revoke flat invitation")
def revoke_invitation(
    flat_id: str,
    user: User = Depends(require_enterprise),
    db: Session = Depends(get_db)
):
    flat = db.query(Flat).filter(Flat.id == flat_id).first()
    if not flat:
        raise HTTPException(404, "Flat not found")
        
    project = db.query(Project).filter(Project.id == flat.project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(403, "Not authorized")

    flat.invitation_token = None
    flat.status = "Not Invited"
    db.commit()
    
    return {"message": "Invitation revoked"}


# ── Public Invitation Validations (B2B2C Handoff) ───────────────────────────

@router.get("/invitations/validate", summary="Validate public invitation token")
def validate_invitation(token: str, db: Session = Depends(get_db)):
    flat = db.query(Flat).filter(Flat.invitation_token == token).first()
    if not flat:
        raise HTTPException(400, "Invalid, expired or revoked invitation token.")
        
    parent_project = db.query(Project).filter(Project.id == flat.project_id).first()
    if not parent_project:
        raise HTTPException(404, "Associated project not found.")

    cust = db.query(User).filter(User.id == flat.customer_id).first()

    return {
        "valid": True,
        "flat_id": flat.id,
        "flat_number": flat.flat_number,
        "bhk_type": flat.bhk_type,
        "project_name": parent_project.property_name,
        "city": parent_project.city,
        "earliest_start_date": parent_project.earliest_start_date,
        "customer_name": cust.name if cust else "Valued Client",
        "customer_project_id": flat.customer_project_id
    }


@router.post("/invitations/accept", summary="Customer accepts invitation and configures flat project")
def accept_invitation(
    req: AcceptInvitationReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    flat = db.query(Flat).filter(Flat.invitation_token == req.token).first()
    if not flat:
        raise HTTPException(400, "Invalid, expired or revoked invitation token.")

    parent_project = db.query(Project).filter(Project.id == flat.project_id).first()
    if not parent_project:
        raise HTTPException(404, "Parent project not found.")

    flat.customer_id = user.id
    
    if flat.customer_project_id:
        return {"project_id": flat.customer_project_id, "message": "Invitation already accepted"}

    pid = str(uuid.uuid4())
    child_project = Project(
        id=pid,
        user_id=user.id,
        parent_project_id=parent_project.id,
        bhk_type=flat.bhk_type,
        property_name=f"Flat {flat.flat_number}, {parent_project.property_name}",
        city=parent_project.city,
        pincode=parent_project.pincode,
        furnishing_type=parent_project.furnishing_type,
        budget=0.0,
        status="draft",
        floor_plan_url=flat.floor_plan.file_url if flat.floor_plan else None,
        color_preferences=[]
    )
    db.add(child_project)

    # Initialize Rooms for child project
    from .projects import BHK_ROOMS, ROOM_DEFAULTS
    rooms_out = []
    for rtype in BHK_ROOMS.get(flat.bhk_type, []):
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
        rooms_out.append(room)

    flat.customer_project_id = pid
    flat.status = "Onboarding"
    # Keep the invitation token active until onboarding is fully complete
    db.commit()

    return {"project_id": pid}


@router.put("/projects/{project_id}/onboarding", summary="Update child project onboarding preferences")
def update_child_onboarding(
    project_id: str,
    req: UpdateCustomerOnboardingReq,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id, Project.user_id == user.id).first()
    if not project:
        raise HTTPException(404, "Child project not found or unauthorized")

    flat = db.query(Flat).filter(Flat.customer_project_id == project_id).first()
    if not flat:
        raise HTTPException(404, "Associated Flat unit details not found.")

    # Save customer preferences
    project.budget = req.budget
    project.material_preference = req.material_preference
    project.interior_material_preference = req.interior_material_preference
    project.fabric_preference = req.fabric_preference
    project.color_preferences = req.color_preferences

    # Update style preference on rooms
    for room in project.rooms:
        if req.style_tags:
            room.style_preference = req.style_tags[0]
        if req.color_preferences:
            room.color_palette = req.color_preferences[:3]

    flat.status = "Onboarding Complete"
    flat.invitation_token = None # Clear invitation token upon completing onboarding
    
    db.commit()
    return {"message": "Onboarding preferences saved"}

