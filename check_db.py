import sqlite3, os

db_path = os.path.join('backend', 'interior_ai.db')
if not os.path.exists(db_path):
    db_path = 'interior_ai.db'

print('db_path:', db_path, 'exists:', os.path.exists(db_path))

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
print('TABLES:', cursor.fetchall())

try:
    cursor.execute("SELECT id, name, category, subcategory, thumbnail_url FROM products LIMIT 20")
    rows = cursor.fetchall()
    print(f"\nProducts ({len(rows)}):")
    for r in rows:
        print(r)
except Exception as e:
    print("ERROR querying products:", e)
