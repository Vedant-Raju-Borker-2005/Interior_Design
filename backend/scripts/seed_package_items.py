import sys, os, uuid
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".env"))

from app.db import SessionLocal
from app.models import Package, Product, PackageConfiguration, PackageItems
from app.services.package_mapping import (
    BHK_BUDGET_CONFIG,
    get_default_room_categories,
    find_product_for_category,
    normalize_bhk
)

db = SessionLocal()
try:
    packages = db.query(Package).order_by(Package.bhk, Package.tier).all()
    print(f"Syncing package_configurations and package_items for {len(packages)} packages...")

    # 1. Sync package_configurations
    for pkg in packages:
        pkg_cfg = db.query(PackageConfiguration).filter(PackageConfiguration.id == pkg.id).first()
        if not pkg_cfg:
            pkg_cfg = PackageConfiguration(
                id=pkg.id,
                name=f"{pkg.bhk} {pkg.name}",
                tier=(pkg.tier or "basic").lower(),
                pricing=pkg.base_price or 0.0,
                timeline_days=45,
                included_services=["3D Visualization", "Modular Joinery", "Site Handover"]
            )
            db.add(pkg_cfg)
        else:
            pkg_cfg.name = f"{pkg.bhk} {pkg.name}"
            pkg_cfg.pricing = pkg.base_price or 0.0
            pkg_cfg.tier = (pkg.tier or "basic").lower()
    db.commit()
    print("  [OK] Synced package_configurations table")

    # 2. Populate package_items
    total_inserted = 0
    for pkg in packages:
        bhk_norm = normalize_bhk(pkg.bhk or "1BHK")
        config = BHK_BUDGET_CONFIG.get(bhk_norm, BHK_BUDGET_CONFIG["1BHK"])
        rooms = config["rooms"]
        tier = (pkg.tier or "basic").lower()

        # Delete existing items for this package
        db.query(PackageItems).filter(PackageItems.package_id == pkg.id).delete()

        pkg_items_count = 0
        for room_type in rooms:
            cat_keys = get_default_room_categories(room_type, tier)
            for cat_key in cat_keys:
                prod = find_product_for_category(db, room_type, cat_key)
                if prod:
                    pi = PackageItems(
                        id=str(uuid.uuid4()),
                        package_id=pkg.id,
                        product_id=prod.id,
                        room_type=room_type,
                        qty=1
                    )
                    db.add(pi)
                    pkg_items_count += 1
                    total_inserted += 1

        print(f"  [OK] {pkg.bhk} {pkg.name} ({tier}): {pkg_items_count} items mapped across {len(rooms)} rooms")

    db.commit()
    print(f"\nSUCCESS! Seeded {total_inserted} rows into package_items in Supabase.")
finally:
    db.close()
