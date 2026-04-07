/**
 * agents/payload-redaction.ts
 * Redact sensitive data from API payloads for logging.
 */
const SENSITIVE_KEYS = new Set(['api_key', 'apiKey', 'authorization', 'token', 'secret', 'password', 'credential', 'access_token', 'refresh_token', 'cookie', 'x-api-key']);

export function redactPayload(payload: unknown, depth = 0): unknown {
    if (depth > 10) return '[MAX_DEPTH]';
    if (payload === null || payload === undefined) return payload;
    if (typeof payload === 'string') return payload.length > 1000 ? payload.slice(0, 100) + `...(${payload.length} chars)` : payload;
    if (Array.isArray(payload)) return payload.map((v) => redactPayload(v, depth + 1));
    if (typeof payload === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
            if (SENSITIVE_KEYS.has(key.toLowerCase())) result[key] = '[REDACTED]';
            else result[key] = redactPayload(value, depth + 1);
        }
        return result;
    }
    return payload;
}

export function redactHeaders(headers: Record<string, string>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
        result[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : value;
    }
    return result;
}

export function redactUrl(url: string): string {
    try { const u = new URL(url); if (u.password) u.password = '***'; for (const key of ['key', 'token', 'secret', 'api_key']) { if (u.searchParams.has(key)) u.searchParams.set(key, '***'); } return u.toString(); } catch { return url; }
}
