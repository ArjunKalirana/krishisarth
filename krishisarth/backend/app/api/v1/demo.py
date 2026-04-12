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

        # 2. Farm
        farm = db.query(Farm).filter(Farm.farmer_id == farmer.id, Farm.name == "KrishiSarth Demo Farm").first()
        if not farm:
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
        
        # 3. Zones - Check if already seeded
        existing_zones = db.query(Zone).filter(Zone.farm_id == farm.id).count()
        if existing_zones >= 6:
            return {"success": True, "message": "Demo data already seeded", "farm_id": str(farm.id)}

        # Continue with seeding...

        # 3. Zones
        zone_configs = [
            {"name": "Tomato Greenhouse A", "crop_type": "tomato", "crop_stage": "fruiting", "area_sqm": 4500},
            {"name": "Grape Vineyard", "crop_type": "grape", "crop_stage": "flowering", "area_sqm": 12000},
            {"name": "Onion Field", "crop_type": "onion", "crop_stage": "bulbing", "area_sqm": 8000},
            {"name": "Pomegranate Orchard", "crop_type": "pomegranate", "crop_stage": "vegetative", "area_sqm": 15000},
            {"name": "Chilli Patch", "crop_type": "chilli", "crop_stage": "seedling", "area_sqm": 3000},
            {"name": "Wheat Block", "crop_type": "wheat", "crop_stage": "harvesting", "area_sqm": 9000},
        ]
        
        zones = []
        for zc in zone_configs:
            zone = Zone(
                farm_id=farm.id,
                name=zc["name"],
                crop_type=zc["crop_type"],
                crop_stage=zc["crop_stage"],
                area_sqm=zc["area_sqm"],
                is_active=True
            )
            db.add(zone)
            db.commit()
            db.refresh(zone)
            zones.append(zone)

            # 4. Device per Zone
            device = Device(
                zone_id=zone.id,
                type="soil_sensor",
                serial_no=f"ESP32-DEMO-{zone.name[:4].upper()}-{random.randint(100,999)}",
                is_online=True,
                battery_pct=random.randint(70,98)
            )
            db.add(device)

        # 5. Alerts
        alert_defs = [
            ("critical", "MOISTURE_ALERT", "Wheat Block moisture at 18% — critically below threshold. Irrigate immediately.", False),
            ("warning", "PUMP_FAILURE", "Grape Vineyard pump pressure dropped — possible blockage", False),
            ("info", "AI_DECISION", "AI skipped irrigation in Pomegranate Orchard — moisture at 72%", False),
            ("warning", "TANK_LOW", "Main water tank at 22% — schedule refill", True),
            ("critical", "SENSOR_FAULT", "Wheat Block sensor offline 2 hrs — last reading 22%", True),
            ("info", "FERTIGATION", "Nitrogen injection completed for Tomato Greenhouse A", True),
        ]
        for sev, atype, msg, is_read in alert_defs:
            alert = Alert(
                farm_id=farm.id,
                zone_id=zones[0].id, # Link all to first zone or map appropriately
                severity=sev,
                type=atype,
                message=msg,
                is_read=is_read,
                created_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 24))
            )
            db.add(alert)

        # 6. AI Decisions
        ai_targets = [z for z in zones if z.name in ["Grape Vineyard", "Pomegranate Orchard", "Wheat Block", "Tomato Greenhouse A", "Chilli Patch"]]
        actions = ["IRRIGATE", "SKIP", "IRRIGATE_URGENT"]
        for idx, z in enumerate(ai_targets):
            action = actions[idx % len(actions)]
            water_saved = 0 if "IRRIGATE" in action else random.randint(1800, 3200)
            reasoning = f"Moisture critically low at 19% during {z.crop_stage} stage — yield loss risk 35%" if "IRRIGATE" in action else f"Adequate moisture ({random.randint(65,75)}%) detected with rain forecast. Skipping saves {water_saved}L."
            
            decision = AIDecision(
                zone_id=z.id,
                decision_type="irrigate" if "IRRIGATE" in action else "skip",
                reasoning=reasoning,
                confidence=round(random.uniform(0.83, 0.99), 2),
                water_saved_l=float(water_saved),
                created_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 8))
            )
            db.add(decision)

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

        return {"success": True, "message": "Demo account seeded successfully", "farm_id": str(farm.id), "zones_created": 6}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
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
    """Instantly drops moisture to 5% for the specified zone (by name)."""
    db = SessionLocal()
    try:
        zone = db.query(Zone).filter(Zone.name.ilike(f"%{zone_name}%")).first()
        if not zone:
            raise HTTPException(status_code=404, detail=f"Zone '{zone_name}' not found")
        
        zid = str(zone.id)
        if zid not in simulation_engine.zone_states:
             simulation_engine.zone_states[zid] = {"moisture": 5.0, "temp": 32.0, "ec": 1.5, "irrigating": False}
        else:
            simulation_engine.zone_states[zid]["moisture"] = 5.0
            simulation_engine.zone_states[zid]["irrigating"] = False
            
        return {"success": True, "zone_found": zone.name, "moisture_set_to": 5.0}
    finally:
        db.close()

@router.api_route("/reset", methods=["GET", "POST"])
async def reset_simulation():
    """Resets all simulated zones to healthy moisture (55%)."""
    for zid in simulation_engine.zone_states:
        simulation_engine.zone_states[zid]["moisture"] = 55.0
        simulation_engine.zone_states[zid]["irrigating"] = False
    return {"success": True, "message": "Simulation states reset to healthy"}
