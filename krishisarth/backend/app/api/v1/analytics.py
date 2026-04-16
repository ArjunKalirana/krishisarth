import csv
import io
import logging
from datetime import date, datetime, timezone, timedelta
from typing import Any, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.api import deps
from app.db.postgres import get_db
from app.models.fertigation_log import FertigationLog
from app.models.zone import Zone
from app.db.mongodb import mongo_manager
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/{farm_id}/analytics", response_model=dict)
async def get_farm_analytics_summary(
    farm_id: str,
    from_date: date = Query(...),
    to_date: date = Query(...),
    zone_id: Optional[str] = None,
    db: Session = Depends(get_db),
    current_farmer = Depends(deps.get_current_farmer),
    _ = Depends(deps.verify_farm_owner)
) -> Any:
    from app.models.irrigation_schedule import IrrigationSchedule
    from app.models.ai_decision import AIDecision as AIDecisionModel
    
    if (to_date - from_date).days > 90:
        raise HTTPException(status_code=400, detail="INVALID_DATE_RANGE")

    from_dt = datetime.combine(from_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    to_dt   = datetime.combine(to_date,   datetime.max.time()).replace(tzinfo=timezone.utc)

    # 1. PostgreSQL Metadata
    zones = db.query(Zone).filter(Zone.farm_id == farm_id).all()
    zone_ids = [str(z.id) for z in zones]
    node_ids = [z.node_id for z in zones if z.node_id]

    # 2. Historical MongoDB Data (Moisture & Nutrients)
    mongo_db = mongo_manager.client[settings.MONGODB_DB_NAME]
    collection = mongo_db["sensor_data"]
    
    moisture_trend = {}
    n_trend, p_trend, k_trend = {}, {}, {}
    
    query = {
        "timestamp": {"$gte": from_dt, "$lte": to_dt}
    }
    if node_ids:
        # Match either as string or int to be safe
        search_nodes = []
        for nid in node_ids:
             search_nodes.append(nid)
             if nid.isdigit(): search_nodes.append(int(nid))
        query["node_id"] = {"$in": search_nodes}

    cursor = collection.find(query).sort("timestamp", 1)
    async for record in cursor:
        ts = record.get("timestamp")
        if not ts: continue
        day = ts.strftime("%a") # e.g. "Mon"
        
        if day not in moisture_trend:
            moisture_trend[day] = []
            n_trend[day], p_trend[day], k_trend[day] = [], [], []
            
        moisture_trend[day].append(float(record.get("soil_moisture", 0)))
        n_trend[day].append(float(record.get("N", 0)))
        p_trend[day].append(float(record.get("P", 0)))
        k_trend[day].append(float(record.get("K", 0)))

    # Calculate series
    days_order = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    moisture_series = [round(sum(moisture_trend[d])/len(moisture_trend[d]), 1) if moisture_trend.get(d) else 45.0 for d in days_order]
    
    # 3. Water Consumption (Postgres remain source of truth for valve logs)
    schedules = db.query(IrrigationSchedule).filter(
        IrrigationSchedule.zone_id.in_(zone_ids),
        IrrigationSchedule.status == "completed",
        IrrigationSchedule.scheduled_at >= from_dt,
        IrrigationSchedule.scheduled_at <= to_dt,
    ).all()
    total_water_l = sum(s.duration_min * 10.0 for s in schedules)

    return {
        "success": True,
        "data": {
            "range":    {"from": from_date, "to": to_date},
            "summary":  {
                "total_water_liters": round(total_water_l, 1),
                "avg_moisture": round(sum(moisture_series)/len(moisture_series), 1),
                "mongodb_records": 1, # flag for frontend
            },
            "labels":           days_order,
            "moisture_trend":   moisture_series,
            "nutrients": {
                "N": [round(sum(n_trend[d])/len(n_trend[d]), 1) if n_trend.get(d) else 0 for d in days_order],
                "P": [round(sum(p_trend[d])/len(p_trend[d]), 1) if p_trend.get(d) else 0 for d in days_order],
                "K": [round(sum(k_trend[d])/len(k_trend[d]), 1) if k_trend.get(d) else 0 for d in days_order]
            }
        }
    }
