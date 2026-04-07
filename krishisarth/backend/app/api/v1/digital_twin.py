from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Dict, Any, Optional
from app.api import deps
from app.services.digital_twin_service import digital_twin_engine

router = APIRouter()

class CurrentStateSchema(BaseModel):
    moisture_pct: Optional[float] = 50.0
    temp_c: Optional[float] = 25.0
    ec_ds_m: Optional[float] = 1.2
    ph: Optional[float] = 6.5
    crop_type: Optional[str] = "default"
    crop_stage: Optional[str] = "vegetative"

class SimulateIrrigationRequest(BaseModel):
    duration_minutes: int
    current_state: CurrentStateSchema

class SimulateFertigationRequest(BaseModel):
    nutrient_type: str
    dose_ml: float
    current_state: CurrentStateSchema

@router.post("/zones/{zone_id}/twin/simulate-irrigation")
def simulate_irrigation(
    zone_id: str,
    req: SimulateIrrigationRequest,
    current_farmer = Depends(deps.get_current_farmer)
):
    result = digital_twin_engine.simulate_irrigation(
        zone_id=zone_id,
        duration_minutes=req.duration_minutes,
        current_state=req.current_state.model_dump() if hasattr(req.current_state, 'model_dump') else req.current_state.dict()
    )
    return {"success": True, "data": result}

@router.post("/zones/{zone_id}/twin/simulate-fertigation")
def simulate_fertigation(
    zone_id: str,
    req: SimulateFertigationRequest,
    current_farmer = Depends(deps.get_current_farmer)
):
    result = digital_twin_engine.simulate_fertigation(
        zone_id=zone_id,
        nutrient_type=req.nutrient_type,
        dose_ml=req.dose_ml,
        current_state=req.current_state.model_dump() if hasattr(req.current_state, 'model_dump') else req.current_state.dict()
    )
    return {"success": True, "data": result}

@router.get("/farms/{farm_id}/twin/status")
def get_twin_status(
    farm_id: str,
    current_farmer = Depends(deps.get_current_farmer)
):
    result = digital_twin_engine.get_twin_status()
    return {"success": True, "data": result}

@router.post("/farms/{farm_id}/twin/calibrate")
def recalibrate_twin(
    farm_id: str,
    current_farmer = Depends(deps.get_current_farmer)
):
    result = digital_twin_engine.recalibrate_twin()
    return {"success": True, "data": result}
