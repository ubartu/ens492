import re
import json

def time_from_slot(slot):
    hour = 8 + int(slot)
    return f"{hour:02d}:40"

def end_time_from_start_duration(start_slot, dur):
    start_int = int(start_slot)
    dur_int = int(dur)
    total_minutes = (dur_int * 50) + ((dur_int - 1) * 10)
    hour = 8 + start_int
    minute = 40 + total_minutes
    while minute >= 60:
        hour += 1
        minute -= 60
    return f"{hour:02d}:{minute:02d}"

DAYS = {
    "0": "Monday",
    "1": "Tuesday",
    "2": "Wednesday",
    "3": "Thursday",
    "4": "Friday",
    "5": "Saturday",
    "6": "Sunday",
    "-1": "TBA"
}

with open('courses.txt', 'r', encoding='utf-8') as f:
    html = f.read()

courses = []

# Split by course-entry divs - much simpler approach
course_blocks = re.split(r'<div class="course-entry hide-info" data-code="', html)[1:]

for block in course_blocks:
    # Extract course code (first thing after the split)
    code_match = re.match(r'([^"]+)"', block)
    if not code_match:
        continue
    
    code = code_match.group(1)
    sc, cn = code.split(' ', 1)
    
    sections = []
    
    # Find all sections within this block
    section_pattern = r'<div class="course-section" data-section-name="[^"]+ - ([^"]+)"[^>]*>.*?(?=<div class="course-section"|$)'
    section_matches = re.finditer(section_pattern, block, re.DOTALL)
    
    for section_match in section_matches:
        section_name = section_match.group(1)
        section_content = section_match.group(0)
        
        # Extract instructor
        instructor_match = re.search(r'<div class="instructor">([^<]+)</div>', section_content)
        instructor = None
        if instructor_match:
            instructor = instructor_match.group(1).strip()
            # Remove role indicators like (P), (S)
            instructor = re.sub(r'\s*\([A-Z]\)\s*$', '', instructor).strip()
        
        # Extract schedule days
        schedule = []
        day_pattern = r'<div class="section-day" data-day="([^"]+)" data-start="([^"]+)" data-duration="([^"]+)" data-place="([^"]+)">'
        day_matches = re.finditer(day_pattern, section_content)
        
        for day_match in day_matches:
            day = day_match.group(1)
            start = day_match.group(2)
            duration = day_match.group(3)
            location = day_match.group(4)
            
            if day != '-1' and start != '-1' and duration != '-1':
                try:
                    schedule.append({
                        "day": DAYS.get(day, "Unknown"),
                        "start_time": time_from_slot(start),
                        "end_time": end_time_from_start_duration(start, duration),
                        "location": location
                    })
                except (ValueError, TypeError):
                    pass
        
        # Format schedule
        if not schedule:
            schedule = None
        elif len(schedule) == 1:
            schedule = schedule[0]
        
        sections.append({
            "section": section_name,
            "instructor": instructor,
            "schedule": schedule
        })
    
    courses.append({
        'subject_code': sc,
        '': cn,
        'sections': sections
    })

with open('courses.json', 'w', encoding='utf-8') as f:
    json.dump(courses, f, indent=2, ensure_ascii=False)

print(f'Extracted {len(courses)} courses')
if courses:
    print(f'Sample: {json.dumps(courses[0], indent=2, ensure_ascii=False)}')
    # Debug: show first section's raw data
    if courses[0]['sections']:
        print(f"\nFirst section: {courses[0]['sections'][0]}")