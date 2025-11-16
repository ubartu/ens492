from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from app.models.enrollment import Enrollment
from app.db.session import get_session
from app.schemas.enrollment import EnrollmentCreate, EnrollmentRead

router = APIRouter()

@router.post("/", response_model=EnrollmentRead)
def create_enrollment(data: EnrollmentCreate, session: Session = Depends(get_session)):
    enrollment = Enrollment(**data.model_dump())
    session.add(enrollment)
    session.commit()
    session.refresh(enrollment)
    return enrollment

@router.get("/", response_model=list[EnrollmentRead])
def list_enrollments(session: Session = Depends(get_session)):
    return session.exec(select(Enrollment)).all()

