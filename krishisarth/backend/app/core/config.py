from typing import Literal, Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "KrishiSarth"
    API_V1_STR: str = "/v1"
    ENVIRONMENT: Literal["development", "staging", "production"] = "development"

    # Required — must be set via environment variables in Railway
    DATABASE_URL: str
    INFLUXDB_URL: str
    INFLUXDB_TOKEN: str
    INFLUXDB_ORG: str
    INFLUXDB_BUCKET: str = "krishisarth_sensors"
    REDIS_URL: str
    JWT_SECRET: str
    JWT_REFRESH_SECRET: str
    MONGODB_URL: str
    MONGODB_DB_NAME: str = "KrishiSarth_ML"
    JWT_ACCESS_EXPIRE_HOURS: int = 24
    JWT_REFRESH_EXPIRE_DAYS: int = 30

    # Optional — backend starts fine without these
    PORT: int = 8000                              # Injected by Railway at runtime
    MQTT_BROKER_HOST: Optional[str] = "localhost"
    MQTT_BROKER_PORT: int = 1883
    AWS_S3_BUCKET: Optional[str] = None
    AWS_REGION: Optional[str] = "ap-south-1"
    OPENWEATHER_API_KEY: Optional[str] = None
    GROQ_KEY: Optional[str] = None
    ML_CROP_API_URL: str = "https://krishisarth.onrender.com/v1/predict/crop"
    ML_FERTILITY_API_URL: str = "https://krishisarth.onrender.com/v1/predict/fertilizer"
    ENABLE_DEMO_MODE: bool = True  # Enable simulation engine by default for hardware-less demos

    # CORS — add your Vercel URL here OR override via CORS_ORIGINS env var
    # as a comma-separated string: "https://a.vercel.app,http://localhost:3000"
    CORS_ORIGINS: list[str] = [
        # Production frontend
        "https://krishisarth.vercel.app",
        # Local development
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "null",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
