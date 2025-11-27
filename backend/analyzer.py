import pandas as pd
from sqlalchemy.orm import Session
from database import SessionLocal, ActivityLog, Anomaly, Sensor
from sklearn.ensemble import IsolationForest
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

def analyze_data():
    db = SessionLocal()
    try:
        # Fetch all logs
        # In a real app, we might want to limit this to recent history or process in batches
        logs = db.query(ActivityLog).all()
        if not logs:
            logger.info("No logs to analyze")
            return

        # Convert to DataFrame
        data = [{"timestamp": l.timestamp, "sensor_id": l.sensor_id, "value": l.value} for l in logs]
        df = pd.DataFrame(data)
        df['timestamp'] = pd.to_datetime(df['timestamp'])
        
        # Feature Engineering
        # We want to detect unusual activity patterns.
        # Let's aggregate by hour and sensor.
        df['hour'] = df['timestamp'].dt.hour
        df['day_of_week'] = df['timestamp'].dt.dayofweek
        
        # Count events per hour per sensor
        hourly_counts = df.groupby(['sensor_id', 'day_of_week', 'hour']).size().reset_index(name='event_count')
        
        if len(hourly_counts) < 10:
            logger.info("Not enough data for analysis")
            return

        # Prepare features for Isolation Forest
        features = ['day_of_week', 'hour', 'event_count']
        X = hourly_counts[features]

        # Train Isolation Forest
        clf = IsolationForest(contamination=0.05, random_state=42)
        hourly_counts['anomaly'] = clf.fit_predict(X)
        
        # -1 indicates anomaly
        anomalies = hourly_counts[hourly_counts['anomaly'] == -1]
        
        for _, row in anomalies.iterrows():
            sensor_id = row['sensor_id']
            hour = row['hour']
            day = row['day_of_week']
            count = row['event_count']
            
            description = f"Unusual activity count ({count}) on day {day} at hour {hour}:00"
            
            # Check if already reported recently to avoid duplicates?
            # For simplicity, we just log it.
            
            # We need a timestamp for the anomaly. We'll use the current time or the time of the bucket.
            # Let's use the most recent timestamp from that bucket if possible, or just now.
            # For this simple logic, let's just log it as "detected now" but referring to that pattern.
            
            anomaly = Anomaly(
                sensor_id=sensor_id,
                timestamp=datetime.utcnow(),
                description=description,
                score=-1.0 # Isolation forest returns -1 for anomalies
            )
            db.add(anomaly)
        
        db.commit()
        logger.info(f"Analysis complete. Found {len(anomalies)} anomalies.")

    except Exception as e:
        logger.error(f"Error during analysis: {e}")
    finally:
        db.close()
