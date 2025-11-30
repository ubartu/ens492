export default function Loading() {
    return (
        <div className="app-container">
            {/* Sidebar Skeleton */}
            <div className="bento-card" style={{ height: 'fit-content' }}>
                <div className="skeleton-header">
                    <div className="skeleton skeleton-title" style={{ width: '60%', height: '2.25rem', marginBottom: '0.5rem' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '80%', height: '1.125rem' }}></div>
                </div>

                <div style={{ marginTop: '2rem' }}>
                    <div className="skeleton skeleton-label" style={{ width: '40%', height: '0.875rem', marginBottom: '0.5rem' }}></div>
                    <div className="skeleton skeleton-input" style={{ width: '100%', height: '6rem' }}></div>

                    <div style={{ marginTop: '1.5rem' }}>
                        <div className="skeleton skeleton-label" style={{ width: '35%', height: '0.875rem', marginBottom: '0.5rem' }}></div>
                        <div className="skeleton skeleton-input" style={{ width: '100%', height: '3rem' }}></div>
                    </div>

                    <div style={{ marginTop: '1.5rem' }}>
                        <div className="skeleton skeleton-label" style={{ width: '45%', height: '0.875rem', marginBottom: '0.5rem' }}></div>
                        <div className="skeleton skeleton-input" style={{ width: '100%', height: '3rem' }}></div>
                    </div>

                    <div className="skeleton skeleton-button" style={{ width: '100%', height: '3.5rem', marginTop: '1.5rem' }}></div>
                </div>
            </div>

            {/* Results Skeleton */}
            <div>
                <div className="state-container" style={{ minHeight: '400px' }}>
                    <div className="spinner" style={{ width: '40px', height: '40px', borderTopColor: '#4f46e5' }}></div>
                    <p style={{ marginTop: '1rem' }}>Loading courses...</p>
                </div>
            </div>
        </div>
    );
}
