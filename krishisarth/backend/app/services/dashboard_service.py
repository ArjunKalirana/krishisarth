import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import Zone, Device, Alert, AIDecision
from app.core.config import settings


def get_moisture_status(pct: float) -> str:
    if pct < 25:
        return "dry"
    if pct > 70:
        return "wet"
    return "ok"


async def get_dashboard(farm_id: str, db: Session, influx_client, redis) -> dict:
    cache_key = f"dashboard_cache:{farm_id}"
    try:
        cached = redis.get(cache_key)
        if cached:
            data = json.loads(cached)
            data["data_source"] = "cache"
            return data
    except Exception:
        pass

    zones = db.query(Zone).filter(Zone.farm_id == farm_id).all()

    # Return empty-but-valid dashboard when farm has no zones yet
    if not zones:
        return {
            "summary": {
                "water_saved_today_l": 0.0,
                "system_status": "optimal",
                "next_irrigation_at": None,
                "active_zones": 0,
                "offline_devices": 0,
            },
            "zones": [],
            "water_quality": {"ph": None, "ec_ms_cm": None, "turbidity_ntu": None, "nitrate_ppm": None},
            "tank_level_pct": 0.0,
            "unread_alerts": 0,
            "data_source": "live",
        }

    zone_ids = [str(z.id) for z in zones]
    zone_map = {str(z.id): z.name for z in zones}
    active_count = sum(1 for z in zones if z.is_active)

    # FIX: Device has no farm_id — join through Zone
    devices = db.query(Device).join(Zone, Device.zone_id == Zone.id).filter(Zone.farm_id == farm_id).all()
    offline_count = sum(1 for d in devices if not d.is_online)

    unread_count = (
        db.query(Alert)
        .filter(Alert.farm_id == farm_id, Alert.is_read == False)
        .count()
    )

    # FIX: AIDecision has no farm_id — join through Zone
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    water_saved = (
        db.query(func.sum(AIDecision.water_saved_l))
        .join(Zone, AIDecision.zone_id == Zone.id)
        .filter(Zone.farm_id == farm_id, AIDecision.created_at >= today_start)
        .scalar()
        or 0.0
    )

    bucket = settings.INFLUXDB_BUCKET
    zone_ids_flux = '", "'.join(zone_ids)

    flux_soil = f'''
from(bucket: "{bucket}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "soil_readings")
  |> filter(fn: (r) => contains(value: r["zone_id"], set: ["{zone_ids_flux}"]))
  |> last()
  |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
'''

    flux_wq = f'''
from(bucket: "{bucket}")
  |> range(start: -24h)
  |> filter(fn: (r) => r["_measurement"] == "water_quality")
  |> filter(fn: (r) => r["farm_id"] == "{farm_id}")
  |> last()
  |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
'''

    dashboard = {
        "summary": {
            "water_saved_today_l": float(water_saved),
            "system_status": "optimal" if offline_count == 0 else "degraded",
            "next_irrigation_at": None,
            "active_zones": active_count,
            "offline_devices": offline_count,
        },
        "zones": [],
        "water_quality": {"ph": None, "ec_ms_cm": None, "turbidity_ntu": None, "nitrate_ppm": None},
        "tank_level_pct": 0.0,
        "unread_alerts": unread_count,
        "data_source": "live",
    }

    # FIX: wrap all InfluxDB calls — no data yet is normal on a fresh install
    soil_data: dict = {}
    try:
        query_api = influx_client.query_api()
        for table in query_api.query(flux_soil):
            for record in table.records:
                zid = record.values.get("zone_id")
                if zid:
                    soil_data[zid] = {
                        "moisture": float(record.values.get("moisture_pct", 0.0)),
                        "temp_c": record.values.get("temp_c"),
                        "ec_ds_m": record.values.get("ec_ds_m"),
                    }
    except Exception:
        pass

    for zid, name in zone_map.items():
        t = soil_data.get(zid, {"moisture": 0.0, "temp_c": None, "ec_ds_m": None})
        m = t.get("moisture", 0.0)
        dashboard["zones"].append({
            "id": zid,
            "name": name,
            "moisture_pct": m,
            "moisture_status": get_moisture_status(m),
            "temp_c": t.get("temp_c"),
            "ec_ds_m": t.get("ec_ds_m"),
            "pump_running": False,
        })

    try:
        query_api = influx_client.query_api()
        for table in query_api.query(flux_wq):
            for record in table.records:
                dashboard["water_quality"] = {
                    "ph": record.values.get("ph"),
                    "ec_ms_cm": record.values.get("ec_ms_cm"),
                    "turbidity_ntu": record.values.get("turbidity_ntu"),
                    "nitrate_ppm": record.values.get("nitrate_ppm"),
                }
                if "tank_level" in record.values:
                    dashboard["tank_level_pct"] = float(record.values.get("tank_level", 0.0))
    except Exception:
        pass

    try:
        redis.setex(cache_key, 60, json.dumps(dashboard, default=str))
    except Exception:
        pass

    return dashboard
