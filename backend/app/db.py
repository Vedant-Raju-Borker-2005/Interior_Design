import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .models import Base

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./interior_ai.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if "sqlite" in DATABASE_URL else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db():
    Base.metadata.create_all(bind=engine)
    if "sqlite" in DATABASE_URL:
        import sqlite3
        db_path = DATABASE_URL.replace("sqlite:///", "")
        if os.path.exists(db_path):
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.execute("PRAGMA table_info(vendors)")
                columns = [row[1] for row in cursor.fetchall()]
                new_cols = {
                    "user_id": "VARCHAR",
                    "business_name": "VARCHAR",
                    "owner_name": "VARCHAR",
                    "email": "VARCHAR",
                    "pan_no": "VARCHAR",
                    "warehouse_address": "VARCHAR",
                    "status": "VARCHAR DEFAULT 'SUBMITTED'",
                    "rejection_reason": "TEXT",
                    "approved_by": "VARCHAR",
                    "approved_at": "VARCHAR"
                }
                for col_name, col_type in new_cols.items():
                    if col_name not in columns:
                        cursor.execute(f"ALTER TABLE vendors ADD COLUMN {col_name} {col_type}")
                
                # Migrate project_photos table to add category column if missing
                cursor.execute("PRAGMA table_info(project_photos)")
                photo_columns = [row[1] for row in cursor.fetchall()]
                if "category" not in photo_columns:
                    cursor.execute("ALTER TABLE project_photos ADD COLUMN category VARCHAR")
                
                # Check support_tickets project_id column nullability
                cursor.execute("PRAGMA table_info(support_tickets)")
                ticket_cols = cursor.fetchall()
                dropped = False
                for col in ticket_cols:
                    # col structure: (cid, name, type, notnull, dflt_value, pk)
                    if col[1] == "project_id" and col[3] == 1:
                        cursor.execute("DROP TABLE support_tickets")
                        dropped = True
                        break
                
                if dropped:
                    conn.commit()
                    # Recreate via metadata
                    Base.metadata.create_all(bind=engine)
                else:
                    # Add user_id column if missing
                    cursor.execute("PRAGMA table_info(support_tickets)")
                    ticket_columns = [row[1] for row in cursor.fetchall()]
                    if ticket_columns and "user_id" not in ticket_columns:
                        cursor.execute("ALTER TABLE support_tickets ADD COLUMN user_id VARCHAR")

                conn.commit()
                conn.close()
            except Exception as e:
                print(f"Database auto-migration failed: {e}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
