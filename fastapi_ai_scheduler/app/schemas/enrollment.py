from pydantic import BaseModel

class EnrollmentCreate(BaseModel):
    student_id: int
    course_id: int

class EnrollmentRead(BaseModel):
    id: int
    student_id: int
    course_id: int
