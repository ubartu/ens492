from pydantic import BaseModel
from typing import Optional

class CourseCreate(BaseModel):
    code: str
    title: str
    credits: int
    slot: str

class CourseRead(CourseCreate):
    id: int
    # Catalog fields
    major: Optional[str] = None
    faculty: Optional[str] = None
    el_type: Optional[str] = None
    ects: Optional[float] = None
    engineering_ects: Optional[float] = None
    basic_science_ects: Optional[float] = None
    prerequisites: Optional[list[str]] = None
    # Syllabus fields
    description: Optional[str] = None
    level: Optional[str] = None
    discipline: Optional[str] = None
    key_topics: Optional[list[str]] = None
    main_textbooks: Optional[list[str]] = None
    topics_count: Optional[int] = None
    has_project: Optional[bool] = None
    has_quizzes: Optional[bool] = None
    has_participation: Optional[bool] = None
    midterm_count: Optional[int] = None
    conceptual_depth: Optional[int] = None
    prerequisites_score: Optional[int] = None
    breadth_score: Optional[int] = None
    assessment_rigor: Optional[int] = None
    quizzes_score: Optional[int] = None
    participation_score: Optional[int] = None
    project_complexity: Optional[int] = None
    reading_intensity: Optional[int] = None
    weighted_difficulty_score: Optional[float] = None
    syllabus_confidence: Optional[float] = None
    syllabus_processed: Optional[bool] = False

class SyllabusImportRequest(BaseModel):
    course_code: str
    syllabus_analysis: dict  # The full JSON from syllabus processing pipeline

