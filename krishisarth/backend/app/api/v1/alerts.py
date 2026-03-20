from typing import Any, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.api import deps
from app.db.postgres import get_db
from app.services import alert_service
from app.schemas.alert_schema import AlertOut

router = APIRouter()

# Mounted under /v1/farms prefix → final URL: GET /v1/farms/{farm_id}/alerts
@router.get("/{farm_id}/alerts", response_model=dict)
def list_farm_alerts(
    farm_id: str,
    is_read: Optional[bool] = Query(None),
    severity: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_farmer=Depends(deps.get_current_farmer),
    _=Depends(deps.verify_farm_owner),
) -> Any:
    alerts, unread_count = alert_service.get_alerts(
        farm_id=farm_id, db=db, is_read=is_read, severity=severity, limit=limit
    )
    return {
        "success": True,
        "data": {
            "alerts": [AlertOut.model_validate(a) for a in alerts],
            "unread_count": unread_count,
        },
    }
