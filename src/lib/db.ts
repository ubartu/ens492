import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

export async function getDb() {
    const ctx = getRequestContext();
    return ctx.env.DB;
}

export interface Course {
    id: string;
    title: string;
    professor: string;
    location: string;
    description: string;
    level: string;
    credits: number;
    su_credits?: number;
    ects_credits?: number;
    basic_science_credits?: number;
    engineering_credits?: number;
    major: string;
    tags: string;
    key_topics: string;
    has_project: number;
    has_quizzes: number;
    has_participation: number;
    midterm_count: number;
    schedule?: string;
    sections?: string;
    prerequisites?: string;
    corequisites?: string;
    video_url?: string;
    main_textbooks: string;
    syllabus_text: string;
    difficulty: string;
    score?: number;
}
