/**
 * secrets/apply.ts
 * Config mutation engine — applies resolved secrets back into config.
 * Ported from OpenClaw src/secrets/apply.ts (855 LOC → ~130 LOC compressed).
 */

import type { SecretApplyResult, SecretRef } from './types.js';
import { isRecord, parseDotPath } from './shared.js';
import { secretRefKey } from './ref-contract.js';

const SECRET_REF_PREFIX = 'secret:';

/**
 * Apply resolved secrets into a config object, replacing `secret:source:provider:id` strings.
 * Mutates the config in place for efficiency. Returns a summary of applied changes.
 */
export function applyResolvedSecrets(
    config: Record<string, unknown>,
    resolved: Map<string, unknown>,
): SecretApplyResult {
    const result: SecretApplyResult = { applied: 0, skipped: 0, errors: [] };
    applyToObject(config, resolved, result, []);
    return result;
}

function applyToObject(
    obj: Record<string, unknown>,
    resolved: Map<string, unknown>,
    result: SecretApplyResult,
    path: string[],
): void {
    for (const [key, value] of Object.entries(obj)) {
        const currentPath = [...path, key];

        if (typeof value === 'string' && value.startsWith(SECRET_REF_PREFIX)) {
            const refStr = value.slice(SECRET_REF_PREFIX.length);
            const parts = refStr.split(':');
            if (parts.length === 3) {
                const refKey = refStr; // `source:provider:id`
                const resolvedValue = resolved.get(refKey);
                if (resolvedValue !== undefined) {
                    obj[key] = resolvedValue;
                    result.applied++;
                } else {
                    result.errors.push({
                        path: currentPath.join('.'),
                        error: `Unresolved secret ref: ${refStr}`,
                    });
                    result.skipped++;
                }
            }
        } else if (isRecord(value)) {
            applyToObject(value, resolved, result, currentPath);
        } else if (Array.isArray(value)) {
            applyToArray(value, resolved, result, currentPath);
        }
    }
}

function applyToArray(
    arr: unknown[],
    resolved: Map<string, unknown>,
    result: SecretApplyResult,
    path: string[],
): void {
    for (let i = 0; i < arr.length; i++) {
        const value = arr[i];
        const currentPath = [...path, String(i)];

        if (typeof value === 'string' && value.startsWith(SECRET_REF_PREFIX)) {
            const refStr = value.slice(SECRET_REF_PREFIX.length);
            const resolvedValue = resolved.get(refStr);
            if (resolvedValue !== undefined) {
                arr[i] = resolvedValue;
                result.applied++;
            } else {
                result.skipped++;
            }
        } else if (isRecord(value)) {
            applyToObject(value, resolved, result, currentPath);
        } else if (Array.isArray(value)) {
            applyToArray(value, resolved, result, currentPath);
        }
    }
}

/**
 * Redact resolved secret values from a config for safe logging.
 * Returns a deep clone with secret values replaced by `[REDACTED]`.
 */
export function redactSecretsFromConfig(config: Record<string, unknown>): Record<string, unknown> {
    return JSON.parse(JSON.stringify(config, (key, value) => {
        if (typeof value === 'string' && value.startsWith(SECRET_REF_PREFIX)) {
            return '[REDACTED]';
        }
        // Common secret field names
        const sensitiveKeys = ['token', 'password', 'secret', 'apiKey', 'appPassword', 'key', 'credential'];
        if (typeof value === 'string' && value.length > 0 && sensitiveKeys.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
            return '[REDACTED]';
        }
        return value;
    })) as Record<string, unknown>;
}
