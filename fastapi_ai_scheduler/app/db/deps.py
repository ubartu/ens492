
# `fastapi_ai_scheduler/app/db/deps.py`
from typing import Generator

from sqlmodel import Session

from fastapi_ai_scheduler.app.db.session import get_session


def get_db() -> Generator[Session, None, None]:
    """FastAPI endpoint\`leri için DB dependency"""
    yield from get_session()
