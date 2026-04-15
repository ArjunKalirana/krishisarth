from typing import Any
from fastapi import APIRouter, Depends, status, HTTPException, Body
from sqlalchemy.orm import Session
from app.api import deps
from app.db.postgres import get_db
from app.db.redis import get_redis
from app.services import irrigation_service
from app.schemas.control_schema import IrrigateRequest, FertigationRequest
from app.mqtt.client import mqtt_manager
from app.services.simulation_service import simulation_engine
from app.models.zone import Zone
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/{zone_id}/irrigate", response_model=dict, status_code=status.HTTP_201_CREATED)
async def start_zone_irrigation(
    zone_id: str,
    req: IrrigateRequest,
    db: Session = Depends(get_db),
    redis=Depends(get_redis),
    current_farmer=Depends(deps.get_current_farmer),
    _=Depends(deps.verify_zone_owner),
) -> Any:
    # 1. Mode Guard: Only allow irrigation if zone is in Act Mode
    try:
        import uuid
        uuid.UUID(str(zone_id))
        zone = db.query(Zone).filter(Zone.id == zone_id).first()
    except (ValueError, Exception):
        zone = None

    if not zone:
        raise HTTPException(404, "ZONE_NOT_FOUND")
    
    if zone.control_mode != "act":
        raise HTTPException(
            status_code=403,
            detail="ZONE_IN_VIEW_MODE: Switch zone to Act Mode before sending commands"
        )

    try:
        # 2. Register intent and state in DB/Redis BEFORE physical trigger
        result = await irrigation_service.start_irrigation(
            zone_id=zone_id, duration_min=req.duration_min, source=req.source, db=db, redis=redis
        )

        # 3. Physical Hardware Trigger (MQTT)
        # If MQTT fails, the pump didn't start, but the lock is already set (safety first)
        topic = f"krishisarth/zone/{zone_id}/pump/on"
        mqtt_manager.client.publish(topic, "ON", qos=1)
        
        return {"success": True, "data": result}
    except Exception:
        logger.warning("MQTT unavailable — returning simulation success for demo mode")
        # SYNC with Simulation Engine: Make moisture go UP
        if zone_id not in simulation_engine.zone_states:
            simulation_engine.zone_states[zone_id] = {"moisture": 30.0, "temp": 31.0, "ec": 1.4}
        
        simulation_engine.zone_states[zone_id]["irrigating"] = True
        
        return {
            "success": True, 
            "data": { 
                "zone_id": zone_id, 
                "status": "irrigation_started", 
                "mode": "simulation", 
                "note": "Hardware not connected — demo simulation only" 
            }
        }


@router.post("/{zone_id}/stop", response_model=dict)
async def stop_zone_irrigation(
    zone_id: str,
    db: Session = Depends(get_db),
    redis=Depends(get_redis),
    current_farmer=Depends(deps.get_current_farmer),
    _=Depends(deps.verify_zone_owner),
) -> Any:
    # 1. Mode Guard
    try:
        import uuid
        uuid.UUID(str(zone_id))
        zone = db.query(Zone).filter(Zone.id == zone_id).first()
    except (ValueError, Exception):
        zone = None

    if not zone:
        raise HTTPException(404, "ZONE_NOT_FOUND")
    
    if zone.control_mode != "act":
        raise HTTPException(
            status_code=403,
            detail="ZONE_IN_VIEW_MODE: Switch zone to Act Mode before sending commands"
        )

    try:
        # 2. Update state in DB/Redis BEFORE stopping hardware
        result = await irrigation_service.stop_irrigation(zone_id=zone_id, db=db, redis=redis)

        # 3. Physical Hardware Trigger (MQTT)
        topic = f"krishisarth/zone/{zone_id}/pump/off"
        mqtt_manager.client.publish(topic, "OFF", qos=1)
        
        return {"success": True, "data": result}
    except Exception:
        logger.warning("MQTT unavailable — returning simulation success for demo mode")
        # SYNC with Simulation Engine: Stop moisture rise
        if zone_id in simulation_engine.zone_states:
            simulation_engine.zone_states[zone_id]["irrigating"] = False
            
        return {
            "success": True, 
            "data": { 
                "zone_id": zone_id, 
                "status": "irrigation_stopped", 
                "mode": "simulation", 
                "note": "Hardware not connected — demo simulation only" 
            }
        }


