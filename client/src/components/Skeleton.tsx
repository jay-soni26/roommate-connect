import React from 'react';

export const Skeleton: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => {
    return <div className={`skeleton ${className || ''}`} style={style} />;
};

export const RoomSkeleton: React.FC = () => {
    return (
        <div className="glass-panel" style={{ padding: '0', overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Skeleton className="skeleton-rect" style={{ height: '230px' }} />
            <div style={{ padding: '1.5rem', flexGrow: 1 }}>
                <Skeleton className="skeleton-text" style={{ width: '80%', height: '1.5rem', marginBottom: '1rem' }} />
                <Skeleton className="skeleton-text" style={{ width: '40%', marginBottom: '1.5rem' }} />
                <Skeleton className="skeleton-text" style={{ width: '60%', height: '2rem', marginBottom: '1.2rem' }} />
                <Skeleton className="skeleton-text" style={{ height: '3rem', borderRadius: '12px' }} />
            </div>
        </div>
    );
};
