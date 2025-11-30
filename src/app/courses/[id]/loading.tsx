export default function Loading() {
    return (
        <div className="app-container">
            {/* Sidebar Skeleton */}
            <div className="bento-card" style={{ height: 'fit-content', position: 'sticky', top: '2rem' }}>
                <div className="skeleton skeleton-text" style={{ width: '30%', height: '0.875rem', marginBottom: '1.5rem' }}></div>

                <div className="skeleton skeleton-title" style={{ width: '90%', height: '2rem', marginBottom: '1rem' }}></div>

                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                    <div className="skeleton skeleton-badge" style={{ width: '60px', height: '24px' }}></div>
                    <div className="skeleton skeleton-badge" style={{ width: '80px', height: '24px' }}></div>
                    <div className="skeleton skeleton-badge" style={{ width: '70px', height: '24px' }}></div>
                </div>

                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    <div>
                        <div className="skeleton skeleton-label" style={{ width: '40%', height: '0.75rem', marginBottom: '0.5rem' }}></div>
                        <div className="skeleton skeleton-text" style={{ width: '70%', height: '1rem' }}></div>
                    </div>
                    <div>
                        <div className="skeleton skeleton-label" style={{ width: '35%', height: '0.75rem', marginBottom: '0.5rem' }}></div>
                        <div className="skeleton skeleton-text" style={{ width: '80%', height: '1rem' }}></div>
                    </div>
                </div>
            </div>

            {/* Main Content Skeleton */}
            <div style={{ display: 'grid', gap: '2rem' }}>
                <div className="bento-card">
                    <div className="skeleton skeleton-heading" style={{ width: '40%', height: '1.5rem', marginBottom: '1rem' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '100%', height: '1rem', marginBottom: '0.5rem' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '95%', height: '1rem', marginBottom: '0.5rem' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '85%', height: '1rem' }}></div>
                </div>

                <div className="bento-card">
                    <div className="skeleton skeleton-heading" style={{ width: '50%', height: '1.5rem', marginBottom: '1.5rem' }}></div>
                    <div className="skeleton skeleton-text" style={{ width: '100%', height: '200px' }}></div>
                </div>
            </div>
        </div>
    );
}
