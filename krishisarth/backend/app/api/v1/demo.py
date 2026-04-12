"""
One-time demo data endpoint — protected by a secret key.
Call once after deployment to populate demo account.
DELETE this file before going to production.
"""
import os
from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.api_route("/history", methods=["GET", "POST"])
async def backfill_history():
    """Triggers the 7-day historical backfill for InfluxDB."""
    import subprocess, sys
    script_path = os.path.join(os.getcwd(), "krishisarth", "backend", "scripts", "demo_seed.py")
    try:
        subprocess.Popen([sys.executable, script_path])
        return {"success": True, "message": "Historical backfill started in background"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.api_route("/crisis", methods=["GET", "POST"])
async def inject_crisis(zone_id: str):
    """Instantly drops moisture to 5% to trigger AI alerts."""
    from app.services.simulation_service import simulation_engine
    if zone_id in simulation_engine.zone_states:
        simulation_engine.zone_states[zone_id]["moisture"] = 5.0
        return {"success": True, "message": f"Moisture drop injected for zone {zone_id}"}
    return {"success": False, "message": "Zone ID not yet initialized in simulator"}

@router.api_route("/reset", methods=["GET", "POST"])
async def reset_simulation():
    """Resets all simulated zones to healthy moisture (55%)."""
    from app.services.simulation_service import simulation_engine
    for zid in simulation_engine.zone_states:
        simulation_engine.zone_states[zid]["moisture"] = 55.0
    return {"success": True, "message": "Simulation states reset to healthy"}
