import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Data() {
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState(null);

    const loadData = async () => {
        setLoading(true);
        const params = { page: 1, limit: 50 };
        if (search) params.search = search;
        const res = await api.getData(params);
        setData(res.data || []);
        setLoading(false);
    };

    useEffect(() => { loadData(); }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        loadData();
    };

    const viewDetail = async (id) => {
        const res = await api.getDataItem(id);
        setSelected(res.data);
    };

    const handleExport = async (format) => {
        const res = await api.exportData(format);
        if (format === 'json') {
            const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `scraper-export-${Date.now()}.json`;
            a.click();
        }
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1>Scraped Data</h1>
                <div className="header-actions">
                    <form onSubmit={handleSearch} className="search-form">
                        <input
                            type="text"
                            placeholder="Search data..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="search-input"
                        />
                        <button type="submit" className="btn btn-sm btn-primary">Search</button>
                    </form>
                    <button className="btn btn-sm btn-ghost" onClick={() => handleExport('json')}>📤 Export JSON</button>
                </div>
            </div>

            {selected && (
                <div className="modal-overlay" onClick={() => setSelected(null)}>
                    <div className="modal-card" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{selected.title || selected.url}</h3>
                            <button className="btn btn-sm btn-ghost" onClick={() => setSelected(null)}>✕</button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-row"><strong>URL:</strong> <a href={selected.url} target="_blank">{selected.url}</a></div>
                            <div className="detail-row"><strong>Status:</strong> <span className={`badge ${selected.status === 'success' ? 'badge-green' : 'badge-red'}`}>{selected.status}</span></div>
                            <div className="detail-row"><strong>Hash:</strong> <code>{selected.content_hash}</code></div>
                            <div className="detail-row"><strong>Changes:</strong> {selected.has_changes ? '🔔 Yes' : 'No'}</div>
                            {selected.extracted_data && (
                                <div className="detail-section">
                                    <strong>Extracted Data:</strong>
                                    <pre className="json-block">{JSON.stringify(JSON.parse(selected.extracted_data || '{}'), null, 2)}</pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {loading ? (
                <div className="page-loading">Loading data...</div>
            ) : data.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-icon">🗃️</span>
                    <p>No data yet. Run a scrape job first.</p>
                </div>
            ) : (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>URL</th>
                                <th>Title</th>
                                <th>Status</th>
                                <th>Changes</th>
                                <th>Created</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map(d => (
                                <tr key={d.id}>
                                    <td>{d.id}</td>
                                    <td className="td-url"><a href={d.url} target="_blank" rel="noopener">{new URL(d.url).hostname}</a></td>
                                    <td className="td-name">{d.title || '—'}</td>
                                    <td><span className={`badge ${d.status === 'success' ? 'badge-green' : 'badge-red'}`}>{d.status}</span></td>
                                    <td>{d.has_changes ? '🔔' : '—'}</td>
                                    <td>{new Date(d.created_at).toLocaleString()}</td>
                                    <td><button className="btn btn-sm btn-ghost" onClick={() => viewDetail(d.id)}>👁️</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
