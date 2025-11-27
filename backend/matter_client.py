import asyncio
import logging
import os
import aiohttp
from matter_server.client import MatterClient
from matter_server.common.models import EventType
from database import SessionLocal, Sensor, ActivityLog

# Default to localhost if not specified
MATTER_SERVER_URL = os.getenv("MATTER_SERVER_URL", "ws://localhost:5580/ws")

logger = logging.getLogger(__name__)

class MatterListener:
    def __init__(self):
        self.client = None
        self.running = False

    async def start(self):
        self.running = True
        logger.info(f"Connecting to Matter Server at {MATTER_SERVER_URL}")
        async with aiohttp.ClientSession() as session:
            async with MatterClient(MATTER_SERVER_URL, session) as client:
                self.client = client
                # Subscribe to events
                client.subscribe_events(self._on_event)
                
                # Keep running
                while self.running:
                    await asyncio.sleep(1)

    def stop(self):
        self.running = False

    def _on_event(self, event: EventType, data: any = None):
        # This is a simplified event handler. 
        # In a real scenario, we need to inspect the event type and data structure carefully.
        # For PIR sensors, we are looking for Occupancy attributes.
        
        logger.info(f"Received event: {event}, data: {data}")
        
        # We need to filter for attribute changes on nodes
        if event == EventType.ATTRIBUTE_UPDATED:
            self._handle_attribute_update(data)
            
    def _handle_attribute_update(self, data):
        # Data structure depends on python-matter-server version
        # Assuming data contains node_id, endpoint_id, cluster_id, attribute_id, value
        
        try:
            node_id = data.node_id
            endpoint_id = data.endpoint_id
            cluster_id = data.cluster_id
            attribute_id = data.attribute_id
            value = data.value
            
            # Check for Occupancy Sensing Cluster (0x0406) and Occupancy Attribute (0x0000)
            if cluster_id == 1030 and attribute_id == 0: # 1030 is 0x0406
                self._log_activity(node_id, endpoint_id, value)
                
        except Exception as e:
            logger.error(f"Error handling attribute update: {e}")

    def _log_activity(self, node_id, endpoint_id, value):
        db = SessionLocal()
        try:
            unique_id = f"{node_id}-{endpoint_id}"
            
            # Find or create sensor
            sensor = db.query(Sensor).filter(Sensor.unique_id == unique_id).first()
            if not sensor:
                sensor = Sensor(unique_id=unique_id, name=f"Sensor {unique_id}", type="PIR")
                db.add(sensor)
                db.commit()
                db.refresh(sensor)
            
            # Log activity
            # Value is likely a bitmap for Occupancy. 1 = Occupied.
            status = "active" if value else "inactive"
            
            log = ActivityLog(sensor_id=sensor.id, value=status)
            db.add(log)
            db.commit()
            logger.info(f"Logged activity for {unique_id}: {status}")
            
        except Exception as e:
            logger.error(f"Error logging activity: {e}")
        finally:
            db.close()

matter_listener = MatterListener()
