
# `fastapi_ai_scheduler/app/api/v1/routers/students.py`
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select

from fastapi_ai_scheduler.app.models.student import Student
from fastapi_ai_scheduler.app.db.deps import get_db
from fastapi_ai_scheduler.app.schemas.student import StudentCreate, StudentRead

router = APIRouter(prefix="/students", tags=["students"])


@router.post("/", response_model=StudentRead)
def create_student(data: StudentCreate, db: Session = Depends(get_db)):
    student = Student.from_orm(data)
    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.get("/", response_model=list[StudentRead])
def list_students(db: Session = Depends(get_db)):
    return db.exec(select(Student)).all()


@router.get("/{student_id}", response_model=StudentRead)
def get_student(student_id: int, db: Session = Depends(get_db)):
    """Belirli bir öğrenciyi getir"""
    student = db.exec(select(Student).where(Student.id == student_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Öğrenci bulunamadı")
    return student


@router.put("/{student_id}", response_model=StudentRead)
def update_student(student_id: int, data: StudentCreate, db: Session = Depends(get_db)):
    """Öğrenci bilgilerini güncelle"""
    student = db.exec(select(Student).where(Student.id == student_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Öğrenci bulunamadı")

    for key, value in data.dict(exclude_unset=True).items():
        setattr(student, key, value)

    db.add(student)
    db.commit()
    db.refresh(student)
    return student


@router.delete("/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    """Öğrenciyi sil"""
    student = db.exec(select(Student).where(Student.id == student_id)).first()
    if not student:
        raise HTTPException(status_code=404, detail="Öğrenci bulunamadı")

    db.delete(student)
    db.commit()
    return {"message": "Öğrenci başarıyla silindi"}
