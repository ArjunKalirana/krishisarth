import httpx
import logging
import traceback
from app.core.config import settings

logger = logging.getLogger(__name__)

OPENWEATHER_URL = "https://api.openweathermap.org/data/2.5/weather"

async def get_weather_full(lat: float, lon: float) -> dict:
    """
    Fetch comprehensive weather data from OpenWeatherMap.
    Returns a dict with temp, humidity, wind, conditions, etc.
    """
    if not settings.OPENWEATHER_API_KEY:
        logger.warning("[Weather] Missing API Key. Using fallback.")
        return {
            "temp": 28, "humidity": 65, "wind": 10, "condition": "Clear",
            "icon": "01d", "id": 800, "is_live": False
        }
    
    params = {
        "lat": lat, "lon": lon,
        "appid": settings.OPENWEATHER_API_KEY,
        "units": "metric"
    }
    
    # Custom headers to mimic a browser and avoid some API rejections
    headers = {
        "User-Agent": "KrishiSarth/1.0 (AgriTech Platform)",
        "Accept": "application/json"
    }
    
    try:
        # Increased timeout to 8s for slow networks
        async with httpx.AsyncClient(timeout=8.0, follow_redirects=True) as client:
            r = await client.get(OPENWEATHER_URL, params=params, headers=headers)
            
            if r.status_code != 200:
                logger.error(f"[Weather] API error {r.status_code}: {r.text}")
                raise Exception(f"HTTP_{r.status_code}")
                
            data = r.json()
            
            weather = data.get("weather", [{}])[0]
            main = data.get("main", {})
            wind = data.get("wind", {})
            rain = data.get("rain", {})
            
            return {
                "temp": round(main.get("temp", 25)),
                "humidity": main.get("humidity", 60),
                "wind": round(wind.get("speed", 0) * 3.6),
                "condition": weather.get("main", "Clear"),
                "description": weather.get("description", "clear sky"),
                "icon": weather.get("icon", "01d"),
                "id": weather.get("id", 800),
                "rain_1h": rain.get("1h", 0.0),
                "is_live": True # Flag for frontend
            }
            
    except httpx.ConnectTimeout:
        logger.error("[Weather] Connection timed out while reaching OpenWeatherMap.")
    except httpx.HTTPStatusError as e:
        logger.error(f"[Weather] HTTP Status Error: {e.response.status_code}")
    except Exception as e:
        logger.error(f"[Weather] Unexpected error: {type(e).__name__} - {str(e)}")
        # If debugging, print traceback
        # traceback.print_exc()
        
    return {
        "temp": 25, "humidity": 60, "wind": 5, "condition": "Offline",
        "icon": "01d", "id": 800, "is_live": False
    }

async def get_rainfall_data(lat: float, lon: float) -> float:
    data = await get_weather_full(lat, lon)
    return data.get("rain_1h", 0.0)
