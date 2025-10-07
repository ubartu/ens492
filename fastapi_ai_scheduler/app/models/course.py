from __future__ import annotations

from sqlmodel import SQLModel, Field

class Course(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    code: str
    title: str
    credits: int
    slot: str
