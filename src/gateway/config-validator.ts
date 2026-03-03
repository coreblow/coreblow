/**
 * src/gateway/config-validator.ts
 * Deep config validation + migration + schema versioning
 * SUPERIOR: CoreBlow has 217 files for config; CoreBlow has smart validation in one file
 */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('config:validator');

// ─── Types ────────────────────────────────────────────────────────

export interface ValidationRule {
    path: string;
    type: 'string' | 'number' | 'boolean' | 'object' | 'array';
    required?: boolean;
    min?: number;
    max?: number;
    pattern?: RegExp;
    enum?: unknown[];
    default?: unknown;
    description?: string;
    /** Custom validator */
    validate?: (value: unknown) => string | null;
}

export interface ValidationResult {
    valid: boolean;
    errors: { path: string; message: string }[];
    warnings: { path: string; message: string }[];
    applied: { path: string; action: string }[]; // defaults applied, migrations run
}

export interface ConfigMigration {
    fromVersion: number;
    toVersion: number;
    description: string;
    migrate: (config: Record<string, unknown>) => Record<string, unknown>;
}

// ─── Schema ──────────────────────────────────────────────────────

const CORE_SCHEMA: ValidationRule[] = [
    { path: 'port', type: 'number', required: false, min: 1, max: 65535, default: 3100, description: 'HTTP port' },
    { path: 'host', type: 'string', required: false, default: '0.0.0.0', description: 'Listen address' },
    { path: 'agent.provider', type: 'string', required: false, default: 'anthropic', description: 'AI provider' },
    { path: 'agent.model', type: 'string', required: false, default: 'claude-opus-4-6', description: 'Model name' },
    { path: 'agent.maxTokens', type: 'number', required: false, min: 1, max: 1000000, default: 4096 },
    { path: 'agent.temperature', type: 'number', required: false, min: 0, max: 2, default: 0.7 },
    { path: 'agent.workspace', type: 'string', required: false, default: '.' },
    { path: 'providers.openai.apiKey', type: 'string', required: false },
    { path: 'providers.anthropic.apiKey', type: 'string', required: false },
    { path: 'providers.openrouter.apiKey', type: 'string', required: false },
    { path: 'channels.telegram.token', type: 'string', required: false },
    { path: 'channels.discord.token', type: 'string', required: false },
];

// ─── Validator ───────────────────────────────────────────────────

export class ConfigValidator {
    private rules: ValidationRule[] = [...CORE_SCHEMA];
    private migrations: ConfigMigration[] = [];

    /**
     * Add custom validation rules
     */
    addRules(rules: ValidationRule[]): void {
        this.rules.push(...rules);
    }

    /**
     * Register a config migration
     */
    addMigration(migration: ConfigMigration): void {
        this.migrations.push(migration);
        this.migrations.sort((a, b) => a.fromVersion - b.fromVersion);
    }

    /**
     * Validate a config object against the schema
     */
    validate(config: Record<string, unknown>): ValidationResult {
        const errors: { path: string; message: string }[] = [];
        const warnings: { path: string; message: string }[] = [];
        const applied: { path: string; action: string }[] = [];

        for (const rule of this.rules) {
            const value = getNestedValue(config, rule.path);

            // Required check
            if (rule.required && (value === undefined || value === null || value === '')) {
                errors.push({ path: rule.path, message: `Required field missing` });
                continue;
            }

            // Skip if not present and not required
            if (value === undefined || value === null) {
                // Apply default
                if (rule.default !== undefined) {
                    setNestedValue(config, rule.path, rule.default);
                    applied.push({ path: rule.path, action: `Default applied: ${JSON.stringify(rule.default)}` });
                }
                continue;
            }

            // Type check
            const actualType = Array.isArray(value) ? 'array' : typeof value;
            if (actualType !== rule.type) {
                errors.push({ path: rule.path, message: `Expected ${rule.type}, got ${actualType}` });
                continue;
            }

            // Range check
            if (rule.type === 'number') {
                const num = value as number;
                if (rule.min !== undefined && num < rule.min) {
                    errors.push({ path: rule.path, message: `Value ${num} below minimum ${rule.min}` });
                }
                if (rule.max !== undefined && num > rule.max) {
                    errors.push({ path: rule.path, message: `Value ${num} above maximum ${rule.max}` });
                }
            }

            // Pattern check
            if (rule.pattern && rule.type === 'string') {
                if (!rule.pattern.test(value as string)) {
                    errors.push({ path: rule.path, message: `Value doesn't match pattern: ${rule.pattern}` });
                }
            }

            // Enum check
            if (rule.enum && !rule.enum.includes(value)) {
                errors.push({ path: rule.path, message: `Value must be one of: ${rule.enum.join(', ')}` });
            }

            // Custom validator
            if (rule.validate) {
                const error = rule.validate(value);
                if (error) errors.push({ path: rule.path, message: error });
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            applied,
        };
    }

    /**
     * Run migrations on a config object
     */
    migrate(config: Record<string, unknown>, fromVersion: number, toVersion: number): Record<string, unknown> {
        let current = { ...config };

        const applicableMigrations = this.migrations.filter(
            m => m.fromVersion >= fromVersion && m.toVersion <= toVersion
        );

        for (const migration of applicableMigrations) {
            try {
                current = migration.migrate(current);
                log.info({ from: migration.fromVersion, to: migration.toVersion, desc: migration.description }, 'Migration applied');
            } catch (err: unknown) {
                log.error({ migration: migration.description, err: err instanceof Error ? err.message : String(err) }, 'Migration failed');
            }
        }

        return current;
    }

    /**
     * Get schema documentation
     */
    getSchema(): { path: string; type: string; required: boolean; default?: unknown; description?: string }[] {
        return this.rules.map(r => ({
            path: r.path,
            type: r.type,
            required: r.required || false,
            default: r.default,
            description: r.description,
        }));
    }
}

// ─── Helpers ─────────────────────────────────────────────────────

export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: Record<string, unknown> | unknown = obj;
    for (const part of parts) {
        if (current === undefined || current === null || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[part];
    }
    return current;
}

export function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const parts = path.split('.');
    let current: Record<string, unknown> = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i]! in current)) current[parts[i]!] = {};
        current = current[parts[i]!] as Record<string, unknown>;
    }
    current[parts[parts.length - 1]!] = value;
}
