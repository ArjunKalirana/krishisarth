from typing import List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Farm, Zone
from app.schemas.farm_schema import FarmCreate
from app.schemas.zone_schema import ZoneCreate, ZonePatch

def get_farms_for_farmer(farmer_id: str, db: Session, page: int = 1, limit: int = 10) -> Tuple[List[Farm], int]:
    """
    Retrieve a paginated list of farms for a specific farmer.
    Returns (farms, total_count).
    """
    query = db.query(Farm).filter(Farm.farmer_id == farmer_id)
    total = query.count()
    farms = query.order_by(Farm.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    # Calculate zone count for each farm in the list
    for farm in farms:
        farm.zone_count = db.query(func.count(Zone.id)).filter(Zone.farm_id == farm.id).scalar()
        
    return farms, total

def create_farm(farmer_id: str, data: FarmCreate, db: Session) -> Farm:
    """
    Create a new farm record in the database.
    """
    farm = Farm(**data.model_dump(), farmer_id=farmer_id)
    db.add(farm)
    db.commit()
    db.refresh(farm)
    return farm

def get_farm_by_id(farm_id: str, db: Session) -> Farm:
    """
    Retrieve a single farm by its ID, including zone count.
    """
    farm = db.query(Farm).filter(Farm.id == farm_id).first()
    if farm:
        farm.zone_count = db.query(func.count(Zone.id)).filter(Zone.farm_id == farm.id).scalar()
    return farm

def create_zone(farm_id: str, data: ZoneCreate, db: Session) -> Zone:
    """
    Create a new zone record within a specified farm.
    """
    zone = Zone(**data.model_dump(), farm_id=farm_id)
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone

def update_zone(zone_id: str, data: ZonePatch, db: Session) -> Zone:
    """
    Update specific fields of an existing zone record.
    """
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        return None
    
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(zone, key, value)
    
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone
