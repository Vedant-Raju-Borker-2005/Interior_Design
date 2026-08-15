import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db import SessionLocal
from app.models import Project, Flat, User, Room, RoomItem, Quotation

def cleanup():
    db = SessionLocal()
    print("Database session initialized.")

    # 1. Clean up test projects
    test_projects = db.query(Project).filter(
        (Project.id.like("test-%")) | (Project.property_name.like("%Oceanic Towers%"))
    ).all()
    print(f"Found {len(test_projects)} test projects to delete.")
    
    for p in test_projects:
        # Break flat references
        flats = db.query(Flat).filter((Flat.project_id == p.id) | (Flat.customer_project_id == p.id)).all()
        for f in flats:
            f.customer_project_id = None
            f.customer_id = None
        db.flush()
        db.delete(p)
    db.commit()

    # 2. Clean up test flats
    test_flats = db.query(Flat).filter(Flat.id.like("test-%")).all()
    print(f"Found {len(test_flats)} test flats to delete.")
    for f in test_flats:
        db.delete(f)
    db.commit()

    # 3. Clean up test users
    test_users = db.query(User).filter(User.id.like("test-%")).all()
    print(f"Found {len(test_users)} test users to delete.")
    for u in test_users:
        db.delete(u)
    db.commit()

    # 4. Clean up test rooms directly (in case they have orphaned IDs)
    test_rooms = db.query(Room).filter(Room.id.like("%-test-p%")).all()
    print(f"Found {len(test_rooms)} test rooms to delete.")
    for r in test_rooms:
        db.delete(r)
    db.commit()

    print("Cleanup test runs completed successfully!")
    db.close()

if __name__ == "__main__":
    cleanup()
