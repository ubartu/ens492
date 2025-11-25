from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import Session, select
from fastapi_ai_scheduler.app.db.session import get_session
from fastapi_ai_scheduler.app.models.course import Course
from fastapi_ai_scheduler.app.schemas.course import CourseCreate, CourseRead, CourseUpdate

router = APIRouter()

@router.post("/", response_model=CourseRead, status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseCreate, session: Session = Depends(get_session)):
    # uniqueness check for code
    exists = session.exec(select(Course).where(Course.code == payload.code)).first()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Course code already exists")
    course = Course.model_validate(payload)  # from pydantic v2-compatible
    session.add(course)
    session.commit()
    session.refresh(course)
    return course

@router.get("/", response_model=List[CourseRead])
def list_courses(
    session: Session = Depends(get_session),
    q: Optional[str] = Query(default=None, description="Search by code or title"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    stmt = select(Course)
    if q:
        stmt = stmt.where((Course.code.ilike(f"%{q}%")) | (Course.title.ilike(f"%{q}%")))
    stmt = stmt.offset(offset).limit(limit)
    return session.exec(stmt).all()

@router.get("/{course_id}", response_model=CourseRead)
def get_course(course_id: int, session: Session = Depends(get_session)):
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return course

@router.patch("/{course_id}", response_model=CourseRead)
def update_course(course_id: int, payload: CourseUpdate, session: Session = Depends(get_session)):
    course = session.get(Course, course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    # If title/credits/slot provided, apply selectively
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        setattr(course, k, v)

    session.add(course)
    session.commit()
    session.refresh(course)
    return course

@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course(course_id: int, session: Session = Depends(get_session)):
    course = session.get(Course, course_id)
    if not course:
        # DELETE should be idempotent; 204 on missing is also acceptable,
        # but we return 404 to be explicit for clients in this phase.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    session.delete(course)
    session.commit()
    return None
