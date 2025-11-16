from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.models.student import Student
from app.db.session import get_session
from app.schemas.student import StudentCreate, StudentRead

router = APIRouter()

@router.post("/", response_model=StudentRead)
def create_student(data: StudentCreate, session: Session = Depends(get_session)):
    student = Student(**data.model_dump())
    session.add(student)
    session.commit()
    session.refresh(student)
    return student

@router.get("/", response_model=list[StudentRead])
def list_students(session: Session = Depends(get_session)):
    return session.exec(select(Student)).all()
