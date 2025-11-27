import sqlite3
import os

db_path = 'backend/matter_logger.db'

if not os.path.exists(db_path):
    print(f"Database file not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

# List tables
print("Tables:")
cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
tables = cursor.fetchall()
for table in tables:
    print(f"- {table[0]}")

# Inspect data_adjustments table if it exists
if ('data_adjustments',) in tables:
    # Query logs for specific time range
    cursor.execute("""
        SELECT id, timestamp, value, sensor_id 
        FROM activity_logs 
        WHERE timestamp LIKE '2025-11-24T08:%'
    """)
    logs = cursor.fetchall()
    print(f"\nLogs for 2025-11-24 08:00-09:00:")
    for log in logs:
        print(log)

    # Check for adjustments
    cursor.execute("""
        SELECT id, timestamp, value, sensor_id 
        FROM data_adjustments 
        WHERE timestamp LIKE '2025-11-24T08:%'
    """)
    adjustments = cursor.fetchall()
    print(f"\nAdjustments for 2025-11-24 08:00-09:00:")
    for adj in adjustments:
        print(adj)

conn.close()
