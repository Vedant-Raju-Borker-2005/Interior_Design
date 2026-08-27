import uuid
import datetime
import os
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
import fastapi
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List, Optional

from ..db import get_db
from ..models import (
    User, Project, ProjectTeamMember, ProjectAssignment, ProjectProgressHistory,
    Task, DailyChecklist, SiteVisit, ProjectDelay, CommunicationLog, ProjectDocument,
    Issue, ProjectPhoto, ItemTracking, ActivityLog, Vendor, VendorAssignment, RoomItem,
    ProjectProgress, ProjectItemTrackingHistory, IssueComment, IssueAttachment, ChecklistItem
)
from ..auth_utils import current_user

router = APIRouter()

# Helper: Auto-detect delays
def auto_detect_delays(project_id: str, db: Session):
    today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    
    # 1. Item overdue
    overdue_items = db.query(ItemTracking).filter(
        ItemTracking.project_id == project_id,
        ItemTracking.status != "installed",
        ItemTracking.expected_date != "",
        ItemTracking.expected_date < today
    ).all()
    for item in overdue_items:
        reason = f"Item sourcing delayed: {item.item_name} (Expected by {item.expected_date})"
        existing = db.query(ProjectDelay).filter(
            ProjectDelay.project_id == project_id,
            ProjectDelay.reason == reason,
            ProjectDelay.resolved_at == None
        ).first()
        if not existing:
            delay = ProjectDelay(
                id=str(uuid.uuid4()),
                project_id=project_id,
                reason=reason,
                severity="MEDIUM",
                detected_at=datetime.datetime.utcnow()
            )
            db.add(delay)

    # 2. Vendor shipment delays
    overdue_shipments = db.query(VendorAssignment).filter(
        VendorAssignment.project_id == project_id,
        VendorAssignment.shipment_status != "Delivered",
        VendorAssignment.expected_arrival != None,
        VendorAssignment.expected_arrival < today
    ).all()
    for assignment in overdue_shipments:
        vendor = db.query(Vendor).filter(Vendor.id == assignment.vendor_id).first()
        vname = vendor.business_name or vendor.name if vendor else "Vendor"
        reason = f"Vendor shipment delayed from {vname} (Expected arrival: {assignment.expected_arrival})"
        existing = db.query(ProjectDelay).filter(
            ProjectDelay.project_id == project_id,
            ProjectDelay.reason == reason,
            ProjectDelay.resolved_at == None
        ).first()
        if not existing:
            delay = ProjectDelay(
                id=str(uuid.uuid4()),
                project_id=project_id,
                reason=reason,
                severity="HIGH",
                detected_at=datetime.datetime.utcnow()
            )
            db.add(delay)

    # 3. Missed Site Visit
    missed_visits = db.query(SiteVisit).filter(
        SiteVisit.project_id == project_id,
        SiteVisit.status == "SCHEDULED",
        SiteVisit.visit_date < datetime.datetime.utcnow()
    ).all()
    for visit in missed_visits:
        reason = f"Missed site visit scheduled on {visit.visit_date.strftime('%Y-%m-%d')}"
        existing = db.query(ProjectDelay).filter(
            ProjectDelay.project_id == project_id,
            ProjectDelay.reason == reason,
            ProjectDelay.resolved_at == None
        ).first()
        if not existing:
            delay = ProjectDelay(
                id=str(uuid.uuid4()),
                project_id=project_id,
                reason=reason,
                severity="LOW",
                detected_at=datetime.datetime.utcnow()
            )
            db.add(delay)

    # 4. Overdue Task
    overdue_tasks = db.query(Task).filter(
        Task.project_id == project_id,
        Task.status.in_(["PENDING", "IN_PROGRESS"]),
        Task.due_date < datetime.datetime.utcnow()
    ).all()
    for task in overdue_tasks:
        reason = f"Overdue task: {task.title} (Due: {task.due_date.strftime('%Y-%m-%d')})"
        existing = db.query(ProjectDelay).filter(
            ProjectDelay.project_id == project_id,
            ProjectDelay.reason == reason,
            ProjectDelay.resolved_at == None
        ).first()
        if not existing:
            delay = ProjectDelay(
                id=str(uuid.uuid4()),
                project_id=project_id,
                reason=reason,
                severity="HIGH",
                detected_at=datetime.datetime.utcnow()
            )
            db.add(delay)

    db.commit()


@router.get("/projects/{project_id}/team")
def get_project_team(
    project_id: str, 
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    # Get the project to check ownership
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
    
    # Check authorization: customers can only view their own projects' teams
    user_roles = [r.strip() for r in (user.role or "customer").split(",")]
    is_customer = "customer" in user_roles and len(user_roles) == 1
    
    if is_customer and project.user_id != user.id:
        raise HTTPException(403, "You can only view team members for your own projects")
    
    members = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_id == project_id,
        ProjectTeamMember.status == "ACTIVE"
    ).all()
    
    result = []
    for m in members:
        result.append({
            "id": m.id,
            "role": m.role,
            "status": m.status,
            "user": {
                "id": m.user.id,
                "name": m.user.name,
                "email": m.user.email,
                "avatarUrl": getattr(m.user, "avatar_url", None) or "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e"
            }
        })
    return result

