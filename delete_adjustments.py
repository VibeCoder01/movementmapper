import sqlite3
import os

db_path = 'backend/matter_logger.db'

if not os.path.exists(db_path):
    print(f"Database file not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Deleting adjustments with ID 4 and 6...")
cursor.execute("DELETE FROM data_adjustments WHERE id IN (4, 6)")
print(f"Deleted {cursor.rowcount} rows.")

conn.commit()
conn.close()
