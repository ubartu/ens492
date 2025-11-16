from pydantic import BaseModel
from typing import Optional

class StudentCreate(BaseModel):
    name: str
    email: str
    major: Optional[str] = None  # "CS", "MATH", "EE", etc. (None for first-year students who haven't chosen yet)
    gpa: Optional[float] = None

class StudentRead(StudentCreate):
    id: int
