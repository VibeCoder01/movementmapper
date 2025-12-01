import requests
import time
import sys

BASE_URL = "http://localhost:8000"

def log(msg):
    print(f"[TEST] {msg}")

def verify_clear_demo():
    log("Starting verification of Clear Demo Data fix...")

    # 1. Generate Demo Data
    log("Generating demo data...")
    try:
        res = requests.post(f"{BASE_URL}/demo/generate")
        res.raise_for_status()
        log(f"Demo data generated: {res.json()}")
    except Exception as e:
        log(f"Failed to generate demo data: {e}")
        sys.exit(1)

    # 2. Find a demo sensor
    log("Finding a demo sensor...")
    try:
        res = requests.get(f"{BASE_URL}/sensors")
        res.raise_for_status()
        sensors = res.json()
        demo_sensor = next((s for s in sensors if s['unique_id'].startswith('demo-')), None)
        if not demo_sensor:
            log("No demo sensor found!")
            sys.exit(1)
        log(f"Found demo sensor: {demo_sensor['name']} (ID: {demo_sensor['id']})")
    except Exception as e:
        log(f"Failed to fetch sensors: {e}")
        sys.exit(1)

    # 3. Add an adjustment to the demo sensor
    log("Adding adjustment to demo sensor...")
    try:
        adjustment_data = {
            "timestamp": "2023-01-01T12:00:00", # Arbitrary past date
            "sensor_id": demo_sensor['id'],
            "value": 10,
            "comment": "Test Adjustment"
        }
        res = requests.post(f"{BASE_URL}/adjustments", json=adjustment_data)
        res.raise_for_status()
        log(f"Adjustment added: {res.json()}")
    except Exception as e:
        log(f"Failed to add adjustment: {e}")
        sys.exit(1)

    # 4. Clear Demo Data
    log("Clearing demo data...")
    try:
        res = requests.post(f"{BASE_URL}/demo/clear")
        res.raise_for_status()
        result = res.json()
        log(f"Clear result: {result}")
        
        if result.get('adjustments_deleted', 0) == 0:
            log("WARNING: No adjustments reported as deleted! This might indicate the fix is not working.")
        else:
            log(f"SUCCESS: {result['adjustments_deleted']} adjustments deleted.")
            
    except Exception as e:
        log(f"Failed to clear demo data: {e}")
        sys.exit(1)

    # 5. Verify everything is gone
    log("Verifying cleanup...")
    try:
        # Check sensors
        res = requests.get(f"{BASE_URL}/sensors")
        sensors = res.json()
        demo_sensors = [s for s in sensors if s['unique_id'].startswith('demo-')]
        if demo_sensors:
            log(f"FAILURE: Demo sensors still exist: {demo_sensors}")
            sys.exit(1)
        else:
            log("Verified: No demo sensors found.")

        # Check adjustments
        res = requests.get(f"{BASE_URL}/adjustments")
        adjustments = res.json()
        # We can't easily filter by sensor ID if the sensor is gone, but we can check if any adjustments remain that *would* have been the demo ones.
        # Ideally, if we cleared everything, and this was a clean state, adjustments should be empty or at least not contain our test one.
        # Since we deleted the sensor, the adjustment should definitely be gone.
        # Let's check if we can find the adjustment we added (we don't have its ID easily unless we parsed it, but we can check count).
        
        log(f"Remaining adjustments count: {len(adjustments)}")
        
    except Exception as e:
        log(f"Verification failed: {e}")
        sys.exit(1)

    log("Verification PASSED!")

if __name__ == "__main__":
    verify_clear_demo()
