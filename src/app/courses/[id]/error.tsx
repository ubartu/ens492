'use client';

import Link from 'next/link';

export default function Error({
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="app-container">
            <div className="bento-card" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📚</div>
                <h2 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>Course Not Found</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
                    We couldn&apos;t load this course. It may have been removed or the link is incorrect.
                </p>
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link href="/" style={{ textDecoration: 'none' }}>
                        <button className="btn-primary" style={{ width: 'auto', padding: '0.875rem 1.5rem' }}>
                            Back to Home
                        </button>
                    </Link>
                    <button
                        onClick={reset}
                        style={{
                            padding: '0.875rem 1.5rem',
                            borderRadius: 'var(--radius-lg)',
                            border: '1.5px solid var(--border-subtle)',
                            background: 'var(--surface)',
                            color: 'var(--text-main)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                        }}
                    >
                        Try Again
                    </button>
                </div>
            </div>
        </div>
    );
}
