/**
 * config/config-redact.ts — Redact sensitive config values for display.
 */

const SENSITIVE_KEYS = new Set(['apiKey', 'token', 'secret', 'password', 'accessToken', 'signingSecret', 'appToken', 'channelSecret', 'verifyToken', 'pairingCode']);

export function redactConfig(config: Record<string, unknown>, depth = 0): Record<string, unknown> {
    if (depth > 10) return config;
    const redacted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(config)) {
        if (SENSITIVE_KEYS.has(key) && typeof value === 'string') {
            redacted[key] = value.length > 8 ? value.slice(0, 4) + '***' + value.slice(-4) : '***';
        } else if (typeof value === 'string' && (key.toLowerCase().includes('key') || key.toLowerCase().includes('secret') || key.toLowerCase().includes('token'))) {
            redacted[key] = value.length > 8 ? value.slice(0, 4) + '***' + value.slice(-4) : '***';
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
            redacted[key] = redactConfig(value as Record<string, unknown>, depth + 1);
        } else { redacted[key] = value; }
    }
    return redacted;
}
