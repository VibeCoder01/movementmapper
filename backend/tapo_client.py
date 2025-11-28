"""
Tapo Native API Client
Connects directly to Tapo H100 hub to get T100 sensor events
"""
import asyncio
import logging
from datetime import datetime
from tapo import ApiClient, T100Handler
from database import SessionLocal, Sensor, ActivityLog

logger = logging.getLogger(__name__)

class TapoClient:
    def __init__(self, hub_ip: str, username: str, password: str):
        self.hub_ip = hub_ip
        self.username = username
        self.password = password
        self.running = False
        self.client = None
        self.hub = None
        self.last_states = {}  # Track last known state of each sensor
        self.last_error = None # Track last connection error
        
    async def start(self):
        """Start polling Tapo hub for sensor events"""
        self.running = True
        self.last_error = None
        logger.info(f"Starting Tapo client for hub at {self.hub_ip}")
        
        try:
            # Initialize Tapo client
            self.client = ApiClient(self.username, self.password)
            self.hub = await self.client.h100(self.hub_ip)
            
            logger.info("Connected to Tapo H100 hub")
            
            # Fetch historical data on startup
            logger.info("Fetching historical data on startup...")
            await self.get_historical_logs()
            
            # Main polling loop
            while self.running:
                try:
                    await self._poll_sensors()
                    # Clear error if polling succeeds
                    if self.last_error:
                        self.last_error = None
                except Exception as e:
                    logger.error(f"Error polling Tapo sensors: {e}")
                    self.last_error = str(e)
                
                await asyncio.sleep(2)  # Poll every 2 seconds for responsive detection
                
        except Exception as e:
            error_msg = str(e)
            logger.error(f"Failed to connect to Tapo hub: {e}")
            logger.error("Please check your credentials in config.py")
            self.last_error = error_msg
    
    def stop(self):
        self.running = False
    
    async def _poll_sensors(self):
        """Poll the hub for sensor states"""
        try:
            # Get list of child devices (T100 sensors)
            children = await self.hub.get_child_device_list()
            
            for child in children:
                device_id = child.device_id
                
                # Check if this is a T100 motion sensor (all children from H100 should be T100s)
                if hasattr(child, 'detected'):
                    # Get current state
                    is_detected = child.detected
                    
                    # Check if state changed
                    if device_id not in self.last_states or self.last_states[device_id] != is_detected:
                        self.last_states[device_id] = is_detected
                        
                        # Log the event
                        await self._log_activity(
                            device_id=device_id,
                            name=child.nickname,
                            detected=is_detected
                        )
                        
                        logger.info(f"Sensor '{child.nickname}': {'MOTION DETECTED' if is_detected else 'Clear'}")
            
        except Exception as e:
            logger.error(f"Error in _poll_sensors: {e}")
            import traceback
            traceback.print_exc()
    
    async def get_historical_logs(self):
        """Fetch historical logs from all sensors"""
        if not self.hub:
            logger.warning("Hub not connected")
            return {"message": "Hub not connected", "count": 0}

        total_logs = 0
        try:
            children = await self.hub.get_child_device_list()
            
            for child in children:
                type_name = type(child).__name__
                # logger.info(f"Child: {child.nickname} ({child.device_id}), Type: {type_name}")
                
                handler = None
                if type_name == 'T100Result':
                    handler = await self.hub.t100(child.device_id)
                elif type_name == 'T110Result':
                    handler = await self.hub.t110(child.device_id)
                
                if handler and hasattr(handler, 'get_trigger_logs'):
                    logger.info(f"Fetching logs for {child.nickname}")
                    
                    # Fetch all pages
                    start_id = 0
                    page_size = 50
                    
                    try:
                        while True:
                            logs_response = await handler.get_trigger_logs(page_size=page_size, start_id=start_id)
                            
                            if not hasattr(logs_response, 'logs') or not logs_response.logs:
                                break
                                
                            logs = logs_response.logs
                            for log_item in logs:
                                await self._process_historical_log(child, log_item)
                                total_logs += 1
                            
                            # Check if we reached the end
                            if len(logs) < page_size:
                                break
                                
                            # Update start_id for next page
                            if hasattr(logs[-1], 'id'):
                                start_id = logs[-1].id
                            else:
                                logger.warning("Log item has no 'id', cannot paginate")
                                break
                                
                    except Exception as e:
                        logger.error(f"Error fetching logs for {child.nickname}: {e}")
                else:
                    logger.info(f"Skipping child {child.nickname} (No handler or get_trigger_logs)")
                        
        except Exception as e:
            logger.error(f"Error in get_historical_logs: {e}")
            import traceback
            traceback.print_exc()
            
        return {"message": "Historical fetch completed", "count": total_logs}

    async def _process_historical_log(self, child, log_item):
        """Process a single historical log item"""
        db = SessionLocal()
        try:
            # Inspect log_item to find timestamp and value
            # Assuming log_item has 'timestamp' (seconds since epoch or ISO string) and 'event'
            
            # Debug log first time
            # logger.info(f"Log item: {dir(log_item)}")
            
            timestamp = None
            value = "active" # Default to active for trigger logs?
            
            if hasattr(log_item, 'timestamp'):
                ts = log_item.timestamp
                if isinstance(ts, int):
                    timestamp = datetime.fromtimestamp(ts)
                elif isinstance(ts, str):
                    # Try parsing ISO
                    try:
                        timestamp = datetime.fromisoformat(ts.replace('Z', '+00:00'))
                    except:
                        pass
            
            if not timestamp:
                # Fallback or skip
                return

            unique_id = f"tapo-{child.device_id}"
            
            # Find sensor
            sensor = db.query(Sensor).filter(Sensor.unique_id == unique_id).first()
            if not sensor:
                # Create if missing (though unlikely if we just listed it)
                sensor = Sensor(unique_id=unique_id, name=child.nickname, type="PIR")
                db.add(sensor)
                db.commit()
                db.refresh(sensor)

            # Check if log already exists
            exists = db.query(ActivityLog).filter(
                ActivityLog.sensor_id == sensor.id,
                ActivityLog.timestamp == timestamp
            ).first()
            
            if not exists:
                log = ActivityLog(sensor_id=sensor.id, value=value, timestamp=timestamp)
                db.add(log)
                db.commit()
                
        except Exception as e:
            logger.error(f"Error processing log item: {e}")
        finally:
            db.close()

    async def _log_activity(self, device_id: str, name: str, detected: bool):
        """Log sensor activity to database"""
        db = SessionLocal()
        try:
            unique_id = f"tapo-{device_id}"
            
            # Find or create sensor
            sensor = db.query(Sensor).filter(Sensor.unique_id == unique_id).first()
            if not sensor:
                sensor = Sensor(unique_id=unique_id, name=name, type="PIR")
                db.add(sensor)
                db.commit()
                db.refresh(sensor)
                logger.info(f"Created new sensor: {name} ({unique_id})")
            
            # Log activity
            status = "active" if detected else "inactive"
            log = ActivityLog(sensor_id=sensor.id, value=status, timestamp=datetime.utcnow())
            db.add(log)
            db.commit()
            
        except Exception as e:
            logger.error(f"Error logging activity: {e}")
        finally:
            db.close()

tapo_client = None

def get_tapo_client():
    global tapo_client
    if tapo_client is None:
        try:
            # Try loading from DB first
            db = SessionLocal()
            from database import SystemConfig
            configs = db.query(SystemConfig).all()
            config_dict = {c.key: c.value for c in configs}
            db.close()
            
            if "tapo_ip" in config_dict and "tapo_username" in config_dict and "tapo_password" in config_dict:
                tapo_client = TapoClient(
                    config_dict["tapo_ip"], 
                    config_dict["tapo_username"], 
                    config_dict["tapo_password"]
                )
            else:
                # Fallback to config.py
                try:
                    from config import TAPO_USERNAME, TAPO_PASSWORD, TAPO_HUB_IP
                    tapo_client = TapoClient(TAPO_HUB_IP, TAPO_USERNAME, TAPO_PASSWORD)
                except ImportError:
                    logger.warning("No configuration found in DB or config.py")
                    return None
                    
        except Exception as e:
            logger.error(f"Error initializing Tapo client: {e}")
            return None
            
    return tapo_client

def reset_tapo_client():
    global tapo_client
    if tapo_client:
        logger.info("Stopping existing Tapo client...")
        tapo_client.stop()
        tapo_client = None