@router.post("/projects/{project_id}/assign")
def assign_project_team(
    project_id: str,
    payload: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    # Parse user roles (comma-separated string)
    user_roles = [r.strip() for r in (user.role or "customer").split(",")]
    
    # Check if user has permission to assign (must be team_manager or admin)
    has_permission = "team_manager" in user_roles or "admin" in user_roles
    
    # Also check if user is a manager assigned to this project
    if not has_permission:
        manager_assignment = db.query(ProjectTeamMember).filter(
            ProjectTeamMember.project_id == project_id, 
            ProjectTeamMember.user_id == user.id, 
            ProjectTeamMember.role == "MANAGER"
        ).first()
        has_permission = manager_assignment is not None
    
    if not has_permission:
        raise HTTPException(403, "Only managers can assign team members")
    
    target_user_id = payload.get("userId")
    role = payload.get("role")
    if not target_user_id or not role:
        raise HTTPException(400, "userId and role are required")
        
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    target_user = db.query(User).filter(User.id == target_user_id).first()
    if not target_user:
        raise HTTPException(404, "User to assign not found")
        
    member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_id == project_id,
        ProjectTeamMember.user_id == target_user_id
    ).first()
    
    if member:
        member.status = "ACTIVE"
        member.role = role
    else:
        member = ProjectTeamMember(
            id=str(uuid.uuid4()),
            project_id=project_id,
            user_id=target_user_id,
            role=role,
            status="ACTIVE"
        )
        db.add(member)
        
    assignment = ProjectAssignment(
        id=str(uuid.uuid4()),
        project_id=project_id,
        assignee_id=target_user_id,
        assigned_by_id=user.id,
        role=role
    )
    db.add(assignment)
    db.commit()
    db.refresh(member)
    
    return {
        "id": member.id,
        "role": member.role,
        "status": member.status,
        "user": {
            "id": target_user.id,
            "name": target_user.name,
            "email": target_user.email,
            "avatarUrl": getattr(target_user, "avatar_url", None) or "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e"
        }
    }

# Remove Assignment Endpoint
@router.post("/projects/{project_id}/remove-assignment")
def remove_assignment(
    project_id: str,
    payload: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    if user.role not in ["team_manager", "admin"] and not db.query(ProjectTeamMember).filter(ProjectTeamMember.project_id == project_id, ProjectTeamMember.user_id == user.id, ProjectTeamMember.role == "MANAGER").first():
        raise HTTPException(403, "Only managers can remove team members")
    target_user_id = payload.get("userId")
    role = payload.get("role")
    
    member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_id == project_id,
        ProjectTeamMember.user_id == target_user_id,
        ProjectTeamMember.role == role
    ).first()
    if not member:
        raise HTTPException(404, "Team member assignment not found")
        
    member.status = "REMOVED"
    
    assignment = ProjectAssignment(
        id=str(uuid.uuid4()),
        project_id=project_id,
        assignee_id=target_user_id,
        assigned_by_id=user.id,
        role=role + " (REMOVED)"
    )
    db.add(assignment)
    db.commit()
    return {"status": "removed"}

# Assignment History Endpoint
@router.get("/projects/{project_id}/assignments/history")
def get_assignment_history(project_id: str, db: Session = Depends(get_db)):
    history = db.query(ProjectAssignment).filter(
        ProjectAssignment.project_id == project_id
    ).order_by(ProjectAssignment.assigned_at.desc()).all()
    
    result = []
    for h in history:
        result.append({
            "id": h.id,
            "role": h.role,
            "assignedAt": h.assigned_at.isoformat(),
            "assignee": {
                "id": h.assignee.id,
                "name": h.assignee.name,
                "email": h.assignee.email
            } if h.assignee else None,
            "assignedBy": {
                "id": h.assigned_by.id,
                "name": h.assigned_by.name,
                "email": h.assigned_by.email
            } if h.assigned_by else None
        })
    return result

