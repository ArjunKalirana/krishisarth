import uuid
import sys
import logging
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from app.core.config import settings
from app.middleware.logging import LoggingMiddleware
from app.middleware.rate_limit import rate_limit

# Diagnostic log for Railway deployment
print(">>> [DEBUG] KRISHISARTH BACKEND PROCESS STARTED")
print(f">>> [DEBUG] Python Version: {sys.version}")
print(f">>> [DEBUG] Working Directory: {sys.path[0]}")

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    default_response_class=JSONResponse,
)

@app.on_event("startup")
async def startup_event():
    print(">>> [DEBUG] FASTAPI STARTUP EVENT TRIGGERED")
    
    # -0.5 Warm up MongoDB Connection
    try:
        from app.db.mongodb import mongo_manager
        await mongo_manager.client.admin.command('ping')
        print(">>> [DEBUG] MONGODB CONNECTED SUCCESSFULLY")
    except Exception as e:
        print(f">>> [WARNING] MongoDB Connection Delay/Failure: {e}")

    # 0. Safety Integrity Check: Verify DB Schema matches ML requirements
    try:
        from sqlalchemy import inspect
        from app.db.postgres import engine
        inspector = inspect(engine)
        existing_cols = [col['name'] for col in inspector.get_columns('zones')]
        required_cols = ['ph', 'ec', 'oc', 's', 'zn', 'fe', 'cu', 'mn', 'b']
        missing = [c for c in required_cols if c not in existing_cols]
        if missing:
            print(f">>> [ERROR] SCHEMA INCOMPLETE: Missing columns {missing}")
            # We don't raise Exception here to allow the server to start (so migrations can potentially run),
            # but we log it loudly. Actually, the user suggested raising exception.
            # But Alembic runs BEFORE this. If Alembic failed, we should know.
            raise Exception(f"Database schema incomplete. Missing columns in 'zones' table: {missing}")
    except Exception as e:
        print(f">>> [CRITICAL] Database Integrity Check Failed: {e}")
        # Stop startup if schema is broken to prevent spamming logs
        sys.exit(1)

    if settings.ENABLE_DEMO_MODE:
        print(">>> [DEBUG] INITIALIZING SIMULATION ENGINE...")
        from app.services.simulation_service import simulation_engine
        await simulation_engine.start()
        print(">>> [DEBUG] SIMULATION ENGINE STARTED")

@app.on_event("shutdown")
async def shutdown_event():
    print(">>> [DEBUG] FASTAPI SHUTDOWN EVENT TRIGGERED")
    if settings.ENABLE_DEMO_MODE:
        from app.services.simulation_service import simulation_engine
        await simulation_engine.stop()
    
    # 0.5 Cleanly close MongoDB singleton
    try:
        from app.db.mongodb import mongo_manager
        mongo_manager.close()
    except Exception as e:
        print(f">>> [DEBUG] MongoDB shutdown error: {e}")

    # 1. Cleanly close InfluxDB singleton and shared Write API
    try:
        from app.db.influxdb import client as influx_client, _write_api
        _write_api.close()
        influx_client.close()
        print(">>> [DEBUG] INFLUXDB CLIENT DISCONNECTED")
    except Exception as e:
        print(f">>> [DEBUG] InfluxDB shutdown error: {e}")

app.add_middleware(LoggingMiddleware)

# Handle X-Forwarded-Proto for correct 307 redirects behind proxies (Railway)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = str(getattr(request.state, "request_id", uuid.uuid4()))
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error": {
                "code": str(exc.detail),
                "message": exc.detail if isinstance(exc.detail, str) else "AN_ERROR_OCCURRED",
                "request_id": request_id,
            },
        },
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    request_id = str(getattr(request.state, "request_id", uuid.uuid4()))
    errors = exc.errors()
    first = errors[0] if errors else {}
    field = " → ".join(str(loc) for loc in first.get("loc", []))
    msg = first.get("msg", "Validation error")
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "error": {
                "code": "VALIDATION_ERROR",
                "message": f"{field}: {msg}",
                "request_id": request_id,
                "details": errors,
            },
        },
    )


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "krishisarth-backend"}


from app.api.v1 import api_router
app.include_router(api_router, prefix="/v1")
