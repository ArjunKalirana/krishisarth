from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.postgres import get_db
from app.db.redis import get_redis
from app.models import Farmer, Farm
from app.services import auth_service
from app.schemas.auth_schema import (
    RegisterRequest, 
    LoginRequest, 
    RefreshRequest, 
    AuthResponse, 
    RefreshResponse
)

router = APIRouter()

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
async def register(
    *,
    db: Session = Depends(get_db),
    farmer_in: RegisterRequest
) -> Any:
    """
    Onboard a new farmer user.
    Hashes password (cost=12) and issues session tokens.
    """
    # 1. Check for existing email to prevent duplicates
    existing = db.query(Farmer).filter(Farmer.email == farmer_in.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="EMAIL_ALREADY_EXISTS"
        )
        
    # 2. Create and persist the farmer record
    farmer = Farmer(
        email=farmer_in.email,
        name=farmer_in.name,
        password_hash=auth_service.hash_password(farmer_in.password),
        phone=farmer_in.phone,
        preferred_lang=farmer_in.preferred_lang
    )
    db.add(farmer)
    db.commit()
    db.refresh(farmer)
    
    # 3. Auto-provision a default farm for a smooth first-run experience
    default_farm = Farm(
        name=f"{farmer.name}'s Plot",
        farmer_id=farmer.id,
        soil_type="Loam",
        area_ha=1.0
    )
    db.add(default_farm)
    db.commit()
    db.refresh(default_farm)
    
    # 4. Issue initial token pair
    access_token = auth_service.create_access_token(farmer.id)
    refresh_token, _ = auth_service.create_refresh_token(farmer.id)
    
    return {
        "success": True,
        "data": {
            "farmer_id": farmer.id,
            "name": farmer.name,
            "email": farmer.email,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": 86400
        }
    }

@router.post("/login", response_model=AuthResponse)
async def login(
    *,
    db: Session = Depends(get_db),
    redis = Depends(get_redis),
    login_in: LoginRequest
) -> Any:
    """
    Authenticate farmer credentials.
    Standardized INVALID_CREDENTIALS error for security.
    Includes automated brute-force protection.
    """
    # 1. Audit check for lockout status
    await auth_service.check_brute_force(login_in.email, redis)
    
    # 2. Lookup farmer by email
    farmer = db.query(Farmer).filter(Farmer.email == login_in.email).first()
    if not farmer:
        # Zero-leakage: generic 401 even if user doesn't exist
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_CREDENTIALS"
        )
        
    # 3. Cryptographic password verification
    if not auth_service.verify_password(login_in.password, farmer.password_hash):
        await auth_service.record_login_failure(login_in.email, redis)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="INVALID_CREDENTIALS"
        )
        
    # 4. Successful login: cleanup counters and update metadata
    await auth_service.clear_login_failures(login_in.email, redis)
    farmer.last_login = datetime.now(timezone.utc)
    db.commit()
    
    access_token = auth_service.create_access_token(farmer.id)
    refresh_token, _ = auth_service.create_refresh_token(farmer.id)
    
    return {
        "success": True,
        "data": {
            "farmer_id": farmer.id,
            "name": farmer.name,
            "email": farmer.email,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": 86400
        }
    }

@router.post("/refresh", response_model=RefreshResponse)
async def refresh(
    *,
    redis = Depends(get_redis),
    refresh_in: RefreshRequest
) -> Any:
    """
    Rotates tokens via Refresh Token.
    Implements JTI revocation check for replay prevention.
    """
    new_access, new_refresh, _ = await auth_service.rotate_refresh_token(
        refresh_in.refresh_token, 
        redis
    )
    
    return {
        "success": True,
        "data": {
            "access_token": new_access,
            "refresh_token": new_refresh,
            "expires_in": 86400
        }
    }
