from sqlmodel import SQLModel
from fastapi_ai_scheduler.app.db.session import engine
from fastapi_ai_scheduler.app.models import student, course, enrollment

def init_db():
    SQLModel.metadata.create_all(bind=engine)
