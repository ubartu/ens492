from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from fastapi_ai_scheduler.app.db.session import get_session
from fastapi_ai_scheduler.app.models.student import Student
from fastapi_ai_scheduler.app.models.course import Course
from fastapi_ai_scheduler.app.models.enrollment import Enrollment
from fastapi_ai_scheduler.app.schemas.enrollment import EnrollmentCreate, EnrollmentRead

router = APIRouter()

@router.post("/", response_model=EnrollmentRead, status_code=status.HTTP_201_CREATED)
def enroll(payload: EnrollmentCreate, session: Session = Depends(get_session)):
    # FK validation
    student = session.get(Student, payload.student_id)
    if not student:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid student_id")

    course = session.get(Course, payload.course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid course_id")

    # prevent duplicates via read-before-write (DB has UniqueConstraint too)
    dup = session.exec(
        select(Enrollment).where(
            (Enrollment.student_id == payload.student_id) &
            (Enrollment.course_id == payload.course_id)
        )
    ).first()
    if dup:
        # idempotent create → return existing record (or 409; choose returning existing for client simplicity)
        return EnrollmentRead(id=dup.id, student_id=dup.student_id, course_id=dup.course_id)

    rec = Enrollment.model_validate(payload)
    session.add(rec)
    session.commit()
    session.refresh(rec)
    return rec

@router.get("/", response_model=List[EnrollmentRead])
def list_enrollments(session: Session = Depends(get_session), limit: int = 100, offset: int = 0):
    rows = session.exec(select(Enrollment).offset(offset).limit(limit)).all()
    return [EnrollmentRead(id=r.id, student_id=r.student_id, course_id=r.course_id) for r in rows]

@router.delete("/{enrollment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_enrollment(enrollment_id: int, session: Session = Depends(get_session)):
    rec = session.get(Enrollment, enrollment_id)
    if not rec:
        # idem: could return 204, but explicit 404 helps during development
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Enrollment not found")
    session.delete(rec)
    session.commit()
    return None
