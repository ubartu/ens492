from typing import Optional
from sqlmodel import SQLModel, Field, Column, String, Index

class Course(SQLModel, table=True):
    __tablename__ = "course"

    id: Optional[int] = Field(default=None, primary_key=True)
    code: str = Field(sa_column=Column(String, unique=True, index=True, nullable=False))
    title: str
    credits: int = Field(ge=0)
    slot: Optional[str] = None

# Optional helper index (non-unique) for search UX
Index("ix_course_code_title", Course.code, Course.title, unique=False)
