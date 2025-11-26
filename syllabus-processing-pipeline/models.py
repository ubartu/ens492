from pydantic import BaseModel


class SyllabusStructure(BaseModel):
    topics_count: int = 0
    has_project: bool = False
    has_quizzes: bool = False
    has_participation: bool = False
    midterm_count: int = 0


class CourseSummary(BaseModel):
    title: str = ""
    level: str = ""
    credits: int = 0
    description: str = ""
    key_topics: list[str] = []
    structure: SyllabusStructure = SyllabusStructure()
    main_textbooks: list[str] = []
    discipline: str = ""


class DifficultyBreakdown(BaseModel):
    conceptual_depth: int = 0
    prerequisites: int = 0
    breadth: int = 0
    assessment_rigor: int = 0
    midterm_count: int = 0
    quizzes: int = 0
    participation: int = 0
    project_complexity: int = 0
    reading_intensity: int = 0


class Meta(BaseModel):
    confidence: float = 0.0
    missing_fields: list[str] = []
    extraction_evidence: dict[str, str] = {}


class SyllabusAnalysis(BaseModel):
    course_summary: CourseSummary
    difficulty_breakdown: DifficultyBreakdown
    weighted_difficulty_score: float = 0.0
    meta: Meta = Meta()

