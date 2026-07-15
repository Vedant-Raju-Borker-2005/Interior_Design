import sqlite3

db_path = "c:/Users/ameyk/OneDrive/Desktop/AI INTERIORS/Interior_Design/backend/interior_ai.db"
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

cursor.execute("PRAGMA table_info(projects);")
columns = cursor.fetchall()
col_names = [col[1] for col in columns]

print("Columns in 'projects' table:")
print(col_names)

if "color_preference" in col_names:
    print("Verification SUCCESS: 'color_preference' is present.")
else:
    print("Verification FAILED.")

conn.close()
