import httpx
import logging
import asyncio
from datetime import datetime, timezone
from app.core.config import settings
from app.db.mongodb import mongo_manager

logger = logging.getLogger(__name__)

async def log_inference_event(payload: dict, crop_result: str, fertility_result: dict):
    """Log a unified inference event containing both model outputs to MongoDB."""
    try:
        db = mongo_manager.client[settings.MONGODB_DB_NAME]
        collection = db["ml_telemetry"]
        record = {
            "timestamp": datetime.now(timezone.utc),
            "inputs": payload,
            "outputs": {
                "crop_recommendation": crop_result,
                "soil_fertility": fertility_result
            },
            "metadata": {
                "provider": "render",
                "version": "v1"
            }
        }
        await collection.insert_one(record)
        logger.info(f">>> [DEBUG] ML TELEMETRY PERSISTED TO MONGODB")
    except Exception as e:
        logger.warning(f"Failed to log combined inference to MongoDB: {e}")

async def log_prediction(model_type: str, input_data: dict, output_data: any):

async def predict_crop(N: float, P: float, K: float, temperature: float,
                        humidity: float, ph: float, rainfall: float) -> str:
    """Call Crop Recommendation ML API hosted on Render."""
    payload = {
        "N": N, "P": P, "K": K,
        "temperature": temperature,
        "humidity": humidity,
        "ph": ph,
        "rainfall": rainfall
    }
    
    prediction = "unavailable"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(settings.ML_CROP_API_URL, json=payload)
            r.raise_for_status()
            data = r.json()
            # Standardizing response keys across potentially different model versions
            prediction = data.get("crop", data.get("prediction", "unknown"))
    except Exception as e:
        logger.error(f"Crop ML API error: {e}")
    
    return prediction

async def predict_fertility(N: float, P: float, K: float, ph: float = 6.5,
                             ec: float = 0.5, oc: float = 0.6, s: float = 10.0,
                             zn: float = 0.6, fe: float = 4.5, cu: float = 0.2,
                             mn: float = 2.0, b: float = 0.5) -> dict:
    """Call Soil Fertility Prediction ML API hosted on Render."""
    payload = {
        "N": N, "P": P, "K": K, "ph": ph,
        "ec": ec, "oc": oc, "S": s,
        "zn": zn, "fe": fe, "cu": cu, "Mn": mn, "B": b
    }
    LABELS = {0: "Less Fertile", 1: "Fertile", 2: "Highly Fertile"}
    
    result = {"class": 1, "label": "Fertile (fallback)"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(settings.ML_FERTILITY_API_URL, json=payload)
            r.raise_for_status()
            data = r.json()
            cls = int(data.get("class", data.get("prediction", 1)))
            result = {"class": cls, "label": LABELS.get(cls, "Fertile")}
    except Exception as e:
        logger.error(f"Fertility ML API error: {e}")
    
    return result
