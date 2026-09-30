import os
import uuid
import datetime
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Update path if necessary
db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "interior_ai.db"))
DATABASE_URL = f"sqlite:///{db_path}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from models import PackageConfiguration, PricingRule

def seed_master_data():
    db = SessionLocal()
    
    # Pricing Rules
    if db.query(PricingRule).count() == 0:
        rules = [
            {"name": "Standard GST (18%)", "rule_type": "GST", "value": 18.0, "effective_date": datetime.date(2024, 1, 1)},
            {"name": "Premium Service Tax", "rule_type": "TAX", "value": 5.0, "effective_date": datetime.date(2024, 1, 1)},
            {"name": "Festive Discount (10%)", "rule_type": "DISCOUNT", "value": 10.0, "effective_date": datetime.date(2024, 10, 1), "expiry_date": datetime.date(2024, 11, 30)},
            {"name": "Volume Discount", "rule_type": "DISCOUNT", "value": 5.0, "effective_date": datetime.date(2024, 1, 1)}
        ]
        for r in rules:
            rule = PricingRule(
                id=str(uuid.uuid4()),
                rule_type=r["rule_type"],
                name=r["name"],
                value=r["value"],
                effective_date=r["effective_date"],
                expiry_date=r.get("expiry_date") or datetime.date(2099, 12, 31)
            )
            db.add(rule)
        
    # Packages
    if db.query(PackageConfiguration).count() == 0:
        pkgs = [
            {
                "name": "Essential Home", "tier": "essential", "pricing": 300000, "timeline_days": 45,
                "services": ["Standard modular kitchen", "Basic wardrobes", "Standard painting", "Basic electrical fittings"]
            },
            {
                "name": "Premium Living", "tier": "premium", "pricing": 700000, "timeline_days": 60,
                "services": ["Premium modular kitchen", "Custom wardrobes", "Premium painting", "False ceiling", "Lighting fixtures"]
            },
            {
                "name": "Luxury Villa", "tier": "luxury", "pricing": 1500000, "timeline_days": 90,
                "services": ["High-end imported kitchen", "Walk-in closets", "Luxury textures", "Smart home integration", "Premium flooring"]
            }
        ]
        for p in pkgs:
            pkg = PackageConfiguration(
                id=str(uuid.uuid4()),
                name=p["name"],
                tier=p["tier"],
                pricing=p["pricing"],
                timeline_days=p["timeline_days"],
                included_services=p["services"]
            )
            db.add(pkg)
            
    db.commit()
    db.close()
    print("Seeded Master Data Successfully!")

if __name__ == "__main__":
    seed_master_data()
