import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

CROP_MODEL_URL = settings.ML_CROP_API_URL
FERTILITY_MODEL_URL = settings.ML_FERTILITY_API_URL

async def predict_crop(N: float, P: float, K: float, temperature: float,
                        humidity: float, ph: float, rainfall: float) -> str:
    """Call Crop Recommendation ML API."""
    payload = {
        "N": N, "P": P, "K": K,
        "temperature": temperature,
        "humidity": humidity,
        "ph": ph,
        "rainfall": rainfall
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(CROP_MODEL_URL, json=payload)
            r.raise_for_status()
            data = r.json()
            return data.get("crop", data.get("prediction", "unknown"))
    except Exception as e:
        logger.error(f"Crop ML API error: {e}")
        return "unavailable"

async def predict_fertility(N: float, P: float, K: float, ph: float = 6.5,
                             ec: float = 0.5, oc: float = 0.6, s: float = 10.0,
                             zn: float = 0.6, fe: float = 4.5, cu: float = 0.2,
                             mn: float = 2.0, b: float = 0.5) -> dict:
    """Call Soil Fertility Prediction ML API."""
    payload = {
        "N": N, "P": P, "K": K, "ph": ph,
        "ec": ec, "oc": oc, "S": s,
        "zn": zn, "fe": fe, "cu": cu, "Mn": mn, "B": b
    }
    LABELS = {0: "Less Fertile", 1: "Fertile", 2: "Highly Fertile"}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(FERTILITY_MODEL_URL, json=payload)
            r.raise_for_status()
            data = r.json()
            cls = int(data.get("class", data.get("prediction", 1)))
            return {"class": cls, "label": LABELS.get(cls, "Fertile")}
    except Exception as e:
        logger.error(f"Fertility ML API error: {e}")
        return {"class": 1, "label": "Fertile (fallback)"}
