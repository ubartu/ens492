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

interface Props {
    params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Props) {
    const { env } = getRequestContext();
    
    if (!verifyAuth(request, env.ADMIN_USERNAME, env.ADMIN_PASSWORD)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { id } = await params;
        const db = env.DB;
        
        const { results } = await db.prepare('SELECT * FROM courses WHERE id = ?').bind(decodeURIComponent(id)).all();
        
        if (results.length === 0) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }
        
        return NextResponse.json({ course: results[0] });
    } catch (error) {
        console.error('Error fetching course:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

