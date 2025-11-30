import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

function verifyAuth(request: Request, adminUsername: string, adminPassword: string): boolean {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return false;
    
    try {
        const token = authHeader.slice(7);
        const decoded = atob(token);
        const [user, , pass] = decoded.split(':');
        return user === adminUsername && pass === adminPassword;
    } catch {
        return false;
    }
}

export async function GET(request: Request) {
    const { env } = getRequestContext();
    
    if (!verifyAuth(request, env.ADMIN_USERNAME, env.ADMIN_PASSWORD)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = env.DB;
        
        const url = new URL(request.url);
        const search = url.searchParams.get('search') || '';
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const offset = parseInt(url.searchParams.get('offset') || '0');
        
        let query = 'SELECT id, title, professor, location, schedule, sections, su_credits, level, major FROM courses';
        const params: string[] = [];
        
        if (search) {
            query += ' WHERE id LIKE ? OR title LIKE ?';
            params.push(`%${search}%`, `%${search}%`);
        }
        
        query += ' ORDER BY id LIMIT ? OFFSET ?';
        params.push(String(limit), String(offset));
        
        const { results } = await db.prepare(query).bind(...params).all();
        
        const countQuery = search 
            ? 'SELECT COUNT(*) as total FROM courses WHERE id LIKE ? OR title LIKE ?'
            : 'SELECT COUNT(*) as total FROM courses';
        
        const countParams = search ? [`%${search}%`, `%${search}%`] : [];
        const { results: countResults } = await db.prepare(countQuery).bind(...countParams).all();
        const total = (countResults[0] as any)?.total || 0;
        
        return NextResponse.json({ courses: results, total });
    } catch (error) {
        console.error('Error fetching courses:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    const { env } = getRequestContext();
    
    if (!verifyAuth(request, env.ADMIN_USERNAME, env.ADMIN_PASSWORD)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = env.DB;
        
        const { id, ...updates } = await request.json();
        
        if (!id) {
            return NextResponse.json({ error: 'Course ID required' }, { status: 400 });
        }
        
        const allowedFields = [
            'title', 'description', 'professor', 'location', 'level', 'major',
            'credits', 'su_credits', 'ects_credits', 'basic_science_credits', 'engineering_credits',
            'schedule', 'sections', 'prerequisites', 'corequisites',
            'tags', 'key_topics', 'main_textbooks', 'syllabus_text', 'difficulty',
            'midterm_count', 'has_project', 'has_quizzes', 'has_participation', 'video_url'
        ];
        const setClause: string[] = [];
        const values: any[] = [];
        
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                setClause.push(`${key} = ?`);
                values.push(typeof value === 'object' ? JSON.stringify(value) : value);
            }
        }
        
        if (setClause.length === 0) {
            return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }
        
        values.push(id);
        
        await db.prepare(`UPDATE courses SET ${setClause.join(', ')} WHERE id = ?`).bind(...values).run();
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating course:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

