import httpx
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"

async def get_weather_full(lat: float, lon: float) -> dict:
    """
    Fetch comprehensive weather data from OpenWeatherMap.
    Returns a dict with temp, humidity, wind, conditions, etc.
    """
    if not settings.OPENWEATHER_API_KEY:
        # Fallback for local development without key
        return {
            "temp": 28,
            "humidity": 65,
            "wind": 10,
            "condition": "Clear",
            "icon": "01d",
            "id": 800
        }
    
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
            
            weather = data.get("weather", [{}])[0]
            main = data.get("main", {})
            wind = data.get("wind", {})
            rain = data.get("rain", {})
            
            return {
                "temp": round(main.get("temp", 25)),
                "humidity": main.get("humidity", 60),
                "wind": round(wind.get("speed", 0) * 3.6), # m/s to km/h
                "condition": weather.get("main", "Clear"),
                "description": weather.get("description", "clear sky"),
                "icon": weather.get("icon", "01d"),
                "id": weather.get("id", 800), # condition code
                "rain_1h": rain.get("1h", 0.0)
            }
            
    except Exception as e:
        logger.error(f"Weather API error: {e}")
        return {
            "temp": 25,
            "humidity": 60,
            "wind": 5,
            "condition": "Unknown",
            "icon": "01d",
            "id": 800
        }

async def get_rainfall_data(lat: float, lon: float) -> float:
    """Legacy wrapper for rainfall only"""
    data = await get_weather_full(lat, lon)
    return data.get("rain_1h", 0.0)

