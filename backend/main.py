from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
import logging
import asyncio
import os
import database
from database import SessionLocal, Sensor, ActivityLog, Anomaly

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="Movement Mapper")

# Dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.on_event("startup")
async def startup_event():
    database.init_db()
    
    # Start Tapo Client if config exists
    from tapo_client import get_tapo_client
    tapo_client = get_tapo_client()
    if tapo_client:
        asyncio.create_task(tapo_client.start())
        logger.info("Tapo client started")
    else:
        logger.warning("Tapo client not configured. Please configure via settings.")

@app.get("/config")
def get_config(db: Session = Depends(get_db)):
    from database import SystemConfig
    configs = db.query(SystemConfig).all()
    config_dict = {c.key: c.value for c in configs}
    
    # Fallback to config.py if keys are missing
    try:
        from config import TAPO_USERNAME, TAPO_PASSWORD, TAPO_HUB_IP
        if "tapo_ip" not in config_dict:
            config_dict["tapo_ip"] = TAPO_HUB_IP
        if "tapo_username" not in config_dict:
            config_dict["tapo_username"] = TAPO_USERNAME
        if "tapo_password" not in config_dict:
            config_dict["tapo_password"] = TAPO_PASSWORD
    except ImportError:
        pass
    
    # Mask password
    if "tapo_password" in config_dict:
        config_dict["tapo_password"] = "********"
        
    return config_dict

class ConfigUpdate(BaseModel):
    tapo_ip: str
    tapo_username: str
    tapo_password: str

@app.post("/config")
async def update_config(config: ConfigUpdate, db: Session = Depends(get_db)):
    from database import SystemConfig
    from tapo_client import get_tapo_client, reset_tapo_client
    
    # Update or create configs
    settings = {
        "tapo_ip": config.tapo_ip,
        "tapo_username": config.tapo_username,
        "tapo_password": config.tapo_password
    }
    
    for key, value in settings.items():
        db_item = db.query(SystemConfig).filter(SystemConfig.key == key).first()
        if db_item:
            db_item.value = value
        else:
            db_item = SystemConfig(key=key, value=value)
            db.add(db_item)
    
    db.commit()
    
    # Restart client
    reset_tapo_client()
    tapo_client = get_tapo_client()
    if tapo_client:
        # Stop existing if running (handled in reset/start logic usually, but let's be safe)
        # Ideally tapo_client.stop() was called. 
        # Since we just reset the global, the old one might still be running if we didn't stop it.
        # We need a way to stop the old one.
        # Let's rely on reset_tapo_client to handle the stop.
        asyncio.create_task(tapo_client.start())
        
    return {"status": "success", "message": "Configuration updated and client restarted"}

@app.on_event("shutdown")
def shutdown_event():
    from tapo_client import get_tapo_client
    tapo_client = get_tapo_client()
    if tapo_client:
        tapo_client.stop()

@app.get("/status")
def get_status():
    from tapo_client import get_tapo_client
    tapo_client = get_tapo_client()
    
    if not tapo_client:
        return {"status": "not_configured", "error": "Tapo client not initialized"}
        
    return {
        "status": "running" if tapo_client.running else "stopped",
        "connected": tapo_client.hub is not None,
        "error": tapo_client.last_error
    }

@app.get("/")
def read_root():
    return {"message": "Matter Activity Logger API"}

@app.get("/sensors", response_model=List[dict])
def read_sensors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    sensors = db.query(Sensor).offset(skip).limit(limit).all()
    return [{"id": s.id, "name": s.name, "unique_id": s.unique_id, "type": s.type, "is_hidden": s.is_hidden} for s in sensors]

class SensorUpdate(BaseModel):
    is_hidden: bool

