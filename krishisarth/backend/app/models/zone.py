import uuid
from sqlalchemy import Column, String, DateTime, Boolean, Float, ForeignKey, func, text, Text
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.db.postgres import Base

class Zone(Base):
    """
    Represents a specific cultivation area within a farm.
    """
    __tablename__ = "zones"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    farm_id = Column(UUID(as_uuid=True), ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String, nullable=False)
    crop_type = Column(String, nullable=False)
    crop_stage = Column(String)
    area_sqm = Column(Float)
    is_active = Column(Boolean, nullable=False, default=True)
    
    # Soil & Control Upgrades
    soil_type       = Column(String, nullable=True)
    soil_report     = Column(Text, nullable=True)    # OCR extracted text
    soil_scan_url   = Column(String, nullable=True)  # uploaded image URL
    control_mode    = Column(String, nullable=False, default="view")  # "view" or "act"
    crop_suggestion = Column(String, nullable=True)  # AI suggested crop
    
    # High-Precision ML Data (Settable from Frontend)
    ph              = Column(Float, nullable=True)
    rainfall        = Column(Float, nullable=True)
    ec              = Column(Float, nullable=True)  # electrical conductivity
    oc              = Column(Float, nullable=True)  # organic carbon
    s               = Column(Float, nullable=True)  # sulfur
    zn              = Column(Float, nullable=True)  # Zinc
    fe              = Column(Float, nullable=True)  # Iron
    cu              = Column(Float, nullable=True)  # Copper
    mn              = Column(Float, nullable=True)  # Manganese
    b               = Column(Float, nullable=True)  # Boron
    
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())

    # Relationships
    farm = relationship("Farm", back_populates="zones")
    devices = relationship("Device", back_populates="zone", cascade="all, delete-orphan")
    irrigation_schedules = relationship("IrrigationSchedule", back_populates="zone", cascade="all, delete-orphan")
    ai_decisions = relationship("AIDecision", back_populates="zone", cascade="all, delete-orphan")
    fertigation_logs = relationship("FertigationLog", back_populates="zone", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="zone", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<Zone(id='{self.id}', name='{self.name}')>"
