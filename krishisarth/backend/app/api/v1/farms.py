import math
from typing import Any
from fastapi import APIRouter, Depends, Query, status, Body
from sqlalchemy.orm import Session
from app.api import deps
from app.db.postgres import get_db
from app.models.zone import Zone
from app.services import farm_service
from app.schemas.farm_schema import FarmCreate, FarmOut, FarmListResponse
from app.schemas.zone_schema import ZoneCreate, ZonePatch, ZoneOut

router = APIRouter()

@router.get("/", response_model=dict)
def list_farms(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    current_farmer = Depends(deps.get_current_farmer)
) -> Any:
    """
    List all farms belonging to the current farmer.
    Returns a standardized paginated response.
    """
    farms, total = farm_service.get_farms_for_farmer(current_farmer.id, db, page, limit)
    # Convert to schema model for the response envelope
    return {
        "success": True,
        "data": {
            "farms": [FarmOut.model_validate(f) for f in farms],
            "total": total,
            "page": page,
            "limit": limit
        }
    }

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_farm(
    *,
    db: Session = Depends(get_db),
    current_farmer = Depends(deps.get_current_farmer),
    farm_in: FarmCreate
) -> Any:
    """
    Create a new farm for the current farmer.
    """
    farm = farm_service.create_farm(current_farmer.id, farm_in, db)
    return {
        "success": True, 
        "data": FarmOut.model_validate(farm)
    }

@router.post("/{farm_id}/auto-zones", response_model=dict, status_code=201)
def auto_create_zones(
    *,
    db: Session = Depends(get_db),
    farm = Depends(deps.verify_farm_owner),
    payload: dict = Body(...)
) -> Any:
    """
    Auto-partition a farm into optimal zones based on area.
    Each sensor node covers max 2000 sqm.
    Body: { "total_area_sqm": float, "crop_type": str (optional), "replace_existing": bool }
    """
    total_area = float(payload.get("total_area_sqm", farm.area_ha * 10000 if farm.area_ha else 10000))
    crop_type  = payload.get("crop_type", "unassigned")
    
    SENSOR_COVERAGE_SQM = 2000  # max area per sensor/zone
    num_zones = max(1, math.ceil(total_area / SENSOR_COVERAGE_SQM))
    
    # Delete existing zones if user wants fresh partition
    if payload.get("replace_existing", False):
        db.query(Zone).filter(Zone.farm_id == farm.id).delete()
        db.commit()
    
    zone_area = round(total_area / num_zones, 1)
    zone_labels = list("ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    
    created_zones = []
    for i in range(num_zones):
        label = zone_labels[i] if i < 26 else f"Z{i+1}"
        zone = Zone(
            farm_id=farm.id,
            name=f"Zone {label}",
            crop_type=crop_type,
            crop_stage="vegetative",
            area_sqm=zone_area,
            is_active=True,
            control_mode="view"  # start in view mode
        )
        db.add(zone)
        db.commit()
        db.refresh(zone)
        created_zones.append(zone)
    
    # Update farm area
    farm.area_ha = round(total_area / 10000, 4)
    db.commit()
    
    return {
        "success": True,
        "message": f"Created {num_zones} zones for {total_area} sqm farm",
        "data": {
            "total_area_sqm": total_area,
            "sensor_coverage_sqm": SENSOR_COVERAGE_SQM,
            "zones_created": num_zones,
            "zone_area_sqm": zone_area,
            "zones": [{"id": str(z.id), "name": z.name, "area_sqm": z.area_sqm} for z in created_zones]
        }
    }

@router.get("/{farm_id}", response_model=dict)
def get_farm(
    farm = Depends(deps.verify_farm_owner)
) -> Any:
    """
    Retrieve details of a specific farm.
    Ownership is verified via the verify_farm_owner dependency.
    """
    return {
        "success": True, 
        "data": FarmOut.model_validate(farm)
    }

@router.post("/{farm_id}/zones", response_model=dict, status_code=status.HTTP_201_CREATED)
def create_zone(
    *,
    db: Session = Depends(get_db),
    farm = Depends(deps.verify_farm_owner),
    zone_in: ZoneCreate
) -> Any:
    """
    Create a new zone within a specific farm.
    Validates farm ownership before creating the zone.
    """
    zone = farm_service.create_zone(farm.id, zone_in, db)
    return {
        "success": True, 
        "data": ZoneOut.model_validate(zone)
    }

@router.patch("/zones/{zone_id}", response_model=dict)
def update_zone(
    *,
    db: Session = Depends(get_db),
    zone = Depends(deps.verify_zone_owner),
    zone_in: ZonePatch
) -> Any:
    """
    Update specific fields of an existing zone.
    Ownership is verified via the verify_zone_owner dependency.
    """
    updated_zone = farm_service.update_zone(zone.id, zone_in, db)
    return {
        "success": True, 
        "data": ZoneOut.model_validate(updated_zone)
    }
