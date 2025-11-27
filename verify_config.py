import requests
import sys
import time

BASE_URL = "http://localhost:8000"

def verify_config():
    print("Starting configuration verification...")
    
    # 1. Get initial config
    try:
        response = requests.get(f"{BASE_URL}/config")
        response.raise_for_status()
        initial_config = response.json()
        print(f"Initial config: {initial_config}")
    except Exception as e:
        print(f"Failed to get config: {e}")
        sys.exit(1)

    # 2. Update config
    new_config = {
        "tapo_ip": "192.168.0.123",
        "tapo_username": "test@example.com",
        "tapo_password": "newpassword123"
    }
    
    try:
        print("Updating config...")
        response = requests.post(f"{BASE_URL}/config", json=new_config)
        response.raise_for_status()
        print(f"Update response: {response.json()}")
    except Exception as e:
        print(f"Failed to update config: {e}")
        sys.exit(1)
        
    # 3. Verify update persisted (and password masked)
    try:
        print("Verifying persistence...")
        response = requests.get(f"{BASE_URL}/config")
        response.raise_for_status()
        updated_config = response.json()
        print(f"Updated config: {updated_config}")
        
        assert updated_config["tapo_ip"] == new_config["tapo_ip"]
        assert updated_config["tapo_username"] == new_config["tapo_username"]
        assert updated_config["tapo_password"] == "********"
        print("Verification SUCCESS: Config updated and persisted correctly.")
        
    except Exception as e:
        print(f"Verification FAILED: {e}")
        sys.exit(1)

    # 4. Restore original config (optional, but good practice if we knew it)
    # For now, we leave it as test config or maybe restore from config.py if we could read it.
    # But since we don't want to break the running system if it was working, 
    # we should probably try to restore if initial_config was valid.
    # However, initial_config has masked password, so we can't restore it fully via API 
    # unless we knew the real password.
    
    print("\nNote: System is now configured with test credentials. You may need to reset them via UI.")

if __name__ == "__main__":
    verify_config()
