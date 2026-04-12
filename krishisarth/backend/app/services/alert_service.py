import uuid
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models.alert import Alert
from app.models.farm import Farm

def get_alerts(
    farm_id: str, 
    db: Session, 
    is_read: Optional[bool] = None, 
    severity: Optional[str] = None, 
    limit: int = 50
) -> Tuple[List[Alert], int]:
    """
    Retrieve filterable alerts for a specific farm.
    Leverages unread-count aggregation in one pass.
    """
    query = db.query(Alert).filter(Alert.farm_id == farm_id)
    
    if is_read is not None:
        query = query.filter(Alert.is_read == is_read)
    
    if severity:
        query = query.filter(Alert.severity == severity)
        
    # Get total unread count for this farm (Uses idx_alerts_unread partial index)
    unread_count = db.query(func.count(Alert.id)).filter(
        Alert.farm_id == farm_id, 
        Alert.is_read == False
    ).scalar()
    
    alerts = query.order_by(Alert.created_at.desc()).limit(limit).all()
    return alerts, unread_count

def mark_read(alert_id: str, farmer_id: str, db: Session) -> Optional[Alert]:
    """
    Mark a specific alert as read. 
    Verifies that the alert belongs to a farm owned by the requesting farmer.
    """
    # Verification: If alert_id is a fallback ID (e.g. 'f1'), it won't be a valid UUID.
    # Postgres crashes with 500 DataError if we try to query UUID col with non-UUID string.
    try:
        uuid.UUID(str(alert_id))
    except (ValueError, AttributeError):
        return None

    alert = db.query(Alert).join(Farm).filter(
        Alert.id == alert_id, 
        Farm.farmer_id == farmer_id
    ).first()
    
    if not alert:
        return None
        
    alert.is_read = True
    db.commit()
    db.refresh(alert)
    return alert

def create_alert(
    farm_id: str, 
    zone_id: Optional[str], 
    severity: str, 
    type: str, 
    message: str, 
    db: Session
) -> Alert:
    """
    Internal utility to generate system alerts.
    Commonly called by workers and sensor handlers.
    """
    alert = Alert(
        farm_id=farm_id,
        zone_id=zone_id,
        severity=severity,
        type=type,
        message=message,
        is_read=False
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert
