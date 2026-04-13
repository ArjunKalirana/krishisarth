"""
Soil Report OCR and Crop Suggestion API
Accepts uploaded soil report images, extracts text via OCR,
and returns AI-powered crop suggestions.
"""
import base64
import re
import logging
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Body
from sqlalchemy.orm import Session
from app.api import deps
from app.db.postgres import get_db
from app.models.zone import Zone
from app.core.config import settings

logger = logging.getLogger(__name__)

router = APIRouter()

# Crop-soil compatibility matrix (Pune/Maharashtra context)
CROP_SOIL_MATRIX = {
    "black cotton": ["cotton", "soybean", "wheat", "jowar", "sunflower"],
    "red laterite": ["groundnut", "millet", "ragi", "castor", "maize"],
    "alluvial": ["rice", "sugarcane", "banana", "tomato", "onion", "chilli"],
    "sandy loam": ["groundnut", "potato", "watermelon", "cucumber", "onion"],
    "clay loam": ["rice", "wheat", "sugarcane", "turmeric", "ginger"],
    "loam": ["tomato", "chilli", "onion", "garlic", "brinjal", "okra"],
}

PH_CROP_MAP = {
    (5.5, 6.5): ["blueberry", "potato", "strawberry"],
    (6.0, 7.0): ["maize", "tomato", "soybean", "wheat", "onion"],
    (6.5, 7.5): ["cotton", "sugarcane", "bajra", "jowar"],
    (7.0, 8.0): ["barley", "asparagus", "spinach"],
}

def extract_soil_params(text: str) -> dict:
    """Parse key values from OCR text using regex."""
    text_lower = text.lower()
    
    params = {}
    
    # pH
    ph_match = re.search(r'ph[:\s]+([0-9]+\.?[0-9]*)', text_lower)
    if ph_match: params['ph'] = float(ph_match.group(1))
    
    # Nitrogen (kg/ha or ppm)
    n_match = re.search(r'(?:nitrogen|n)[:\s]+([0-9]+\.?[0-9]*)', text_lower)
    if n_match: params['nitrogen_kg_ha'] = float(n_match.group(1))
    
    # Phosphorus
    p_match = re.search(r'(?:phosphorus|phosphate|p)[:\s]+([0-9]+\.?[0-9]*)', text_lower)
    if p_match: params['phosphorus_kg_ha'] = float(p_match.group(1))
    
    # Potassium
    k_match = re.search(r'(?:potassium|potash|k)[:\s]+([0-9]+\.?[0-9]*)', text_lower)
    if k_match: params['potassium_kg_ha'] = float(k_match.group(1))
    
    # Organic Carbon
    oc_match = re.search(r'organic\s+carbon[:\s]+([0-9]+\.?[0-9]*)', text_lower)
    if oc_match: params['organic_carbon_pct'] = float(oc_match.group(1))
    
    # Soil type
    for soil_type in CROP_SOIL_MATRIX.keys():
        if soil_type.replace(' ', '') in text_lower.replace(' ', ''):
            params['soil_type'] = soil_type
            break
    
    return params

def suggest_crops(params: dict) -> list:
    """Return ranked crop suggestions based on soil params."""
    candidates = set()
    
    # Soil type match
    soil = params.get('soil_type', '').lower()
    for soil_key, crops in CROP_SOIL_MATRIX.items():
        if any(word in soil for word in soil_key.split()):
            candidates.update(crops)
    
    # pH match
    ph = params.get('ph', 6.5)
    for (ph_min, ph_max), crops in PH_CROP_MAP.items():
        if ph_min <= ph <= ph_max:
            candidates.update(crops)
    
    # Default if nothing matched
    if not candidates:
        candidates = {"tomato", "onion", "chilli", "wheat", "maize"}
    
    return sorted(list(candidates))[:8]  # Return top 8

