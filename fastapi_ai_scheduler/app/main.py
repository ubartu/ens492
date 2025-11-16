from fastapi import FastAPI
from app.api.v1.routers import students, courses, enrollments, auth, syllabus
from app.db.init_db import init_db

app = FastAPI(title="AI Scheduler API", version="0.1.0")

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(students.router, prefix="/api/v1/students", tags=["students"])
app.include_router(courses.router, prefix="/api/v1/courses", tags=["courses"])
app.include_router(enrollments.router, prefix="/api/v1/enrollments", tags=["enrollments"])
app.include_router(syllabus.router, prefix="/api/v1/syllabus", tags=["syllabus"])

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/")
def root():
    return {"status": "ok", "message": "AI Scheduler backend active"}
