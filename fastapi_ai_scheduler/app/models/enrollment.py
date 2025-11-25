from typing import Optional
from sqlmodel import SQLModel, Field
from sqlalchemy import UniqueConstraint  # import from SQLAlchemy

class Enrollment(SQLModel, table=True):
    __tablename__ = "enrollment"
    __table_args__ = (
        UniqueConstraint("student_id", "course_id", name="uq_student_course"),
    )

    id: Optional[int] = Field(default=None, primary_key=True)
    # IMPORTANT: use foreign_key ONLY (no sa_column here)
    student_id: int = Field(foreign_key="student.id")
    course_id:  int = Field(foreign_key="course.id")
