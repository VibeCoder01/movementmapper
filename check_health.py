import requests
import sys

BASE_URL = "http://localhost:8000"

def check_health():
    print("Checking backend health...")
    endpoints = ["/sensors", "/logs?limit=10", "/adjustments"]
    failed = False
    for ep in endpoints:
        try:
            res = requests.get(f"{BASE_URL}{ep}")
            if res.status_code != 200:
                print(f"FAILED: {ep} returned {res.status_code}")
                failed = True
            else:
                print(f"SUCCESS: {ep} returned 200")
        except Exception as e:
            print(f"EXCEPTION: {ep} - {e}")
            failed = True
    
    if failed:
        sys.exit(1)
    print("Backend is healthy.")

if __name__ == "__main__":
    check_health()
