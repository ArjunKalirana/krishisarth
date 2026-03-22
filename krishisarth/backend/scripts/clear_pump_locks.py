"""
Development utility — clears all irrigation pump locks from Redis.
Use when pumps are stuck in RUNNING state after backend restart.
Run: .\\venv\\Scripts\\python.exe scripts\\clear_pump_locks.py
"""
import sys, os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.redis import redis_client
from app.db.postgres import SessionLocal
from app.models import IrrigationSchedule
from datetime import datetime, timezone

db = SessionLocal()

# 1. Clear all irrigation_lock keys from Redis
keys = redis_client.keys("irrigation_lock:*")
if keys:
    redis_client.delete(*keys)
    print(f"Cleared {len(keys)} pump lock(s) from Redis:")
    for k in keys:
        print(f"  {k}")
else:
    print("No pump locks found in Redis.")

# 2. Mark any running schedules as failed in PostgreSQL
running = db.query(IrrigationSchedule).filter(
    IrrigationSchedule.status == "running"
).all()

for s in running:
    s.status = "failed"
    s.executed_at = datetime.now(timezone.utc)

if running:
    db.commit()
    print(f"\nMarked {len(running)} stuck schedule(s) as failed in database.")
else:
    print("No stuck schedules found in database.")

db.close()
print("\nDone. You can now start irrigation again.")
