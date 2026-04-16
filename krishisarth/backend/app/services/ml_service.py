import httpx
import logging
import asyncio
from datetime import datetime, timezone
from app.core.config import settings
from app.db.mongodb import mongo_manager

logger = logging.getLogger(__name__)

async def log_inference_event(payload: dict, crop_result: str, fertility_result: dict):
    """Log raw sensor data and ML outcomes to the production 'sensor_data' collection."""
    if not settings.MONGODB_URL:
        return

    try:
        db = mongo_manager.client[settings.MONGODB_DB_NAME]
        collection = db["sensor_data"]
        
        # Mapping incoming hardware payload to the specified production schema
        record = {
            "timestamp": datetime.now(timezone.utc),
            "node_id": payload.get("id"),
            "temperature": payload.get("temp"),
            "humidity": payload.get("hum"),
            "soil_moisture": payload.get("soil"),
            "N": payload.get("N", 0),
            "P": payload.get("P", 0),
            "K": payload.get("K", 0),
            "inference": {
                "crop_recommendation": crop_result,
                "soil_fertility": fertility_result
            }
        }
        await collection.insert_one(record)
        logger.info(f">>> [DEBUG] SENSOR DATA & INFERENCE PERSISTED TO MONGODB (smart_agri.sensor_data)")
    except Exception as e:
        logger.warning(f"Failed to log production sensor data to MongoDB: {e}")

async def _predict_with_backoff(url, payload, model_name):
    """Internal helper to handle Render's cold starts with exponential backoff."""
    attempts = 3
    async with httpx.AsyncClient(timeout=30) as client:
        for i in range(attempts):
            try:
                r = await client.post(url, json=payload)
                r.raise_for_status()
                return r.json()
            except (httpx.HTTPStatusError, httpx.ConnectError, httpx.TimeoutException) as e:
                if i < attempts - 1:
                    wait_time = (i + 1) * 20 # 20s, 40s
                    logger.warning(f">>> [ML] {model_name} Warming Up (Attempt {i+1}/{attempts}). Retrying in {wait_time}s...")
                    await asyncio.sleep(wait_time)
                else:
                    logger.error(f">>> [ML] {model_name} Failed after {attempts} attempts: {e}")
                    raise e
    return None

async def predict_crop(N: float, P: float, K: float, temperature: float,
                        humidity: float, ph: float, rainfall: float) -> str:
    """Call Crop Recommendation ML API with retry logic."""
    payload = {
        "N": N, "P": P, "K": K,
        "temperature": temperature,
        "humidity": humidity,
        "ph": ph,
        "rainfall": rainfall
    }
    
    try:
        data = await _predict_with_backoff(settings.ML_CROP_API_URL, payload, "CropModel")
        if data:
            return data.get("crop_prediction", data.get("crop", data.get("prediction", "unknown")))
    except Exception:
        return "MODEL_WARMING" # Specific error code for frontend handling
    
    return "unavailable"

async def predict_fertility(N: float, P: float, K: float, ph: float = 6.5,
                             ec: float = 0.5, oc: float = 0.6, s: float = 10.0,
                             zn: float = 0.6, fe: float = 4.5, cu: float = 0.2,
                             mn: float = 2.0, b: float = 0.5) -> dict:
    """Call Soil Fertility Prediction ML API with retry logic."""
    payload = {
        "N": N, "P": P, "K": K, 
        "pH": ph, "EC": ec, "OC": oc, "S": s, 
        "Zn": zn, "Fe": fe, "Cu": cu, "Mn": mn, "B": b
    }
    LABELS = {0: "Less Fertile", 1: "Fertile", 2: "Highly Fertile"}
    
    try:
        data = await _predict_with_backoff(settings.ML_FERTILITY_API_URL, payload, "FertilityModel")
        if data:
            pred_val = data.get("fertility_prediction", data.get("prediction", "Fertile"))
            label_map = {"Low": 0, "Medium": 1, "High": 2, "Less Fertile": 0, "Fertile": 1, "Highly Fertile": 2}
            cls = label_map.get(pred_val, 1)
            return {"class": cls, "label": pred_val if isinstance(pred_val, str) else LABELS.get(cls, "Fertile")}
    except Exception:
        return {"class": -1, "label": "MODEL_WARMING"}
    
    return {"class": 1, "label": "Fertile (fallback)"}
