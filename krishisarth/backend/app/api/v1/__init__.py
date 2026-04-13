from fastapi import APIRouter, Depends
from app.middleware.rate_limit import rate_limit
from app.api.v1 import auth, farms, dashboard, control, ai_decisions, analytics, alerts, alerts_mark, websocket, demo, digital_twin, soil

api_router = APIRouter()

# 1. Protected HTTP routes (Rate Limited)
# We apply the rate limit here to all standard API calls.
protected_router = APIRouter(dependencies=[Depends(rate_limit)])
protected_router.include_router(auth.router,          prefix="/auth",   tags=["auth"])
protected_router.include_router(farms.router,         prefix="/farms",  tags=["farms"])
protected_router.include_router(dashboard.router,     prefix="/farms",  tags=["dashboard"])
protected_router.include_router(control.router,       prefix="/zones",  tags=["control"])
protected_router.include_router(ai_decisions.router,  prefix="/zones",  tags=["ai"])
protected_router.include_router(analytics.router,     prefix="/farms",  tags=["analytics"])
protected_router.include_router(alerts.router,        prefix="/farms",  tags=["alerts"])
protected_router.include_router(alerts_mark.router,   prefix="/alerts", tags=["alerts"])
protected_router.include_router(soil.router,          prefix="",        tags=["soil"])
protected_router.include_router(demo.router,          prefix="/demo",   tags=["demo"])

# 2. Unprotected / Real-time routes
# WebSockets and Digital Twin are excluded from Rate Limiting to prevent ASGI crashes.
api_router.include_router(protected_router)
api_router.include_router(websocket.router,     prefix="",        tags=["websocket"])
api_router.include_router(digital_twin.router,  prefix="",        tags=["digital_twin"])
