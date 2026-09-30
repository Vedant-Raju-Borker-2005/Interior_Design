import random
import re
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
    
    user_roles = [r.strip() for r in (user.role or "customer").split(",")]
    
    if requested_role == "admin":
        if "admin" in user_roles:
            return True
        from ..models import AdminRole
        admin_role = db.query(AdminRole).filter(AdminRole.user_id == user.id).first()
        if admin_role:
            return True
            
    elif requested_role == "vendor":
        if "vendor" in user_roles:
            return True
        from ..models import Vendor
        vendor = db.query(Vendor).filter((Vendor.user_id == user.id) | (Vendor.phone == user.phone)).first()
        if vendor:
            return True
            
    elif requested_role == "team" or requested_role.startswith("team_"):
        if any(r in ["team", "team_manager", "team_coordinator", "team_technician", "COORDINATOR", "TECHNICIAN", "MANAGER", "PROJECT_TEAM", "admin"] for r in user_roles):
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
    """Add a new role to user without removing existing roles."""
    user_roles = [r.strip() for r in (user.role or "customer").split(",")]
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
        # Brand new user — create with this role
        status = "pending_verification" if req.role and ("team" in req.role.lower() or "vendor" in req.role.lower()) else "active"
        user = User(phone=req.phone, email=req.email, name=req.name or "User", role=req.role or "customer", status=status)
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Existing user signing up for a new role — append role without removing old ones
        if req.role:
            _add_role(user, req.role, db)
            if "team" in req.role.lower() or "vendor" in req.role.lower():
                user.status = "pending_verification"
                db.commit()

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
    return {"access_token": token, "token_type": "bearer", "user_id": user.id, "role": req.role or user.role or "customer"}


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
        # Feedback 1.3 — billing identity printed on quotations
        "gst_number": user.gst_number,
        "company_name": user.company_name,
        "pan_number": user.pan_number,
        "billing_address": user.billing_address,
        "billing_city": user.billing_city,
        "billing_state": user.billing_state,
        "billing_pincode": user.billing_pincode,
    }


# GSTIN: 2-digit state code, 10-char PAN, entity digit, 'Z', checksum char.
_GSTIN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$")
_PAN = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
_BILLING_FIELDS = ["gst_number", "company_name", "pan_number", "billing_address",
                   "billing_city", "billing_state", "billing_pincode"]


@router.put("/me", summary="Update user profile")
def update_me(payload: dict, db: Session = Depends(get_db),
              user: User = Depends(current_user)):
    for field in ["name", "city", "style_tags", "budget_min", "budget_max"]:
        if field in payload:
            setattr(user, field, payload[field])

    # Feedback 1.3 — GST & billing details. Validated here so a malformed GSTIN
    # never reaches a quotation.
    for field in _BILLING_FIELDS:
        if field not in payload:
            continue
        value = payload[field]
        if isinstance(value, str):
            value = value.strip() or None
        if field in ("gst_number", "pan_number") and value:
            value = value.upper().replace(" ", "")
            pattern = _GSTIN if field == "gst_number" else _PAN
            if not pattern.match(value):
                label = "GSTIN" if field == "gst_number" else "PAN"
                raise HTTPException(400, f"Invalid {label} format: {value}")
        setattr(user, field, value)

    # A GSTIN embeds the PAN at positions 3-12; fill it in when not given.
    if user.gst_number and not user.pan_number:
        user.pan_number = user.gst_number[2:12]

    db.commit()
    db.refresh(user)
    return {
        "id": user.id, "name": user.name, "city": user.city,
        **{f: getattr(user, f) for f in _BILLING_FIELDS},
    }
