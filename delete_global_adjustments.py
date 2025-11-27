import sqlite3
import os

db_path = 'backend/matter_logger.db'

if not os.path.exists(db_path):
    print(f"Database file not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

print("Deleting global adjustments (sensor_id IS NULL)...")
cursor.execute("DELETE FROM data_adjustments WHERE sensor_id IS NULL")
print(f"Deleted {cursor.rowcount} rows.")

conn.commit()
conn.close()
