import sqlite3
import os

db_path = "c:/Users/ameyk/OneDrive/Desktop/AI INTERIORS/Interior_Design/backend/interior_ai.db"

print(f"Connecting to active database at {db_path}...")
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE projects ADD COLUMN color_preference TEXT;")
    conn.commit()
    print("Successfully added 'color_preference' column to active 'projects' table! 🎉")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e) or "already exists" in str(e):
        print("Column 'color_preference' already exists in 'projects' table.")
    else:
        print(f"Error altering table: {e}")
finally:
    conn.close()
