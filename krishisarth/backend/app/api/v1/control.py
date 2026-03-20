from typing import Any
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
from app.api import deps
from app.db.postgres import get_db
from app.db.redis import get_redis
from app.services import irrigation_service
from app.schemas.control_schema import IrrigateRequest, FertigationRequest

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
    result = await irrigation_service.start_irrigation(
        zone_id=zone_id, duration_min=req.duration_min, source=req.source, db=db, redis=redis
    )
    return {"success": True, "data": result}


@router.post("/{zone_id}/stop", response_model=dict)
async def stop_zone_irrigation(
    zone_id: str,
    db: Session = Depends(get_db),
    redis=Depends(get_redis),
    current_farmer=Depends(deps.get_current_farmer),
    _=Depends(deps.verify_zone_owner),
) -> Any:
    result = await irrigation_service.stop_irrigation(zone_id=zone_id, db=db, redis=redis)
    return {"success": True, "data": result}


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
