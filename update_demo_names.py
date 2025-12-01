from sqlalchemy import create_engine, Column, Integer, String, Boolean
from sqlalchemy.orm import sessionmaker, declarative_base

Base = declarative_base()

class Sensor(Base):
    __tablename__ = "sensors"
    id = Column(Integer, primary_key=True, index=True)
    unique_id = Column(String, unique=True, index=True)
    name = Column(String)
    type = Column(String)
    is_hidden = Column(Boolean, default=False)

# Connect to the database
SQLALCHEMY_DATABASE_URL = "sqlite:///./backend/matter_logger.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
db = SessionLocal()

# Find demo sensors
demo_sensors = db.query(Sensor).filter(Sensor.unique_id.like("demo-%")).all()

print(f"Found {len(demo_sensors)} demo sensors to update:")
for sensor in demo_sensors:
    old_name = sensor.name
    # Add (Demo) suffix if not already present
    if not sensor.name.endswith(" (Demo)"):
        sensor.name = sensor.name + " (Demo)"
        print(f"  ID {sensor.id}: '{old_name}' -> '{sensor.name}'")
    else:
        print(f"  ID {sensor.id}: '{sensor.name}' (already has suffix)")

db.commit()
print("\nDatabase updated successfully!")
