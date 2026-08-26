import random
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User
from ..schemas import SignupReq, VerifyOTPReq, TokenResponse
from ..auth_utils import create_access_token, current_user

router = APIRouter()

# In-memory OTP store (Redis in production)
_otp_store: dict[str, str] = {}
_otp_rate: dict[str, int] = {}


def _has_role(user: User, role: str) -> bool:
    """Check if user has a specific role (supports comma-separated multi-role)."""
    user_roles = [r.strip() for r in (user.role or "customer").split(",")]
    return role in user_roles


def _check_role_allowed(user: User, requested_role: str, db: Session) -> bool:
    if _has_role(user, requested_role):
        return True
    
    if requested_role == "admin":
        from ..models import AdminRole
        admin_role = db.query(AdminRole).filter(AdminRole.user_id == user.id).first()
        if admin_role:
            return True
            
    elif requested_role == "vendor":
        from ..models import Vendor
        vendor = db.query(Vendor).filter((Vendor.user_id == user.id) | (Vendor.phone == user.phone)).first()
        if vendor:
            return True
            
    elif requested_role in ["team", "team_manager", "team_coordinator", "team_technician"]:
        user_roles = [r.strip() for r in (user.role or "").split(",")]
        # For legacy "team" requests, allow any team role. For specific requests, match exact.
        if requested_role == "team":
            if any(r in ["team", "team_manager", "team_coordinator", "team_technician", "COORDINATOR", "TECHNICIAN", "PROJECT_TEAM"] for r in user_roles):
                return True
        else:
            if requested_role in user_roles:
                return True
                
        from ..models import ProjectTeamMember
        member = db.query(ProjectTeamMember).filter(
            (ProjectTeamMember.user_id == user.id) | 
            (ProjectTeamMember.email == user.email) | 
            (ProjectTeamMember.phone == user.phone)
        ).first()
        if member:
            return True
            
    return False


def _add_role(user: User, role: str, db: Session):
    """Add a new role to user without removing existing roles (except mutually exclusive team roles)."""
    user_roles = [r.strip() for r in (user.role or "customer").split(",")]
    
    # Team roles should be mutually exclusive
    team_roles = {"team_manager", "team_coordinator", "team_technician"}
    if role in team_roles:
        # Remove any existing team roles
        user_roles = [r for r in user_roles if r not in team_roles]

    if role not in user_roles:
        user_roles.append(role)
        user.role = ",".join(user_roles)
        db.commit()


@router.post("/signup", summary="Register – sends OTP, appends role if user already exists")
def signup(req: SignupReq, db: Session = Depends(get_db)):
    if req.phone:
        req.phone = req.phone.replace(" ", "")
    if req.email:
        req.email = req.email.replace(" ", "")
    contact = req.phone or req.email
    if not contact:
        raise HTTPException(400, "Phone or email required")

    # Rate limit bypassed for development
    rate = 0

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
        user = User(phone=req.phone, email=req.email, name=req.name or "User", role=req.role or "customer", status="active")
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Existing user signing up for a new role — append role without removing old ones
        if req.role:
            _add_role(user, req.role, db)

    # In dev, print OTP to console
    print(f"\n{'='*40}")
    print(f"[OTP] for {contact}: {otp}")
    print(f"{'='*40}\n")

    return {"otp_sent": True, "dev_otp": otp, "message": f"OTP sent to {contact}"}


@router.post("/login", summary="Request OTP to login (only if registered for that role)")
def login(req: SignupReq, db: Session = Depends(get_db)):
    if req.phone:
        req.phone = req.phone.replace(" ", "")
    if req.email:
        req.email = req.email.replace(" ", "")
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

    # ── Strict Role portal guard ───────────────────────────────────────────────
    # A number can ONLY login to a portal it has explicitly registered for.
    if req.role:
        if not _check_role_allowed(user, req.role, db):
            raise HTTPException(
                status_code=403,
                detail=f"This number is not registered as a '{req.role}'. Please sign up as '{req.role}' first."
            )

    # Rate limit bypassed for development
    rate = 0

    otp = str(random.randint(100000, 999999))
    _otp_store[contact] = otp
    _otp_rate[contact] = rate + 1

    # In dev, print OTP to console
    print(f"\n{'='*40}")
    print(f"[OTP] for {contact}: {otp}")
    print(f"{'='*40}\n")

    return {"otp_sent": True, "dev_otp": otp, "message": f"OTP sent to {contact}"}


@router.post("/verify-otp", response_model=TokenResponse, summary="Verify OTP and get JWT")
def verify_otp(req: VerifyOTPReq, db: Session = Depends(get_db)):
    if req.phone:
        req.phone = req.phone.replace(" ", "")
    if req.email:
        req.email = req.email.replace(" ", "")
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

    # ── Strict Role portal guard ───────────────────────────────────────────────
    if req.role:
        if not _check_role_allowed(user, req.role, db):
            raise HTTPException(
                status_code=403,
                detail=f"This number is not registered as a '{req.role}'. Please sign up as '{req.role}' first."
            )

    # Sync project assignments and role-based seeded details
    from ..db import sync_demo_data
    sync_demo_data(db)

    token = create_access_token(user.id)
    # Return the REQUESTED role (not full role string) so frontend can route correctly
    # If multiple roles are stored (e.g., "customer,team_manager"), return only the one being logged in with
    return_role = req.role or "customer"
    return {"access_token": token, "token_type": "bearer", "user_id": user.id, "role": return_role}


@router.get("/me", summary="Get current user profile")
def me(db: Session = Depends(get_db),
       user: User = Depends(current_user)):
    return {
        "id": user.id,
        "name": user.name,
        "phone": user.phone,
        "email": user.email,
        "city": user.city,
        "style_tags": user.style_tags or [],
        "budget_min": user.budget_min,
        "budget_max": user.budget_max,
        "role": user.role or "customer",
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
