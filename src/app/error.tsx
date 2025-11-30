'use client';

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    return (
        <div className="app-container">
            <div className="bento-card" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
                <h2 style={{ marginBottom: '1rem', color: 'var(--text-main)' }}>Something went wrong!</h2>
                <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', lineHeight: 1.6 }}>
                    {error.message || 'An unexpected error occurred. Please try again.'}
                </p>
                <button
                    onClick={reset}
                    className="btn-primary"
                    style={{ maxWidth: '200px', margin: '0 auto' }}
                >
                    Try Again
                </button>
            </div>
        </div>
    );
}
