import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.ai_decision import AIDecision
from app.models.zone import Zone
from app.core import constants
from app.core.config import settings

logger = logging.getLogger(__name__)

class ModelLoadError(Exception):
    """Raised when machine learning models fail to initialize."""
    pass

async def run_inference(zone_id: str, db: Session, influx_client=None, redis=None) -> AIDecision:
    """
    Execute an AI reasoning cycle for a zone.
    Falls back gracefully if InfluxDB or Redis are unavailable.
    """
    # Use injected deps or fall back to module-level singletons
    if redis is None:
        from app.db.redis import redis_client
        redis = redis_client

    if influx_client is None:
        from app.db.influxdb import client as influx_singleton
        influx_client = influx_singleton

    # 1. Load zone from database
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise ValueError(f"Zone {zone_id} not found")

    farm_id = str(zone.farm_id)

    # 2. Fetch latest moisture from InfluxDB — graceful if no data
    moisture_pct = 0.0
    try:
        query_api = influx_client.query_api()
        bucket = settings.INFLUXDB_BUCKET
        flux = f'''
        from(bucket: "{bucket}")
          |> range(start: -24h)
          |> filter(fn: (r) => r["_measurement"] == "soil_readings")
          |> filter(fn: (r) => r["zone_id"] == "{zone_id}")
          |> last()
        '''
        results = query_api.query(flux)
        for table in results:
            for record in table.records:
                if record.get_field() in ("moisture_pct", "moisture"):
                    val = record.get_value()
                    if val is not None:
                        moisture_pct = float(val)
                        break
    except Exception as e:
        logger.warning(f"InfluxDB unavailable for zone {zone_id}: {str(e)}")
        moisture_pct = 0.0

    # 3. Fetch tank level from Redis — graceful if unavailable
    tank_val = 100.0
    try:
        tank_raw = redis.get(f"tank_level:{farm_id}")
        if tank_raw:
            tank_val = float(tank_raw)
    except Exception as e:
        logger.warning(f"Redis unavailable: {str(e)}")
        tank_val = 100.0

    # 4. Build input snapshot
    snapshot = {
        "moisture_pct": moisture_pct,
        "crop_type":    zone.crop_type,
        "crop_stage":   zone.crop_stage,
        "tank_level":   tank_val,
        "zone_name":    zone.name,
        "at":           datetime.now(timezone.utc).isoformat()
    }

    # 5. Rule-based decision (LSTM model not trained yet — using threshold rules)
    decision_type = "skip"
    confidence    = 0.65
    reasoning     = f"Soil moisture at {moisture_pct:.1f}% — within acceptable range. No irrigation needed."
    water_saved   = 0.0

    if moisture_pct < constants.AI_MOISTURE_RULE_THRESHOLD * 100:
        decision_type = "irrigate"
        confidence    = 0.92
        reasoning     = (
            f"Critical moisture deficit detected: {moisture_pct:.1f}% "
            f"(threshold: {constants.AI_MOISTURE_RULE_THRESHOLD * 100:.0f}%). "
            f"Immediate irrigation recommended for {zone.name} "
            f"({zone.crop_type}, {zone.crop_stage} stage)."
        )
        water_saved = 0.0
    elif moisture_pct == 0.0:
        decision_type = "skip"
        confidence    = 0.55
        reasoning     = (
            f"No sensor data available for {zone.name}. "
            f"Skipping irrigation as a precaution. "
            f"Connect IoT sensors or run inject_fake_sensors.py for testing."
        )
    elif moisture_pct > 70:
        decision_type = "skip"
        confidence    = 0.88
        reasoning     = (
            f"Soil is well-hydrated at {moisture_pct:.1f}% for {zone.name}. "
            f"Irrigation skipped — estimated water saved: 20L."
        )
        water_saved = 20.0

    # 6. Persist the decision
    decision = AIDecision(
        zone_id        = zone_id,
        decision_type  = decision_type,
        reasoning      = reasoning,
        confidence     = confidence,
        input_snapshot = snapshot,
        water_saved_l  = water_saved,
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)

    logger.info(
        f"AI Decision for zone {zone.name}: {decision_type} "
        f"(confidence={confidence:.0%}, moisture={moisture_pct:.1f}%)"
    )

    return decision
