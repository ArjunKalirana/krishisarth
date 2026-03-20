from typing import Literal, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "KrishiSarth"
    API_V1_STR: str = "/v1"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"

    # Required
    DATABASE_URL: str
    INFLUXDB_URL: str
    INFLUXDB_TOKEN: str
    INFLUXDB_ORG: str
    INFLUXDB_BUCKET: str = "krishisarth_sensors"
    REDIS_URL: str
    JWT_SECRET: str
    JWT_REFRESH_SECRET: str
    JWT_ACCESS_EXPIRE_HOURS: int = 24
    JWT_REFRESH_EXPIRE_DAYS: int = 30

    # Optional — backend starts fine without these
    MQTT_BROKER_HOST: Optional[str] = "localhost"
    MQTT_BROKER_PORT: int = 1883
    AWS_S3_BUCKET: Optional[str] = None
    AWS_REGION: Optional[str] = "ap-south-1"
    OPENWEATHER_API_KEY: Optional[str] = None

    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "null",  # covers file:// protocol — browser sends Origin: null
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
