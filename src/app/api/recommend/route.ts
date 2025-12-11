import { NextResponse } from 'next/server';
import { Course } from '@/lib/db';
import { generateEmbedding, buildQueryText } from '@/lib/embeddings';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

function normalizeVectorScore(
    rawScore: number,
    scores: number[] // Pass all scores for percentile calculation
): number {
    // Sort scores for percentile calculation
    const sortedScores = [...scores].sort((a, b) => a - b);
    
    // Calculate correct percentile: count of scores <= rawScore / total
    const countBelowOrEqual = sortedScores.filter(s => s <= rawScore).length;
    const percentile = countBelowOrEqual / sortedScores.length;
    
    // Map to display range with better curve
    const MIN_DISPLAY = 0.40;
    const MAX_DISPLAY = 0.96;
    
    // Use a slight curve to emphasize top matches
    const curvedPercentile = Math.pow(percentile, 0.9); // Slight curve
    
    return MIN_DISPLAY + (curvedPercentile * (MAX_DISPLAY - MIN_DISPLAY));
}

/**
 * Extracts a numeric difficulty score from a course's difficulty field.
 * The difficulty field should be a JSON string containing fields like:
 * - weighted_difficulty_score (preferred, 0-5)
 * - conceptual_depth, reading_intensity, project_complexity, assessments (1-5 each)
 * 
 * Returns the weighted_difficulty_score if available, or average of sub-scores, or null.
 * 
 * Handles edge cases gracefully:
 * - Plain strings (e.g., 'intermediate', 'advanced') → returns null
 * - Invalid JSON → returns null
 * - Missing/null/undefined → returns null
 * - Already parsed objects → works correctly
 */
function extractDifficultyScore(difficulty: string | null | undefined): number | null {
    if (!difficulty) return null;
    
    try {
        // Attempt to parse if it's a string, otherwise use as-is (already an object)
        const diffObj = typeof difficulty === 'string' ? JSON.parse(difficulty) : difficulty;
        
        // Ensure we have an object after parsing
        if (typeof diffObj !== 'object' || diffObj === null || Array.isArray(diffObj)) {
            return null;
        }
        
        // Prefer weighted_difficulty_score if available
        if (typeof diffObj.weighted_difficulty_score === 'number') {
            return diffObj.weighted_difficulty_score;
        }
        
        // Otherwise, calculate average of available sub-scores
        const scores: number[] = [];
        if (typeof diffObj.conceptual_depth === 'number') scores.push(diffObj.conceptual_depth);
        if (typeof diffObj.reading_intensity === 'number') scores.push(diffObj.reading_intensity);
        if (typeof diffObj.project_complexity === 'number') scores.push(diffObj.project_complexity);
        if (typeof diffObj.assessments === 'number') scores.push(diffObj.assessments);
        
        if (scores.length > 0) {
            return scores.reduce((sum, score) => sum + score, 0) / scores.length;
        }
        
        return null;
    } catch {
        return null;
    }
}

