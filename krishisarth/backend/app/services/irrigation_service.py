import logging
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.irrigation_schedule import IrrigationSchedule
from app.models.fertigation_log import FertigationLog
from app.models.zone import Zone

TANK_CRITICAL_PCT = 10.0
DEFAULT_FLOW_RATE_LPM = 10.0

logger = logging.getLogger(__name__)


async def start_irrigation(zone_id: str, duration_min: int, source: str, db: Session, redis) -> dict:
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="ZONE_NOT_FOUND")
    
    farm_id = str(zone.farm_id)
    lock_key = f"ks:pump_lock:{zone_id}"
    
    if redis.get(lock_key):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="PUMP_ALREADY_RUNNING")

    farm_id = str(zone.farm_id)
    
    # 3. Concurrency Check: Max 2 zones per farm
    from app.core import constants
    try:
        active_locks = redis.keys(f"irrigation_lock:{farm_id}:*")
        if len(active_locks) >= constants.MAX_CONCURRENT_PUMPS:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, 
                detail=f"CONCURRENCY_LIMIT: Farm {farm_id} already has {len(active_locks)} pumps active"
            )
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        logger.warning(f"Redis concurrency check failed (continuing): {str(e)}")

    tank_level = redis.get(f"tank_level:{farm_id}")
    if tank_level and float(tank_level) < TANK_CRITICAL_PCT:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="TANK_LEVEL_CRITICAL")

    now = datetime.now(timezone.utc)
    schedule = IrrigationSchedule(
        zone_id=zone_id,
        scheduled_at=now,
        duration_min=duration_min,
        status="running",
        source=source,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)

    # Scoped lock key with 30-min TTL or duration + buffer
    scoped_lock_key = f"ks:pump_lock:{zone_id}"
    redis.setex(scoped_lock_key, max(1800, duration_min * 60), "active")

    schedule.celery_task_id = f"task_{schedule.id}"
    db.commit()

    # Return plain dict — model has no started_at/estimated_end_at columns
    return {
        "schedule_id": str(schedule.id),
        "zone_id": str(schedule.zone_id),
        "duration_min": schedule.duration_min,
        "status": schedule.status,
        "started_at": now.isoformat(),
        "estimated_end_at": (now + timedelta(minutes=duration_min)).isoformat(),
    }


async def stop_irrigation(zone_id: str, db: Session, redis) -> dict:
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(404, "ZONE_NOT_FOUND")
    
    farm_id = str(zone.farm_id)
    lock_key = f"ks:pump_lock:{zone_id}"
    
    if not redis.get(lock_key):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PUMP_NOT_RUNNING")

    schedule = (
        db.query(IrrigationSchedule)
        .filter(IrrigationSchedule.zone_id == zone_id, IrrigationSchedule.status == "running")
        .order_by(IrrigationSchedule.scheduled_at.desc())
        .first()
    )
    if not schedule:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PUMP_NOT_RUNNING")

    now = datetime.now(timezone.utc)
    actual_sec = (now - schedule.scheduled_at).total_seconds()
    water_used_l = round((actual_sec / 60) * DEFAULT_FLOW_RATE_LPM, 2)

    schedule.status = "stopped_manually"
    schedule.executed_at = now
    db.commit()
    redis.delete(lock_key)

    return {
        "zone_id": zone_id,
        "pump_stopped": True,
        "water_used_l": water_used_l,
        "stopped_at": now.isoformat(),
    }


async def queue_fertigation(zone_id: str, nutrient_type: str, concentration_ml: float, db: Session, redis) -> FertigationLog:
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(404, "ZONE_NOT_FOUND")
        
    farm_id = str(zone.farm_id)
    if not redis.get(f"ks:pump_lock:{zone_id}"):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="PUMP_NOT_RUNNING")

    log = FertigationLog(
        zone_id=zone_id,
        nutrient_type=nutrient_type,
        concentration_ml=concentration_ml,
        status="queued",
    )
    db.add(log)
    db.commit()
    db.refresh(log)
    return log
