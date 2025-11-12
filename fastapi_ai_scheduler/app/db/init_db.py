from sqlmodel import SQLModel
from app.db.session import engine
from app.models import student, course, enrollment

def init_db():
    SQLModel.metadata.create_all(bind=engine)
