from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.models.course import Course
from app.db.session import get_session
from app.schemas.course import SyllabusImportRequest, CourseRead

router = APIRouter()

@router.post("/import", response_model=CourseRead)
def import_syllabus_analysis(
    request: SyllabusImportRequest, 
    session: Session = Depends(get_session)
):
    """
    Import syllabus analysis data into a course.
    Matches by course code. If course doesn't exist, creates it with basic info from syllabus.
    """
    # Find course by code
    course = session.exec(select(Course).where(Course.code == request.course_code)).first()
    
    # If course doesn't exist, create it
    if not course:
        analysis = request.syllabus_analysis
        course_summary = analysis.get("course_summary", {})
        
        # Extract major from course code (e.g., "CS201" -> "CS")
        code_upper = request.course_code.upper().strip()
        major = None
        for m in ["CS", "MATH", "MAT", "EE", "IE", "ME", "BIO", "ECON", "PROJ", "ENS", "HIST", "HUM", "MGMT", "NS", "SPS", "TLL", "AL", "CIP", "IF", "FIN"]:
            if code_upper.startswith(m):
                major = m
                break
        
        # Create new course with basic info
        course = Course(
            code=request.course_code.upper().strip(),
            title=course_summary.get("title", ""),
            credits=course_summary.get("credits", 0),
            slot="TBD",  # Default slot, can be updated later
            major=major
        )
        session.add(course)
        session.flush()  # Get the ID
    
    analysis = request.syllabus_analysis
    
    # Extract course summary
    course_summary = analysis.get("course_summary", {})
    difficulty = analysis.get("difficulty_breakdown", {})
    meta = analysis.get("meta", {})
    
    # Update major if not set (extract from code)
    if not course.major:
        code_upper = course.code.upper().strip()
        for m in ["CS", "MATH", "MAT", "EE", "IE", "ME", "BIO", "ECON", "PROJ", "ENS", "HIST", "HUM", "MGMT", "NS", "SPS", "TLL", "AL", "CIP", "IF", "FIN"]:
            if code_upper.startswith(m):
                course.major = m
                break
    
    # Update course with syllabus data
    course.description = course_summary.get("description")
    course.level = course_summary.get("level")
    course.discipline = course_summary.get("discipline")
    course.key_topics = course_summary.get("key_topics", [])
    course.main_textbooks = course_summary.get("main_textbooks", [])
    
    # Structure
    structure = course_summary.get("structure", {})
    course.topics_count = structure.get("topics_count")
    course.has_project = structure.get("has_project")
    course.has_quizzes = structure.get("has_quizzes")
    course.has_participation = structure.get("has_participation")
    course.midterm_count = structure.get("midterm_count")
    
    # Difficulty breakdown
    course.conceptual_depth = difficulty.get("conceptual_depth")
    course.prerequisites_score = difficulty.get("prerequisites")
    course.breadth_score = difficulty.get("breadth")
    course.assessment_rigor = difficulty.get("assessment_rigor")
    course.quizzes_score = difficulty.get("quizzes")
    course.participation_score = difficulty.get("participation")
    course.project_complexity = difficulty.get("project_complexity")
    course.reading_intensity = difficulty.get("reading_intensity")
    
    # Overall scores
    course.weighted_difficulty_score = analysis.get("weighted_difficulty_score")
    course.syllabus_confidence = meta.get("confidence")
    course.syllabus_processed = True
    
    session.add(course)
    session.commit()
    session.refresh(course)
    
    return course

