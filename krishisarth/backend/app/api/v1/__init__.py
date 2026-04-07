from fastapi import APIRouter
from app.api.v1 import auth, farms, dashboard, control, ai_decisions, analytics, alerts, alerts_mark, websocket, demo

api_router = APIRouter()
api_router.include_router(auth.router,          prefix="/auth",   tags=["auth"])
api_router.include_router(farms.router,         prefix="/farms",  tags=["farms"])
api_router.include_router(dashboard.router,     prefix="/farms",  tags=["dashboard"])
api_router.include_router(control.router,       prefix="/zones",  tags=["control"])
api_router.include_router(ai_decisions.router,  prefix="/zones",  tags=["ai"])
api_router.include_router(analytics.router,     prefix="/farms",  tags=["analytics"])
api_router.include_router(alerts.router,        prefix="/farms",  tags=["alerts"])      # GET /farms/{id}/alerts
api_router.include_router(alerts_mark.router,   prefix="/alerts", tags=["alerts"])     # PATCH /alerts/{id}/read
api_router.include_router(websocket.router,     prefix="",        tags=["websocket"])
api_router.include_router(demo.router,          prefix="/demo",   tags=["demo"])
