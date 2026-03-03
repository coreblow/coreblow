import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Jobs() {
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');

    const loadJobs = async () => {
        setLoading(true);
        const params = { page: 1, limit: 50 };
        if (filter) params.status = filter;
        const res = await api.getJobs(params);
        setJobs(res.data || []);
        setLoading(false);
    };

    useEffect(() => { loadJobs(); }, [filter]);

    const statusColor = (s) => {
        switch (s) {
            case 'success': return 'badge-green';
            case 'failed': return 'badge-red';
            case 'running': return 'badge-blue';
            case 'pending': return 'badge-yellow';
            case 'cancelled': return 'badge-gray';
            default: return 'badge-gray';
        }
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1>Job Queue</h1>
                <div className="filter-bar">
                    {['', 'pending', 'running', 'success', 'failed'].map(f => (
                        <button key={f} className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setFilter(f)}>
                            {f || 'All'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="page-loading">Loading jobs...</div>
            ) : jobs.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-icon">⚡</span>
                    <p>No jobs {filter ? `with status "${filter}"` : 'yet'}.</p>
                </div>
            ) : (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Job ID</th>
                                <th>Target</th>
                                <th>Status</th>
                                <th>Attempt</th>
                                <th>Duration</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {jobs.map(j => (
                                <tr key={j.id}>
                                    <td><code className="job-id">{j.job_id?.slice(0, 16)}...</code></td>
                                    <td className="td-name">{j.target_name || '—'}</td>
                                    <td><span className={`badge ${statusColor(j.status)}`}>{j.status}</span></td>
                                    <td>{j.attempt}/{j.max_attempts}</td>
                                    <td>{j.duration_ms ? `${(j.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                                    <td>{new Date(j.created_at).toLocaleString()}</td>
                                    <td className="td-actions">
                                        {j.status === 'failed' && (
                                            <button className="btn btn-sm btn-ghost" onClick={async () => { await api.retryJob(j.id); loadJobs(); }} title="Retry">🔄</button>
                                        )}
                                        {(j.status === 'pending' || j.status === 'running') && (
                                            <button className="btn btn-sm btn-ghost btn-danger" onClick={async () => { await api.cancelJob(j.id); loadJobs(); }} title="Cancel">✖</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
