import json
import logging
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Farm, Zone, Device, Alert, AIDecision
from app.core.config import settings
from app.services.simulation_service import simulation_engine
from app.services.weather_service import get_weather_full
from app.db.mongodb import mongo_manager

logger = logging.getLogger(__name__)

def get_moisture_status(pct: float) -> str:
    if pct < 25:
        return "dry"
    if pct > 70:
        return "wet"
    return "ok"

async def sync_mongodb_zones(farm_id: str, db: Session):
    """
    Scans MongoDB for unique Node IDs and ensures they are registered as Zones in PostgreSQL.
    Automates the 'Zone Provisioning' workflow.
    """
    try:
        mongo_db = mongo_manager.client[settings.MONGODB_DB_NAME]
        collection = mongo_db["sensor_data"]
        
        # Get unique node_ids from the last 24h
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        node_ids = await collection.distinct("node_id", {"timestamp": {"$gte": cutoff}})
        
        for nid in node_ids:
            if nid is None: continue
            nid_str = str(nid)
            
            # Check if this node is already mapped to a zone
            zone = db.query(Zone).filter(Zone.node_id == nid_str).first()
            if not zone:
                logger.info(f"[Sync] Provisioning new zone for Node ID: {nid_str}")
                new_zone = Zone(
                    farm_id=farm_id,
                    name=f"Zone {nid_str}",
                    node_id=nid_str,
                    crop_type="Default",
                    is_active=True
                )
                db.add(new_zone)
        db.commit()
    except Exception as e:
        logger.warning(f"[DashboardSync] Failed to sync MongoDB zones: {e}")

async def get_dashboard(farm_id: str, db: Session, influx_client, redis) -> dict:
    cache_key = f"ks_dash_mongo_{farm_id}"
    try:
        cached = redis.get(cache_key)
        if cached:
            data = json.loads(cached)
            if data.get("zones"):
                data["data_source"] = "cache"
                return data
    except Exception: pass

    # 1. Sync MongoDB Nodes -> PostgreSQL Zones
    await sync_mongodb_zones(farm_id, db)

    # 2. Fetch Zone Metadata
    zones = db.query(Zone).filter(Zone.farm_id == farm_id).order_by(Zone.node_id).all()
    if not zones:
        return {"summary": {"active_zones": 0}, "zones": [], "data_source": "live"}

    # 3. Global Stats
    unread_count = db.query(Alert).filter(Alert.farm_id == farm_id, Alert.is_read == False).count()
    
    # 4. Fetch Weather (Pune Fallback)
    weather = {"temp": 28, "condition": "Clear", "humidity": 60, "wind": 5}
    try:
        farm = db.query(Farm).filter(Farm.id == farm_id).first()
        lat, lng = (farm.lat, farm.lng) if (farm and farm.lat) else (18.52, 73.86)
        weather = await get_weather_full(lat, lng)
    except Exception: pass

    # 5. Fetch Latest Sensor Data from MongoDB
    mongo_db = mongo_manager.client[settings.MONGODB_DB_NAME]
    collection = mongo_db["sensor_data"]
    
    dashboard_zones = []
    total_moisture = 0
    node_count = 0

    for z in zones:
        moisture, temp, humidity = 45.0, 30.0, 60.0 # Defaults
        n, p, k = 0, 0, 0
        
        if z.node_id:
            # Query MongoDB for latest reading for this node
            cursor = collection.find({"node_id": int(z.node_id) if z.node_id.isdigit() else z.node_id}).sort("timestamp", -1).limit(1)
            async for record in cursor:
                moisture = float(record.get("soil_moisture", 45.0))
                temp     = float(record.get("temperature", 30.0))
                humidity = float(record.get("humidity", 60.0))
                n        = float(record.get("N", 0))
                p        = float(record.get("P", 0))
                k        = float(record.get("K", 0))
                node_count += 1
                total_moisture += moisture

        dashboard_zones.append({
            "id": str(z.id),
            "node_id": z.node_id,
            "name": z.name,
            "moisture_pct": round(moisture, 1),
            "moisture_status": get_moisture_status(moisture),
            "temp_c": temp,
            "humidity": humidity,
            "nutrients": {"N": n, "P": p, "K": k},
            "crop_type": z.crop_type,
            "pump_running": False
        })

    dashboard = {
        "summary": {
            "active_zones": len(zones),
            "avg_moisture": round(total_moisture / node_count, 1) if node_count > 0 else 0,
            "system_status": "optimal" if node_count > 0 else "offline",
            "unread_alerts": unread_count,
        },
        "zones": dashboard_zones,
        "weather": weather,
        "water_quality": {"ph": 6.5, "ec_ms_cm": 1.2, "tank_level_pct": 85.0},
        "data_source": "mongodb"
    }

    try:
        redis.setex(cache_key, 5, json.dumps(dashboard, default=str))
    except Exception: pass

    return dashboard
