import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"

async def get_rainfall_data(lat: float, lon: float) -> float:
    """
    Fetch current rainfall (last 1h or 3h) from OpenWeatherMap.
    Returns rainfall in mm, or 0.0 if unavailable.
    """
    if not settings.OPENWEATHER_API_KEY:
        return 0.0
    
    params = {
        "lat": lat,
        "lon": lon,
        "appid": settings.OPENWEATHER_API_KEY,
        "units": "metric"
    }
    
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(OPENWEATHER_URL, params=params)
            r.raise_for_status()
            data = r.json()
            
            # OpenWeatherMap returns rainfall in 'rain.1h' or 'rain.3h'
            rain = data.get("rain", {})
            return rain.get("1h", rain.get("3h", 0.0))
            
    except Exception as e:
        logger.error(f"Weather API error: {e}")
        return 0.0
