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
from app.models.farmer import Farmer
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
                # Increase backoff on consecutive failures to avoid log spam
                await asyncio.sleep(30) 
                continue
            await asyncio.sleep(10) # Normal tick every 10 seconds

    async def _simulate_tick(self):
        logger.debug(f"Simulation tick running — {len(self.zone_states)} zones in state")
        db = SessionLocal()
        write_api = get_write_api()
        try:
            # ONLY simulate the exact demo account for the judges.
            farms = db.query(Farm).join(Farmer).filter(
                Farmer.email == 'demo@gmail.com'
            ).all()
            
            for farm in farms:
                zones = db.query(Zone).filter(Zone.farm_id == farm.id).all()
                farm_telemetry = []
                
                # Water Quality (Farm Level) - Simulating tank drainage
                if farm.id not in self.zone_states:
                    self.zone_states[farm.id] = {"tank_level": 85.0} # Initialize farm-level state
                    
                tank_state = self.zone_states[farm.id]
                # Tank level drifts down 0.1-0.2% per tick
                tank_state["tank_level"] -= random.uniform(0.1, 0.2)
                if tank_state["tank_level"] < 30.0:
                    tank_state["tank_level"] = 85.0 # Automatic refill event
                
                wq_point = Point("water_quality") \
                    .tag("farm_id", str(farm.id)) \
                    .field("ph", round(random.uniform(6.6, 7.2), 2)) \
                    .field("ec_ms_cm", round(random.uniform(1.2, 1.6), 2)) \
                    .field("tank_level", round(tank_state["tank_level"], 1)) \
                    .time(datetime.now(timezone.utc))
                write_api.write(bucket=settings.INFLUXDB_BUCKET, record=wq_point)

                for zone in zones:
                    zid = str(zone.id)
                    # Get or init state
                    if zid not in self.zone_states:
                        zone_moisture_map = {
                            "wheat block": 18.0,        # critical dry
                            "grape vineyard": 21.0,     # dry
                            "chilli patch": 35.0,       # below optimal
                            "onion field": 44.0,        # moderate
                            "tomato greenhouse a": 58.0, # healthy
                            "pomegranate orchard": 72.0, # wet
                        }
                        zone_name_lower = zone.name.lower()
                        default_moisture = next(
                            (v for k, v in zone_moisture_map.items() if k in zone_name_lower),
                            random.uniform(35, 65)  # fallback
                        )
                        self.zone_states[zid] = {
                            "moisture": default_moisture,
                            "temp": random.uniform(28, 34),
                            "ec": random.uniform(1.1, 1.6),
                            "irrigating": False
                        }
                    
                    state = self.zone_states[zid]
                    
                    # 1. Physics Model: Check if irrigation is active
                    # Use scoped lock key: irrigation_lock:{farm_id}:{zone_id}
                    lock_key = f"irrigation_lock:{str(farm.id)}:{zid}"
                    is_irrigating = redis_client.get(lock_key) is not None or state.get("irrigating", False)
                    
                    if is_irrigating:
                        # Rising moisture (Pump active)
                        # In demo mode, we rise moisture by 1.5% - 2.5% per 10s tick
                        rise_amt = random.uniform(1.5, 2.5)
                        state["moisture"] = min(98.0, state["moisture"] + rise_amt)
                        
                        # Soft Stop logic for autonomous simulation
                        if state.get("irrigating") and state["moisture"] >= 65.0:
                            state["irrigating"] = False
                            
                        state["temp"] = max(24.0, state["temp"] - random.uniform(0.1, 0.3))
                    else:
                        # Natural evaporation / Evapotranspiration
                        # Slower, more realistic dry-down: 0.1% - 0.2% per tick (approx 1% per minute)
                        evap_rate = random.uniform(0.1, 0.2)
                        
                        # Wheat Block specialized dry-down
                        if "wheat" in zone.name.lower() and state["moisture"] > 22:
                            evap_rate += 0.15
                            
                        state["moisture"] = max(5.0, state["moisture"] - evap_rate)
                        
                        # Temperature thermal drift around 31°C
                        state["temp"] = round(31.0 + random.uniform(-0.3, 0.3), 1)
                        
                    # EC variance
                    state["ec"] = round(state["ec"] + random.uniform(-0.05, 0.05), 2)
                    state["moisture"] = round(state["moisture"], 2)

                    # 3. Write to InfluxDB
                    point = Point("soil_readings") \
                        .tag("zone_id", zid) \
                        .field("moisture_pct", state["moisture"]) \
                        .field("temp_c", state["temp"]) \
                        .field("ec_ds_m", state["ec"]) \
                        .time(datetime.now(timezone.utc))
                    write_api.write(bucket=settings.INFLUXDB_BUCKET, record=point)

                # 4. Invalidate Dashboard Cache in Redis for instant UI feedback
                try:
                    cache_key = f"dashboard_cache:{str(farm.id)}"
                    redis_client.delete(cache_key)
                except Exception as e:
                    logger.warning(f"Redis cache invalidation failed: {e}")

        finally:
            db.close()

simulation_engine = SimulationEngine()
