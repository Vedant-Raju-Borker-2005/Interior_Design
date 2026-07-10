from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from ..db import get_db
from ..models import Package, Product
from ..schemas import PackageOut, ProductOut

router = APIRouter()


@router.get("/packages", summary="List packages filtered by BHK, tier, budget")
def list_packages(
    bhk: Optional[str] = Query(None),
    tier: Optional[str] = Query(None),
    budget: Optional[float] = Query(None),
    style: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    q = db.query(Package)
    if bhk:
        q = q.filter(Package.bhk == bhk)
    if tier:
        q = q.filter(Package.tier == tier)
    if budget:
        q = q.filter(Package.base_price <= budget)
    pkgs = q.all()

    # Style tag filter (Python-side since SQLite JSON)
    if style:
        pkgs = [p for p in pkgs if style.lower() in (p.style_tags or [])]

    # Sort: featured first, then price
    pkgs.sort(key=lambda p: (not p.featured, p.base_price))

    return {
        "packages": [_pkg_out(p) for p in pkgs],
        "total": len(pkgs),
    }


@router.get("/packages/{pkg_id}", summary="Get single package detail")
def get_package(pkg_id: str, db: Session = Depends(get_db)):
    pkg = db.query(Package).filter(Package.id == pkg_id).first()
    if not pkg:
        raise HTTPException(404, "Package not found")
    return _pkg_out(pkg)


@router.get("/products", summary="List products filtered by room_type or category")
def list_products(
    room_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    style: Optional[str] = Query(None),
    max_price: Optional[float] = Query(None),
    pincode: Optional[str] = Query(None),
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db),
):
    from sqlalchemy import or_, func
    from ..models import Vendor

    # ── Base query ─────────────────────────────────────────────────────────────
    q = db.query(Product)
    if room_type:
        q = q.filter(Product.room_type == room_type)
    if category:
        # Normalize: replace underscores with spaces so "coffee_tables" matches "Coffee Tables"
        cat_normalized = category.lower().replace("_", " ")
        q = q.filter(
            or_(
                func.lower(func.replace(Product.category, "_", " ")) == cat_normalized,
                func.lower(func.replace(Product.subcategory, "_", " ")) == cat_normalized,
            )
        )
    if max_price:
        q = q.filter(Product.price <= max_price)


    all_prods = q.all()

    # ── Pincode priority sorting ───────────────────────────────────────────────
    if pincode and all_prods:
        all_vendors = db.query(Vendor).filter(Vendor.active == True).all()
        vendor_map = {v.id: v for v in all_vendors}

        # Tier 1: exact pincode match
        exact_ids = {
            v.id for v in all_vendors
            if pincode in (v.serviceable_pincodes or [])
        }
        # Tier 2: nearby — same first 3 digits (same district in Indian PIN system)
        pin_prefix = pincode[:3]
        nearby_ids = {
            v.id for v in all_vendors
            if any(p.startswith(pin_prefix) for p in (v.serviceable_pincodes or []))
        } - exact_ids

        def sort_key(p: Product):
            if p.vendor_id in exact_ids:
                return 0   # local — show first
            if p.vendor_id in nearby_ids:
                return 1   # nearby district
            return 2       # national fallback

        all_prods.sort(key=sort_key)

        # Tag each product with its availability tier
        def tier_label(p: Product):
            if p.vendor_id in exact_ids:
                return "local"
            if p.vendor_id in nearby_ids:
                return "nearby"
            return "national"

        # Apply style filter (Python-side since JSON)
        if style:
            all_prods = [p for p in all_prods if style.lower() in (p.style_tags or [])]

        paginated = all_prods[skip: skip + limit]
        return {
            "items": [_prod_out(p, tier_label(p)) for p in paginated],
            "total": len(all_prods),
        }

    # ── No pincode: return normally ────────────────────────────────────────────
    if style:
        all_prods = [p for p in all_prods if style.lower() in (p.style_tags or [])]

    paginated = all_prods[skip: skip + limit]
    return {
        "items": [_prod_out(p) for p in paginated],
        "total": len(all_prods),
    }


@router.get("/products/{prod_id}", summary="Get single product")
def get_product(prod_id: str, db: Session = Depends(get_db)):
    prod = db.query(Product).filter(Product.id == prod_id).first()
    if not prod:
        raise HTTPException(404, "Product not found")
    return _prod_out(prod)


# ── Helpers ───────────────────────────────────────────────────────────────────
def _pkg_out(p: Package) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "tier": p.tier,
        "bhk": p.bhk,
        "base_price": p.base_price,
        "style_tags": p.style_tags or [],
        "thumbnail_url": p.thumbnail_url,
        "images": p.images or [],
        "featured": p.featured,
        "description": p.description,
    }


def _prod_out(p: Product, availability_tier: str = "national") -> dict:
    return {
        "id": p.id,
        "sku": p.sku,
        "name": p.name,
        "category": p.category,
        "subcategory": p.subcategory,
        "room_type": p.room_type,
        "price": p.price,
        "materials": p.materials or [],
        "color_variants": p.color_variants or [],
        "variants": p.variants or {},
        "thumbnail_url": p.thumbnail_url,
        "style_tags": p.style_tags or [],
        "availability_tier": availability_tier,
    }
