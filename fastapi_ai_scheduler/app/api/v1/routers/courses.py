from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.models.course import Course
from app.db.session import get_session
from app.schemas.course import CourseCreate, CourseRead

router = APIRouter()

@router.post("/", response_model=CourseRead)
def create_course(data: CourseCreate, session: Session = Depends(get_session)):
    course = Course(**data.model_dump())
    session.add(course)
    session.commit()
    session.refresh(course)
    return course

@router.get("/", response_model=list[CourseRead])
def list_courses(session: Session = Depends(get_session)):
    return session.exec(select(Course)).all()

