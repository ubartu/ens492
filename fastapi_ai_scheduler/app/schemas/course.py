from typing import Optional
from pydantic import BaseModel, Field

class CourseBase(BaseModel):
    code: str = Field(min_length=2, max_length=32)
    title: str
    credits: int = Field(ge=0)
    slot: Optional[str] = None

class CourseCreate(CourseBase):
    pass

class CourseRead(CourseBase):
    id: int

class CourseUpdate(BaseModel):
    title: Optional[str] = None
    credits: Optional[int] = Field(default=None, ge=0)
    slot: Optional[str] = None
