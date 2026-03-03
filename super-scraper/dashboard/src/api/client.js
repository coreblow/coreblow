// API Client for Super Scraper Worker
const API_BASE = import.meta.env.VITE_API_URL || 'https://super-scraper-worker.febrinanda-co2.workers.dev';

let apiKey = localStorage.getItem('ss_api_key') || '';

export const setApiKey = (key) => {
    apiKey = key;
    localStorage.setItem('ss_api_key', key);
};

export const getApiKey = () => apiKey;
export const isAuthenticated = () => !!apiKey;

async function request(path, options = {}) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': apiKey,
            ...options.headers,
        },
    });
    return res.json();
}

export const api = {
    // Health
    health: () => request('/api/health'),
    stats: () => request('/api/stats'),

    // Targets
    getTargets: (page = 1, limit = 20) => request(`/api/targets?page=${page}&limit=${limit}`),
    getTarget: (id) => request(`/api/targets/${id}`),
    createTarget: (data) => request('/api/targets', { method: 'POST', body: JSON.stringify(data) }),
    updateTarget: (id, data) => request(`/api/targets/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteTarget: (id) => request(`/api/targets/${id}`, { method: 'DELETE' }),

    // Data
    getData: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/api/data?${qs}`);
    },
    getDataItem: (id) => request(`/api/data/${id}`),

    // Jobs
    getJobs: (params = {}) => {
        const qs = new URLSearchParams(params).toString();
        return request(`/api/jobs?${qs}`);
    },
    createJob: (data) => request('/api/jobs', { method: 'POST', body: JSON.stringify(data) }),
    cancelJob: (id) => request(`/api/jobs/${id}/cancel`, { method: 'POST' }),
    retryJob: (id) => request(`/api/jobs/${id}/retry`, { method: 'POST' }),

    // Export
    exportData: (format = 'json', targetId = null) => {
        let path = `/api/export?format=${format}`;
        if (targetId) path += `&target_id=${targetId}`;
        return request(path);
    },
};
