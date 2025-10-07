from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from fastapi_ai_scheduler.app.models.student import Student
from fastapi_ai_scheduler.app.db.session import get_session
from fastapi_ai_scheduler.app.schemas.student import StudentCreate, StudentRead

router = APIRouter()

@router.post("/", response_model=StudentRead)
def create_student(data: StudentCreate, session: Session = Depends(get_session)):
    student = Student.from_orm(data)
    session.add(student)
    session.commit()
    session.refresh(student)
    return student

@router.get("/", response_model=list[StudentRead])
def list_students(session: Session = Depends(get_session)):
    return session.exec(select(Student)).all()
