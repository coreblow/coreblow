/**
 * secrets/env-secrets.ts
 * Environment variable secret management with allowlists and redaction.
 * Extended from CoreBlow placeholder to match OpenClaw patterns.
 */

import { isNonEmptyString, maskSecret } from './shared.js';

const DEFAULT_SENSITIVE_PREFIXES = [
    'COREBLOW_', 'OPENAI_', 'ANTHROPIC_', 'GOOGLE_', 'AZURE_',
    'DISCORD_', 'TELEGRAM_', 'SLACK_', 'SIGNAL_',
    'AWS_', 'GITHUB_', 'DATABASE_', 'REDIS_',
];

/**
 * Get a secret from environment variables.
 */
export function getSecret(name: string): string | undefined {
    return process.env[name];
}

/**
 * Get a required secret — throws if missing.
 */
export function requireSecret(name: string): string {
    const val = process.env[name];
    if (!val) throw new Error(`Missing required secret: ${name}`);
    return val;
}

/**
 * Get a secret with a fallback default.
 */
export function getSecretOrDefault(name: string, fallback: string): string {
    return process.env[name] ?? fallback;
}

/**
 * Check if a secret is configured (non-empty).
 */
export function hasSecret(name: string): boolean {
    return isNonEmptyString(process.env[name]);
}

/**
 * Scan environment for all secrets matching sensitive prefixes.
 * Returns variable names (not values) for audit purposes.
 */
export function scanSensitiveEnvVars(prefixes = DEFAULT_SENSITIVE_PREFIXES): string[] {
    return Object.keys(process.env).filter(key =>
        prefixes.some(prefix => key.startsWith(prefix))
    );
}

/**
 * Scan environment for secrets matching an allowlist.
 * Only returns values for allowed keys.
 */
export function resolveEnvSecrets(
    keys: string[],
    opts?: { allowlist?: string[]; required?: boolean }
): Map<string, string> {
    const allowlist = opts?.allowlist ? new Set(opts.allowlist) : null;
    const resolved = new Map<string, string>();

    for (const key of keys) {
        if (allowlist && !allowlist.has(key)) {
            throw new Error(`Environment variable "${key}" is not in the allowlist.`);
        }
        const value = process.env[key];
        if (isNonEmptyString(value)) {
            resolved.set(key, value);
        } else if (opts?.required) {
            throw new Error(`Required environment variable "${key}" is missing or empty.`);
        }
    }

    return resolved;
}

/**
 * Create a redacted copy of process.env for safe logging.
 */
export function redactEnv(
    env: NodeJS.ProcessEnv = process.env,
    prefixes = DEFAULT_SENSITIVE_PREFIXES,
): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(env)) {
        if (value === undefined) continue;
        if (prefixes.some(prefix => key.startsWith(prefix))) {
            result[key] = maskSecret(value);
        } else {
            result[key] = value;
        }
    }
    return result;
}
