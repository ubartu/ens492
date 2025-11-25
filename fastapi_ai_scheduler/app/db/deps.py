# `fastapi_ai_scheduler/app/db/deps.py`
from typing import Generator

from sqlmodel import Session

from fastapi_ai_scheduler.app.db.session import get_session


def get_db() -> Generator[Session, None, None]:
    """FastAPI endpoint'leri için DB dependency"""
    yield from get_session()


def get_session_sync() -> Generator[Session, None, None]:
    """Senkron session dependency"""
    with Session() as session:
        yield session


def get_session_async() -> Generator[Session, None, None]:
    """Asenkron işlemler için session dependency"""
    yield from get_session()
