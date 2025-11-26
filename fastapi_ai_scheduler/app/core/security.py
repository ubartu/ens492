from datetime import datetime, timedelta, timezone
from typing import Optional
from jose import jwt, JWTError
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi_ai_scheduler.app.core.config import settings

ALGO = "HS256"
bearer_scheme = HTTPBearer(auto_error=False)

def create_access_token(sub: str, minutes: Optional[int] = None) -> str:
    exp_minutes = minutes or settings.access_token_expire_minutes
    now = datetime.now(tz=timezone.utc)
    payload = {"sub": sub, "iat": int(now.timestamp()), "exp": int((now + timedelta(minutes=exp_minutes)).timestamp())}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGO)

def verify_token_and_get_sub(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[ALGO], options={"verify_aud": False})
        sub = payload.get("sub")
        if not sub:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token: missing subject")
        return sub
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

def auth_dependency(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)) -> str:
    if not credentials or not credentials.scheme.lower() == "bearer":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    return verify_token_and_get_sub(credentials.credentials)
