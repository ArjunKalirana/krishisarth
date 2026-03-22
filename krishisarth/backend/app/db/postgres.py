from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

# Create persistent database engine with pooling
# Railway provides DATABASE_URL as "postgres://..." but SQLAlchemy 2.x
# requires "postgresql://...". Fix the scheme transparently at runtime.
_db_url = settings.DATABASE_URL
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql://", 1)

engine = create_engine(
    _db_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10
)

# Shared session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Declarative base class for all SQLAlchemy models
Base = declarative_base()

def get_db():
    """
    FastAPI dependency providing a SQLAlchemy database session.
    Ensures the session is closed after the request completes.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def ping_db() -> bool:
    """
    Execute a minimal query to verify PostgreSQL connectivity.
    Returns True if successful, False otherwise.
    """
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception:
        return False
