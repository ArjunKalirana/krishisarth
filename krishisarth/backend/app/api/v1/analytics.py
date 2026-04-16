import csv
import io
import logging
import httpx
import json
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

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

async def generate_farmer_insights(stats: dict) -> str:
    """
    Calls Groq AI to generate a farmer-centric biological analysis.
    """
    if not settings.GROQ_KEY:
        return "AI analysis is currently unavailable. Please check your GROQ_KEY configuration."

    prompt = f"""
You are Sarth, a friendly and expert digital agronomist for the KrishiSarth platform. 
Your goal is to help a farmer understand their field's health based on the last 7 days of telemetry.

DATA SUMMARY:
- Average Soil Moisture: {stats.get('avg_moisture')}%
- Nutrient Levels (N-P-K): {stats.get('avg_n')}mg | {stats.get('avg_p')}mg | {stats.get('avg_k')}mg
- Water Consumed: {stats.get('total_water_l')} Liters
- Precision Level: High (MongoDB Telemetry)

INSTRUCTIONS:
1. Be Encouraging: Use a helpful, supportive tone.
2. Be Practical: Give direct advice on whether they should adjust irrigation or fertilization.
3. No Jargon: Explain things in simple terms (e.g., instead of "evapotranspiration", say "how fast the soil is drying").
4. Keep it concise (3-4 bullet points).
5. Mention specifically the current Nutrient status.

Speak directly to the farmer.
"""
    
    headers = {
        "Authorization": f"Bearer {settings.GROQ_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "llama3-8b-8192",
        "messages": [
            {"role": "system", "content": "You are a helpful agricultural AI assistant."},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.7,
        "max_tokens": 500
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(GROQ_API_URL, json=payload, headers=headers)
            r.raise_for_status()
            data = r.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        logger.error(f"Groq AI failure: {e}")
        return "The AI agronomist is currently walking the fields. Insights will be available shortly."

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
    
    if (to_date - from_date).days > 90:
        raise HTTPException(status_code=400, detail="INVALID_DATE_RANGE")

    from_dt = datetime.combine(from_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    to_dt   = datetime.combine(to_date,   datetime.max.time()).replace(tzinfo=timezone.utc)

    # 1. PostgreSQL Metadata (Strictly zones with hardware link)
    zones = db.query(Zone).filter(Zone.id.in_(zone_ids_filter) if (zone_id and (zone_ids_filter:=[zone_id])) else True).filter(Zone.farm_id == farm_id, Zone.node_id != None).all()
    zone_ids = [str(z.id) for z in zones]
    node_ids = [z.node_id for z in zones if z.node_id]

    # 2. Historical MongoDB Data (Moisture & Nutrients)
    mongo_db = mongo_manager.client[settings.MONGODB_DB_NAME]
    collection = mongo_db["sensor_data"]
    
    moisture_trend = {}
    n_trend, p_trend, k_trend = {}, {}, {}
    
    query = {"timestamp": {"$gte": from_dt, "$lte": to_dt}}
    if node_ids:
        search_nodes = []
        for nid in node_ids:
             search_nodes.append(nid)
             if nid.isdigit(): search_nodes.append(int(nid))
        query["node_id"] = {"$in": search_nodes}

    cursor = collection.find(query).sort("timestamp", 1)
    async for record in cursor:
        ts = record.get("timestamp")
        if not ts: continue
        day = ts.strftime("%a")
        
        if day not in moisture_trend:
            moisture_trend[day] = []
            n_trend[day], p_trend[day], k_trend[day] = [], [], []
            
        moisture_trend[day].append(float(record.get("soil_moisture", 0)))
        n_trend[day].append(float(record.get("N", 0)))
        p_trend[day].append(float(record.get("P", 0)))
        k_trend[day].append(float(record.get("K", 0)))

    days_order = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    
    def avg(lst, default=0.0):
        return round(sum(lst)/len(lst), 1) if lst else default

    moisture_series = [avg(moisture_trend.get(d), 45.0) for d in days_order]
    n_series = [avg(n_trend.get(d), 0) for d in days_order]
    p_series = [avg(p_trend.get(d), 0) for d in days_order]
    k_series = [avg(k_trend.get(d), 0) for d in days_order]

    # 3. Water Consumption
    schedules = db.query(IrrigationSchedule).filter(
        IrrigationSchedule.zone_id.in_(zone_ids),
        IrrigationSchedule.status == "completed",
        IrrigationSchedule.scheduled_at >= from_dt,
        IrrigationSchedule.scheduled_at <= to_dt,
    ).all()
    total_water_l = sum(s.duration_min * 10.0 for s in schedules)

    # 4. Generate AI Insights
    stats_for_ai = {
        "avg_moisture": avg(moisture_series),
        "avg_n": avg(n_series),
        "avg_p": avg(p_series),
        "avg_k": avg(k_series),
        "total_water_l": round(total_water_l, 1)
    }
    ai_analysis = await generate_farmer_insights(stats_for_ai)

    return {
        "success": True,
        "data": {
            "range":    {"from": from_date, "to": to_date},
            "summary":  {
                "total_water_liters": round(total_water_l, 1),
                "avg_moisture": round(sum(moisture_series)/len(moisture_series), 1),
                "ai_insight": ai_analysis
            },
            "labels":           days_order,
            "moisture_trend":   moisture_series,
            "nutrients": {
                "N": n_series,
                "P": p_series,
                "K": k_series
            }
        }
    }
