import requests
import sys

BASE_URL = "http://localhost:8000"

def log(msg):
    print(f"[TEST] {msg}")

def reproduce_generate():
    log("Attempting to generate demo data...")
    try:
        res = requests.post(f"{BASE_URL}/demo/generate")
        if res.status_code != 200:
            log(f"FAILED: Status Code {res.status_code}")
            log(f"Response: {res.text}")
            sys.exit(1)
        else:
            log(f"SUCCESS: {res.json()}")
            
            # Check if sensors are hidden
            res = requests.get(f"{BASE_URL}/sensors")
            sensors = res.json()
            demo_sensors = [s for s in sensors if s['unique_id'].startswith('demo-')]
            for s in demo_sensors:
                log(f"Sensor {s['name']} (ID: {s['id']}) is_hidden: {s.get('is_hidden')}")
                if s.get('is_hidden'):
                    log("FAILURE: Demo sensor is hidden! Fix failed.")
                    sys.exit(1)
                else:
                    log("VERIFIED: Sensor is visible.")
    except Exception as e:
        log(f"EXCEPTION: {e}")
        sys.exit(1)

if __name__ == "__main__":
    reproduce_generate()
