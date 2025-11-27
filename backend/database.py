from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Boolean, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime

SQLALCHEMY_DATABASE_URL = "sqlite:///./matter_logger.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class SystemConfig(Base):
    __tablename__ = "system_config"

    key = Column(String, primary_key=True, index=True)
    value = Column(String)

class Sensor(Base):
    __tablename__ = "sensors"

    id = Column(Integer, primary_key=True, index=True)
    unique_id = Column(String, unique=True, index=True) # Matter Node ID / Endpoint
    name = Column(String)
    type = Column(String) # e.g., "PIR", "Contact"

    logs = relationship("ActivityLog", back_populates="sensor")
    anomalies = relationship("Anomaly", back_populates="sensor")

class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    value = Column(String) # "active", "inactive", etc.
    
    sensor = relationship("Sensor", back_populates="logs")

class Anomaly(Base):
    __tablename__ = "anomalies"

    id = Column(Integer, primary_key=True, index=True)
    sensor_id = Column(Integer, ForeignKey("sensors.id"))
    timestamp = Column(DateTime, default=datetime.utcnow)
    description = Column(String)
    score = Column(Float) # Anomaly score

    sensor = relationship("Sensor", back_populates="anomalies")

class DataAdjustment(Base):
    __tablename__ = "data_adjustments"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, index=True) # Hour resolution
    sensor_id = Column(Integer, ForeignKey("sensors.id"), nullable=True) # Nullable for global adjustments if needed, but we'll stick to sensor-specific for now
    value = Column(Integer) # Offset value (e.g. -5, +2)
    comment = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)

def init_db():
    Base.metadata.create_all(bind=engine)