function calculateMatchScore(
    normalizedScore: number,
    course: Course,
    queryKeywords: string[],
    pastCourseIds: Set<string>,
    userLevel?: string,
    userMajor?: string,
    userAverageDifficulty?: number | null // Average difficulty of user's past courses
): number {
    const tags = typeof course.tags === 'string' 
        ? JSON.parse(course.tags || '[]') 
        : course.tags || [];
    
    let keyTopics: string[] = [];
    try {
        keyTopics = typeof course.key_topics === 'string' 
            ? JSON.parse(course.key_topics || '[]') 
            : course.key_topics || [];
    } catch {
        keyTopics = [];
    }
    
    // Enhanced keyword matching with better scoring
    let keywordBoost = 0;
    const searchableText = `${course.title} ${course.description} ${tags.join(' ')} ${keyTopics.join(' ')}`.toLowerCase();
    
    for (const keyword of queryKeywords) {
        if (searchableText.includes(keyword)) {
            // Weight matches in title/description higher
            if (course.title.toLowerCase().includes(keyword) || 
                course.description.toLowerCase().includes(keyword)) {
                keywordBoost += 0.03; // Higher weight for title/description matches
            } else {
                keywordBoost += 0.015; // Lower weight for tag/topic matches
            }
        }
    }
    // Cap keyword boost but allow more if many matches
    keywordBoost = Math.min(keywordBoost, 0.12);
    
    // Enhanced prerequisite matching
    let prereqBoost = 0;
    if (course.prerequisites) {
        const prereqs = typeof course.prerequisites === 'string' 
            ? JSON.parse(course.prerequisites || '[]') 
            : course.prerequisites || [];
        
        const matchedPrereqs = prereqs.filter((p: string) => pastCourseIds.has(p.toUpperCase()));
        if (matchedPrereqs.length > 0) {
            // Boost more if user has ALL prerequisites
            if (matchedPrereqs.length === prereqs.length) {
                prereqBoost = 0.10; // Full prerequisite match
            } else {
                prereqBoost = Math.min(matchedPrereqs.length * 0.04, 0.08); // Partial match
            }
        } else if (prereqs.length === 0) {
            // Bonus for courses with no prerequisites (accessible)
            prereqBoost = 0.02;
        }
    }
    
    // Level appropriateness boost
    let levelBoost = 0;
    if (userLevel && course.level) {
        const levelMatch = userLevel.toLowerCase() === course.level.toLowerCase();
        if (levelMatch) {
            levelBoost = 0.05; // Boost for appropriate level
        } else if (userLevel.toLowerCase() === 'graduate' && course.level.toLowerCase() === 'undergraduate') {
            levelBoost = -0.05; // Penalty for grad student taking undergrad course
        }
    }
    
    // Major alignment boost
    let majorBoost = 0;
    if (userMajor && course.major) {
        if (userMajor.toUpperCase() === course.major.toUpperCase()) {
            majorBoost = 0.08; // Strong boost for major courses
        }
    }
    
    // Difficulty appropriateness based on user's past course experience
    let difficultyBoost = 0;
    if (course.difficulty && userAverageDifficulty !== null && userAverageDifficulty !== undefined) {
        const courseDifficulty = extractDifficultyScore(course.difficulty);
        
        if (courseDifficulty !== null) {
            const difficultyDiff = courseDifficulty - userAverageDifficulty;
            
            // Boost courses that are at or slightly above user's level (encourages growth)
            // Penalize courses that are too far above or below
            if (Math.abs(difficultyDiff) < 0.5) {
                // Very close match (within 0.5, not including 0.5) - small boost
                difficultyBoost = 0.03;
            } else if (difficultyDiff >= 0.5 && difficultyDiff < 1.0) {
                // Slightly harder (0.5 to <1.0 above) - moderate boost (encourages challenge)
                difficultyBoost = 0.04;
            } else if (difficultyDiff >= 1.0 && difficultyDiff <= 1.5) {
                // Moderately harder (1.0-1.5 above) - small boost (still manageable)
                difficultyBoost = 0.02;
            } else if (difficultyDiff > 1.5) {
                // Too hard (more than 1.5 above) - small penalty
                difficultyBoost = -0.03;
            } else if (difficultyDiff <= -0.5 && difficultyDiff >= -1.0) {
                // Slightly easier (0.5-1.0 below) - neutral (no boost/penalty)
                difficultyBoost = 0;
            } else if (difficultyDiff < -1.0) {
                // Too easy (more than 1.0 below) - small penalty
                difficultyBoost = -0.02;
            }
        }
    }
    
    // Combine all boosts
    const combinedScore = normalizedScore + keywordBoost + prereqBoost + levelBoost + majorBoost + difficultyBoost;
    
    // Use a sigmoid-like function for better score distribution
    // This prevents scores from clustering too much
    const finalScore = Math.min(0.98, Math.max(0.35, combinedScore));
    
    return finalScore;
}

function extractKeywords(text: string): string[] {
    const stopWords = new Set([
        'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'you', 'your', 'he', 'him',
        'she', 'her', 'it', 'its', 'they', 'them', 'what', 'which', 'who', 'whom',
        'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be',
        'been', 'being', 'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
        'a', 'an', 'the', 'and', 'but', 'if', 'or', 'because', 'as', 'until', 'while',
        'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into',
        'through', 'during', 'before', 'after', 'above', 'below', 'to', 'from',
        'up', 'down', 'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further',
        'then', 'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'each',
        'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only',
        'own', 'same', 'so', 'than', 'too', 'very', 's', 't', 'can', 'will', 'just',
        'don', 'should', 'now', 'want', 'like', 'would', 'could', 'also', 'get',
        'work', 'working', 'interested', 'interest', 'learn', 'learning', 'study',
        'studying', 'course', 'courses', 'class', 'classes', 'take', 'taken', 'took'
    ]);
    
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 2 && !stopWords.has(word));
}

