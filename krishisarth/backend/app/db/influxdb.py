from influxdb_client import InfluxDBClient
from app.core.config import settings

# Singleton InfluxDB client instance
client = InfluxDBClient(
    url=settings.INFLUXDB_URL,
    token=settings.INFLUXDB_TOKEN,
    org=settings.INFLUXDB_ORG
)

# Shared Write API instance (prevents thread leaks)
_write_api = client.write_api()

def get_write_api():
    """Returns the shared InfluxDB Write API client."""
    return _write_api

def get_query_api():
    """Returns the InfluxDB Query API client."""
    return client.query_api()

def ping_influx() -> bool:
    """
    Verify InfluxDB connectivity by checking its health status.
    Returns True if status is 'pass', False otherwise.
    """
    try:
        return client.health().status == "pass"
    except Exception:
        return False

def get_influx_client():
    """FastAPI dependency returning the singleton InfluxDB client."""
    return client
