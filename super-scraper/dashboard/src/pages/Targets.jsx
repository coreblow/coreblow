import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Targets() {
    const [targets, setTargets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ name: '', url: '', selectors: '{}', schedule: '0 */6 * * *' });
    const [editId, setEditId] = useState(null);

    const loadTargets = async () => {
        setLoading(true);
        const res = await api.getTargets(1, 50);
        setTargets(res.data || []);
        setLoading(false);
    };

    useEffect(() => { loadTargets(); }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const payload = {
            name: form.name,
            url: form.url,
            selectors: JSON.parse(form.selectors || '{}'),
            schedule: form.schedule,
        };

        if (editId) {
            await api.updateTarget(editId, payload);
        } else {
            await api.createTarget(payload);
        }
        setShowForm(false);
        setForm({ name: '', url: '', selectors: '{}', schedule: '0 */6 * * *' });
        setEditId(null);
        loadTargets();
    };

    const handleEdit = (t) => {
        setForm({
            name: t.name,
            url: t.url,
            selectors: typeof t.selectors === 'string' ? t.selectors : JSON.stringify(t.selectors || {}, null, 2),
            schedule: t.schedule || '0 */6 * * *',
        });
        setEditId(t.id);
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('Delete this target?')) return;
        await api.deleteTarget(id);
        loadTargets();
    };

    const handleScrapeNow = async (targetId) => {
        await api.createJob({ target_id: targetId });
        alert('Job created! Run the scraper to process it.');
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1>Scrape Targets</h1>
                <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: '', url: '', selectors: '{}', schedule: '0 */6 * * *' }); }}>
                    {showForm ? 'Cancel' : '+ Add Target'}
                </button>
            </div>

            {showForm && (
                <form className="card form-card" onSubmit={handleSubmit}>
                    <h3>{editId ? 'Edit Target' : 'New Target'}</h3>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Name</label>
                            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="My Website" required />
                        </div>
                        <div className="form-group">
                            <label>URL</label>
                            <input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://example.com" required />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Schedule (cron)</label>
                            <input value={form.schedule} onChange={e => setForm({ ...form, schedule: e.target.value })} placeholder="0 */6 * * *" />
                        </div>
                    </div>
                    <div className="form-group">
                        <label>CSS Selectors (JSON)</label>
                        <textarea value={form.selectors} onChange={e => setForm({ ...form, selectors: e.target.value })} rows={4} placeholder='{"title": "h1", "price": ".price"}' />
                    </div>
                    <button type="submit" className="btn btn-primary">{editId ? 'Update' : 'Create Target'}</button>
                </form>
            )}

            {loading ? (
                <div className="page-loading">Loading targets...</div>
            ) : targets.length === 0 ? (
                <div className="empty-state">
                    <span className="empty-icon">🎯</span>
                    <p>No targets yet. Add your first scrape target above.</p>
                </div>
            ) : (
                <div className="table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>URL</th>
                                <th>Schedule</th>
                                <th>Status</th>
                                <th>Last Scraped</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {targets.map(t => (
                                <tr key={t.id}>
                                    <td className="td-name">{t.name}</td>
                                    <td className="td-url"><a href={t.url} target="_blank" rel="noopener">{new URL(t.url).hostname}</a></td>
                                    <td><code>{t.schedule}</code></td>
                                    <td><span className={`badge ${t.is_active ? 'badge-green' : 'badge-gray'}`}>{t.is_active ? 'Active' : 'Paused'}</span></td>
                                    <td>{t.last_scraped_at ? new Date(t.last_scraped_at).toLocaleString() : '—'}</td>
                                    <td className="td-actions">
                                        <button className="btn btn-sm btn-ghost" onClick={() => handleScrapeNow(t.id)} title="Scrape now">⚡</button>
                                        <button className="btn btn-sm btn-ghost" onClick={() => handleEdit(t)} title="Edit">✏️</button>
                                        <button className="btn btn-sm btn-ghost btn-danger" onClick={() => handleDelete(t.id)} title="Delete">🗑️</button>
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