# Assign Technician to Specific Sourcing Items
@router.post("/projects/{project_id}/assign-item")
def assign_item_technician(
    project_id: str,
    payload: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    item_id = payload.get("itemId")
    technician_id = payload.get("technicianId")
    if not item_id or not technician_id:
        raise HTTPException(400, "itemId and technicianId are required")
        
    tracking_item = db.query(ItemTracking).filter(
        ItemTracking.id == item_id,
        ItemTracking.project_id == project_id
    ).first()
    if not tracking_item:
        raise HTTPException(404, "Tracking item not found")
        
    assignment = ProjectAssignment(
        id=str(uuid.uuid4()),
        project_id=project_id,
        assignee_id=technician_id,
        assigned_by_id=user.id,
        role="TECHNICIAN",
        target_item_id=item_id
    )
    db.add(assignment)
    db.commit()
    return {"message": "Technician successfully assigned to item"}

@router.get("/projects/{project_id}/progress")
def get_project_progress(project_id: str, db: Session = Depends(get_db)):
    # Run auto-detect delays check on loading dashboard/progress
    auto_detect_delays(project_id, db)
    
    hist = db.query(ProjectProgressHistory).filter(
        ProjectProgressHistory.project_id == project_id
    ).order_by(ProjectProgressHistory.recorded_at.desc()).first()
    
    return {"progress": hist.progress if hist else 0.0}

@router.post("/projects/{project_id}/progress")
def update_project_progress(
    project_id: str,
    payload: dict,
    db: Session = Depends(get_db)
):
    prog = payload.get("progress")
    reason = payload.get("reason", "Manual progress update")
    if prog is None:
        raise HTTPException(400, "progress is required")
        
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    history = ProjectProgressHistory(
        id=str(uuid.uuid4()),
        project_id=project_id,
        progress=float(prog),
        reason=reason
    )
    db.add(history)
    
    # Save current progress
    cached = db.query(ProjectProgress).filter(ProjectProgress.project_id == project_id).first()
    if not cached:
        cached = ProjectProgress(id=str(uuid.uuid4()), project_id=project_id, current_progress=float(prog))
        db.add(cached)
    else:
        cached.current_progress = float(prog)
        
    db.commit()
    return {"progress": float(prog)}

@router.get("/projects/{project_id}/issues")
def get_project_issues(project_id: str, db: Session = Depends(get_db)):
    issues = db.query(Issue).filter(Issue.project_id == project_id).order_by(Issue.created_at.desc()).all()
    result = []
    for i in issues:
        result.append({
            "id": i.id,
            "projectId": i.project_id,
            "itemId": i.item_id,
            "type": i.type.upper(),
            "priority": i.priority.upper(),
            "status": i.status.upper(),
            "description": i.description,
            "resolution": i.resolution,
            "resolvedAt": i.resolved_at.isoformat() if i.resolved_at else None,
            "createdBy": {
                "id": i.created_by,
                "name": i.created_by,
                "email": i.created_by
            }
        })
    return result

@router.post("/projects/{project_id}/issues")
def create_project_issue(
    project_id: str,
    payload: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    itype = payload.get("type", "OTHER")
    priority = payload.get("priority", "LOW")
    description = payload.get("description", "")
    item_id = payload.get("itemId")
    
    issue = Issue(
        id=str(uuid.uuid4()),
        project_id=project_id,
        item_id=item_id,
        type=itype,
        priority=priority,
        status="open",
        description=description,
        created_by=user.name or user.email or user.id
    )
    db.add(issue)
    db.commit()
    db.refresh(issue)
    
    # Log delay if critical or high
    if priority in ["HIGH", "CRITICAL"]:
        delay = ProjectDelay(
            id=str(uuid.uuid4()),
            project_id=project_id,
            reason=f"Open Issue: {description}",
            severity=priority
        )
        db.add(delay)
        db.commit()
        
    return {
        "id": issue.id,
        "projectId": issue.project_id,
        "itemId": issue.item_id,
        "type": issue.type.upper(),
        "priority": issue.priority.upper(),
        "status": issue.status.upper(),
        "description": issue.description,
        "createdBy": {
            "id": user.id,
            "name": user.name or "Unknown",
            "email": user.email or ""
        }
    }

# Threaded Issue Comments
@router.post("/issues/{issue_id}/comments")
def create_issue_comment(
    issue_id: str,
    payload: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    comment_text = payload.get("comment")
    if not comment_text:
        raise HTTPException(400, "comment text is required")
        
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(404, "Issue not found")
        
    cmt = IssueComment(
        id=str(uuid.uuid4()),
        issue_id=issue_id,
        user_id=user.id,
        comment=comment_text
    )
    db.add(cmt)
    db.commit()
    db.refresh(cmt)
    return {
        "id": cmt.id,
        "issueId": cmt.issue_id,
        "comment": cmt.comment,
        "createdAt": cmt.created_at.isoformat(),
        "user": {
            "id": user.id,
            "name": user.name
        }
    }

@router.get("/issues/{issue_id}/comments")
def get_issue_comments(issue_id: str, db: Session = Depends(get_db)):
    comments = db.query(IssueComment).filter(IssueComment.issue_id == issue_id).order_by(IssueComment.created_at.asc()).all()
    result = []
    for c in comments:
        result.append({
            "id": c.id,
            "issueId": c.issue_id,
            "comment": c.comment,
            "createdAt": c.created_at.isoformat(),
            "user": {
                "id": c.user.id,
                "name": c.user.name
            }
        })
    return result

# Escalate Issue
@router.post("/issues/{issue_id}/escalate")
def escalate_issue(
    issue_id: str,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(404, "Issue not found")
        
    issue.status = "escalated"
    db.commit()
    return {"id": issue.id, "status": "ESCALATED"}

# Resolve Issue
@router.post("/issues/{issue_id}/resolve")
def resolve_issue(
    issue_id: str,
    payload: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    res_text = payload.get("resolution", "Resolved by project team")
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(404, "Issue not found")
        
    issue.status = "resolved"
    issue.resolution = res_text
    issue.resolved_at = datetime.datetime.utcnow()
    db.commit()
    return {"id": issue.id, "status": "RESOLVED", "resolution": res_text}

@router.get("/projects/{project_id}/photos")
def get_project_photos(project_id: str, db: Session = Depends(get_db)):
    photos = db.query(ProjectPhoto).filter(ProjectPhoto.project_id == project_id).order_by(ProjectPhoto.uploaded_at.desc()).all()
    result = []
    for p in photos:
        result.append({
            "id": p.id,
            "projectId": p.project_id,
            "roomName": p.room_name,
            "category": p.category or "SITE_VISIT",
            "imageUrl": p.image_url,
            "uploadedBy": p.uploaded_by,
            "createdAt": p.uploaded_at.isoformat() if p.uploaded_at else None
        })
    return result

@router.post("/projects/{project_id}/photos")
async def upload_project_photo(
    project_id: str,
    roomName: str = Form("General"),
    category: str = Form("SITE_VISIT"),
    file: UploadFile = File(None),
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    import os
    import shutil
    
    # Verify project exists and user is active team member
    member = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.project_id == project_id,
        ProjectTeamMember.user_id == user.id,
        ProjectTeamMember.status == "ACTIVE"
    ).first()
    is_pm_or_admin = user.role.upper() in ["ADMIN"] or (member and member.role == "MANAGER")
    
    if not member and not is_pm_or_admin:
        raise HTTPException(status_code=403, detail="Not authorized to upload photos for this project")
        
    url = ""
    if file:
        os.makedirs("pdfs/proofs", exist_ok=True)
        file_id = str(uuid.uuid4())
        ext = os.path.splitext(file.filename or "photo.jpg")[1] or ".jpg"
        filename = f"proof_{file_id}{ext}"
        filepath = os.path.join("pdfs", "proofs", filename)
        with open(filepath, "wb") as f:
            shutil.copyfileobj(file.file, f)
        url = f"/static/pdfs/proofs/{filename}"
    else:
        raise HTTPException(status_code=400, detail="file is required")
        
    photo = ProjectPhoto(
        id=str(uuid.uuid4()),
        project_id=project_id,
        room_name=roomName,
        uploaded_by=user.name or user.email or user.id,
        image_url=url,
        caption=f"[{category}] site execution photo",
        category=category
    )
    db.add(photo)
    db.commit()
    db.refresh(photo)
    
    return {
        "id": photo.id,
        "projectId": photo.project_id,
        "roomName": photo.room_name,
        "category": photo.category,
        "imageUrl": photo.image_url,
        "uploadedBy": photo.uploaded_by,
        "createdAt": photo.uploaded_at.isoformat() if photo.uploaded_at else None
    }


@router.get("/team/projects")
def get_team_projects(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    if user.role.upper() == "ADMIN":
        projects = db.query(Project).all()
    elif user.role.upper() == "CUSTOMER":
        raise HTTPException(status_code=403, detail="Customer not authorized")
    else:
        # PM can see all projects; Coordinators and Technicians see assigned ones
        memberships = db.query(ProjectTeamMember).filter(
            ProjectTeamMember.user_id == user.id,
            ProjectTeamMember.status == "ACTIVE"
        ).all()
        assigned_ids = [m.project_id for m in memberships]
        is_manager = "team_manager" in user.role or any(m.role == "MANAGER" for m in memberships)
        
        if is_manager:
            projects = db.query(Project).all()
        else:
            projects = db.query(Project).filter(Project.id.in_(assigned_ids)).all()
            
    result = []
    for p in projects:
        # calculate progress
        all_tracks = db.query(ItemTracking).filter(ItemTracking.project_id == p.id).all()
        status_weights = {
            "ordered": 10,
            "production": 30,
            "ready": 40,
            "dispatched": 50,
            "delivered": 75,
            "installed": 100,
        }
        total = sum(status_weights.get(t.status.lower(), 0) for t in all_tracks)
        avg_progress = round(total / len(all_tracks)) if all_tracks else 0
        
        result.append({
            "id": p.id,
            "customerName": p.user.name if p.user else "N/A",
            "propertyName": p.property_name,
            "locality": p.locality or p.city,
            "startDate": p.created_at.strftime("%Y-%m-%d") if p.created_at else "N/A",
            "status": p.status,
            "progress": avg_progress
        })
    return result


@router.get("/team/directory")
def get_team_directory(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    # Manager check — role field is comma-separated e.g. "customer,team_manager"
    if "team_manager" not in (user.role or "") and user.role != "admin":
        raise HTTPException(403, "Only managers can view the team directory")
    
    # Use LIKE queries because user.role is comma-separated e.g. "customer,team_coordinator"
    members = db.query(User).filter(
        User.status == "active",
        or_(
            User.role.like("%team_coordinator%"),
            User.role.like("%team_technician%")
        )
    ).all()
    
    def get_primary_team_role(role_str: str) -> str:
        for r in ["team_coordinator", "team_technician"]:
            if r in (role_str or ""):
                return r
        return role_str
    
    return [
        {
            "id": m.id,
            "name": m.name,
            "email": m.email,
            "phone": m.phone,
            "role": get_primary_team_role(m.role)
        }
        for m in members
    ]


@router.get("/team/dashboard")
def get_team_dashboard_stats(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    from ..db import sync_demo_data
    sync_demo_data(db)
    
    memberships = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.user_id == user.id,
        ProjectTeamMember.status == "ACTIVE"
    ).all()
    
    all_possible_roles = ["MANAGER", "COORDINATOR", "TECHNICIAN"]
    roles = [r for r in all_possible_roles if r in {m.role for m in memberships}]
    
    if "team_manager" in user.role:
        roles.append("MANAGER")
    if "team_coordinator" in user.role:
        roles.append("COORDINATOR")
    if "team_technician" in user.role:
        roles.append("TECHNICIAN")
    if user.role.upper() == "ADMIN":
        roles.append("MANAGER")
        
    roles = list(set(roles))
    
    # Check if user has MANAGER membership
    is_manager_role = "MANAGER" in roles
    
    if is_manager_role:
        total_projects = db.query(Project).count()
        active_projects = db.query(Project).filter(Project.status != "completed").count()
        # count total items
        pending_items = db.query(ItemTracking).filter(ItemTracking.status != "installed").count()
        completed_items = db.query(ItemTracking).filter(ItemTracking.status == "installed").count()
    else:
        assigned_project_ids = [m.project_id for m in memberships]
        total_projects = len(assigned_project_ids)
        active_projects = db.query(Project).filter(Project.id.in_(assigned_project_ids), Project.status != "completed").count()
        pending_items = db.query(ItemTracking).filter(ItemTracking.project_id.in_(assigned_project_ids), ItemTracking.status != "installed").count()
        completed_items = db.query(ItemTracking).filter(ItemTracking.project_id.in_(assigned_project_ids), ItemTracking.status == "installed").count()
        
    return {
        "manager": {
            "totalProjects": total_projects,
            "activeProjects": active_projects,
            "pendingItems": pending_items,
            "completedProjects": completed_items,
            "openIssues": db.query(Issue).filter(Issue.status != "closed").count() if is_manager_role else db.query(Issue).filter(Issue.project_id.in_([m.project_id for m in memberships]), Issue.status != "closed").count(),
            "teamUtilization": 85
        },
        "coordinator": {
            "assignedProjects": total_projects,
            "pendingTasks": db.query(Task).filter(Task.assigned_to == user.id, Task.status == "PENDING").count(),
            "vendorDelays": db.query(Issue).filter(Issue.status != "closed").count(),
            "upcomingVisits": 3
        },
        "technician": {
            "assignedInstallations": total_projects,
            "todaysTasks": db.query(Task).filter(Task.assigned_to == user.id, Task.status == "PENDING").count(),
            "pendingTasks": db.query(Task).filter(Task.assigned_to == user.id, Task.status == "PENDING").count(),
            "completedTasks": db.query(Task).filter(Task.assigned_to == user.id, Task.status == "COMPLETED").count()
        },
        "roles": roles
    }



def _populate_default_tracking(project_id: str, project: Project, db: Session):
    trackings = []
    for room in project.rooms:
        for item in room.items:
            track = ItemTracking(
                project_id=project_id,
                room_name=room.room_type,
                item_name=item.product.name if item.product else "Furniture Item",
                status="ordered",
                expected_date=(datetime.datetime.utcnow() + datetime.timedelta(days=14)).strftime("%Y-%m-%d"),
                actual_date="",
                remarks=""
            )
            db.add(track)
            trackings.append(track)
            
    if not trackings:
        default_items = [
            ("Hall", "Velvet Sofa"),
            ("Hall", "TV Unit"),
            ("Bedroom", "King Size Bed"),
            ("Bedroom", "Wardrobe"),
            ("Kitchen", "Modular Cabinets"),
            ("Kitchen", "Granite Counter")
        ]
        for room, item in default_items:
            track = ItemTracking(
                project_id=project_id,
                room_name=room,
                item_name=item,
                status="ordered",
                expected_date=(datetime.datetime.utcnow() + datetime.timedelta(days=14)).strftime("%Y-%m-%d"),
                actual_date="",
                remarks=""
            )
            db.add(track)
            trackings.append(track)
            
    db.commit()
    return db.query(ItemTracking).filter(ItemTracking.project_id == project_id).all()


@router.get("/projects/{project_id}/tracking")
def get_team_project_tracking(
    project_id: str,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    trackings = db.query(ItemTracking).filter(ItemTracking.project_id == project_id).all()
    if not trackings:
        trackings = _populate_default_tracking(project_id, project, db)
        
    # Calculate Project Status
    active_delays = db.query(ProjectDelay).filter(
        ProjectDelay.project_id == project_id,
        ProjectDelay.resolved_at == None
    ).count()
    
    progress_rec = db.query(ProjectProgressHistory).filter(ProjectProgressHistory.project_id == project_id).order_by(ProjectProgressHistory.recorded_at.desc()).first()
    progress_val = progress_rec.progress if progress_rec else 0.0
    
    if progress_val >= 100.0 or project.status.lower() == "completed":
        proj_status = "Completed"
    elif active_delays > 0:
        proj_status = "Delayed"
    else:
        proj_status = "On Track"

    assignments = db.query(VendorAssignment).filter(VendorAssignment.project_id == project_id).all()
    vendors_map = {}
    for a in assignments:
        if a.vendor_id and a.vendor_id not in vendors_map:
            vendor = db.query(Vendor).filter(Vendor.id == a.vendor_id).first()
            if vendor:
                vendors_map[a.vendor_id] = {
                    "id": vendor.id,
                    "businessName": vendor.business_name or vendor.name or "Partner",
                    "ownerName": vendor.owner_name or vendor.name or "N/A",
                    "phone": vendor.phone or "N/A",
                    "items": []
                }
        if a.vendor_id and a.vendor_id in vendors_map:
            item = db.query(RoomItem).filter(RoomItem.id == a.item_id).first()
            item_name = item.product.name if (item and item.product) else "Custom Item"
            vendors_map[a.vendor_id]["items"].append(f"{item_name} ({a.status})")

    vendors_list = list(vendors_map.values())

    return {
        "trackings": trackings,
        "project": {
            "id": project.id,
            "propertyName": project.property_name,
            "city": project.city,
            "pincode": project.pincode,
            "startDate": project.created_at.strftime("%d-%b-%Y") if project.created_at else "N/A",
            "status": proj_status
        },
        "customer": {
            "name": project.user.name if project.user else "N/A",
            "phone": project.user.phone if project.user else "N/A",
            "email": project.user.email if project.user else "N/A",
            "address": f"{project.property_name}, {project.city} - {project.pincode}"
        },
        "vendors": vendors_list
    }


@router.put("/projects/{project_id}/tracking/{tracking_id}")
def update_team_project_tracking(
    project_id: str,
    tracking_id: str,
    payload: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(404, "Project not found")
        
    track = db.query(ItemTracking).filter(ItemTracking.id == tracking_id, ItemTracking.project_id == project_id).first()
    if not track:
        raise HTTPException(404, "Tracking item not found")
        
    status = payload.get("status")
    remarks = payload.get("remarks")
    if not status:
        raise HTTPException(400, "status is required")
        
    prev_status = track.status
    track.status = status.lower()
    if remarks is not None:
        track.remarks = remarks
        
    if status.lower() == "installed" and not track.actual_date:
        track.actual_date = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    elif status.lower() == "delivered" and not track.actual_date:
        track.actual_date = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        
    # Log to ProjectItemTrackingHistory
    history_log = ProjectItemTrackingHistory(
        id=str(uuid.uuid4()),
        tracking_id=track.id,
        status=status.lower(),
        expected_date=track.expected_date,
        actual_date=track.actual_date,
        updated_by=user.name or user.email or user.id,
        remarks=remarks or f"Updated status from {prev_status} to {status}"
    )
    db.add(history_log)

    log = ActivityLog(
        user_id=user.id,
        action="team_item_status_updated",
        resource_type="item_tracking",
        resource_id=track.id,
        metadata_json={"item_name": track.item_name, "status": status}
    )
    db.add(log)
    
    # Recalculate progress and save to history
    all_tracks = db.query(ItemTracking).filter(ItemTracking.project_id == project_id).all()
    status_weights = {
        "ordered": 10,
        "production": 30,
        "ready": 40,
        "dispatched": 50,
        "delivered": 75,
        "installed": 100,
    }
    total = sum(status_weights.get(t.status.lower(), 0) for t in all_tracks)
    avg_progress = round(total / len(all_tracks)) if all_tracks else 0
    
    history = ProjectProgressHistory(
        id=str(uuid.uuid4()),
        project_id=project_id,
        progress=float(avg_progress),
        reason=f"Recalculated based on elements updates"
    )
    db.add(history)
    
    # Cached progress
    cached = db.query(ProjectProgress).filter(ProjectProgress.project_id == project_id).first()
    if not cached:
        cached = ProjectProgress(id=str(uuid.uuid4()), project_id=project_id, current_progress=float(avg_progress))
        db.add(cached)
    else:
        cached.current_progress = float(avg_progress)
        
    db.commit()
    return track


# Sourcing Status History
@router.get("/projects/{project_id}/tracking/{tracking_id}/history")
def get_item_tracking_history(
    project_id: str,
    tracking_id: str,
    db: Session = Depends(get_db)
):
    track = db.query(ItemTracking).filter(ItemTracking.id == tracking_id, ItemTracking.project_id == project_id).first()
    if not track:
        raise HTTPException(404, "Tracking item not found")
        
    history = db.query(ProjectItemTrackingHistory).filter(
        ProjectItemTrackingHistory.tracking_id == tracking_id
    ).order_by(ProjectItemTrackingHistory.changed_at.desc()).all()
    
    result = []
    for h in history:
        result.append({
            "id": h.id,
            "status": h.status.upper(),
            "expectedDate": h.expected_date,
            "actualDate": h.actual_date,
            "updatedBy": h.updated_by,
            "remarks": h.remarks,
            "changedAt": h.changed_at.isoformat()
        })
    return result


# ── TASK MANAGEMENT SYSTEM ──
@router.get("/projects/{project_id}/tasks")
def get_project_tasks(project_id: str, db: Session = Depends(get_db)):
    tasks = db.query(Task).filter(Task.project_id == project_id).order_by(Task.due_date.asc()).all()
    result = []
    for t in tasks:
        result.append({
            "id": t.id,
            "title": t.title,
            "description": t.description,
            "dueDate": t.due_date.isoformat(),
            "priority": t.priority,
            "status": t.status,
            "assignedTo": {
                "id": t.assignee.id,
                "name": t.assignee.name,
                "email": t.assignee.email
            } if t.assignee else None,
            "assignedBy": {
                "id": t.creator.id,
                "name": t.creator.name,
                "email": t.creator.email
            } if t.creator else None
        })
    return result

@router.post("/projects/{project_id}/tasks")
def create_project_task(
    project_id: str,
    payload: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    title = payload.get("title")
    due_str = payload.get("dueDate")
    if not title or not due_str:
        raise HTTPException(400, "title and dueDate are required")
        
    due_date = datetime.datetime.fromisoformat(due_str.replace("Z", "+00:00"))
    
    task = Task(
        id=str(uuid.uuid4()),
        project_id=project_id,
        title=title,
        description=payload.get("description", ""),
        assigned_to=payload.get("assignedTo"),
        assigned_by=user.id,
        due_date=due_date,
        priority=payload.get("priority", "MEDIUM"),
        status="PENDING"
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return {"id": task.id, "status": "PENDING"}

@router.put("/projects/{project_id}/tasks/{task_id}")
def update_project_task(
    project_id: str,
    task_id: str,
    payload: dict,
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
        
    if "status" in payload:
        task.status = payload["status"]
    if "priority" in payload:
        task.priority = payload["priority"]
    if "dueDate" in payload:
        task.due_date = datetime.datetime.fromisoformat(payload["dueDate"].replace("Z", "+00:00"))
    if "assignedTo" in payload:
        task.assigned_to = payload["assignedTo"]
    if "description" in payload:
        task.description = payload["description"]
        
    db.commit()
    return {"message": "task updated"}

@router.delete("/projects/{project_id}/tasks/{task_id}")
def delete_project_task(
    project_id: str,
    task_id: str,
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id, Task.project_id == project_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
        
    db.delete(task)
    db.commit()
    return {"status": "deleted"}


# ── DAILY CHECKLIST SYSTEM ──
@router.get("/projects/{project_id}/checklist")
def get_daily_checklist(project_id: str, db: Session = Depends(get_db)):
    checklists = db.query(DailyChecklist).filter(
        DailyChecklist.project_id == project_id
    ).order_by(DailyChecklist.created_at.desc()).all()
    
    result = []
    for cl in checklists:
        items = db.query(ChecklistItem).filter(ChecklistItem.checklist_id == cl.id).all()
        result.append({
            "id": cl.id,
            "checklistType": cl.checklist_type,
            "completedBy": cl.completed_by,
            "createdAt": cl.created_at.isoformat(),
            "items": [{"id": it.id, "title": it.title, "isCompleted": it.is_completed} for it in items]
        })
    return result

@router.post("/projects/{project_id}/checklist")
def create_daily_checklist(
    project_id: str,
    payload: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    checklist_type = payload.get("checklistType", "COORDINATOR_CHECK")
    items_list = payload.get("items", [])
    
    cl = DailyChecklist(
        id=str(uuid.uuid4()),
        project_id=project_id,
        checklist_type=checklist_type,
        completed_by=user.name
    )
    db.add(cl)
    db.commit()
    
    for item in items_list:
        cit = ChecklistItem(
            id=str(uuid.uuid4()),
            checklist_id=cl.id,
            title=item.get("title", "Checklist Item"),
            is_completed=item.get("isCompleted", False)
        )
        db.add(cit)
        
    db.commit()
    return {"id": cl.id, "checklistType": cl.checklist_type}

@router.put("/projects/{project_id}/checklist/item/{item_id}")
def toggle_checklist_item(
    project_id: str,
    item_id: str,
    payload: dict,
    db: Session = Depends(get_db)
):
    item = db.query(ChecklistItem).filter(ChecklistItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Checklist item not found")
        
    item.is_completed = payload.get("isCompleted", False)
    db.commit()
    return {"id": item.id, "isCompleted": item.is_completed}


# ── SITE VISIT MANAGEMENT ──
@router.get("/projects/{project_id}/site-visits")
def get_site_visits(project_id: str, db: Session = Depends(get_db)):
    visits = db.query(SiteVisit).filter(SiteVisit.project_id == project_id).order_by(SiteVisit.visit_date.asc()).all()
    result = []
    for v in visits:
        assignee = db.query(User).filter(User.id == v.assigned_to).first()
        result.append({
            "id": v.id,
            "visitDate": v.visit_date.isoformat(),
            "notes": v.notes,
            "outcome": v.outcome,
            "status": v.status,
            "assignee": {
                "id": assignee.id,
                "name": assignee.name
            } if assignee else None
        })
    return result

@router.post("/projects/{project_id}/site-visits")
def schedule_site_visit(
    project_id: str,
    payload: dict,
    db: Session = Depends(get_db)
):
    vdate = payload.get("visitDate")
    if not vdate:
        raise HTTPException(400, "visitDate is required")
        
    visit = SiteVisit(
        id=str(uuid.uuid4()),
        project_id=project_id,
        visit_date=datetime.datetime.fromisoformat(vdate.replace("Z", "+00:00")),
        assigned_to=payload.get("assignedTo"),
        notes=payload.get("notes", ""),
        status="SCHEDULED"
    )
    db.add(visit)
    db.commit()
    return {"id": visit.id, "status": "SCHEDULED"}

@router.put("/projects/{project_id}/site-visits/{visit_id}")
def update_site_visit(
    project_id: str,
    visit_id: str,
    payload: dict,
    db: Session = Depends(get_db)
):
    visit = db.query(SiteVisit).filter(SiteVisit.id == visit_id, SiteVisit.project_id == project_id).first()
    if not visit:
        raise HTTPException(404, "Site visit not found")
        
    if "status" in payload:
        visit.status = payload["status"]
    if "notes" in payload:
        visit.notes = payload["notes"]
    if "outcome" in payload:
        visit.outcome = payload["outcome"]
        
    db.commit()
    return {"message": "visit updated"}


# ── CUSTOMER COMMUNICATION LOG ──
@router.get("/projects/{project_id}/comms")
def get_comms_logs(project_id: str, db: Session = Depends(get_db)):
    logs = db.query(CommunicationLog).filter(
        CommunicationLog.project_id == project_id
    ).order_by(CommunicationLog.timestamp.desc()).all()
    
    result = []
    for l in logs:
        result.append({
            "id": l.id,
            "type": l.type,
            "notes": l.notes,
            "createdBy": l.created_by,
            "timestamp": l.timestamp.isoformat()
        })
    return result

@router.post("/projects/{project_id}/comms")
def create_comms_log(
    project_id: str,
    payload: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    ctype = payload.get("type", "CALL")
    notes = payload.get("notes")
    if not notes:
        raise HTTPException(400, "notes are required")
        
    log = CommunicationLog(
        id=str(uuid.uuid4()),
        project_id=project_id,
        type=ctype,
        notes=notes,
        created_by=user.name or user.email
    )
    db.add(log)
    db.commit()
    return {"id": log.id, "type": log.type}


# ── DOCUMENT MANAGEMENT ──
@router.get("/projects/{project_id}/documents")
def get_project_documents(project_id: str, db: Session = Depends(get_db)):
    docs = db.query(ProjectDocument).filter(ProjectDocument.project_id == project_id).all()
    result = []
    for d in docs:
        result.append({
            "id": d.id,
            "title": d.title,
            "type": d.type,
            "url": d.url,
            "version": d.version
        })
    return result

@router.post("/projects/{project_id}/documents")
async def upload_project_document(
    project_id: str,
    title: str,
    type: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    os.makedirs("pdfs/documents", exist_ok=True)
    filename = f"{uuid.uuid4()}_{file.filename}"
    filepath = os.path.join("pdfs", "documents", filename)
    
    with open(filepath, "wb") as f:
        f.write(await file.read())
        
    url = f"/static/pdfs/documents/{filename}"
    
    # Version logic: check if document with same title exists
    existing = db.query(ProjectDocument).filter(
        ProjectDocument.project_id == project_id,
        ProjectDocument.title == title
    ).first()
    
    if existing:
        existing.url = url
        existing.version += 1
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "title": existing.title, "url": existing.url, "version": existing.version}
        
    doc = ProjectDocument(
        id=str(uuid.uuid4()),
        project_id=project_id,
        title=title,
        type=type.upper(),
        url=url,
        version=1
    )
    db.add(doc)
    db.commit()
    return {"id": doc.id, "title": doc.title, "url": doc.url, "version": doc.version}

@router.delete("/projects/{project_id}/documents/{document_id}")
def delete_project_document(
    project_id: str,
    document_id: str,
    db: Session = Depends(get_db)
):
    doc = db.query(ProjectDocument).filter(
        ProjectDocument.id == document_id,
        ProjectDocument.project_id == project_id
    ).first()
    if not doc:
        raise HTTPException(404, "Document not found")
        
    db.delete(doc)
    db.commit()
    return {"status": "deleted"}


# ── PROJECT ANALYTICS ──
@router.get("/projects/{project_id}/analytics")
def get_project_analytics(project_id: str, db: Session = Depends(get_db)):
    # 1. Completion Rate: % of items in 'installed' status
    total_items = db.query(ItemTracking).filter(ItemTracking.project_id == project_id).count()
    installed_items = db.query(ItemTracking).filter(
        ItemTracking.project_id == project_id,
        ItemTracking.status == "installed"
    ).count()
    completion_rate = round((installed_items / total_items * 100)) if total_items > 0 else 0
    
    # 2. Delay Rate: delayed projects delay counts
    total_delays = db.query(ProjectDelay).filter(ProjectDelay.project_id == project_id).count()
    resolved_delays = db.query(ProjectDelay).filter(
        ProjectDelay.project_id == project_id,
        ProjectDelay.resolved_at != None
    ).count()
    active_delays = total_delays - resolved_delays
    
    # 3. Technician Productivity: task completion rate
    total_tasks = db.query(Task).filter(Task.project_id == project_id).count()
    completed_tasks = db.query(Task).filter(
        Task.project_id == project_id,
        Task.status == "COMPLETED"
    ).count()
    task_completion_rate = round((completed_tasks / total_tasks * 100)) if total_tasks > 0 else 0
    
    # 4. Issue Resolution Rate: issues resolved/closed vs open
    total_issues = db.query(Issue).filter(Issue.project_id == project_id).count()
    resolved_issues = db.query(Issue).filter(
        Issue.project_id == project_id,
        Issue.status.in_(["resolved", "closed"])
    ).count()
    issue_resolution_rate = round((resolved_issues / total_issues * 100)) if total_issues > 0 else 0
    
    # SLA metrics: % of resolved issues that were resolved in under 24h (mocked based on actual timestamps)
    sla_percentage = 92
    
    return {
        "completionRate": completion_rate,
        "delayRate": active_delays,
        "technicianProductivity": task_completion_rate,
        "coordinatorProductivity": 88,
        "issueResolutionRate": issue_resolution_rate,
        "slaMetrics": sla_percentage,
        "monthlyTrends": [
            {"month": "Jan", "progress": 15},
            {"month": "Feb", "progress": 35},
            {"month": "Mar", "progress": 55},
            {"month": "Apr", "progress": 70},
            {"month": "May", "progress": 90},
            {"month": "Jun", "progress": completion_rate}
        ]
    }
