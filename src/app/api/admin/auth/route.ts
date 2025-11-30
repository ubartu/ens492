import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function POST(request: Request) {
    try {
        const { env } = getRequestContext();
        const ADMIN_USERNAME = env.ADMIN_USERNAME;
        const ADMIN_PASSWORD = env.ADMIN_PASSWORD;
        
        if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
            console.error('Admin credentials not configured');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        
        const { username, password } = await request.json();
        
        if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
            const token = btoa(`${ADMIN_USERNAME}:${Date.now()}:${ADMIN_PASSWORD}`);
            return NextResponse.json({ 
                success: true, 
                token 
            });
        }
        
        return NextResponse.json({ 
            success: false, 
            error: 'Invalid credentials' 
        }, { status: 401 });
    } catch {
        return NextResponse.json({ 
            error: 'Internal Server Error' 
        }, { status: 500 });
    }
}

export async function GET(request: Request) {
    const { env } = getRequestContext();
    const ADMIN_USERNAME = env.ADMIN_USERNAME;
    const ADMIN_PASSWORD = env.ADMIN_PASSWORD;
    
    if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    
    try {
        const token = authHeader.slice(7);
        const decoded = atob(token);
        const [user, , pass] = decoded.split(':');
        
        if (user === ADMIN_USERNAME && pass === ADMIN_PASSWORD) {
            return NextResponse.json({ authenticated: true });
        }
    } catch {
        // Invalid token
    }
    
    return NextResponse.json({ authenticated: false }, { status: 401 });
}

