import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Dashboard() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.stats().then(data => { setStats(data); setLoading(false); });
    }, []);

    if (loading) return <div className="page-loading">Loading...</div>;

    const cards = [
        { label: 'Active Targets', value: stats?.active_targets || 0, icon: '🎯', color: '#818cf8' },
        { label: 'Total Jobs', value: stats?.total_jobs || 0, icon: '⚡', color: '#34d399' },
        { label: 'Jobs Today', value: stats?.jobs_today || 0, icon: '📊', color: '#fbbf24' },
        { label: 'Data Records', value: stats?.total_data || 0, icon: '🗃️', color: '#f472b6' },
        { label: 'Changes Detected', value: stats?.total_changes || 0, icon: '🔔', color: '#fb923c' },
    ];

    return (
        <div className="page">
            <div className="page-header">
                <h1>Dashboard</h1>
                <p>Ultra Skills — CoreBlow</p>
            </div>

            <div className="stats-grid">
                {cards.map((c, i) => (
                    <div className="stat-card" key={i}>
                        <div className="stat-icon" style={{ background: c.color + '20', color: c.color }}>{c.icon}</div>
                        <div className="stat-info">
                            <div className="stat-value">{c.value.toLocaleString()}</div>
                            <div className="stat-label">{c.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {stats?.last_scrape && (
                <div className="info-bar">
                    Last scrape: <strong>{new Date(stats.last_scrape).toLocaleString()}</strong>
                </div>
            )}

            <div className="quick-actions">
                <h2>Quick Actions</h2>
                <div className="action-grid">
                    <a href="/targets" className="action-card">
                        <span className="action-icon">🎯</span>
                        <span>Add Target</span>
                    </a>
                    <a href="/jobs" className="action-card">
                        <span className="action-icon">⚡</span>
                        <span>View Jobs</span>
                    </a>
                    <a href="/data" className="action-card">
                        <span className="action-icon">📤</span>
                        <span>Export Data</span>
                    </a>
                </div>
            </div>
        </div>
    );
}
