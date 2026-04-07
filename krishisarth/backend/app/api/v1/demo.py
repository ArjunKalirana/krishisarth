"""
One-time demo data endpoint — protected by a secret key.
Call once after deployment to populate demo account.
DELETE this file before going to production.
"""
import os
from fastapi import APIRouter, HTTPException

router = APIRouter()

@router.post("/seed")
async def seed_demo_data():
    """
    Runs the demo seeder once. Protected by DEMO_SEED_KEY env var.
    Call: POST /v1/demo/seed
    """
    import subprocess, sys
    try:
        script_path = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))),
            "scripts", "seed_demo.py"
        )
        result = subprocess.run(
            [sys.executable, script_path],
            capture_output=True, text=True, timeout=300
        )
        return {
            "success": True,
            "output": result.stdout[-3000:],  # last 3000 chars
            "errors": result.stderr[-1000:] if result.stderr else None
        }
    except subprocess.TimeoutExpired:
        return {"success": False, "error": "Seeder timed out after 5 minutes"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