@router.post("/zones/{zone_id}/soil-scan", response_model=dict)
async def scan_soil_report(
    zone_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_farmer = Depends(deps.get_current_farmer),
    _ = Depends(deps.verify_zone_owner),
):
    """
    Accept a soil report image, extract text via OCR (pytesseract),
    parse soil parameters, and return crop suggestions.
    """
    # Read file
    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:  # 10MB limit
        raise HTTPException(status_code=400, detail="FILE_TOO_LARGE: Max 10MB")
    
    # Support common image formats and PDF (if handled later)
    allowed_types = ["image/jpeg", "image/png", "image/jpg", "application/pdf"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="INVALID_FILE: Must be an image (jpg/png) or PDF")
    
    # OCR extraction
    extracted_text = ""
    try:
        import pytesseract
        from PIL import Image
        import io
        img = Image.open(io.BytesIO(contents))
        extracted_text = pytesseract.image_to_string(img, lang='eng')
    except (ImportError, Exception) as ocr_err:
        logger.warning(f"Local OCR failed or unavailable: {str(ocr_err)}. Falling back to Groq Vision API.")
        # Fallback: use Groq vision API if pytesseract not installed or fails
        try:
            import httpx
            b64 = base64.b64encode(contents).decode()
            groq_response = httpx.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.GROQ_KEY}"},
                json={
                    "model": "llama-3.2-11b-vision-preview",
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:{file.content_type};base64,{b64}"}},
                            {"type": "text", "text": "Extract all soil test values from this report: pH, Nitrogen, Phosphorus, Potassium, Organic Carbon, soil type. Return as plain text key: value pairs."}
                        ]
                    }],
                    "max_tokens": 500
                },
                timeout=30
            )
            if groq_response.status_code == 200:
                extracted_text = groq_response.json()["choices"][0]["message"]["content"]
            else:
                extracted_text = f"OCR Error: {groq_response.text}"
        except Exception as e:
            extracted_text = f"OCR unavailable (Local failed, Cloud error: {str(e)})"
    
    # Parse and suggest
    params = extract_soil_params(extracted_text)
    suggestions = suggest_crops(params)
    
    # Save to zone
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if zone:
        zone.soil_report = extracted_text[:2000]
        if params.get('soil_type'):
            zone.soil_type = params['soil_type']
        if suggestions:
            zone.crop_suggestion = ",".join(suggestions[:3])
        db.commit()
    
    return {
        "success": True,
        "data": {
            "zone_id": zone_id,
            "extracted_text": extracted_text,
            "parsed_params": params,
            "crop_suggestions": suggestions,
            "top_suggestion": suggestions[0] if suggestions else "tomato",
            "message": f"Soil analysis complete. Top suggestion: {suggestions[0] if suggestions else 'N/A'}"
        }
    }

@router.post("/zones/{zone_id}/soil-text", response_model=dict)
async def submit_soil_text(
    zone_id: str,
    db: Session = Depends(get_db),
    current_farmer = Depends(deps.get_current_farmer),
    _ = Depends(deps.verify_zone_owner),
    payload: dict = Body(...),
):
    """Accept manually typed soil report values and return suggestions."""
    params = {
        "ph":               float(payload.get("ph", 6.5)),
        "nitrogen_kg_ha":   float(payload.get("nitrogen", 0)),
        "phosphorus_kg_ha": float(payload.get("phosphorus", 0)),
        "potassium_kg_ha":  float(payload.get("potassium", 0)),
        "soil_type":        payload.get("soil_type", ""),
    }
    suggestions = suggest_crops(params)
    
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if zone:
        zone.soil_type = params.get("soil_type") or zone.soil_type
        zone.crop_suggestion = ",".join(suggestions[:3])
        db.commit()
    
    return {
        "success": True,
        "data": {
            "parsed_params": params,
            "crop_suggestions": suggestions,
            "top_suggestion": suggestions[0] if suggestions else "tomato"
        }
    }