export async function POST(request: Request) {
    try {
        const { bio, career, pastCourses, limit, offset, userLevel, userMajor } = await request.json();

        const { env } = getRequestContext();
        const db = env.DB;
        const ai = env.AI;
        const vectorize = env.VECTORIZE;

        const { results } = await db.prepare('SELECT id, title, description, tags, su_credits, credits, level, major, schedule, sections, professor, location, video_url, prerequisites, corequisites, syllabus_text, difficulty, has_project, has_quizzes, has_participation, midterm_count, key_topics FROM courses ORDER BY id').all();
        const allCourses = results as Course[];

        const courseMap = new Map(allCourses.map(c => [c.id, c]));

        const pastCourseIdsSet = new Set<string>(
            pastCourses
                ? pastCourses.split(',').map((id: string) => id.trim().toUpperCase()).filter(Boolean)
                : []
        );

        // Calculate user's average difficulty from past courses
        let userAverageDifficulty: number | null = null;
        if (pastCourseIdsSet.size > 0) {
            const pastCourseDifficulties: number[] = [];
            for (const courseId of pastCourseIdsSet) {
                const pastCourse = courseMap.get(courseId);
                if (pastCourse && pastCourse.difficulty) {
                    const diffScore = extractDifficultyScore(pastCourse.difficulty);
                    if (diffScore !== null) {
                        pastCourseDifficulties.push(diffScore);
                    }
                }
            }
            if (pastCourseDifficulties.length > 0) {
                userAverageDifficulty = pastCourseDifficulties.reduce((sum, score) => sum + score, 0) / pastCourseDifficulties.length;
            }
        }

        if (!bio && !career && pastCourseIdsSet.size === 0) {
            const coursesWithScore = allCourses.map((course) => ({
                ...course,
                tags: typeof course.tags === 'string' ? JSON.parse(course.tags) : course.tags,
                score: 0,
            }));

            const filteredCourses = coursesWithScore.filter(
                course => !pastCourseIdsSet.has(course.id.toUpperCase())
            );
            
            const paginatedCourses = limit 
                ? filteredCourses.slice(offset || 0, (offset || 0) + limit) 
                : filteredCourses;
            
            return NextResponse.json({ courses: paginatedCourses, total: filteredCourses.length });
        }

        const queryText = buildQueryText(bio || '', career || '', pastCourses || '');
        const queryKeywords = extractKeywords(`${bio || ''} ${career || ''}`);
        const queryEmbedding = await generateEmbedding(queryText, ai);

        const vectorResults = await vectorize.query(queryEmbedding, {
            topK: 100,
            returnMetadata: 'indexed',
            returnValues: false,
        });

        const rawScores = vectorResults.matches.map((m: { score: number }) => m.score);

        const scoredCourses: (Course & { score: number })[] = [];
        
        for (const match of vectorResults.matches) {
            const course = courseMap.get(match.id);
            if (!course) continue;
            if (pastCourseIdsSet.has(course.id.toUpperCase())) continue;

            const normalizedScore = normalizeVectorScore(match.score, rawScores);
            
            const finalScore = calculateMatchScore(
                normalizedScore,
                course,
                queryKeywords,
                pastCourseIdsSet,
                userLevel,
                userMajor,
                userAverageDifficulty
            );

            scoredCourses.push({
                ...course,
                tags: typeof course.tags === 'string' ? JSON.parse(course.tags) : course.tags,
                score: finalScore,
            });
        }

        scoredCourses.sort((a, b) => b.score - a.score);

        const paginatedCourses = limit 
            ? scoredCourses.slice(offset || 0, (offset || 0) + limit) 
            : scoredCourses;

        return NextResponse.json({ courses: paginatedCourses, total: scoredCourses.length });
    } catch (error) {
        console.error('Error generating recommendations:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
