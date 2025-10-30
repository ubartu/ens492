from contextlib import asynccontextmanager
from sqlmodel import SQLModel
from fastapi import FastAPI
from fastapi_ai_scheduler.app.api.v1.routers import students, courses, enrollments, auth
from fastapi_ai_scheduler.app.db.deps import get_fake_session, USE_FAKE_DB
from fastapi_ai_scheduler.app.db.session import engine, get_session


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Modern FastAPI lifespan handler (replaces deprecated @app.on_event)."""
    if not USE_FAKE_DB:
        # Initialize real database tables
        SQLModel.metadata.create_all(bind=engine)
    else:
        # Switch to in-memory fake DB for development/testing
        app.dependency_overrides[get_session] = get_fake_session

    yield  # --- Application runs while inside this context ---

    # Teardown logic (if any cleanup needed)
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


# ------------------------------------------------------------
# Local entry point: allows running `python app/main.py`
# ------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    print("🚀 Launching AI Scheduler via direct run sequence...")
    uvicorn.run(
        "fastapi_ai_scheduler.app.main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info",
    )
