/**
 * utils/log-redaction.ts
 * Sensitive data redaction engine for log output.
 * Follows CoreBlow's redactPatterns convention.
 */

// ─── Pattern Definitions ──────────────────────────────────────────

const API_KEY_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
    { name: 'OpenAI', pattern: /sk-[a-zA-Z0-9]{20,}/g },
    { name: 'Anthropic', pattern: /sk-ant-[a-zA-Z0-9-]{20,}/g },
    { name: 'GitHub PAT', pattern: /ghp_[a-zA-Z0-9]{36}/g },
    { name: 'GitHub OAuth', pattern: /gho_[a-zA-Z0-9]{36}/g },
    { name: 'Slack Bot', pattern: /xoxb-[0-9]+-[a-zA-Z0-9]+/g },
    { name: 'Slack User', pattern: /xoxp-[0-9]+-[a-zA-Z0-9]+/g },
    { name: 'Discord', pattern: /[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27,}/g },
    { name: 'Telegram', pattern: /[0-9]+:[A-Za-z0-9_-]{35}/g },
    { name: 'Google API', pattern: /AIza[a-zA-Z0-9_-]{35}/g },
    { name: 'AWS Access', pattern: /AKIA[0-9A-Z]{16}/g },
    { name: 'Bearer Token', pattern: /Bearer\s+[a-zA-Z0-9._~+\/-]{20,}/gi },
    { name: 'Basic Auth', pattern: /Basic\s+[a-zA-Z0-9+\/=]{10,}/gi },
];

const GENERIC_SECRET_PATTERNS: RegExp[] = [
    // Hex strings that look like secrets (32+ chars)
    /(?<=[=:\s"'])[a-f0-9]{32,}(?=["\s,}]|$)/gi,
    // Base64-encoded strings that look like tokens (40+ chars)
    /(?<=[=:\s"'])[A-Za-z0-9+\/]{40,}={0,2}(?=["\s,}]|$)/g,
];

// ─── Redaction Functions ──────────────────────────────────────────

/**
 * Redact known API key patterns from a string.
 */
export function redactApiKeys(text: string): string {
    let result = text;
    for (const { pattern } of API_KEY_PATTERNS) {
        result = result.replace(pattern, '[REDACTED]');
    }
    return result;
}

/**
 * Redact sensitive values from a structured log object.
 * Deep-clones the object and replaces sensitive field values.
 */
export function redactLogObject(obj: Record<string, unknown>, sensitiveKeys?: string[]): Record<string, unknown> {
    const keys = new Set(sensitiveKeys ?? [
        'token', 'password', 'secret', 'apiKey', 'appPassword',
        'authorization', 'cookie', 'privateKey', 'signingKey',
        'clientSecret', 'accessKey', 'secretAccessKey', 'key',
        'credential', 'webhookSecret',
    ]);

    return redactDeep(obj, keys) as Record<string, unknown>;
}

function redactDeep(value: unknown, sensitiveKeys: Set<string>): unknown {
    if (typeof value === 'string') {
        return redactApiKeys(value);
    }
    if (Array.isArray(value)) {
        return value.map(v => redactDeep(v, sensitiveKeys));
    }
    if (typeof value === 'object' && value !== null) {
        const result: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            if (sensitiveKeys.has(k) || sensitiveKeys.has(k.toLowerCase())) {
                result[k] = '[REDACTED]';
            } else {
                result[k] = redactDeep(v, sensitiveKeys);
            }
        }
        return result;
    }
    return value;
}

/**
 * Check if a string contains any known API key patterns.
 */
export function containsSecrets(text: string): boolean {
    return API_KEY_PATTERNS.some(({ pattern }) => {
        pattern.lastIndex = 0;
        return pattern.test(text);
    });
}