@app.patch("/sensors/{sensor_id}")
def update_sensor(sensor_id: int, sensor_update: SensorUpdate, db: Session = Depends(get_db)):
    sensor = db.query(Sensor).filter(Sensor.id == sensor_id).first()
    if not sensor:
        raise HTTPException(status_code=404, detail="Sensor not found")
    
    sensor.is_hidden = sensor_update.is_hidden
    db.commit()
    db.refresh(sensor)
    
    return {"id": sensor.id, "name": sensor.name, "is_hidden": sensor.is_hidden, "message": "Sensor updated successfully"}

@app.get("/logs", response_model=List[dict])
def read_logs(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    logs = db.query(ActivityLog).order_by(ActivityLog.timestamp.desc()).offset(skip).limit(limit).all()
    return [{"id": l.id, "sensor_id": l.sensor_id, "timestamp": l.timestamp, "value": l.value} for l in logs]

@app.get("/anomalies", response_model=List[dict])
def read_anomalies(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    anomalies = db.query(Anomaly).order_by(Anomaly.timestamp.desc()).offset(skip).limit(limit).all()
    return [{"id": a.id, "sensor_id": a.sensor_id, "timestamp": a.timestamp, "description": a.description, "score": a.score} for a in anomalies]

@app.get("/adjustments", response_model=List[dict])
def read_adjustments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    from database import DataAdjustment
    adjustments = db.query(DataAdjustment).order_by(DataAdjustment.timestamp.desc()).offset(skip).limit(limit).all()
    return [{"id": a.id, "sensor_id": a.sensor_id, "timestamp": a.timestamp, "value": a.value, "comment": a.comment} for a in adjustments]

from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class AdjustmentCreate(BaseModel):
    timestamp: datetime
    sensor_id: Optional[int] = None
    value: int
    comment: str

@app.post("/adjustments")
def create_adjustment(adjustment: AdjustmentCreate, db: Session = Depends(get_db)):
    from database import DataAdjustment
    # Check if adjustment already exists for this sensor/time, if so update it
    # We normalize timestamp to hour in the frontend, but let's ensure it here too if needed.
    # For now, assume frontend sends correct hour-aligned timestamp.
    
    existing = db.query(DataAdjustment).filter(
        DataAdjustment.sensor_id == adjustment.sensor_id,
        DataAdjustment.timestamp == adjustment.timestamp
    ).first()

    if existing:
        existing.value = adjustment.value
        existing.comment = adjustment.comment
        db.commit()
        db.refresh(existing)
        return {"id": existing.id, "message": "Adjustment updated"}
    
    new_adj = DataAdjustment(
        timestamp=adjustment.timestamp,
        sensor_id=adjustment.sensor_id,
        value=adjustment.value,
        comment=adjustment.comment
    )
    db.add(new_adj)
    db.commit()
    db.refresh(new_adj)
    return {"id": new_adj.id, "message": "Adjustment created"}

@app.delete("/adjustments/{adjustment_id}")
def delete_adjustment(adjustment_id: int, db: Session = Depends(get_db)):
    from database import DataAdjustment
    db.query(DataAdjustment).filter(DataAdjustment.id == adjustment_id).delete()
    db.commit()
    return {"message": "Adjustment deleted"}

@app.post("/analyze")
def trigger_analysis(background_tasks: BackgroundTasks):
    from analyzer import analyze_data
    background_tasks.add_task(analyze_data)
    return {"message": "Analysis triggered in background"}

@app.post("/logs/fetch-historical")
async def fetch_historical_logs():
    from tapo_client import get_tapo_client
    tapo_client = get_tapo_client()
    if not tapo_client:
        raise HTTPException(status_code=503, detail="Tapo client not initialized")
    
    result = await tapo_client.get_historical_logs()
    return result

@app.post("/demo/generate")
def generate_demo_data(db: Session = Depends(get_db)):
    """Generate demo data for testing the UI"""
    from datetime import datetime, timedelta
    import random
    
    # Create demo sensors
    demo_sensors = [
        {"unique_id": "demo-living-room", "name": "Living Room Motion (Demo)", "type": "PIR", "is_hidden": False},
        {"unique_id": "demo-kitchen", "name": "Kitchen Motion (Demo)", "type": "PIR", "is_hidden": False},
        {"unique_id": "demo-bedroom", "name": "Bedroom Motion (Demo)", "type": "PIR", "is_hidden": False},
    ]
    
    sensor_ids = []
    for sensor_data in demo_sensors:
        sensor = db.query(Sensor).filter(Sensor.unique_id == sensor_data["unique_id"]).first()
        if not sensor:
            sensor = Sensor(**sensor_data)
            db.add(sensor)
        else:
            # Update existing sensor
            sensor.name = sensor_data["name"]
            sensor.is_hidden = sensor_data.get("is_hidden", False)
        
        db.commit()
        db.refresh(sensor)
        sensor_ids.append(sensor.id)
    
    # Generate 30 days of activity with weekly variations
    base_time = datetime.utcnow() - timedelta(days=30)
    logs_created = 0
    
    for day in range(30):
        current_day = base_time + timedelta(days=day)
        day_of_week = current_day.weekday()  # 0=Monday, 6=Sunday
        
        # Different patterns for weekdays vs weekends
        is_weekend = day_of_week >= 5
        
        for sensor_id in sensor_ids:
            # Weekday pattern
            if not is_weekend:
                # Morning rush (6-9 AM) - higher on weekdays
                for hour in range(6, 9):
                    count = random.randint(8, 18)
                    for _ in range(count):
                        timestamp = current_day.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
                        log = ActivityLog(sensor_id=sensor_id, timestamp=timestamp, value="active")
                        db.add(log)
                        logs_created += 1
                
                # Work hours (9 AM-5 PM) - lower on weekdays (people at work)
                for hour in range(9, 17):
                    count = random.randint(2, 8)
                    for _ in range(count):
                        timestamp = current_day.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
                        log = ActivityLog(sensor_id=sensor_id, timestamp=timestamp, value="active")
                        db.add(log)
                        logs_created += 1
                
                # Evening (5-11 PM) - high activity
                for hour in range(17, 23):
                    count = random.randint(10, 22)
                    for _ in range(count):
                        timestamp = current_day.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
                        log = ActivityLog(sensor_id=sensor_id, timestamp=timestamp, value="active")
                        db.add(log)
                        logs_created += 1
            
            # Weekend pattern
            else:
                # Late morning (8 AM-12 PM) - people sleep in
                for hour in range(8, 12):
                    count = random.randint(6, 14)
                    for _ in range(count):
                        timestamp = current_day.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
                        log = ActivityLog(sensor_id=sensor_id, timestamp=timestamp, value="active")
                        db.add(log)
                        logs_created += 1
                
                # Afternoon (12 PM-6 PM) - high activity (home all day)
                for hour in range(12, 18):
                    count = random.randint(12, 25)
                    for _ in range(count):
                        timestamp = current_day.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
                        log = ActivityLog(sensor_id=sensor_id, timestamp=timestamp, value="active")
                        db.add(log)
                        logs_created += 1
                
                # Evening (6-11 PM) - moderate to high
                for hour in range(18, 23):
                    count = random.randint(8, 18)
                    for _ in range(count):
                        timestamp = current_day.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
                        log = ActivityLog(sensor_id=sensor_id, timestamp=timestamp, value="active")
                        db.add(log)
                        logs_created += 1
            
            # Late night (11 PM-1 AM) - similar for all days
            for hour in [23, 0]:
                if random.random() < 0.5:
                    count = random.randint(1, 4)
                    for _ in range(count):
                        timestamp = current_day.replace(hour=hour, minute=random.randint(0, 59), second=random.randint(0, 59))
                        log = ActivityLog(sensor_id=sensor_id, timestamp=timestamp, value="active")
                        db.add(log)
                        logs_created += 1
            
            # Early morning (1-6 AM) - very low, slightly higher on weekends
            if random.random() < (0.3 if is_weekend else 0.15):
                night_hour = random.randint(1, 5)
                count = random.randint(1, 3)
                for _ in range(count):
                    timestamp = current_day.replace(hour=night_hour, minute=random.randint(0, 59), second=random.randint(0, 59))
                    log = ActivityLog(sensor_id=sensor_id, timestamp=timestamp, value="active")
                    db.add(log)
                    logs_created += 1
    
    # Add some anomalous patterns
    # Unusual 3 AM activity
    for _ in range(5):
        anomaly_day = base_time + timedelta(days=random.randint(0, 29))
        for sensor_id in random.sample(sensor_ids, 2):
            for _ in range(random.randint(15, 25)):
                timestamp = anomaly_day.replace(hour=3, minute=random.randint(0, 59))
                log = ActivityLog(sensor_id=sensor_id, timestamp=timestamp, value="active")
                db.add(log)
                logs_created += 1
    
    db.commit()
    
    return {
        "message": "Demo data generated successfully",
        "sensors_created": len(demo_sensors),
        "logs_created": logs_created
    }

@app.post("/demo/clear")
def clear_demo_data(db: Session = Depends(get_db)):
    """Clear all demo data"""
    from database import DataAdjustment
    
    # Find demo sensors
    demo_sensors = db.query(Sensor).filter(
        Sensor.unique_id.like("demo-%")
    ).all()
    
    logs_deleted = 0
    anomalies_deleted = 0
    adjustments_deleted = 0
    sensors_deleted = 0
    
    for sensor in demo_sensors:
        logs_deleted += db.query(ActivityLog).filter(ActivityLog.sensor_id == sensor.id).delete(synchronize_session=False)
        anomalies_deleted += db.query(Anomaly).filter(Anomaly.sensor_id == sensor.id).delete(synchronize_session=False)
        adjustments_deleted += db.query(DataAdjustment).filter(DataAdjustment.sensor_id == sensor.id).delete(synchronize_session=False)
        db.delete(sensor)
        sensors_deleted += 1
    
    db.commit()
    
    return {
        "message": "Demo data cleared successfully",
        "sensors_deleted": sensors_deleted,
        "logs_deleted": logs_deleted,
        "anomalies_deleted": anomalies_deleted,
        "adjustments_deleted": adjustments_deleted
    }

@app.post("/sensors/refresh")
async def refresh_sensors():
    """Force immediate sensor polling from Tapo hub"""
    from tapo_client import get_tapo_client
    tapo_client = get_tapo_client()
    if not tapo_client:
        raise HTTPException(status_code=503, detail="Tapo client not initialized")
    
    try:
        # Force a poll of sensors
        await tapo_client._poll_sensors()
        return {"message": "Sensors refreshed successfully"}
    except Exception as e:
        logger.error(f"Error refreshing sensors: {e}")
        raise HTTPException(status_code=500, detail=f"Error refreshing sensors: {str(e)}")

@app.get("/logs/backend")
def get_backend_logs(lines: int = 1000):
    """Retrieve backend log file contents"""
    # Try multiple locations for robustness
    possible_paths = ["../backend.log", "backend.log", "/var/log/backend.log"]
    log_file_path = None
    
    for path in possible_paths:
        if os.path.exists(path):
            log_file_path = path
            break
            
    if not log_file_path:
        return {"logs": f"Log file not found. Checked: {', '.join(possible_paths)}"}
    
    try:
        with open(log_file_path, 'r') as f:
            all_lines = f.readlines()
            # Return last N lines
            last_lines = all_lines[-lines:] if len(all_lines) > lines else all_lines
            return {"logs": ''.join(last_lines)}
    except Exception as e:
        logger.error(f"Error reading log file: {e}")
        raise HTTPException(status_code=500, detail=f"Error reading log file: {str(e)}")
