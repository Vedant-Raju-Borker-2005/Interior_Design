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


@router.post("/signup", summary="Register or login – sends OTP to phone/email")
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
        user = User(phone=req.phone, email=req.email, name=req.name or "User", role=req.role or "customer")
        db.add(user)
        db.commit()
        db.refresh(user)

    # In dev, print OTP to console
    print(f"\n{'='*40}")
    print(f"[OTP] for {contact}: {otp}")
    print(f"{'='*40}\n")

    return {"otp_sent": True, "dev_otp": otp, "message": f"OTP sent to {contact}"}


@router.post("/login", summary="Request OTP to login (only if registered)")
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

    # ── Role portal guard ──────────────────────────────────────────────────────
    if req.role:
        is_allowed = False
        if req.role == "customer":
            if user.role == "customer":
                is_allowed = True
        elif req.role == "admin":
            if user.role == "admin":
                is_allowed = True
        elif req.role == "vendor":
            if user.role == "vendor":
                is_allowed = True
            else:
                from ..models import Vendor
                vendor = db.query(Vendor).filter((Vendor.user_id == user.id) | (Vendor.phone == user.phone)).first()
                if vendor:
                    is_allowed = True

        if not is_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"This account is not registered as a '{req.role}'."
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

    # ── Role portal guard ──────────────────────────────────────────────────────
    if req.role:
        is_allowed = False
        if req.role == "customer":
            is_allowed = True
        elif req.role == "admin":
            if user.role == "admin":
                is_allowed = True
            else:
                from ..models import AdminRole
                admin_role = db.query(AdminRole).filter(AdminRole.user_id == user.id).first()
                if admin_role:
                    is_allowed = True
        elif req.role == "vendor":
            if user.role == "vendor":
                is_allowed = True
            else:
                from ..models import Vendor
                vendor = db.query(Vendor).filter((Vendor.user_id == user.id) | (Vendor.phone == user.phone)).first()
                if vendor:
                    is_allowed = True

        if not is_allowed:
            raise HTTPException(
                status_code=403,
                detail=f"This account is not registered as a '{req.role}'."
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
