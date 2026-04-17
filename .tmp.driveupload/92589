/**
 * CoreBlow Environment Variable Substitution
 *
 * Supports ${VAR_NAME} syntax in config string values, substituted at load time.
 * Features: nested object traversal, missing var detection, escape sequences,
 * default values (${VAR:-default}), and strict mode.
 *
 * Equivalent: CoreBlow config/env-substitution.ts (203 LOC)
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('config:env-sub');

// ─── Types ────────────────────────────────────────────────────────

export interface EnvSubstitutionOptions {
    /** Environment variables source (defaults to process.env) */
    env?: Record<string, string | undefined>;
    /** Throw on missing env vars (default: false) */
    strict?: boolean;
    /** Replace missing vars with empty string (default: true) */
    replaceUndefined?: boolean;
    /** Prefix filter for env vars (e.g., 'CB_') */
    prefix?: string;
}

export interface SubstitutionResult {
    value: unknown;
    substitutions: SubstitutionEntry[];
    missingVars: string[];
    errors: string[];
}

export interface SubstitutionEntry {
    path: string;
    variable: string;
    originalValue: string;
    resolvedValue: string;
}

// ─── Errors ───────────────────────────────────────────────────────

export class MissingEnvVarError extends Error {
    constructor(
        public readonly variable: string,
        public readonly configPath: string,
    ) {
        super(`Missing environment variable "${variable}" referenced at config path "${configPath}"`);
        this.name = 'MissingEnvVarError';
    }
}

// ─── Constants ────────────────────────────────────────────────────

/** Pattern: ${VAR_NAME} or ${VAR_NAME:-default} */
const SUBSTITUTION_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-(.*?))?\}/g;

/** Escape pattern: $${...} → literal ${...} */
const ESCAPE_PATTERN = /\$\$\{/g;

// ─── Substitution Engine ──────────────────────────────────────────

/**
 * Substitute environment variables in a config value (string, object, or array)
 */
export function substituteEnvVars(
    value: unknown,
    options?: EnvSubstitutionOptions,
): SubstitutionResult {
    const opts: Required<EnvSubstitutionOptions> = {
        env: options?.env ?? (process.env as Record<string, string | undefined>),
        strict: options?.strict ?? false,
        replaceUndefined: options?.replaceUndefined ?? true,
        prefix: options?.prefix ?? '',
    };

    const substitutions: SubstitutionEntry[] = [];
    const missingVars: string[] = [];
    const errors: string[] = [];

    const result = substituteRecursive(value, '', opts, substitutions, missingVars, errors);

    return { value: result, substitutions, missingVars, errors };
}

/**
 * Substitute env vars in a single string
 */
export function substituteString(
    input: string,
    env?: Record<string, string | undefined>,
    strict?: boolean,
): string {
    const source = env ?? (process.env as Record<string, string | undefined>);

    // Handle escape sequences first
    const unescaped = input.replace(ESCAPE_PATTERN, '___CB_ESCAPE___');

    const result = unescaped.replace(SUBSTITUTION_PATTERN, (_match, varName: string, defaultValue?: string) => {
        const envValue = source[varName];
        if (envValue !== undefined) return envValue;
        if (defaultValue !== undefined) return defaultValue;
        if (strict) throw new MissingEnvVarError(varName, '');
        return '';
    });

    return result.replace(/___CB_ESCAPE___/g, '${');
}

/**
 * Check if a string contains env var references
 */
export function hasEnvVarReferences(value: string): boolean {
    return SUBSTITUTION_PATTERN.test(value);
}

/**
 * Extract all env var names referenced in a value
 */
export function extractEnvVarNames(value: unknown): string[] {
    const names = new Set<string>();
    extractRecursive(value, names);
    return Array.from(names);
}

/**
 * Validate that all referenced env vars exist
 */
export function validateEnvVars(
    value: unknown,
    env?: Record<string, string | undefined>,
): { valid: boolean; missing: string[] } {
    const source = env ?? (process.env as Record<string, string | undefined>);
    const names = extractEnvVarNames(value);
    const missing = names.filter((name) => source[name] === undefined);
    return { valid: missing.length === 0, missing };
}

// ─── Private Helpers ──────────────────────────────────────────────

function substituteRecursive(
    value: unknown,
    path: string,
    opts: Required<EnvSubstitutionOptions>,
    substitutions: SubstitutionEntry[],
    missingVars: string[],
    errors: string[],
): unknown {
    if (typeof value === 'string') {
        if (!hasEnvVarReferences(value)) return value;

        const unescaped = value.replace(ESCAPE_PATTERN, '___CB_ESCAPE___');

        const result = unescaped.replace(SUBSTITUTION_PATTERN, (match, varName: string, defaultValue?: string) => {
            const envValue = opts.env[varName];

            if (envValue !== undefined) {
                substitutions.push({
                    path,
                    variable: varName,
                    originalValue: match,
                    resolvedValue: envValue,
                });
                return envValue;
            }

            if (defaultValue !== undefined) {
                substitutions.push({
                    path,
                    variable: varName,
                    originalValue: match,
                    resolvedValue: defaultValue,
                });
                return defaultValue;
            }

            missingVars.push(varName);
            if (opts.strict) {
                errors.push(`Missing env var "${varName}" at path "${path}"`);
            }
            return opts.replaceUndefined ? '' : match;
        });

        return result.replace(/___CB_ESCAPE___/g, '${');
    }

    if (Array.isArray(value)) {
        return value.map((item, i) =>
            substituteRecursive(item, `${path}[${i}]`, opts, substitutions, missingVars, errors),
        );
    }

    if (value !== null && typeof value === 'object') {
        const result: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
            const childPath = path ? `${path}.${key}` : key;
            result[key] = substituteRecursive(val, childPath, opts, substitutions, missingVars, errors);
        }
        return result;
    }

    return value;
}

function extractRecursive(value: unknown, names: Set<string>): void {
    if (typeof value === 'string') {
        let match: RegExpExecArray | null;
        const pattern = new RegExp(SUBSTITUTION_PATTERN.source, 'g');
        while ((match = pattern.exec(value)) !== null) {
            names.add(match[1]!);
        }
        return;
    }
    if (Array.isArray(value)) {
        for (const item of value) extractRecursive(item, names);
        return;
    }
    if (value !== null && typeof value === 'object') {
        for (const val of Object.values(value as Record<string, unknown>)) {
            extractRecursive(val, names);
        }
    }
}
