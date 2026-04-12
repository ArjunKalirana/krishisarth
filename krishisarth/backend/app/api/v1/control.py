from typing import Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api import deps
from app.db.postgres import get_db
from app.db.redis import get_redis
from app.services import irrigation_service
from app.schemas.control_schema import IrrigateRequest, FertigationRequest
from app.mqtt.client import mqtt_manager
from app.services.simulation_service import simulation_engine
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
    try:
        # Physical Hardware Trigger (MQTT)
        topic = f"krishisarth/zone/{zone_id}/pump/on"
        mqtt_manager.client.publish(topic, "ON", qos=1)
        
        result = await irrigation_service.start_irrigation(
            zone_id=zone_id, duration_min=req.duration_min, source=req.source, db=db, redis=redis
        )
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
    try:
        # Physical Hardware Trigger (MQTT)
        topic = f"krishisarth/zone/{zone_id}/pump/off"
        mqtt_manager.client.publish(topic, "OFF", qos=1)
        
        result = await irrigation_service.stop_irrigation(zone_id=zone_id, db=db, redis=redis)
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
