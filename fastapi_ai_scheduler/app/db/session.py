import os

# `fastapi_ai_scheduler/app/db/session.py`

from dotenv import load_dotenv
from typing import Generator

from sqlmodel import create_engine, Session
from torchvision.datasets.inaturalist import DATASET_URLS





# .env dosyasını yükle
load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:492database@127.0.0.1:5432/492db")# PostgreSQL için connect_args (SQLite değil)
connect_args = {}

# Engine oluştur (echo=True debug için açılabilir)
engine = create_engine(
    DATABASE_URL,
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
