from pydantic import BaseModel

class StudentCreate(BaseModel):
    name: str
    email: str

class StudentRead(StudentCreate):
    id: int
