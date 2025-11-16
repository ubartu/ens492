from __future__ import annotations

from typing import Optional
from sqlmodel import SQLModel, Field

class Student(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str
    major: Optional[str] = Field(default=None)  # "CS", "MATH", "EE", etc. (None for first-year students)
    gpa: Optional[float] = Field(default=None)
