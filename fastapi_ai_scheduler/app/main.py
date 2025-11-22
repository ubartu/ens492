# `fastapi_ai_scheduler/app/main.py`
import logging
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import SQLModel
from fastapi import FastAPI

from fastapi_ai_scheduler.app.api.v1.routers import students, courses, enrollments, auth
from fastapi_ai_scheduler.app.db.session import engine


logger = logging.getLogger(__name__)


def _verify_database_connection() -> None:
    """Ensure the database connection is reachable before proceeding."""

    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except SQLAlchemyError as exc:
        logger.exception("Failed to connect to the database at %s", engine.url)
        raise RuntimeError(
            "Database connection failed. Ensure the DATABASE_URL is correct and the database is reachable."
        ) from exc


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern FastAPI lifespan handler"""
    _verify_database_connection()

    try:
        SQLModel.metadata.create_all(bind=engine)
    except SQLAlchemyError as exc:
        logger.exception("Connected to database, but failed to initialize tables")
        raise RuntimeError(
            "Database is reachable but table initialization failed. Check database permissions and connectivity."
        ) from exc
    yield
    print("Application shutdown complete.")


# Instantiate the app with lifecycle
app = FastAPI(title="AI Scheduler API", version="0.1.0", lifespan=lifespan)


@app.get("/")
def root():
    """Health probe / root endpoint."""
    return {"status": "ok", "message": "AI Scheduler backend active"}


# Router registration
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(students.router, prefix="/api/v1/students", tags=["students"])
app.include_router(courses.router, prefix="/api/v1/courses", tags=["courses"])
app.include_router(enrollments.router, prefix="/api/v1/enrollments", tags=["enrollments"])


if __name__ == "__main__":
    import uvicorn
    print(" Launching AI Scheduler...")
    uvicorn.run(
        "fastapi_ai_scheduler.app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
    )
