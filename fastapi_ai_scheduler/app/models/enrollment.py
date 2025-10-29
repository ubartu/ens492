from typing import Optional
from sqlmodel import SQLModel, Field, Column, Integer, UniqueConstraint

class Enrollment(SQLModel, table=True):
    __tablename__ = "enrollment"
    __table_args__ = (
        # prevent duplicate (student_id, course_id)
        UniqueConstraint("student_id", "course_id", name="uq_student_course"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    student_id: int = Field(foreign_key="student.id", sa_column=Column(Integer, nullable=False))
    course_id:  int = Field(foreign_key="course.id",  sa_column=Column(Integer, nullable=False))
