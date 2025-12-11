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

    let keyTopics: string[] = [];
    try {
        keyTopics = typeof course.key_topics === 'string' 
            ? JSON.parse(course.key_topics) 
            : course.key_topics || [];
    } catch {
        keyTopics = [];
    }

    let syllabusContent = '';
    try {
        if (course.syllabus_text) {
            const syllabus = JSON.parse(course.syllabus_text);
            
            // Course objectives - use more content
            if (syllabus.course_objective) {
                const obj = Array.isArray(syllabus.course_objective)
                    ? syllabus.course_objective.join(' ')
                    : syllabus.course_objective;
                syllabusContent += `Objectives: ${obj.slice(0, 600)}. `;
            }
            
            // Learning outcomes - use more
            if (syllabus.course_learning_outcomes?.length > 0) {
                syllabusContent += `Learning outcomes: ${syllabus.course_learning_outcomes.slice(0, 5).join(' ').slice(0, 600)}. `;
            }
            
            // Course description from syllabus if available
            if (syllabus.course_description) {
                syllabusContent += syllabus.course_description.slice(0, 400) + '. ';
            }
        }
    } catch {
    }

    // Include textbooks for domain context
    let textbooks = '';
    try {
        if (course.main_textbooks) {
            const books = typeof course.main_textbooks === 'string' 
                ? JSON.parse(course.main_textbooks) 
                : course.main_textbooks || [];
            if (Array.isArray(books) && books.length > 0) {
                textbooks = `Textbooks: ${books.slice(0, 3).join(', ')}. `;
            }
        }
    } catch {
    }

    // Build structured representation with weighted importance
    const parts = [
        // High priority: title and description
        course.title,
        course.description,
        
        // Medium priority: syllabus content
        syllabusContent,
        
        // High priority: key topics (these are important for matching)
        keyTopics.length > 0 ? `Key topics: ${keyTopics.join(', ')}` : '',
        
        // Medium priority: tags
        tags.length > 0 ? `Topics: ${tags.join(', ')}` : '',
        
        // Context: level and major
        course.level ? `Level: ${course.level}` : '',
        course.major ? `Major: ${course.major}` : '',
        
        // Context: textbooks
        textbooks,
        
        // Difficulty context (if available)
        course.difficulty ? `Difficulty level: ${course.difficulty}` : ''
    ].filter(Boolean);

    // Increase limit and use smarter truncation
    const fullText = parts.join('. ');
    
    // Prioritize keeping important parts (title, description, key topics)
    if (fullText.length > 3000) {
        const importantParts = [
            course.title,
            course.description,
            keyTopics.length > 0 ? `Key topics: ${keyTopics.join(', ')}` : '',
            syllabusContent.slice(0, 800)
        ].filter(Boolean).join('. ');
        
        return importantParts.slice(0, 3000);
    }
    
    return fullText;
}

export function buildQueryText(
    bio: string, 
    career: string, 
    pastCourses: string,
    pastCourseTitles?: string[] // Add this if you can fetch past course titles
): string {
    const parts = [];
    
    // Weighted query construction
    if (bio) {
        parts.push(`Student interests and background: ${bio}`);
    }
    
    if (career) {
        parts.push(`Career goals and aspirations: ${career}`);
    }
    
    // Enhanced past courses context
    if (pastCourses) {
        if (pastCourseTitles && pastCourseTitles.length > 0) {
            parts.push(`Previously taken courses: ${pastCourseTitles.join(', ')}. This indicates background in: ${pastCourses}`);
        } else {
            parts.push(`Academic background includes: ${pastCourses}`);
        }
    }
    
    // Add implicit preferences based on past courses
    if (pastCourses && !bio && !career) {
        parts.push(`Looking for courses that build upon this background`);
    }
    
    return parts.join('. ');
}

// Add synonyms/related terms for better matching
function expandQuery(queryText: string): string {
    // Simple expansion - you could use a thesaurus or LLM for this
    const expansions: Record<string, string[]> = {
        'machine learning': ['ML', 'artificial intelligence', 'AI', 'neural networks'],
        'data science': ['data analysis', 'statistics', 'analytics'],
        // Add more as needed
    };
    
    let expanded = queryText;
    for (const [term, synonyms] of Object.entries(expansions)) {
        if (queryText.toLowerCase().includes(term)) {
            expanded += '. ' + synonyms.join(', ');
        }
    }
    
    return expanded;
}
