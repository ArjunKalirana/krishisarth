import asyncio
import random
import logging
import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from influxdb_client import Point
from app.db.postgres import SessionLocal
from app.db.redis import redis_client
from app.db.influxdb import get_write_api
from app.models.zone import Zone
from app.models.farm import Farm
from app.core.config import settings

logger = logging.getLogger(__name__)

class SimulationEngine:
    def __init__(self):
        self.running = False
        self._task = None
        # Internal state to track moisture drift for realism
        self.zone_states = {} 

    async def start(self):
        if self.running:
            return
        self.running = True
        self._task = asyncio.create_task(self._run_loop())
        logger.info("Simulation Engine STARTED")

    async def stop(self):
        self.running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("Simulation Engine STOPPED")

    async def _run_loop(self):
        while self.running:
            try:
                await self._simulate_tick()
            except Exception as e:
                logger.error(f"Simulation tick failed: {str(e)}")
            await asyncio.sleep(10) # Tick every 10 seconds

    async def _simulate_tick(self):
        db = SessionLocal()
        write_api = get_write_api()
        try:
            farms = db.query(Farm).all()
            for farm in farms:
                zones = db.query(Zone).filter(Zone.farm_id == farm.id).all()
                farm_telemetry = []
                
                # Water Quality (Farm Level)
                wq_point = Point("water_quality") \
                    .tag("farm_id", str(farm.id)) \
                    .field("ph", round(random.uniform(6.2, 6.8), 2)) \
                    .field("ec_ms_cm", round(random.uniform(1.1, 1.4), 2)) \
                    .field("tank_level", round(random.uniform(82, 88), 1)) \
                    .time(datetime.now(timezone.utc))
                write_api.write(bucket=settings.INFLUXDB_BUCKET, record=wq_point)

                for zone in zones:
                    zid = str(zone.id)
                    # Get or init state
                    if zid not in self.zone_states:
                        self.zone_states[zid] = {
                            "moisture": random.uniform(45, 65),
                            "temp": random.uniform(24, 32),
                            "ec": random.uniform(1.2, 1.8)
                        }
                    
                    state = self.zone_states[zid]
                    
                    # 1. Physics Model: Check if irrigation is active
                    is_irrigating = redis_client.get(f"irrigation_lock:{zid}") is not None
                    
                    if is_irrigating:
                        # Rising moisture
                        state["moisture"] = min(98.0, state["moisture"] + random.uniform(0.8, 2.2))
                        # Slight cooling effect
                        state["temp"] = max(20.0, state["temp"] - random.uniform(0.1, 0.3))
                    else:
                        # Natural evaporation/decay
                        state["moisture"] = max(5.0, state["moisture"] - random.uniform(0.02, 0.08))
                        # Thermal drift
                        state["temp"] += random.uniform(-0.1, 0.1)
                    
                    # 2. Random fluctuation (Noise)
                    state["moisture"] = round(state["moisture"] + random.uniform(-0.2, 0.2), 2)
                    state["temp"] = round(state["temp"], 1)

                    # 3. Write to InfluxDB
                    point = Point("soil_readings") \
                        .tag("zone_id", zid) \
                        .field("moisture_pct", state["moisture"]) \
                        .field("temp_c", state["temp"]) \
                        .field("ec_ds_m", state["ec"]) \
                        .time(datetime.now(timezone.utc))
                    write_api.write(bucket=settings.INFLUXDB_BUCKET, record=point)

                # 4. Invalidate/Update Dashboard Cache in Redis for instant UI feedback
                # Note: The dashboard_service.get_dashboard will call InfluxDB anyway,
                # but we can force it here if we wanted sub-second persistence.
                # For now, we let the InfluxDB write be the truth.

        finally:
            db.close()

simulation_engine = SimulationEngine()
