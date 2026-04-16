import asyncio
import os
from app.services.weather_service import get_weather_full
from app.core.config import settings

async def test_weather():
    print(f">>> [TEST] API KEY: {settings.OPENWEATHER_API_KEY[:5]}...")
    lat, lng = 18.52, 73.85 # Pune
    data = await get_weather_full(lat, lng)
    print(f">>> [TEST] Weather Data: {data}")
    
    if data.get("condition") == "Unknown" or data.get("temp") == 25:
        print(">>> [TEST] FAILED: Likely hit fallback or API error.")
    else:
        print(">>> [TEST] SUCCESS: Real weather data received.")

if __name__ == "__main__":
    asyncio.run(test_weather())
