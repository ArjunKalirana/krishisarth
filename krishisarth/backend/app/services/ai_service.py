import logging
import httpx
import json
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.models.ai_decision import AIDecision
from app.models.zone import Zone
from app.core import constants
from app.core.config import settings
from app.db.mongodb import mongo_manager
from app.services import ml_service

logger = logging.getLogger(__name__)

async def _get_groq_reasoning(snapshot: dict) -> str:
    """Use Groq to generate high-quality agronomist reasoning."""
    if not settings.GROQ_KEY:
        return None
    
    groq_key = settings.GROQ_KEY.strip("'\"")
    
    # Safe Data Extraction
    z_name = snapshot.get('zone_name') or "Unknown Zone"
    c_type = snapshot.get('crop_type') or "Active Crop"
    c_stage = snapshot.get('crop_stage') or "Growth"
    moisture = snapshot.get('moisture_pct') or 0.0
    fertility = snapshot.get('fertility_label') or "Stable"
    npk = f"{snapshot.get('N', 0)}-{snapshot.get('P', 0)}-{snapshot.get('K', 0)}"

    prompt = f"""
    You are Sarth, an Elite AI Agronomist. Analyze this sensor data and provide 1-2 sentences of actionable advice for the farmer.
    Data:
    - Zone: {z_name}
    - Crop: {c_type} ({c_stage})
    - Soil Moisture: {moisture}%
    - Fertility: {fertility}
    - NPK: {npk}
    
    Advice should be professional, data-centric, and focused on yield optimization.
    """
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {groq_key}"},
                json={
                    "model": "llama-3-8b-8192",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.5,
                    "max_tokens": 512
                },
                timeout=15.0
            )
            if response.status_code != 200:
                logger.error(f"Groq API Error in Service: {response.status_code} - {response.text}")
                return None
            data = response.json()
            return data["choices"][0]["message"]["content"].strip()
        except Exception as e:
            logger.warning(f"Groq reasoning failed: {e}")
            return None

async def run_inference(zone_id: str, db: Session, influx_client=None, redis=None) -> AIDecision:
    """
    Execute an AI reasoning cycle using MongoDB telemetry and ML models.
    """
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise ValueError(f"Zone {zone_id} not found")

    # 1. Fetch latest telemetry from MongoDB
    m_db = mongo_manager.client[settings.MONGODB_DB_NAME]
    collection = m_db["sensor_data"]
    
    # Query by node_id if available, otherwise fallback
    query = {"node_id": zone.node_id} if zone.node_id else {"zone_id": zone_id}
    latest = await collection.find_one(query, sort=[("timestamp", -1)])
    
    moisture = latest.get("soil_moisture", 45.0) if latest else 45.0
    N = latest.get("N", 20) if latest else 20
    P = latest.get("P", 15) if latest else 15
    K = latest.get("K", 40) if latest else 40
    temp = latest.get("temperature", 28.0) if latest else 28.0

    # 2. Call ML Fertility Model
    fertility = await ml_service.predict_fertility(N=N, P=P, K=K)
    
    # 3. Decision Logic (Threshold-based for action, Groq for reasoning)
    threshold = constants.AI_MOISTURE_RULE_THRESHOLD * 100
    decision_type = "irrigate" if moisture < threshold else "skip"
    confidence = 0.85 if moisture < threshold else 0.70

    snapshot = {
        "moisture_pct": moisture,
        "N": N, "P": P, "K": K,
        "fertility_label": fertility.get("label", "Unknown"),
        "crop_type": zone.crop_type,
        "crop_stage": zone.crop_stage,
        "zone_name": zone.name,
        "at": datetime.now(timezone.utc).isoformat()
    }

    # 4. Generate Groq Reasoning
    reasoning = await _get_groq_reasoning(snapshot)
    if not reasoning:
        # Fallback reasoning
        if decision_type == "irrigate":
            reasoning = f"Moisture at {moisture}% is below threshold {threshold}%. Immediate irrigation required."
        else:
            reasoning = f"Soil moisture levels ({moisture}%) are optimal for {zone.crop_type}. Sustaining current state."

    # 5. Persist Decision
    decision = AIDecision(
        zone_id = zone_id,
        decision_type = decision_type,
        reasoning = reasoning,
        confidence = confidence,
        input_snapshot = snapshot,
        water_saved_l = 25.0 if decision_type == "skip" else 0.0
    )
    db.add(decision)
    db.commit()
    db.refresh(decision)

    return decision
