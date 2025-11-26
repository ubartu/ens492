import os
from typing import Generator

from dotenv import load_dotenv
from sqlmodel import Session, create_engine


# .env dosyasını yükle
load_dotenv()

# Allow configurable database URL with a safe local default for development
DEFAULT_DATABASE_URL = "sqlite:///./local.db"
DATABASE_URL = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)

# SQLite requires a special connect arg while other engines (e.g., PostgreSQL) do not
is_sqlite = DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

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
    Cloud SQL Proxy üzerinden PostgreSQL`e bağlanır.
    """
    with Session(engine) as session:
        yield session
