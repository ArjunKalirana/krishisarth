from app.middleware.rate_limit import rate_limit
from fastapi import Depends

api_router = APIRouter(dependencies=[Depends(rate_limit)])
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
api_router.include_router(digital_twin.router,  prefix="",        tags=["digital_twin"])
