import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

const ALLOWED_DOMAINS = [
    'dropbox.com',
    'www.dropbox.com',
    'dl.dropboxusercontent.com',
    'drive.google.com',
    'docs.google.com',
];

function isValidDocumentUrl(url: string): boolean {
    try {
        const parsed = new URL(url);
        return ALLOWED_DOMAINS.some(domain => parsed.hostname.endsWith(domain));
    } catch {
        return false;
    }
}

function detectSource(url: string): string {
    if (url.includes('dropbox.com') || url.includes('dropboxusercontent.com')) return 'dropbox';
    if (url.includes('drive.google.com') || url.includes('docs.google.com')) return 'google_drive';
    return 'other';
}

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
            `SELECT id, author_name, title, description, document_url, document_type, 
             source, semester, note_type, created_at 
             FROM notes WHERE course_id = ? AND status = ? ORDER BY created_at DESC`
        ).bind(courseId, 'approved').all();
        
        return NextResponse.json({ notes: results });
    } catch (error) {
        console.error('Error fetching notes:', error);
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
            title,
            description,
            documentUrl,
            documentType,
            semester,
            noteType
        } = body;
        
        if (!courseId || !authorName || !title || !documentUrl) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }
        
        if (authorName.length > 100) {
            return NextResponse.json({ error: 'Name too long' }, { status: 400 });
        }
        
        if (title.length > 200) {
            return NextResponse.json({ error: 'Title too long' }, { status: 400 });
        }
        
        if (description && description.length > 1000) {
            return NextResponse.json({ error: 'Description too long' }, { status: 400 });
        }
        
        if (!isValidDocumentUrl(documentUrl)) {
            return NextResponse.json({ 
                error: 'Invalid document URL. Please use Dropbox or Google Drive links.' 
            }, { status: 400 });
        }
        
        const validDocTypes = ['pdf', 'doc', 'docx', 'slides', 'other'];
        const validNoteTypes = ['lecture_notes', 'study_guide', 'cheat_sheet', 'past_exam', 'summary', 'other'];
        
        if (documentType && !validDocTypes.includes(documentType)) {
            return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
        }
        
        if (noteType && !validNoteTypes.includes(noteType)) {
            return NextResponse.json({ error: 'Invalid note type' }, { status: 400 });
        }
        
        const source = detectSource(documentUrl);
        
        await db.prepare(
            `INSERT INTO notes (course_id, author_name, title, description, document_url, 
             document_type, source, semester, note_type, status) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
            courseId, 
            authorName.trim(), 
            title.trim(),
            description?.trim() || null,
            documentUrl.trim(),
            documentType || 'other',
            source,
            semester || null,
            noteType || 'other',
            'pending'
        ).run();
        
        return NextResponse.json({ 
            success: true, 
            message: 'Note submitted for approval' 
        });
    } catch (error) {
        console.error('Error creating note:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

