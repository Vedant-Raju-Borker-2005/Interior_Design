import random
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User, Vendor, ProjectTeamMember, Project
from ..schemas import SignupReq, VerifyOTPReq, TokenResponse
from ..auth_utils import create_access_token, current_user

router = APIRouter()

# In-memory OTP store (Redis in production)
_otp_store: dict[str, str] = {}
_otp_rate: dict[str, int] = {}


@router.post("/signup", summary="Register or login – sends OTP to phone/email")
def signup(req: SignupReq, db: Session = Depends(get_db)):
    contact = req.phone or req.email
    if not contact:
        raise HTTPException(400, "Phone or email required")

    rate = _otp_rate.get(contact, 0)
    if rate >= 5:
        raise HTTPException(429, "OTP rate limit exceeded. Try after 1 hour.")

    otp = str(random.randint(100000, 999999))
    _otp_store[contact] = otp
    _otp_rate[contact] = rate + 1

    # Upsert user
    user = None
    if req.phone:
        user = db.query(User).filter(User.phone == req.phone).first()
    elif req.email:
        user = db.query(User).filter(User.email == req.email).first()

    if not user:
        user = User(phone=req.phone, email=req.email, name=req.name or "User")
        db.add(user)
        db.commit()
        db.refresh(user)

    # Ensure role profile is created
    if req.role:
        role_lower = req.role.lower()
        if role_lower == "vendor":
            existing_vendor = db.query(Vendor).filter(
                (Vendor.user_id == user.id) | 
                (Vendor.phone == contact) | 
                (Vendor.email == contact)
            ).first()
            if not existing_vendor:
                vendor = Vendor(
                    user_id=user.id,
                    name=user.name,
                    phone=user.phone or contact or "",
                    email=user.email or contact or "",
                    status="DRAFT",
                    categories=[],
                    serviceable_pincodes=[]
                )
                db.add(vendor)
                db.commit()
        elif role_lower == "team":
            existing_member = db.query(ProjectTeamMember).filter(ProjectTeamMember.user_id == user.id).first()
            if not existing_member:
                first_project = db.query(Project).first()
                project_id = first_project.id if first_project else "dummy-project-id"
                member = ProjectTeamMember(
                    project_id=project_id,
                    user_id=user.id,
                    role="TECHNICIAN",
                    status="ACTIVE"
                )
                db.add(member)
                db.commit()

    # In dev, print OTP to console
    print(f"\n{'='*40}")
    print(f"[OTP] for {contact}: {otp}")
    print(f"{'='*40}\n")

    return {"otp_sent": True, "dev_otp": otp, "message": f"OTP sent to {contact}"}


@router.post("/login", summary="Request OTP to login (only if registered)")
def login(req: SignupReq, db: Session = Depends(get_db)):
    contact = req.phone or req.email
    if not contact:
        raise HTTPException(400, "Phone or email required")

    # Check if user exists in SQLite database
    user = None
    if req.phone:
        user = db.query(User).filter(User.phone == req.phone).first()
    elif req.email:
        user = db.query(User).filter(User.email == req.email).first()

    if not user:
        raise HTTPException(404, "This account is not registered. Please sign up first.")

    # Role specific checks on login
    if req.role:
        role_lower = req.role.lower()
        if role_lower == "vendor":
            vendor = db.query(Vendor).filter(
                (Vendor.user_id == user.id) | 
                (Vendor.phone == contact) | 
                (Vendor.email == contact)
            ).first()
            if not vendor:
                raise HTTPException(404, "This phone/email is not registered as a Vendor. Please sign up/register as a vendor first.")
        elif role_lower == "team":
            member = db.query(ProjectTeamMember).filter(ProjectTeamMember.user_id == user.id).first()
            if not member:
                raise HTTPException(404, "This phone/email is not registered as a Team Member. Please contact your administrator.")
        elif role_lower == "admin":
            is_admin = False
            if user.email and ("admin" in user.email.lower()):
                is_admin = True
            if user.name and ("admin" in user.name.lower()):
                is_admin = True
            
            # Check MANAGER or ADMIN role in project team members
            manager_member = db.query(ProjectTeamMember).filter(
                (ProjectTeamMember.user_id == user.id) & 
                (ProjectTeamMember.role.in_(["MANAGER", "ADMIN"]))
            ).first()
            if manager_member:
                is_admin = True
                
            if not is_admin:
                raise HTTPException(403, "Access denied. This account does not have Admin permissions.")

    rate = _otp_rate.get(contact, 0)
    if rate >= 5:
        raise HTTPException(429, "OTP rate limit exceeded. Try after 1 hour.")

    otp = str(random.randint(100000, 999999))
    _otp_store[contact] = otp
    _otp_rate[contact] = rate + 1

    # In dev, print OTP to console
    print(f"\n{'='*40}")
    print(f"[OTP] for {contact}: {otp}")
    print(f"{'='*40}\n")

    return {"otp_sent": True, "dev_otp": otp, "message": f"OTP sent to {contact}"}



@router.post("/verify-otp", summary="Verify OTP and get JWT")
def verify_otp(req: VerifyOTPReq, db: Session = Depends(get_db)):
    contact = req.phone or req.email
    if not contact:
        raise HTTPException(400, "Phone or email required")

    stored = _otp_store.get(contact)
    if not stored or stored != req.otp:
        raise HTTPException(400, "Invalid or expired OTP")

    del _otp_store[contact]

    user = None
    if req.phone:
        user = db.query(User).filter(User.phone == req.phone).first()
    elif req.email:
        user = db.query(User).filter(User.email == req.email).first()

    if not user:
        raise HTTPException(404, "User not found")

    # Determine user role based on linked profiles
    role = "customer"  # default
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if vendor:
        role = "vendor"
    team_member = db.query(ProjectTeamMember).filter(ProjectTeamMember.user_id == user.id).first()
    if team_member:
        if team_member.role in ("MANAGER", "ADMIN"):
            role = "admin"
        else:
            role = "team"
    # admin override if name/email contains 'admin'
    if user.name and "admin" in user.name.lower():
        role = "admin"
    if user.email and "admin" in user.email.lower():
        role = "admin"

    token = create_access_token(user.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "user": {
            "id": user.id,
            "name": user.name,
            "phone": user.phone,
            "email": user.email,
            "city": user.city,
            "style_tags": user.style_tags or [],
            "role": role,
        }
    }


@router.get("/me", summary="Get current user profile")
def me(db: Session = Depends(get_db),
       user: User = Depends(current_user)):
    # Determine role from linked profiles
    role = "customer"
    vendor = db.query(Vendor).filter(Vendor.user_id == user.id).first()
    if vendor:
        role = "vendor"
    team_member = db.query(ProjectTeamMember).filter(ProjectTeamMember.user_id == user.id).first()
    if team_member:
        if team_member.role in ("MANAGER", "ADMIN"):
            role = "admin"
        else:
            role = "team"
    if user.name and "admin" in user.name.lower():
        role = "admin"
    if user.email and "admin" in user.email.lower():
        role = "admin"

    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "email": user.email,
        "city": user.city,
        "style_tags": user.style_tags or [],
        "budget_min": user.budget_min,
        "budget_max": user.budget_max,
        "role": role,
    }


@router.put("/me", summary="Update user profile")
def update_me(payload: dict, db: Session = Depends(get_db),
              user: User = Depends(current_user)):
    for field in ["name", "city", "style_tags", "budget_min", "budget_max"]:
        if field in payload:
            setattr(user, field, payload[field])
    db.commit()
    db.refresh(user)
    return {"id": user.id, "name": user.name, "city": user.city}
