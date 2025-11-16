from __future__ import annotations

from typing import Optional
from sqlmodel import SQLModel, Field, Column
from sqlalchemy import JSON

class Course(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    code: str  # Format: "CS201", "MATH484" (Major+Code)
    title: str
    credits: int
    slot: str
    
    # Catalog fields (from degree_requirements/catalog)
    major: Optional[str] = Field(default=None)  # Extracted from code
    faculty: Optional[str] = Field(default=None)  # "FENS", "FASS", "SBS"
    el_type: Optional[str] = Field(default=None)  # "required", "core", "area", "free", "university"
    ects: Optional[float] = Field(default=None)
    engineering_ects: Optional[float] = Field(default=None)
    basic_science_ects: Optional[float] = Field(default=None)
    
    # Prerequisites (list of course codes)
    prerequisites: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    
    # Syllabus analysis fields
    description: Optional[str] = Field(default=None)
    level: Optional[str] = Field(default=None)  # "Undergraduate", "Graduate", "Mixed"
    discipline: Optional[str] = Field(default=None)
    key_topics: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    main_textbooks: Optional[list[str]] = Field(default=None, sa_column=Column(JSON))
    
    # Structure fields
    topics_count: Optional[int] = Field(default=None)
    has_project: Optional[bool] = Field(default=None)
    has_quizzes: Optional[bool] = Field(default=None)
    has_participation: Optional[bool] = Field(default=None)
    midterm_count: Optional[int] = Field(default=None)
    
    # Difficulty breakdown (0-100 each)
    conceptual_depth: Optional[int] = Field(default=None)
    prerequisites_score: Optional[int] = Field(default=None)
    breadth_score: Optional[int] = Field(default=None)
    assessment_rigor: Optional[int] = Field(default=None)
    quizzes_score: Optional[int] = Field(default=None)
    participation_score: Optional[int] = Field(default=None)
    project_complexity: Optional[int] = Field(default=None)
    reading_intensity: Optional[int] = Field(default=None)
    
    # Overall difficulty score
    weighted_difficulty_score: Optional[float] = Field(default=None)
    
    # Metadata
    syllabus_confidence: Optional[float] = Field(default=None)  # 0-1
    syllabus_processed: Optional[bool] = Field(default=False)
