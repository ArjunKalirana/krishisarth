"""
KrishiSarth — Demo Account Seeder
Creates a rich demo account with 30 days of historical data.
Run: .\venv\Scripts\python.exe scripts\seed_demo.py

Safe to run multiple times — fully idempotent.
"""
import sys, os, random
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timezone, timedelta
from influxdb_client import InfluxDBClient, Point, WritePrecision
from influxdb_client.client.write_api import SYNCHRONOUS
from app.core.config import settings
from app.db.postgres import SessionLocal
from app.models import (
    Farmer, Farm, Zone, Device,
    IrrigationSchedule, AIDecision, FertigationLog, Alert
)
from app.services.auth_service import hash_password

DEMO_EMAIL    = "demo@gmail.com"
DEMO_PASSWORD = "Demo@123"

# Zone configs — each zone has a distinct personality for a good demo
ZONES = [
    {
        "name": "Tomato Greenhouse A",
        "crop": "tomato",
        "stage": "fruiting",
        "area": 4500,
        "base_moisture": 58,   # healthy zone
        "volatile": False,
        "color": "green",
    },
    {
        "name": "Grape Vineyard",
        "crop": "grape",
        "stage": "flowering",
        "area": 12000,
        "base_moisture": 19,   # DRY — needs irrigation (great for demo)
        "volatile": True,
        "color": "red",
    },
    {
        "name": "Onion Field",
        "crop": "onion",
        "stage": "bulbing",
        "area": 8000,
        "base_moisture": 44,
        "volatile": False,
        "color": "green",
    },
    {
        "name": "Pomegranate Orchard",
        "crop": "pomegranate",
        "stage": "vegetative",
        "area": 15000,
        "base_moisture": 72,   # WET — skip irrigation (great for AI demo)
        "volatile": False,
        "color": "blue",
    },
    {
        "name": "Chilli Patch",
        "crop": "chilli",
        "stage": "seedling",
        "area": 3000,
        "base_moisture": 35,
        "volatile": True,
        "color": "green",
    },
    {
        "name": "Wheat Block",
        "crop": "wheat",
        "stage": "harvesting",
        "area": 9000,
        "base_moisture": 22,   # CRITICAL DRY — will trigger alert
        "volatile": True,
        "color": "red",
    },
]

