import uuid
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from app.core.config import settings
from app.middleware.logging import LoggingMiddleware
from app.middleware.rate_limit import rate_limit

app = FastAPI(
    title=settings.PROJECT_NAME,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    default_response_class=JSONResponse,
    dependencies=[Depends(rate_limit)],
)

@app.on_event("startup")
async def startup_event():
    if settings.ENABLE_DEMO_MODE:
        from app.services.simulation_service import simulation_engine
        await simulation_engine.start()

@app.on_event("shutdown")
async def shutdown_event():
    if settings.ENABLE_DEMO_MODE:
        from app.services.simulation_service import simulation_engine
        await simulation_engine.stop()

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
    from app.db.postgres import ping_db
    from app.db.redis import ping_redis
    from app.db.influxdb import ping_influx
    components = {
        "postgresql": "healthy" if ping_db() else "unhealthy",
        "redis": "healthy" if ping_redis() else "unhealthy",
        "influxdb": "healthy" if ping_influx() else "unhealthy",
    }
    overall = "healthy" if all(v == "healthy" for v in components.values()) else "degraded"
    return {"status": overall, "components": components}


from app.api.v1 import api_router
app.include_router(api_router, prefix="/v1")
