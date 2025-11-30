import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function GET(request: Request) {
    try {
        const { env } = getRequestContext();
        const db = env.DB;
        
        const url = new URL(request.url);
        const courseId = url.searchParams.get('courseId');
        
        if (!courseId) {
            return NextResponse.json({ error: 'Course ID required' }, { status: 400 });
        }
        
        const { results } = await db.prepare(
            `SELECT id, author_name, content, overall_rating, difficulty_rating, 
             workload_rating, usefulness_rating, grade_received, semester_taken, 
             would_recommend, created_at 
             FROM reviews WHERE course_id = ? AND status = ? ORDER BY created_at DESC`
        ).bind(courseId, 'approved').all();
        
        return NextResponse.json({ reviews: results });
    } catch (error) {
        console.error('Error fetching reviews:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { env } = getRequestContext();
        const db = env.DB;
        
        const body = await request.json();
        const { 
            courseId, 
            authorName, 
            content, 
            overallRating,
            difficultyRating,
            workloadRating,
            usefulnessRating,
            gradeReceived,
            semesterTaken,
            wouldRecommend
        } = body;
        
        if (!courseId || !authorName || !content) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        if (authorName.length > 100) {
            return NextResponse.json({ error: 'Name too long' }, { status: 400 });
        }
        
        if (content.length > 3000) {
            return NextResponse.json({ error: 'Review too long (max 3000 characters)' }, { status: 400 });
        }
        
        const validateRating = (r: number | null) => !r || (r >= 1 && r <= 5);
        if (!validateRating(overallRating) || !validateRating(difficultyRating) || 
            !validateRating(workloadRating) || !validateRating(usefulnessRating)) {
            return NextResponse.json({ error: 'Ratings must be between 1 and 5' }, { status: 400 });
        }
        
        await db.prepare(
            `INSERT INTO reviews (course_id, author_name, content, overall_rating, 
             difficulty_rating, workload_rating, usefulness_rating, grade_received, 
             semester_taken, would_recommend, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            courseId, 
            authorName.trim(), 
            content.trim(), 
            overallRating || null,
            difficultyRating || null,
            workloadRating || null,
            usefulnessRating || null,
            gradeReceived || null,
            semesterTaken || null,
            wouldRecommend !== undefined ? (wouldRecommend ? 1 : 0) : null,
            'pending'
        ).run();
        
        return NextResponse.json({ 
            success: true, 
            message: 'Review submitted for approval' 
        });
    } catch (error) {
        console.error('Error creating review:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

