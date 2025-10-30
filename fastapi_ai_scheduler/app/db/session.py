# app/db/session.py
import os
from sqlmodel import create_engine, Session
from fastapi_ai_scheduler.app.core.config import settings

# Absolute safety: derive DB_URL even if settings lacks attribute due to version skew
DB_URL = getattr(settings, "db_url", None) or os.getenv("DB_URL") or "sqlite:///./scheduler.db"

# SQLite needs this flag to avoid cross-thread errors in dev
connect_args = {"check_same_thread": False} if DB_URL.startswith("sqlite") else {}

engine = create_engine(DB_URL, echo=False, connect_args=connect_args)

def get_session():
    with Session(engine) as session:
        yield session
