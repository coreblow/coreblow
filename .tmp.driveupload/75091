// worker/src/middleware/auth.js
// JWT + API Key authentication middleware

export async function verifyAuth(request, env) {
    // Check API Key first (header: X-API-Key)
    const apiKey = request.headers.get('X-API-Key');
    if (apiKey) {
        return await verifyApiKey(apiKey, env);
    }

    // Check Bearer token
    const authHeader = request.headers.get('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        return await verifyJwt(token, env);
    }

    // For initial setup, allow requests with master key
    const masterKey = env.MASTER_API_KEY;
    if (masterKey) {
        const providedKey = request.headers.get('X-Master-Key');
        if (providedKey === masterKey) {
            return { authenticated: true, permissions: ['read', 'write', 'admin'] };
        }
    }

    return { error: 'Authentication required. Provide X-API-Key header or Bearer token.' };
}

async function verifyApiKey(key, env) {
    const keyHash = await hashKey(key);
    const result = await env.DB.prepare(
        'SELECT * FROM api_keys WHERE key_hash = ? AND is_active = 1'
    ).bind(keyHash).first();

    if (!result) {
        return { error: 'Invalid API key' };
    }

    if (result.expires_at && new Date(result.expires_at) < new Date()) {
        return { error: 'API key expired' };
    }

    // Update last used
    await env.DB.prepare(
        'UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(result.id).run();

    return {
        authenticated: true,
        keyId: result.id,
        permissions: JSON.parse(result.permissions || '["read"]'),
        rateLimit: result.rate_limit,
    };
}

async function verifyJwt(token, env) {
    try {
        const secret = env.JWT_SECRET;
        if (!secret) return { error: 'JWT not configured' };

        const parts = token.split('.');
        if (parts.length !== 3) return { error: 'Invalid token format' };

        const payload = JSON.parse(atob(parts[1]));

        if (payload.exp && payload.exp < Date.now() / 1000) {
            return { error: 'Token expired' };
        }

        return {
            authenticated: true,
            userId: payload.sub,
            permissions: payload.permissions || ['read'],
        };
    } catch {
        return { error: 'Invalid token' };
    }
}

async function hashKey(key) {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
