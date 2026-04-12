
import os
import sys

# Ensure the app package is discoverable
sys.path.append(os.getcwd())

from app.db.postgres import SessionLocal
from app.models import Farmer, Farm, Zone, Device

def check():
    db = SessionLocal()
    try:
        farmer = db.query(Farmer).filter(Farmer.email == "demo@gmail.com").first()
        if not farmer:
            print("No Demo Farmer found")
            return
        
        print(f"Farmer: {farmer.name} ({farmer.id})")
        farms = db.query(Farm).filter(Farmer.farmer_id == farmer.id).all()
        print(f"Total Farms: {len(farms)}")
        
        for f in farms:
            zones = db.query(Zone).filter(Zone.farm_id == f.id).all()
            print(f"  - Farm: {f.name} ({f.id}) | Zones: {len(zones)}")
            for z in zones:
                devices = db.query(Device).filter(Device.zone_id == z.id).all()
                print(f"    - Zone: {z.name} ({z.id}) | Devices: {len(devices)}")
                
    finally:
        db.close()

if __name__ == "__main__":
    check()