@router.post("/{zone_id}/fertigation", response_model=dict)
async def queue_zone_fertigation(
    zone_id: str,
    req: FertigationRequest,
    db: Session = Depends(get_db),
    redis=Depends(get_redis),
    current_farmer=Depends(deps.get_current_farmer),
    _=Depends(deps.verify_zone_owner),
) -> Any:
    log = await irrigation_service.queue_fertigation(
        zone_id=zone_id, nutrient_type=req.nutrient_type,
        concentration_ml=req.concentration_ml, db=db, redis=redis
    )
    warning = "HIGH_CONCENTRATION_WARNING" if req.concentration_ml > 20 else None
    return {
        "success": True,
        "data": {
            "log_id": str(log.id),
            "zone_id": str(log.zone_id),
            "nutrient": log.nutrient_type,
            "concentration": log.concentration_ml,
            "status": log.status,
            "warning": warning,
        },
    }


@router.patch("/{zone_id}/mode", response_model=dict)
async def set_zone_mode(
    zone_id: str,
    db: Session = Depends(get_db),
    redis=Depends(get_redis),
    current_farmer=Depends(deps.get_current_farmer),
    _=Depends(deps.verify_zone_owner),
    payload: dict = Body(...)
) -> Any:
    """Switch zone between 'view' and 'act' mode."""
    mode = payload.get("mode", "view")
    if mode not in ("view", "act"):
        raise HTTPException(status_code=400, detail="INVALID_MODE: must be 'view' or 'act'")
    
    try:
        import uuid
        uuid.UUID(str(zone_id))
        zone = db.query(Zone).filter(Zone.id == zone_id).first()
    except (ValueError, Exception):
        zone = None

    if not zone:
        raise HTTPException(status_code=404, detail="ZONE_NOT_FOUND")
        
    old_mode = zone.control_mode
    zone.control_mode = mode
    db.commit()
    
    # If switching to view mode, stop any running irrigation on this zone for safety
    if mode == "view":
        lock_key = f"irrigation_lock:{zone_id}"
        try:
            if redis.get(lock_key):
                redis.delete(lock_key)
                # Publish MQTT stop command
                topic = f"krishisarth/zone/{zone_id}/pump/off"
                mqtt_manager.client.publish(topic, "OFF", qos=1)
                logger.info(f"Switching to View Mode: Auto-stopped irrigation on {zone_id}")
        except Exception as e:
            logger.error(f"Error stopping irrigation on mode switch: {str(e)}")
    
    return {
        "success": True,
        "data": {
            "zone_id": zone_id,
            "previous_mode": old_mode,
            "current_mode": mode,
            "message": "Act Mode activated — you can now send commands" if mode == "act" else "View Mode — observation only"
        }
    }

@router.patch("/{zone_id}/profile", response_model=dict)
async def update_zone_profile(
    zone_id: str,
    db: Session = Depends(get_db),
    current_farmer=Depends(deps.get_current_farmer),
    _=Depends(deps.verify_zone_owner),
    payload: dict = Body(...)
) -> Any:
    """Update detailed soil and environmental profile for ML precision."""
    try:
        import uuid
        uuid.UUID(str(zone_id))
        zone = db.query(Zone).filter(Zone.id == zone_id).first()
    except (ValueError, Exception):
        zone = None

    if not zone:
        raise HTTPException(status_code=404, detail="ZONE_NOT_FOUND")

    # Update only allowed fields
    allowed_fields = {"ph", "rainfall", "ec", "oc", "S", "zn", "fe", "cu", "Mn", "B", "crop_type", "crop_stage"}
    for field, value in payload.items():
        if field in allowed_fields:
            setattr(zone, field, value)
            
    db.commit()
    return {"success": True, "message": "Zone profile updated successfully"}