def run():
    print("=== KrishiSarth Demo Seeder ===\n")
    try:
        db = SessionLocal()
        # Test connection
        db.execute(text("SELECT 1"))
    except Exception as e:
        print(f"❌ FATAL: Could not connect to PostgreSQL database.")
        print(f"   Error: {e}")
        print("   TIP: If running locally, ensure Docker Desktop is started.")
        sys.exit(1)

    now = datetime.now(timezone.utc)

    # ── 1. Farmer ──────────────────────────────────────────────────────────────
    farmer = db.query(Farmer).filter(Farmer.email == DEMO_EMAIL).first()
    if not farmer:
        farmer = Farmer(
            name="Arjun Sharma",
            email=DEMO_EMAIL,
            password_hash=hash_password(DEMO_PASSWORD),
            phone="+919823456789",
            preferred_lang="en",
        )
        db.add(farmer); db.commit(); db.refresh(farmer)
        print(f"CREATED farmer: {farmer.name} ({DEMO_EMAIL})")
    else:
        print(f"EXISTS  farmer: {farmer.name}")

    # ── 2. Farm ────────────────────────────────────────────────────────────────
    farm = db.query(Farm).filter(
        Farm.farmer_id == farmer.id, Farm.name == "KrishiSarth Demo Farm"
    ).first()
    if not farm:
        farm = Farm(
            farmer_id=farmer.id,
            name="KrishiSarth Demo Farm",
            soil_type="black cotton",
            area_ha=8.2,
            lat=20.0059,
            lng=73.7897,
        )
        db.add(farm); db.commit(); db.refresh(farm)
        print(f"CREATED farm: {farm.name}")
    else:
        print(f"EXISTS  farm: {farm.name}")

    # ── 3. Zones + Devices ────────────────────────────────────────────────────
    zone_objects = []
    for i, z in enumerate(ZONES, 1):
        zone = db.query(Zone).filter(
            Zone.farm_id == farm.id, Zone.name == z["name"]
        ).first()
        if not zone:
            zone = Zone(
                farm_id=farm.id,
                name=z["name"],
                crop_type=z["crop"],
                crop_stage=z["stage"],
                area_sqm=z["area"],
                is_active=True,
            )
            db.add(zone); db.commit(); db.refresh(zone)
            print(f"CREATED zone: {zone.name}")
        else:
            print(f"EXISTS  zone: {zone.name}")
        zone_objects.append((zone, z))

        for dev_type, serial_prefix in [("sensor", "ESP32-SH"), ("actuator", "PUMP-SH")]:
            serial = f"{serial_prefix}-{i:03d}"
            if not db.query(Device).filter(Device.serial_no == serial).first():
                db.add(Device(
                    zone_id=zone.id,
                    type=dev_type,
                    serial_no=serial,
                    firmware_ver="2.1.0",
                    battery_pct=random.randint(70, 98),
                    is_online=True,
                ))
        db.commit()

    # ── 4. Historical PostgreSQL data (30 days) ────────────────────────────────
    print("\nGenerating 30 days of historical records...")

    for zone, z_cfg in zone_objects:
        zone_id = zone.id

        # Irrigation schedules — every 3-4 days
        for day in range(30, 0, -3):
            sched_time = now - timedelta(days=day, hours=random.randint(5, 7))
            duration   = random.choice([15, 20, 25, 30])
            existing   = db.query(IrrigationSchedule).filter(
                IrrigationSchedule.zone_id == zone_id,
                IrrigationSchedule.scheduled_at == sched_time
            ).first()
            if not existing:
                db.add(IrrigationSchedule(
                    zone_id      = zone_id,
                    source       = random.choice(["ai", "ai", "manual"]),
                    scheduled_at = sched_time,
                    duration_min = duration,
                    status       = "completed",
                    executed_at  = sched_time + timedelta(minutes=duration),
                ))

        # AI decisions — every 2 days
        for day in range(30, 0, -2):
            decision_time = now - timedelta(days=day, hours=random.randint(0, 3))
            moisture_snap = z_cfg["base_moisture"] + random.uniform(-10, 10)
            decision_type = "irrigate" if moisture_snap < 30 else (
                "skip" if moisture_snap > 65 else random.choice(["irrigate", "skip"])
            )
            confidence    = round(random.uniform(0.72, 0.97), 2)
            # WATER SAVED: Increased to 800L - 4000L range for the demo
            water_saved   = round(random.uniform(800.0, 4000.0), 1) if decision_type == "skip" else 0.0
            reasoning_map = {
                "irrigate": f"Soil moisture critically low at {moisture_snap:.1f}% for {zone.crop_type} in {zone.crop_stage} stage. Immediate irrigation required.",
                "skip":     f"Adequate moisture at {moisture_snap:.1f}%. Rain probability 68%. Skipping irrigation saves {water_saved}L.",
            }
            db.add(AIDecision(
                zone_id        = zone_id,
                decision_type  = decision_type,
                reasoning      = reasoning_map[decision_type],
                confidence     = confidence,
                water_saved_l  = water_saved,
                input_snapshot = {
                    "moisture_pct": round(moisture_snap, 1),
                    "crop_type":    zone.crop_type,
                    "crop_stage":   zone.crop_stage,
                    "tank_level":   round(random.uniform(55, 95), 1),
                    "at":           decision_time.isoformat(),
                },
                created_at     = decision_time,
            ))

        # Fertigation logs — every 5 days
        for day in range(28, 0, -5):
            applied_time = now - timedelta(days=day, hours=1)
            nutrient     = random.choice(["Nitrogen", "Phosphorus", "Potassium"])
            ec_b         = round(random.uniform(1.1, 1.8), 2)
            db.add(FertigationLog(
                zone_id          = zone_id,
                nutrient_type    = nutrient,
                concentration_ml = round(random.uniform(8, 18), 1),
                ec_before        = ec_b,
                ec_after         = round(ec_b + random.uniform(0.3, 0.7), 2),
                status           = "completed",
                applied_at       = applied_time,
            ))

    # ── 5. Alerts ─────────────────────────────────────────────────────────────
    alert_defs = [
        ("critical", "MOISTURE_ALERT", "Wheat Block moisture at 18% — critically below threshold of 25%."),
        ("warning",  "PUMP_FAILURE",   "Grape Vineyard pump pressure dropped 0.4 bar — check for possible leakage."),
        ("info",     "AI_DECISION",    "AI skipped irrigation in Pomegranate Orchard: High moisture (72%) detected."),
        ("critical", "TANK_LOW",       "Main water tank critically low (28%) — auto-refill sequence pending."),
    ]
    existing_alerts = db.query(Alert).filter(Alert.farm_id == farm.id).count()
    if existing_alerts == 0:
        zone_ref = zone_objects[0][0]
        for i, (sev, atype, msg) in enumerate(alert_defs):
            db.add(Alert(
                farm_id    = farm.id,
                zone_id    = zone_ref.id,
                severity   = sev,
                type       = atype,
                message    = msg,
                is_read    = i > 2,
                created_at = now - timedelta(hours=i * 3 + 1),
            ))

    db.commit()
    print("PostgreSQL historical data: DONE")

    try:
        client = InfluxDBClient(
            url=settings.INFLUXDB_URL,
            token=settings.INFLUXDB_TOKEN,
            org=settings.INFLUXDB_ORG,
            timeout=5000 # 5 seconds
        )
        # Test connection
        client.ready()
    except Exception as e:
        print("\n⚠️ WARNING: InfluxDB is unavailable. Skipping time-series seeding.")
        print(f"   {e}")
        print("   Note: Dashboard will still work using live simulation fallback logic.")
        client = None

    if client:
        write_api = client.write_api(write_options=SYNCHRONOUS)
        batch = []

    for zone, z_cfg in zone_objects:
        zone_id    = str(zone.id)
        farm_id    = str(farm.id)
        base_m     = z_cfg["base_moisture"]
        volatile   = z_cfg["volatile"]
        device_id  = f"ESP32-{zone_id[:8]}"

        # 30 days of readings every 15 minutes = 2880 points per zone
        for day in range(30, 0, -1):
            for reading_idx in range(96):   # 96 × 15min = 24h
                minutes_ago = day * 1440 + reading_idx * 15
                ts          = now - timedelta(minutes=minutes_ago)

                # Moisture follows a daily curve + random walk
                daily_cycle = 5 * (1 if reading_idx < 48 else -1)  # dip at night
                noise       = random.uniform(-4, 4) if volatile else random.uniform(-2, 2)
                # After irrigation events (every 3 days), moisture jumps up
                if (day % 3 == 0) and (reading_idx < 10):
                    moisture = min(base_m + 20 + noise, 82)
                else:
                    moisture = max(10, min(85, base_m + daily_cycle + noise))

                batch.append(
                    Point("soil_readings")
                    .tag("zone_id",   zone_id)
                    .tag("device_id", device_id)
                    .tag("depth",     "0-15cm")
                    .field("moisture_pct", round(moisture, 1))
                    .field("temp_c",       round(random.uniform(26, 36), 1))
                    .field("ec_ds_m",      round(random.uniform(0.9, 2.2), 2))
                    .field("ph",           round(random.uniform(6.2, 7.3), 1))
                    .time(ts, WritePrecision.NS)
                )

                # Write in batches of 500 to avoid memory issues
                if len(batch) >= 500:
                    write_api.write(bucket=settings.INFLUXDB_BUCKET,
                                    org=settings.INFLUXDB_ORG, record=batch)
                    batch = []

        print(f"  Zone '{zone.name}': InfluxDB series written")

    # Water quality — one reading per day per farm
    for day in range(30, 0, -1):
        ts = now - timedelta(days=day, hours=6)
        batch.append(
            Point("water_quality")
            .tag("farm_id",   str(farm.id))
            .tag("device_id", "WQ-SH-01")
            .field("ph",            round(random.uniform(6.6, 7.4), 1))
            .field("ec_ms_cm",      round(random.uniform(1.0, 1.9), 2))
            .field("turbidity_ntu", round(random.uniform(1.5, 4.5), 1))
            .field("nitrate_ppm",   round(random.uniform(12, 22), 1))
            .field("tank_level",    round(random.uniform(40, 92), 1))
            .time(ts, WritePrecision.NS)
        )

    # Flush remaining
    if client:
        if batch:
            write_api.write(bucket=settings.INFLUXDB_BUCKET,
                            org=settings.INFLUXDB_ORG, record=batch)

        client.close()
        print("\nInfluxDB time series: DONE")
    else:
        print("\nInfluxDB time series: SKIPPED")
    print(f"""
╔══════════════════════════════════════════════════╗
║        DEMO ACCOUNT READY                       ║
╠══════════════════════════════════════════════════╣
║  Email:    demo@gmail.com                       ║
║  Password: Demo@123                             ║
║  Farm:     Sharma Smart Farm (Nashik)           ║
║  Zones:    6 (2 dry, 1 wet, 3 optimal)         ║
║  History:  30 days sensor + decision data       ║
╚══════════════════════════════════════════════════╝

What to show in the demo:
  Dashboard  → Live zone cards with varied moisture levels
  AI Page    → Run AI Audit → Grape Vineyard will trigger irrigation
  Control    → Toggle Grape Vineyard ON → watch 3D update
  Analytics  → 30-day moisture trend chart with real data
  3D View    → Simulate irrigation → water animation plays
    """)
    db.close()

if __name__ == "__main__":
    run()
