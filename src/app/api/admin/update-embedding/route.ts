import { NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';
import { generateEmbedding, buildCourseText } from '@/lib/embeddings';

export const runtime = 'edge';

export async function POST(request: Request) {
    try {
        const { courseId } = await request.json();

        if (!courseId) {
            return NextResponse.json({ error: 'Missing courseId' }, { status: 400 });
        }

        const { env } = getRequestContext();
        const db = env.DB;
        const ai = env.AI;
        const vectorize = env.VECTORIZE;

        const { results } = await db.prepare('SELECT * FROM courses WHERE id = ?').bind(courseId).all();
        const course: any = results[0];

        if (!course) {
            return NextResponse.json({ error: 'Course not found' }, { status: 404 });
        }

        const text = buildCourseText(course);
        const embedding = await generateEmbedding(text, ai);

        await vectorize.upsert([{
            id: courseId,
            values: embedding,
            metadata: {
                title: course.title,
            }
        }]);

        return NextResponse.json({ success: true, courseId, textLength: text.length });

    } catch (error) {
        console.error('Error updating embedding:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
