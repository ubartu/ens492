import { NextResponse } from 'next/server';
import { Course } from '@/lib/db';
import { generateEmbedding, buildQueryText } from '@/lib/embeddings';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

function normalizeVectorScore(
    rawScore: number,
    minScore: number,
    maxScore: number
): number {
    const range = maxScore - minScore;
    if (range < 0.001) return 0.75;
    
    const normalized = (rawScore - minScore) / range;
    
    const MIN_DISPLAY = 0.45;
    const MAX_DISPLAY = 0.95;
    
    return MIN_DISPLAY + (normalized * (MAX_DISPLAY - MIN_DISPLAY));
}

function calculateMatchScore(
    normalizedScore: number,
    course: Course,
    queryKeywords: string[],
    pastCourseIds: Set<string>
): number {
    const tags = typeof course.tags === 'string' 
        ? JSON.parse(course.tags || '[]') 
        : course.tags || [];
    
    let keywordBoost = 0;
    const searchableText = `${course.title} ${course.description} ${tags.join(' ')}`.toLowerCase();
    
    for (const keyword of queryKeywords) {
        if (searchableText.includes(keyword)) {
            keywordBoost += 0.02;
        }
    }
    keywordBoost = Math.min(keywordBoost, 0.08);

    let prereqBoost = 0;
    if (course.prerequisites) {
        const prereqs = typeof course.prerequisites === 'string' 
            ? JSON.parse(course.prerequisites || '[]') 
            : course.prerequisites || [];
        
        const matchedPrereqs = prereqs.filter((p: string) => pastCourseIds.has(p.toUpperCase()));
        if (matchedPrereqs.length > 0) {
            prereqBoost = Math.min(matchedPrereqs.length * 0.03, 0.06);
        }
    }

    const combinedScore = normalizedScore + keywordBoost + prereqBoost;
    
    return Math.min(0.98, Math.max(0.40, combinedScore));
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
        const { bio, career, pastCourses, limit, offset } = await request.json();

        const { env } = getRequestContext();
        const db = env.DB;
        const ai = env.AI;
        const vectorize = env.VECTORIZE;

        const { results } = await db.prepare('SELECT id, title, description, tags, su_credits, credits, level, major, schedule, sections, professor, location, video_url, prerequisites, corequisites, syllabus_text, difficulty, has_project, has_quizzes, has_participation, midterm_count FROM courses ORDER BY id').all();
        const allCourses = results as Course[];

        const courseMap = new Map(allCourses.map(c => [c.id, c]));

        const pastCourseIdsSet = new Set<string>(
            pastCourses
                ? pastCourses.split(',').map((id: string) => id.trim().toUpperCase()).filter(Boolean)
                : []
        );

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
        const minRawScore = Math.min(...rawScores);
        const maxRawScore = Math.max(...rawScores);

        const scoredCourses: (Course & { score: number })[] = [];
        
        for (const match of vectorResults.matches) {
            const course = courseMap.get(match.id);
            if (!course) continue;
            if (pastCourseIdsSet.has(course.id.toUpperCase())) continue;

            const normalizedScore = normalizeVectorScore(match.score, minRawScore, maxRawScore);
            
            const finalScore = calculateMatchScore(
                normalizedScore,
                course,
                queryKeywords,
                pastCourseIdsSet
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
