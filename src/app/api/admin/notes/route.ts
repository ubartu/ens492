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
        const status = url.searchParams.get('status') || 'pending';
        
        const { results } = await db.prepare(
            `SELECT n.*, courses.title as course_title 
             FROM notes n 
             LEFT JOIN courses ON n.course_id = courses.id 
             WHERE n.status = ? 
             ORDER BY n.created_at DESC`
        ).bind(status).all();
        
        return NextResponse.json({ notes: results });
    } catch (error) {
        console.error('Error fetching notes:', error);
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
        
        const { id, status } = await request.json();
        
        if (!id || !['approved', 'rejected'].includes(status)) {
            return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
        }
        
        await db.prepare(
            "UPDATE notes SET status = ?, updated_at = datetime('now') WHERE id = ?"
        ).bind(status, id).run();
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating note:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    const { env } = getRequestContext();
    
    if (!verifyAuth(request, env.ADMIN_USERNAME, env.ADMIN_PASSWORD)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = env.DB;
        
        const url = new URL(request.url);
        const id = url.searchParams.get('id');
        
        if (!id) {
            return NextResponse.json({ error: 'Note ID required' }, { status: 400 });
        }
        
        await db.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting note:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

