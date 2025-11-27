import sys
import os
import logging
from datetime import datetime, timedelta
import random

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from database import init_db, SessionLocal, Sensor, ActivityLog, Anomaly
from analyzer import analyze_data

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def verify():
    logger.info("Starting verification...")
    
    # 1. Initialize DB
    init_db()
    db = SessionLocal()
    
    try:
        # Clear existing data
        db.query(Anomaly).delete()
        db.query(ActivityLog).delete()
        db.query(Sensor).delete()
        db.commit()
        
        # 2. Create a mock sensor
        sensor = Sensor(unique_id="mock-sensor-1", name="Mock PIR Sensor", type="PIR")
        db.add(sensor)
        db.commit()
        db.refresh(sensor)
        logger.info(f"Created mock sensor: {sensor.id}")
        
        # 3. Generate normal activity (e.g., 9 AM - 5 PM)
        logger.info("Generating normal activity data...")
        base_time = datetime.utcnow() - timedelta(days=7)
        
        for day in range(7):
            current_day = base_time + timedelta(days=day)
            for hour in range(9, 18): # Work hours
                # Add random events
                count = random.randint(5, 15)
                for _ in range(count):
                    timestamp = current_day.replace(hour=hour, minute=random.randint(0, 59))
                    log = ActivityLog(sensor_id=sensor.id, timestamp=timestamp, value="active")
                    db.add(log)
        
        db.commit()
        
        # 4. Generate anomaly (e.g., 3 AM activity)
        logger.info("Generating anomaly data...")
        anomaly_time = datetime.utcnow().replace(hour=3, minute=30)
        for _ in range(20): # High activity at 3 AM
            log = ActivityLog(sensor_id=sensor.id, timestamp=anomaly_time, value="active")
            db.add(log)
            
        db.commit()
        
        # 5. Run Analyzer
        logger.info("Running analyzer...")
        analyze_data()
        
        # 6. Check for anomalies
        anomalies = db.query(Anomaly).all()
        if anomalies:
            logger.info(f"SUCCESS: Detected {len(anomalies)} anomalies.")
            for a in anomalies:
                logger.info(f" - {a.description} at {a.timestamp}")
        else:
            logger.error("FAILURE: No anomalies detected.")
            
        # 7. Check data counts
        sensor_count = db.query(Sensor).count()
        log_count = db.query(ActivityLog).count()
        logger.info(f"Database populated: {sensor_count} sensors, {log_count} activity logs")
            
    except Exception as e:
        logger.error(f"Verification failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    verify()
