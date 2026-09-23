'use client';

export default function StatCard({
    icon,
    label,
    value,
    change,
    progress,
    subValue,
    children,
    type = 'income'
}) {

    return (
        <div className="stat-card">
            <div className="stat-header">
                <div className={`stat-icon ${type}`}>
                    {icon}
                </div>
                <span className="stat-label">{label}</span>
            </div>
            <div className="stat-value">{value}</div>
            {subValue && <div className="stat-sub-value" style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>{subValue}</div>}
            
            {children && <div className="stat-content" style={{ marginTop: '12px' }}>{children}</div>}

            <div className="stat-progress">
                <div
                    className={`stat-progress-bar ${type}`}
                    style={{ width: `${progress}%` }}
                />
            </div>
            {change && (
                <div className={`stat-change ${String(change).startsWith('-') ? 'negative' : 'positive'}`}>
                    <span>{String(change).startsWith('-') ? '↓' : '↑'}</span>
                    <span>{change}</span>
                </div>
            )}
        </div>
    );
}
