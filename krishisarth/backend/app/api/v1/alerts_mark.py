from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.db.postgres import get_db
from app.services import alert_service
from app.schemas.alert_schema import AlertOut

router = APIRouter()

# Mounted under /v1/alerts prefix → final URL: PATCH /v1/alerts/{alert_id}/read
@router.patch("/{alert_id}/read", response_model=dict)
def mark_alert_as_read(
    alert_id: str,
    db: Session = Depends(get_db),
    current_farmer=Depends(deps.get_current_farmer),
) -> Any:
    alert = alert_service.mark_read(alert_id, current_farmer.id, db)
    if not alert:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="ALERT_ACCESS_DENIED")
    return {"success": True, "data": AlertOut.model_validate(alert)}
