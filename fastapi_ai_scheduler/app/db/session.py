
# `fastapi_ai_scheduler/app/db/session.py`
import os
from typing import Generator

from sqlmodel import create_engine, Session

from fastapi_ai_scheduler.app.core.config import settings

# DB_URL\`i settings\`ten al
DB_URL = settings.DB_URL

# PostgreSQL için connect_args (SQLite değil)
connect_args = {}

# Engine oluştur (echo=True debug için açılabilir)
engine = create_engine(
    DB_URL,
    echo=False,
    connect_args=connect_args,
    pool_size=10,
    max_overflow=20,
)


def get_session() -> Generator[Session, None, None]:
    """
    FastAPI için veritabanı oturumu sağlayan dependency.
    Cloud SQL Proxy üzerinden PostgreSQL\`e bağlanır.
    """
    with Session(engine) as session:
        yield session
