import { useState, useEffect } from 'react';
import { api } from '../api/client';

export default function Settings() {
    const [config, setConfig] = useState({
        workerUrl: localStorage.getItem('worker_url') || '',
        apiKey: localStorage.getItem('api_key') || '',
        telegramToken: '',
        telegramChatId: '',
        discordWebhook: '',
        defaultSchedule: '0 */6 * * *',
        maxRetries: 3,
        timeout: 30000,
    });
    const [saved, setSaved] = useState(false);
    const [stats, setStats] = useState(null);

    useEffect(() => {
        loadStats();
        const stored = localStorage.getItem('scraper_settings');
        if (stored) {
            try {
                setConfig(prev => ({ ...prev, ...JSON.parse(stored) }));
            } catch (e) { /* ignore */ }
        }
    }, []);

    const loadStats = async () => {
        try {
            const res = await api.getStats();
            if (res.success) setStats(res.data);
        } catch (e) { /* ignore */ }
    };

    const handleChange = (key, value) => {
        setConfig(prev => ({ ...prev, [key]: value }));
        setSaved(false);
    };

    const handleSave = () => {
        localStorage.setItem('scraper_settings', JSON.stringify(config));
        if (config.workerUrl) localStorage.setItem('worker_url', config.workerUrl);
        if (config.apiKey) localStorage.setItem('api_key', config.apiKey);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const handleTestConnection = async () => {
        try {
            const res = await api.getStats();
            if (res.success) {
                showToast('Connection successful — API is reachable', 'success');
            } else {
                showToast('Connection failed — check API key', 'error');
            }
        } catch (e) {
            showToast('Connection failed — check Worker URL', 'error');
        }
    };

    const showToast = (msg, type) => {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    };

    return (
        <div className="page">
            <div className="page-header">
                <h1>⚙️ Settings</h1>
                <p className="subtitle">Configure your Ultra Skills instance</p>
            </div>

            <div className="settings-grid">
                <div className="settings-section">
                    <h3>🔗 API Connection</h3>
                    <div className="form-group">
                        <label>Worker URL</label>
                        <input type="url" value={config.workerUrl}
                            onChange={e => handleChange('workerUrl', e.target.value)}
                            placeholder="https://ultra-skills-worker.xxx.workers.dev" />
                    </div>
                    <div className="form-group">
                        <label>API Key</label>
                        <input type="password" value={config.apiKey}
                            onChange={e => handleChange('apiKey', e.target.value)}
                            placeholder="ss_..." />
                    </div>
                    <button className="btn btn-secondary" onClick={handleTestConnection}>
                        Test Connection
                    </button>
                </div>

                <div className="settings-section">
                    <h3>🔔 Notifications</h3>
                    <div className="form-group">
                        <label>Telegram Bot Token</label>
                        <input type="password" value={config.telegramToken}
                            onChange={e => handleChange('telegramToken', e.target.value)}
                            placeholder="123456:ABC-DEF..." />
                    </div>
                    <div className="form-group">
                        <label>Telegram Chat ID</label>
                        <input type="text" value={config.telegramChatId}
                            onChange={e => handleChange('telegramChatId', e.target.value)}
                            placeholder="-1001234567890" />
                    </div>
                    <div className="form-group">
                        <label>Discord Webhook URL</label>
                        <input type="url" value={config.discordWebhook}
                            onChange={e => handleChange('discordWebhook', e.target.value)}
                            placeholder="https://discord.com/api/webhooks/..." />
                    </div>
                </div>

                <div className="settings-section">
                    <h3>⚡ Engine Defaults</h3>
                    <div className="form-group">
                        <label>Default Schedule (Cron)</label>
                        <input type="text" value={config.defaultSchedule}
                            onChange={e => handleChange('defaultSchedule', e.target.value)}
                            placeholder="0 */6 * * *" />
                        <small>Every 6 hours by default</small>
                    </div>
                    <div className="form-group">
                        <label>Max Retries</label>
                        <input type="number" min="1" max="10" value={config.maxRetries}
                            onChange={e => handleChange('maxRetries', parseInt(e.target.value))} />
                    </div>
                    <div className="form-group">
                        <label>Timeout (ms)</label>
                        <input type="number" min="5000" max="120000" step="5000"
                            value={config.timeout}
                            onChange={e => handleChange('timeout', parseInt(e.target.value))} />
                    </div>
                </div>

                {stats && (
                    <div className="settings-section">
                        <h3>📊 System Info</h3>
                        <div className="system-info">
                            <div className="info-row"><span>API Version</span><span>{stats.version || '2.0.0'}</span></div>
                            <div className="info-row"><span>Active Targets</span><span>{stats.total_targets || 0}</span></div>
                            <div className="info-row"><span>Total Jobs</span><span>{stats.total_jobs || 0}</span></div>
                            <div className="info-row"><span>Data Records</span><span>{stats.total_data || 0}</span></div>
                            <div className="info-row"><span>Success Rate</span><span>{stats.success_rate || '0'}%</span></div>
                        </div>
                    </div>
                )}
            </div>

            <div className="settings-actions">
                <button className="btn btn-primary" onClick={handleSave}>
                    {saved ? '✅ Saved!' : '💾 Save Settings'}
                </button>
            </div>
        </div>
    );
}
