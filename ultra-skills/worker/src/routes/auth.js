// worker/src/routes/auth.js
// Authentication routes — API key generation, login

import { json, error, success } from '../utils/response.js';

export async function handleAuth(request, env, path, method) {
    if (path === '/api/auth/setup' && method === 'POST') {
        return setupMasterKey(request, env);
    }
    if (path === '/api/auth/keys' && method === 'POST') {
        return createApiKey(request, env);
    }
    if (path === '/api/auth/keys' && method === 'GET') {
        return listApiKeys(request, env);
    }

    return error('Auth endpoint not found', 404);
}

// Initial setup — create the first API key using master key
async function setupMasterKey(request, env) {
    const masterKey = env.MASTER_API_KEY;
    if (!masterKey) return error('MASTER_API_KEY not configured in environment', 500);

    const providedKey = request.headers.get('X-Master-Key');
    if (providedKey !== masterKey) return error('Invalid master key', 403);

    // Check if any keys exist
    const existing = await env.DB.prepare('SELECT COUNT(*) as count FROM api_keys').first();
    if (existing.count > 0) {
        return error('API keys already exist. Use existing admin key to create more.', 400);
    }

    // Generate first admin API key
    const apiKey = generateApiKey();
    const keyHash = await hashKey(apiKey);

    await env.DB.prepare(`
    INSERT INTO api_keys (key_hash, name, permissions, rate_limit)
    VALUES (?, ?, ?, ?)
  `).bind(keyHash, 'Admin Key (Auto-generated)', '["read","write","admin"]', 120).run();

    return success({
        api_key: apiKey,
        message: 'Admin API key created. Save this key — it will not be shown again!',
        warning: 'Store this key securely. It has full admin permissions.',
    }, 201);
}

async function createApiKey(request, env) {
    // Verify caller has admin permissions
    const authResult = await verifyAdmin(request, env);
    if (authResult.error) return error(authResult.error, 403);

    const body = await request.json();
    const { name, permissions, rate_limit, expires_in_days } = body;

    if (!name) return error('API key name is required', 400);

    const apiKey = generateApiKey();
    const keyHash = await hashKey(apiKey);

    let expiresAt = null;
    if (expires_in_days) {
        const d = new Date();
        d.setDate(d.getDate() + expires_in_days);
        expiresAt = d.toISOString();
    }

    await env.DB.prepare(`
    INSERT INTO api_keys (key_hash, name, permissions, rate_limit, expires_at)
    VALUES (?, ?, ?, ?, ?)
  `).bind(
        keyHash, name,
        JSON.stringify(permissions || ['read']),
        rate_limit || 60,
        expiresAt
    ).run();

    return success({
        api_key: apiKey,
        name,
        permissions: permissions || ['read'],
        expires_at: expiresAt,
        message: 'API key created. Save this key — it will not be shown again!',
    }, 201);
}

async function listApiKeys(request, env) {
    const authResult = await verifyAdmin(request, env);
    if (authResult.error) return error(authResult.error, 403);

    const keys = await env.DB.prepare(
        'SELECT id, name, permissions, rate_limit, is_active, last_used_at, expires_at, created_at FROM api_keys ORDER BY created_at DESC'
    ).all();

    return json({ success: true, data: keys.results });
}

async function verifyAdmin(request, env) {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey) return { error: 'API key required' };

    const keyHash = await hashKey(apiKey);
    const result = await env.DB.prepare(
        'SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1'
    ).bind(keyHash).first();

    if (!result) return { error: 'Invalid API key' };

    const permissions = JSON.parse(result.permissions || '[]');
    if (!permissions.includes('admin')) return { error: 'Admin permissions required' };

    return { authenticated: true };
}

function generateApiKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const prefix = 'ss_';
    let key = prefix;
    const array = new Uint8Array(40);
    crypto.getRandomValues(array);
    for (const byte of array) {
        key += chars[byte % chars.length];
    }
    return key;
}

async function hashKey(key) {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
