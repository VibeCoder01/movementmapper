from database import SessionLocal, SystemConfig
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clear_config():
    db = SessionLocal()
    try:
        deleted = db.query(SystemConfig).delete()
        db.commit()
        logger.info(f"Deleted {deleted} configuration entries from database.")
    except Exception as e:
        logger.error(f"Error clearing config: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    clear_config()
