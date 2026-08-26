import sqlite3

conn = sqlite3.connect('interior_ai.db')
cur = conn.cursor()

# Simulate the LIKE query
cur.execute("""
    SELECT name, phone, email, role, status 
    FROM users 
    WHERE status = 'active' 
    AND (role LIKE '%team_coordinator%' OR role LIKE '%team_technician%')
""")
rows = cur.fetchall()
print(f"Directory query result - {len(rows)} members:")
for r in rows:
    print(r)

print()

# Check managers
cur.execute("SELECT name, phone, email, role FROM users WHERE role LIKE '%team_manager%'")
managers = cur.fetchall()
print(f"Managers - {len(managers)}:")
for m in managers:
    print(m)

conn.close()
