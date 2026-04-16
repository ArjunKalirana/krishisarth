import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logger = logging.getLogger(__name__)

class MongoDBClient:
    """
    Singleton MongoDB Client using Motor (async).
    Prevents background thread leaks by maintaining a single connection pool.
    """
    _instance = None
    _client = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MongoDBClient, cls).__new__(cls)
        return cls._instance

    @property
    def client(self) -> AsyncIOMotorClient:
        if self._client is None:
            logger.info(">>> [DEBUG] INITIALIZING MONGODB SINGLETON CLIENT...")
            self._client = AsyncIOMotorClient(
                settings.MONGODB_URL,
                # Best practice: enable server selection timeout to fail fast
                serverSelectionTimeoutMS=5000,
                # Explicitly set min/max pool size to control resources
                minPoolSize=1,
                maxPoolSize=10
            )
        return self._client

    def close(self):
        if self._client:
            self._client.close()
            self._client = None
            logger.info(">>> [DEBUG] MONGODB CLIENT CLOSED")

# Global singleton instance
mongo_manager = MongoDBClient()

def get_mongo_db():
    """Dependency helper for FastAPI."""
    return mongo_manager.client[settings.MONGODB_DB_NAME]
