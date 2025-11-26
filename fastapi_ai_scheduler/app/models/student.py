from typing import Optional
from sqlmodel import SQLModel, Field, Column, String

class Student(SQLModel, table=True):
    __tablename__ = "student"

    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    email: str = Field(sa_column=Column(String, unique=True, index=True, nullable=False))
