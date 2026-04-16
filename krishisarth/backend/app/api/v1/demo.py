"""
DEMO SEEDER — REMOVE BEFORE PRODUCTION
Provides endpoints for seeding demo data, triggering crises, and checking status.
Designed to work in cloud environments (Railway/Vercel) without subprocess dependencies.
"""
import random
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from influxdb_client import Point

from app.db.postgres import SessionLocal
from app.db.influxdb import get_write_api
from app.models import Farmer, Farm, Zone, Device, Alert, AIDecision
from app.services.auth_service import hash_password
from app.services.simulation_service import simulation_engine
from app.core.config import settings

router = APIRouter()

@router.api_route("/history", methods=["GET", "POST"])
async def backfill_history():
    """
    Inline demo seeder. Creates farmer, farm, zones, and 7-day historical telemetry.
    No authentication required for demo purposes.
    """
    db = SessionLocal()
    try:
        # 1. Farmer
        demo_email = "demo@gmail.com"
        farmer = db.query(Farmer).filter(Farmer.email == demo_email).first()
        if not farmer:
            farmer = Farmer(
                name="Demo Farmer",
                email=demo_email,
                password_hash=hash_password("Demo@123"),
                phone="+91-9876543210"
            )
            db.add(farmer)
            db.commit()
            db.refresh(farmer)

        # 2. Safe cleanup — load farms as ORM objects so cascade works correctly
        print(f"[Seeder] Cleaning up existing farms for farmer {farmer.id}...")
        existing_farms = db.query(Farm).filter(Farm.farmer_id == farmer.id).all()
        for old_farm in existing_farms:
            # Must delete child records that have farm_id FK but no ORM cascade
            # Alert has farm_id and zone_id — delete alerts first
            db.query(Alert).filter(Alert.farm_id == old_farm.id).delete(synchronize_session=False)
            
            # Zones cascade to devices/AI decisions/fertigation via ORM cascade="all, delete-orphan"
            # But bulk-delete bypasses that, so delete zones explicitly too
            zone_ids = [z.id for z in db.query(Zone).filter(Zone.farm_id == old_farm.id).all()]
            if zone_ids:
                db.query(AIDecision).filter(AIDecision.zone_id.in_(zone_ids)).delete(synchronize_session=False)
                db.query(Device).filter(Device.zone_id.in_(zone_ids)).delete(synchronize_session=False)
            
            db.query(Zone).filter(Zone.farm_id == old_farm.id).delete(synchronize_session=False)
            db.delete(old_farm)
        db.commit()
        print(f"[Seeder] Deleted {len(existing_farms)} old farm(s).")
        
        print("[Seeder] Creating fresh KrishiSarth Demo Farm...")
        farm = Farm(
            name="KrishiSarth Demo Farm",
            soil_type="Black Cotton",
            area_ha=5.2,
            farmer_id=farmer.id,
            lat=20.0059,
            lng=73.7897
        )
        db.add(farm)
        db.commit()
        db.refresh(farm)
        
        # 3. Zones - No longer creating mock zones; the system will sync real nodes from MongoDB.
        zones = []
        db.commit()

        # 7. InfluxDB Backfill (7 days, hourly)
        write_api = get_write_api()
        now = datetime.now(timezone.utc)
        
        for z in zones:
            # Determine moisture profile based on zone name
            name_lower = z.name.lower()
            if "wheat" in name_lower: base, var = 20, 5
            elif "grape" in name_lower: base, var = 23, 5
            elif "pomegranate" in name_lower: base, var = 70, 5
            else: base, var = 55, 10

            for h in range(168): # 7 days * 24h
                ts = now - timedelta(hours=h)
                val = base + random.uniform(-var, var)
                p = Point("soil_readings") \
                    .tag("zone_id", str(z.id)) \
                    .field("moisture_pct", round(val, 2)) \
                    .field("temp_c", round(random.uniform(26, 36), 1)) \
                    .field("ec_ds_m", round(random.uniform(0.9, 2.2), 2)) \
                    .time(ts)
                write_api.write(bucket=settings.INFLUXDB_BUCKET, record=p)

        # Water Quality (daily for 7 days)
        for d in range(7):
            ts = now - timedelta(days=d)
            p = Point("water_quality") \
                .tag("farm_id", str(farm.id)) \
                .field("ph", round(random.uniform(6.6, 7.4), 1)) \
                .field("ec_ms_cm", round(random.uniform(1.0, 1.9), 2)) \
                .field("turbidity_ntu", round(random.uniform(1.5, 4.5), 1)) \
                .field("tank_level", round(random.uniform(40, 92), 1)) \
                .time(ts)
            write_api.write(bucket=settings.INFLUXDB_BUCKET, record=p)

        # 8. Force Simulation Engine to re-adopt the new IDs
        try:
            simulation_engine.zone_states.clear()
            print("[Seeder] Simulation engine state CLEARED for re-adoption.")
        except: pass

        return {
            "success": True, 
            "message": "Nuke & Deep Seed Complete", 
            "farm_id": str(farm.id),
            "zones_created": len(zones)
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Seeding failed: {str(e)}")
    finally:
        db.close()

@router.get("/farm-id")
async def get_demo_farm_id():
    """Returns the current demo farm ID so the frontend can update its state."""
    db = SessionLocal()
    try:
        farmer = db.query(Farmer).filter(Farmer.email == "demo@gmail.com").first()
        if not farmer:
            return {"success": False, "message": "Demo not seeded"}
        
        farm = db.query(Farm).filter(
            Farm.farmer_id == farmer.id
        ).order_by(Farm.created_at.desc()).first()
        
        if not farm:
            return {"success": False, "message": "No farm found"}
        
        zones = db.query(Zone).filter(Zone.farm_id == farm.id).all()
        
        return {
            "success": True,
            "farm_id": str(farm.id),
            "farm_name": farm.name,
            "zones_count": len(zones),
            "farmer_id": str(farmer.id)
        }
    finally:
        db.close()

@router.get("/status")
async def get_demo_status():
    """Health check for demo account and simulation engine."""
    db = SessionLocal()
    try:
        farmer = db.query(Farmer).filter(Farmer.email == "demo@gmail.com").first()
        if not farmer:
            return {"seeded": False, "simulation_running": False, "message": "Demo account not seeded yet"}
        
        farm = db.query(Farm).filter(Farm.farmer_id == farmer.id).first()
        zones_count = db.query(Zone).filter(Zone.farm_id == farm.id).count() if farm else 0
        
        return {
            "seeded": True,
            "farmer_id": str(farmer.id),
            "farm_name": farm.name if farm else None,
            "zones_count": zones_count,
            "simulation_running": simulation_engine.running,
            "zone_states": simulation_engine.zone_states,
            "message": "Demo ready" if simulation_engine.running else "Demo seeded but simulation not running"
        }
    finally:
        db.close()

@router.api_route("/crisis", methods=["GET", "POST"])
async def inject_crisis(zone_name: str = "Wheat Block"):
    """Instantly drops moisture to 5% to trigger AI alerts."""
    db = SessionLocal()
    try:
        farmer = db.query(Farmer).filter(Farmer.email == "demo@gmail.com").first()
        if not farmer:
            return {"success": False, "message": "Demo not seeded"}
        
        farm = db.query(Farm).filter(Farm.farmer_id == farmer.id).order_by(Farm.created_at.desc()).first()
        if not farm:
            return {"success": False, "message": "No farm found"}
        
        # Find zone by name (partial, case-insensitive)
        zone = db.query(Zone).filter(
            Zone.farm_id == farm.id,
            Zone.name.ilike(f"%{zone_name}%")
        ).first()
        
        if not zone:
            # Fall back to any zone
            zone = db.query(Zone).filter(Zone.farm_id == farm.id).first()
        
        if not zone:
            return {"success": False, "message": "No zones found — call /demo/history first"}
        
        zid = str(zone.id)
        # Force into simulation state regardless of whether engine has adopted it
        simulation_engine.zone_states[zid] = {
            "moisture": 5.0,
            "temp": 35.0,
            "ec": 1.8,
            "irrigating": False
        }
        
        return {
            "success": True,
            "zone_found": zone.name,
            "zone_id": zid,
            "moisture_set_to": 5.0
        }
    finally:
        db.close()

@router.api_route("/reset", methods=["GET", "POST"])
async def reset_simulation():
    """Resets all simulated zones to healthy moisture levels."""
    db = SessionLocal()
    try:
        farmer = db.query(Farmer).filter(Farmer.email == "demo@gmail.com").first()
        if not farmer:
            return {"success": False, "message": "Demo not seeded"}
        
        farm = db.query(Farm).filter(Farm.farmer_id == farmer.id).order_by(Farm.created_at.desc()).first()
        if not farm:
            return {"success": False, "message": "No farm found"}
        
        zones = db.query(Zone).filter(Zone.farm_id == farm.id).all()
        
        zone_defaults = {
            "wheat": 18.0, "grape": 21.0, "chilli": 35.0,
            "onion": 44.0, "tomato": 58.0, "pomegranate": 72.0,
        }
        
        reset_count = 0
        for zone in zones:
            name_lower = zone.name.lower()
            moisture = next((v for k, v in zone_defaults.items() if k in name_lower), 50.0)
            simulation_engine.zone_states[str(zone.id)] = {
                "moisture": moisture,
                "temp": 30.0,
                "ec": 1.3,
                "irrigating": False
            }
            reset_count += 1
        
        return {"success": True, "message": f"Reset {reset_count} zones to healthy levels"}
    finally:
        db.close()
