import sys
import os
import random
from datetime import datetime, timedelta, timezone
from influxdb_client import Point
from influxdb_client.client.write_api import SYNCHRONOUS

# Add project root to sys.path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.postgres import SessionLocal
from app.db.influxdb import get_influx_client
from app.models import Farm, Zone
from app.core.config import settings

def seed_historical_data():
    """
    Backfills InfluxDB with 7 days of realistic historical data.
    """
    print("--- Starting Historical Data Backfill (7 Days) ---")
    db = SessionLocal()
    client = get_influx_client()
    write_api = client.write_api(write_options=SYNCHRONOUS)
    
    try:
        farms = db.query(Farm).all()
        if not farms:
            print("ERROR: No farms found in PostgreSQL. Run seed.py first!")
            return

        now = datetime.now(timezone.utc)
        
        for farm in farms:
            print(f"Seeding history for Farm: {farm.name}...")
            zones = db.query(Zone).filter(Zone.farm_id == farm.id).all()
            
            # 1. Seed Water Quality (every 1 hour)
            for h in range(24 * 7):
                ts = now - timedelta(hours=h)
                p = Point("water_quality") \
                    .tag("farm_id", str(farm.id)) \
                    .field("ph", round(random.uniform(6.2, 6.9), 2)) \
                    .field("ec_ms_cm", round(random.uniform(1.0, 1.5), 2)) \
                    .field("tank_level", round(random.uniform(40, 95), 1)) \
                    .field("turbidity_ntu", round(random.uniform(1, 5), 1)) \
                    .field("nitrate_ppm", round(random.uniform(10, 50), 1)) \
                    .time(ts)
                write_api.write(bucket=settings.INFLUXDB_BUCKET, record=p)

            # 2. Seed Soil Readings (every 30 mins)
            for zone in zones:
                print(f"  -> Zone: {zone.name}")
                base_moisture = random.uniform(35, 65)
                
                for m in range(24 * 7 * 2): # 30 min intervals
                    ts = now - timedelta(minutes=m * 30)
                    
                    # Create some "dips" for realism
                    if (m % 48) > 30: # Simulate afternoon drying
                        drift = -1.5
                    elif (m % 48) < 10: # Simulate morning irrigation
                        drift = 2.0
                    else:
                        drift = 0.2
                    
                    base_moisture = max(10, min(95, base_moisture + drift + random.uniform(-0.5, 0.5)))
                    
                    p = Point("soil_readings") \
                        .tag("zone_id", str(zone.id)) \
                        .field("moisture_pct", round(base_moisture, 2)) \
                        .field("temp_c", round(random.uniform(22, 34), 1)) \
                        .field("ec_ds_m", round(random.uniform(1.2, 2.0), 2)) \
                        .time(ts)
                    write_api.write(bucket=settings.INFLUXDB_BUCKET, record=p)

        print("--- Historical Seeding Completed Successfully ---")

    except Exception as e:
        print(f"CRITICAL ERROR: {str(e)}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_historical_data()
