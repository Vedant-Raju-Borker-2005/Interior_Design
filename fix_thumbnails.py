import sqlite3

db_path = 'backend/interior_ai.db'

# Curated, verified Unsplash furniture URLs (checked)
# Sofa: famous green velvet sofa - correct
SOFA_IMG = "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&q=80"

# Coffee table: white round coffee table on white background
COFFEE_TABLE_IMG = "https://images.unsplash.com/photo-1506439773649-6e0eb8cfb237?w=600&q=80"

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("SELECT id, name, category, subcategory, thumbnail_url FROM products")
rows = cursor.fetchall()
print(f"Found {len(rows)} products:")
for prod_id, name, category, subcategory, thumb in rows:
    print(f"  {name} | {subcategory} | current: {thumb[:60]}")

print()

# Manually update coffee table to a good photo
for prod_id, name, category, subcategory, thumb in rows:
    sub_lower = (subcategory or "").lower()
    cat_lower = (category or "").lower()

    if "coffee" in sub_lower or "coffee" in cat_lower or "side table" in sub_lower or "end table" in sub_lower:
        cursor.execute("UPDATE products SET thumbnail_url = ? WHERE id = ?", (COFFEE_TABLE_IMG, prod_id))
        print(f"  Updated '{name}' to coffee table image")
    elif "sofa" in sub_lower or "couch" in sub_lower:
        cursor.execute("UPDATE products SET thumbnail_url = ? WHERE id = ?", (SOFA_IMG, prod_id))
        print(f"  Updated '{name}' to sofa image")

conn.commit()
conn.close()
print("\nDone.")
