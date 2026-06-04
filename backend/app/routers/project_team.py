import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional

from ..db import get_db
from ..models import (
    User, Project, ProjectTeamMember, ProjectAssignment, ProjectProgressHistory,
    Task, DailyChecklist, SiteVisit, ProjectDelay, CommunicationLog, ProjectDocument,
    Issue, ProjectPhoto, ItemTracking, ActivityLog
)
from ..auth_utils import current_user

router = APIRouter()

@router.get("/projects/{project_id}/team")
def get_project_team(project_id: str, db: Session = Depends(get_db)):
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

@router.get("/projects/{project_id}/progress")
def get_project_progress(project_id: str, db: Session = Depends(get_db)):
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
def upload_project_photo(
    project_id: str,
    payload: dict,
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    room_name = payload.get("roomName", "General")
    category = payload.get("category", "SITE_VISIT")
    image_url = payload.get("imageUrl")
    
    if not image_url:
        raise HTTPException(400, "imageUrl is required")
        
    photo = ProjectPhoto(
        id=str(uuid.uuid4()),
        project_id=project_id,
        room_name=room_name,
        uploaded_by=user.name or user.email or user.id,
        image_url=image_url,
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

@router.get("/team/dashboard")
def get_team_dashboard_stats(
    user: User = Depends(current_user),
    db: Session = Depends(get_db)
):
    # Determine user roles across all projects
    memberships = db.query(ProjectTeamMember).filter(
        ProjectTeamMember.user_id == user.id,
        ProjectTeamMember.status == "ACTIVE"
    ).all()
    
    roles = [m.role for m in memberships]
    
    total_projects = db.query(Project).count()
    active_projects = db.query(Project).filter(Project.status != "completed").count()
    completed_projects = db.query(Project).filter(Project.status == "completed").count()
    open_issues = db.query(Issue).filter(Issue.status != "closed").count()
    
    assigned_project_ids = [m.project_id for m in memberships]
    assigned_projects_count = len(assigned_project_ids)
    
    pending_tasks = db.query(Task).filter(Task.assigned_to == user.id, Task.status == "PENDING").count()
    completed_tasks = db.query(Task).filter(Task.assigned_to == user.id, Task.status == "COMPLETED").count()
    todays_tasks = db.query(Task).filter(
        Task.assigned_to == user.id,
        Task.due_date >= datetime.datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    ).count()
    
    return {
        "manager": {
            "totalProjects": total_projects,
            "activeProjects": active_projects,
            "delayedProjects": int(total_projects * 0.15),
            "completedProjects": completed_projects,
            "openIssues": open_issues,
            "teamUtilization": 85
        },
        "coordinator": {
            "assignedProjects": assigned_projects_count,
            "pendingTasks": pending_tasks,
            "vendorDelays": int(open_issues * 0.4),
            "upcomingVisits": 3
        },
        "technician": {
            "assignedInstallations": assigned_projects_count,
            "todaysTasks": todays_tasks,
            "pendingTasks": pending_tasks,
            "completedTasks": completed_tasks
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
    return trackings


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
        
    track.status = status.lower()
    if remarks is not None:
        track.remarks = remarks
        
    if status.lower() == "installed" and not track.actual_date:
        track.actual_date = datetime.datetime.utcnow().strftime("%Y-%m-%d")
    elif status.lower() == "delivered" and not track.actual_date:
        track.actual_date = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        
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
        "ordered": 15,
        "accepted": 30,
        "production": 50,
        "ready": 60,
        "dispatched": 75,
        "delivered": 90,
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
    
    db.commit()
    return track
