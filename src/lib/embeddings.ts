export async function generateEmbedding(text: string, ai: any): Promise<number[]> {
    const response: any = await ai.run('@cf/qwen/qwen3-embedding-0.6b', {
        text: [text],
    });
    return response.data[0];
}

export function buildCourseText(course: any): string {
    let tags: string[] = [];
    try {
        tags = typeof course.tags === 'string' ? JSON.parse(course.tags) : course.tags || [];
    } catch {
        tags = [];
    }

    let syllabusContent = '';
    try {
        if (course.syllabus_text) {
            const syllabus = JSON.parse(course.syllabus_text);
            if (syllabus.course_objective) {
                const obj = Array.isArray(syllabus.course_objective)
                    ? syllabus.course_objective.join(' ')
                    : syllabus.course_objective;
                syllabusContent += obj.slice(0, 400) + ' ';
            }
            if (syllabus.course_learning_outcomes?.length > 0) {
                syllabusContent += syllabus.course_learning_outcomes.slice(0, 3).join(' ').slice(0, 400);
        }
        }
    } catch {
    }

    const parts = [
        course.title,
        course.description,
        syllabusContent,
        tags.length > 0 ? `Topics: ${tags.join(', ')}` : ''
    ].filter(Boolean);

    return parts.join('. ').slice(0, 2000);
}

export function buildQueryText(bio: string, career: string, pastCourses: string): string {
    const parts = [];
    
    if (bio) {
        parts.push(`Interests: ${bio}`);
    }
    if (career) {
        parts.push(`Career goal: ${career}`);
    }
    if (pastCourses) {
        parts.push(`Background: ${pastCourses}`);
    }
    
    return parts.join('. ');
}
