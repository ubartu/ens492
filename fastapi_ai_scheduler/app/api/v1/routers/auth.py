from fastapi import APIRouter, HTTPException
from fastapi_ai_scheduler.app.core.security import create_access_token


router = APIRouter()

@router.post("/token")
def issue_token(username: str, password: str):
    if username == "admin" and password == "admin":
        return {"access_token": create_access_token({"sub": username}), "token_type": "bearer"}
    raise HTTPException(status_code=401, detail="Invalid credentials")
