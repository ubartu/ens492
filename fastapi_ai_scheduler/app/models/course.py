from typing import Optional
from sqlmodel import SQLModel, Field, Column, String, Index

class Course(SQLModel, table=True):
    __tablename__ = "course"

    id: Optional[int] = Field(default=None, primary_key=True)
    # unique constraint at DB level
    code: str = Field(sa_column=Column(String, unique=True, index=True, nullable=False))
    title: str
    credits: int = Field(ge=0)
    # e.g., "Mon 09:40-11:30" (keep as string for now)
    slot: Optional[str] = None

# helpful composite index example (optional)
Index("ix_course_code_title", Course.code, Course.title, unique=False)
