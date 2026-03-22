from typing import Any, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, status
from sqlalchemy.orm import Session
from app.api import deps
from app.db.postgres import get_db
from app.services import ai_service
from app.models.ai_decision import AIDecision
from pydantic import BaseModel
import httpx

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[ChatMessage]

router = APIRouter()

@router.get("/{zone_id}/ai-decisions", response_model=dict)
def get_zone_ai_decisions(
    zone_id: str,
    limit: int = Query(10, ge=1, le=50),
    decision_type: Optional[str] = None,
    db: Session = Depends(get_db),
    current_farmer = Depends(deps.get_current_farmer),
    # verify_zone_owner checks farmer ownership of the zone
    _ = Depends(deps.verify_zone_owner)
) -> Any:
    """Retrieve historical AI reasoning cycles for a specific zone."""
    query = db.query(AIDecision).filter(AIDecision.zone_id == zone_id)
    if decision_type:
        query = query.filter(AIDecision.decision_type == decision_type)
    
    results = query.order_by(AIDecision.created_at.desc()).limit(limit).all()
    # Serialize results adding support for standard envelope
    return {
        "success": True, 
        "data": [
            {
                "id": str(d.id),
                "type": d.decision_type,
                "reasoning": d.reasoning,
                "confidence": d.confidence,
                "created_at": d.created_at
            } for d in results
        ]
    }

from app.db.redis import get_redis
from app.db.influxdb import get_influx_client

@router.post("/{zone_id}/ai-decisions/run", response_model=dict)
async def trigger_ai_inference(
    zone_id: str,
    db: Session = Depends(get_db),
    redis=Depends(get_redis),
    influx_client=Depends(get_influx_client),
    current_farmer=Depends(deps.get_current_farmer),
    _=Depends(deps.verify_zone_owner),
) -> Any:
    """Manually trigger an AI inference cycle for the specified zone."""
    import logging
    logger = logging.getLogger(__name__)
    try:
        decision = await ai_service.run_inference(
            zone_id=zone_id,
            db=db,
            influx_client=influx_client,
            redis=redis,
        )
        return {
            "success": True,
            "data": {
                "id":         str(decision.id),
                "type":       decision.decision_type,
                "reasoning":  decision.reasoning,
                "confidence": decision.confidence,
                "snapshot":   decision.input_snapshot,
                "created_at": decision.created_at,
            }
        }
    except Exception as e:
        logger.error(f"AI inference failed for zone {zone_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="AI_ENGINE_UNAVAILABLE"
        )

@router.post("/chat", response_model=dict)
async def proxy_ai_chat(
    request: ChatRequest,
    current_farmer = Depends(deps.get_current_farmer)
) -> Any:
    """Proxy AI Chat to Groq, protecting the API Key."""
    from app.core.config import settings
    if not settings.GROQ_KEY:
        raise HTTPException(status_code=500, detail="GROQ_KEY not configured on server")
    
    # Strip quotes if present from .env loading mistakes
    groq_key = settings.GROQ_KEY.strip("'\"")
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {groq_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": m.role, "content": m.content} for m in request.messages],
                    "temperature": 0.6,
                    "max_tokens": 1024
                },
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()
            reply_text = data.get("choices", [{}])[0].get("message", {}).get("content", "")
            return {
                "success": True, 
                "data": {"reply": reply_text}
            }
        except Exception as e:
            logger_name = f"{__name__}.chat_proxy"
            import logging
            logger = logging.getLogger(logger_name)
            
            if hasattr(e, 'response') and e.response is not None:
                try:
                    error_json = e.response.json()
                    logger.error(f"Groq API Error Detail: {error_json}")
                except:
                    logger.error(f"Groq API Error Text: {e.response.text}")
            
            logger.error(f"Groq API Error: {str(e)}")
            raise HTTPException(status_code=502, detail="AI_PROVIDER_ERROR")
