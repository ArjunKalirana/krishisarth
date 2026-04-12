import os
import subprocess
import sys
import time

def main():
    print("\n" + "="*50)
    print("🚀 KrishiSarth Stage Readiness Checklist")
    print("="*50 + "\n")
    
    script_dir = os.path.dirname(os.path.abspath(__file__))
    backend_dir = os.path.dirname(script_dir)
    os.chdir(backend_dir)
    
    infra_ok = True

    # 1. Clear locks
    print("🧹 Phase 1: Clearing stale pump locks...")
    try:
        subprocess.run([sys.executable, "scripts/clear_pump_locks.py"], check=True, timeout=5, capture_output=True)
        print("   ✓ Redis locks cleared.")
    except Exception:
        print("   ⚠ Warning: Redis offline. Stale locks may persist.")
        infra_ok = False
    
    # 2. Seed Demo Data
    print("\n🌱 Phase 2: Seeding high-fidelity data...")
    try:
        # We run the seeder which has its own connection timeouts now
        subprocess.run([sys.executable, "scripts/seed_demo.py"], check=True, timeout=15)
        print("   ✓ Database seeded.")
    except Exception:
        print("   ❌ Error: Database (Postgres) is unreachable.")
        infra_ok = False
    
    print("\n" + "-"*50)
    if not infra_ok:
        print("🛑 ACTION REQUIRED BEFORE GOING ON STAGE:")
        print("1. Start Docker Desktop on this machine.")
        print("2. Run 'make dev' to start containers.")
        print("3. Re-run this script to ensure data is seeded.")
    else:
        print("✅ SYSTEM READY: Everything looks good for the demo!")
    
    print("\n📋 Presentation Credentials:")
    print("   Email:    demo@gmail.com")
    print("   Password: Demo@123")
    print("-"*50 + "\n")

if __name__ == "__main__":
    main()
