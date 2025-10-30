# app/db/fake_session.py
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field
import itertools

_id_counter = itertools.count(1)

@dataclass
class FakeRecord:
    id: int
    data: Dict[str, Any]

class FakeSession:
    def __init__(self):
        # "tables"
        self.students: Dict[int, FakeRecord] = {}
        self.courses: Dict[int, FakeRecord] = {}
        self.enrollments: Dict[int, FakeRecord] = {}

    # minimal methods used by routers:
    def add_course(self, payload: dict):
        new_id = next(_id_counter)
        rec = FakeRecord(id=new_id, data={"id": new_id, **payload})
        self.courses[new_id] = rec
        return rec.data

    def get_course(self, course_id: int) -> Optional[dict]:
        rec = self.courses.get(course_id)
        return rec.data if rec else None

    def list_courses(self):
        return [r.data for r in self.courses.values()]

    def add_student(self, payload: dict):
        new_id = next(_id_counter)
        rec = FakeRecord(id=new_id, data={"id": new_id, **payload})
        self.students[new_id] = rec
        return rec.data

    def get_student(self, student_id: int) -> Optional[dict]:
        rec = self.students.get(student_id)
        return rec.data if rec else None

    def add_enrollment(self, payload: dict):
        # prevent duplicate student-course pair
        for r in self.enrollments.values():
            if r.data["student_id"] == payload["student_id"] and r.data["course_id"] == payload["course_id"]:
                return r.data  # idempotent return
        new_id = next(_id_counter)
        rec = FakeRecord(id=new_id, data={"id": new_id, **payload})
        self.enrollments[new_id] = rec
        return rec.data

    def list_enrollments(self):
        return [r.data for r in self.enrollments.values()]
