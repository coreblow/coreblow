import { useState } from 'react';
import { setApiKey } from '../api/client';

export default function Login({ onLogin }) {
    const [key, setKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!key.trim()) return;
        setLoading(true);
        setError('');

        try {
            setApiKey(key.trim());
            const res = await fetch(
                (import.meta.env.VITE_API_URL || 'https://super-scraper-worker.febrinanda-co2.workers.dev') + '/api/stats',
                { headers: { 'X-API-Key': key.trim() } }
            );
            const data = await res.json();
            if (data.error) {
                setError(data.error);
                setApiKey('');
            } else {
                onLogin();
            }
        } catch {
            setError('Connection failed');
            setApiKey('');
        }
        setLoading(false);
    };

    return (
        <div className="login-page">
            <div className="login-card">
                <div className="login-header">
                    <span className="login-icon">🕷️</span>
                    <h1>Super Scraper</h1>
                    <p>Enter your API key to access the dashboard</p>
                </div>
                <form onSubmit={handleSubmit}>
                    <input
                        type="password"
                        placeholder="ss_xxxxxxxxxx..."
                        value={key}
                        onChange={(e) => setKey(e.target.value)}
                        className="login-input"
                        autoFocus
                    />
                    {error && <div className="login-error">{error}</div>}
                    <button type="submit" className="login-btn" disabled={loading || !key.trim()}>
                        {loading ? 'Verifying...' : 'Connect'}
                    </button>
                </form>
                <div className="login-footer">
                    <span>CoreBlow · Super Scraper v2.0</span>
                </div>
            </div>
        </div>
    );
}
