from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from app.db.postgres import get_db
from app.db.redis import get_redis
from app.db.influxdb import get_write_api
from app.mqtt.client import mqtt_manager
from app.api.v1.websocket import manager
from app.models.zone import Zone
from app.services.ml_service import predict_crop, predict_fertility, log_inference_event
from app.services import irrigation_service
from influxdb_client import Point
from datetime import datetime, timezone
import asyncio, logging, json

router = APIRouter()
logger = logging.getLogger(__name__)

class HardwarePayload(BaseModel):
    id: int           # zone index
    temp: float       # temperature °C
    hum: float        # humidity %
    soil: float       # soil moisture (raw or %)
    N: float = 0.0
    P: float = 0.0
    K: float = 0.0
    # Optional supplemental for full fertility model
    ph: float = 6.5
    rainfall: float = 100.0
    ec: float = 0.5
    oc: float = 0.6
    s: float = 10.0
    zn: float = 0.6
    fe: float = 4.5
    cu: float = 0.2
    mn: float = 2.0
    b: float = 0.5

@router.post("/ingest")
async def hardware_ingest(
    payload: HardwarePayload,
    db: Session = Depends(get_db),
    redis=Depends(get_redis),
    write_api=Depends(get_write_api),
):
    """
    Receive sensor data from Raspberry Pi, store in InfluxDB,
    run ML models, broadcast to frontend via WebSocket,
    and trigger auto-actions in View Mode.
    """
    zone_index = payload.id

    # 1. Resolve zone by index (fallback order to avoid missing migrations)
    zones = db.query(Zone).order_by(Zone.created_at).all()
    if not zones or zone_index - 1 >= len(zones):
        raise HTTPException(404, f"No zone found for hardware id={zone_index}")
        
    zone = zones[zone_index - 1]
    
    zone_id = str(zone.id)
    farm_id = str(zone.farm_id)
    moisture = min(payload.soil, 100.0)  # cap at 100%

    # 1.5 Fetch Environmental Data Fallback (OpenWeatherMap)
    rainfall_val = payload.rainfall
    if rainfall_val == 100.0 and zone.rainfall == 100.0:
        # Check if we can fetch live weather
        from app.models.farm import Farm
        from app.services.weather_service import get_rainfall_data
        farm = db.query(Farm).filter(Farm.id == zone.farm_id).first()
        if farm and farm.lat and farm.lng:
            rainfall_val = await get_rainfall_data(farm.lat, farm.lng)
            logger.info(f"WeatherSync: Fetched live rainfall {rainfall_val}mm for farm {farm.name}")

    # 2. Write to InfluxDB
    point = (
        Point("hardware_readings")
        .tag("zone_id", zone_id)
        .tag("zone_index", str(zone_index))
        .field("moisture", moisture)
        .field("temp_c", payload.temp)
        .field("humidity_pct", payload.hum)
        .field("N", payload.N)
        .field("P", payload.P)
        .field("K", payload.K)
        .field("rainfall", rainfall_val)
        .time(datetime.now(timezone.utc))
    )
    write_api.write(bucket="krishisarth_sensors", record=point)

    # 3. Call ML models concurrently using Zone Data + Weather fallbacks
    crop_task = predict_crop(
        N=payload.N, P=payload.P, K=payload.K,
        temperature=payload.temp, humidity=payload.hum,
        ph=payload.ph if payload.ph != 6.5 else (zone.ph or 6.5),
        rainfall=rainfall_val if rainfall_val != 100.0 else (zone.rainfall or 100.0)
    )
    fertility_task = predict_fertility(
        N=payload.N, P=payload.P, K=payload.K,
        ph=payload.ph if payload.ph != 6.5 else (zone.ph or 6.5),
        ec=payload.ec if payload.ec != 0.5 else (zone.ec or 0.5),
        oc=payload.oc if payload.oc != 0.6 else (zone.oc or 0.6),
        s=payload.s if payload.s != 10.0 else (zone.s or 10.0),
        zn=payload.zn if payload.zn != 0.6 else (zone.zn or 0.6),
        fe=payload.fe if payload.fe != 4.5 else (zone.fe or 4.5),
        cu=payload.cu if payload.cu != 0.2 else (zone.cu or 0.2),
        mn=payload.mn if payload.mn != 2.0 else (zone.mn or 2.0),
        b=payload.b if payload.b != 0.5 else (zone.b or 0.5)
    )
    crop_result, fertility_result = await asyncio.gather(crop_task, fertility_task)
    
    # 3.5 Log combined inference event to MongoDB for 'critical and important data' persistence
    asyncio.create_task(log_inference_event(payload.dict(), crop_result, fertility_result))

    # Cache ML results in Redis (TTL: 10 minutes)
    redis.setex(f"ml:zone:{zone_id}:crop", 600, crop_result)
    redis.setex(f"ml:zone:{zone_id}:fertility", 600, json.dumps(fertility_result))

    # 4. Auto-actions in VIEW MODE
    actions_triggered = []
    if zone.control_mode == "view":
        # Auto-irrigation: soil moisture below threshold
        if moisture < 30:
            try:
                await irrigation_service.start_irrigation(
                    zone_id=zone_id, duration_min=15,
                    source="auto_sensor", db=db, redis=redis
                )
                mqtt_manager.client.publish(f"krishisarth/zone/{zone_id}/pump/on", "ON", qos=1)
                actions_triggered.append({"action": "auto_irrigation_started", "reason": f"moisture={moisture}%"})
                logger.info(f"AUTO: Started irrigation on zone {zone_id} (moisture={moisture}%)")
            except Exception as e:
                logger.error(f"Auto-irrigation failed: {e}")

        # Auto-fertigation: N, P, or K low
        if payload.N < 10 or payload.P < 10 or payload.K < 10:
            low_nutrients = []
            if payload.N < 10: low_nutrients.append("nitrogen")
            if payload.P < 10: low_nutrients.append("phosphorus")
            if payload.K < 10: low_nutrients.append("potassium")
            nutrient_type = low_nutrients[0]  # queue first deficient
            
            # Start pump if not already running for fertigation
            if not redis.get(f"irrigation_lock:{farm_id}:{zone_id}"):
                try:
                    await irrigation_service.start_irrigation(
                        zone_id=zone_id, duration_min=15,
                        source="auto_sensor", db=db, redis=redis
                    )
                    mqtt_manager.client.publish(f"krishisarth/zone/{zone_id}/pump/on", "ON", qos=1)
                except Exception as e:
                    logger.error(f"Pump auto-start for fertigation failed: {e}")

            try:
                await irrigation_service.queue_fertigation(
                    zone_id=zone_id, nutrient_type=nutrient_type,
                    concentration_ml=10.0, db=db, redis=redis
                )
                mqtt_manager.client.publish(
                    f"krishisarth/zone/{zone_id}/fertigation/start",
                    json.dumps({"nutrient": nutrient_type, "dose_ml": 10}), qos=1
                )
                actions_triggered.append({
                    "action": "auto_fertigation_queued",
                    "nutrient": nutrient_type,
                    "reason": f"low_nutrients={low_nutrients}"
                })
            except Exception as e:
                logger.error(f"Auto-fertigation failed: {e}")

    # 5. Broadcast full data to frontend via WebSocket
    ws_message = {
        "type": "HARDWARE_UPDATE",
        "data": {
            "zone_id": zone_id,
            "zone_index": zone_index,
            "moisture_pct": moisture,
            "temp_c": payload.temp,
            "humidity_pct": payload.hum,
            "N": payload.N,
            "P": payload.P,
            "K": payload.K,
            "ml_crop": crop_result,
            "ml_fertility": fertility_result,
            "actions_triggered": actions_triggered,
            "pump_status": "on" if redis.get(f"irrigation_lock:{farm_id}:{zone_id}") else "off",
            "fertigation_status": "active" if any("fertigation" in a["action"] for a in actions_triggered) else "idle",
            "last_updated": datetime.now(timezone.utc).isoformat()
        }
    }
    await manager.broadcast_to_farm(farm_id, ws_message)

    return {
        "success": True,
        "zone_id": zone_id,
        "zone_index": zone_index,
        "ml_crop": crop_result,
        "ml_fertility": fertility_result,
        "actions_triggered": actions_triggered
    }
