/**
 * CoreBlow Config Validation Engine
 *
 * Schema-based configuration validation with typed per-module schemas,
 * config merging with precedence, validation error reporting,
 * and default value resolution. Zero external dependencies.
 */

/** Validation result */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    /** Config with defaults applied */
    resolved: Record<string, unknown>;
}

/** Validation error */
export interface ValidationError {
    path: string;
    message: string;
    expected?: string;
    received?: string;
}

/** Schema field types */
export type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object' | 'enum';

/** Schema field definition */
export interface FieldSchema {
    type: FieldType;
    required?: boolean;
    default?: unknown;
    description?: string;
    /** For enum type */
    values?: string[];
    /** For string type */
    pattern?: RegExp;
    minLength?: number;
    maxLength?: number;
    /** For number type */
    min?: number;
    max?: number;
    /** For array type */
    items?: FieldSchema;
    /** For object type — nested schema */
    properties?: Record<string, FieldSchema>;
}

/** Config schema for a module */
export interface ConfigSchema {
    name: string;
    description?: string;
    properties: Record<string, FieldSchema>;
}

/** Config source precedence */
export type ConfigSource = 'default' | 'file' | 'env' | 'override';

/** Config layer for merging */
export interface ConfigLayer {
    source: ConfigSource;
    data: Record<string, unknown>;
}

// ================================================================
// Built-in Schemas
// ================================================================

/** Agent configuration schema */
export const AGENT_SCHEMA: ConfigSchema = {
    name: 'agents',
    description: 'Agent runtime configuration',
    properties: {
        model: { type: 'string', required: true, default: 'gpt-4o', description: 'Default model' },
        provider: { type: 'string', default: 'openai', description: 'Default provider' },
        temperature: { type: 'number', default: 0.7, min: 0, max: 2 },
        maxTokens: { type: 'number', default: 4096, min: 1, max: 1_000_000 },
        systemPrompt: { type: 'string', default: '' },
        maxContextTokens: { type: 'number', default: 128_000 },
        tokenBudget: { type: 'number', default: 0, description: '0 = unlimited' },
        stream: { type: 'boolean', default: true },
    },
};

/** Channel configuration schema */
export const CHANNEL_SCHEMA: ConfigSchema = {
    name: 'channels',
    description: 'Channel integration configuration',
    properties: {
        enabled: { type: 'boolean', default: false },
        token: { type: 'string' },
        apiKey: { type: 'string' },
        accountId: { type: 'string' },
        webhookUrl: { type: 'string' },
        dmPolicy: { type: 'enum', values: ['open', 'allowlist', 'pairing', 'closed'], default: 'allowlist' },
        allowFrom: { type: 'array', items: { type: 'string' }, default: [] },
        ownerIds: { type: 'array', items: { type: 'string' }, default: [] },
    },
};

/** Security configuration schema */
export const SECURITY_SCHEMA: ConfigSchema = {
    name: 'security',
    description: 'Security and access control',
    properties: {
        apiToken: { type: 'string', description: 'API authentication token' },
        corsOrigins: { type: 'array', items: { type: 'string' }, default: ['*'] },
        rateLimit: { type: 'number', default: 100, description: 'Requests per minute' },
        sessionTtlMs: { type: 'number', default: 86_400_000 },
    },
};

/** Provider configuration schema */
export const PROVIDER_SCHEMA: ConfigSchema = {
    name: 'providers',
    description: 'Model provider configuration',
    properties: {
        openai: { type: 'object', properties: {
            apiKey: { type: 'string' },
            baseUrl: { type: 'string', default: 'https://api.openai.com/v1' },
            organization: { type: 'string' },
        }},
        anthropic: { type: 'object', properties: {
            apiKey: { type: 'string' },
            baseUrl: { type: 'string', default: 'https://api.anthropic.com' },
        }},
        google: { type: 'object', properties: {
            apiKey: { type: 'string' },
            projectId: { type: 'string' },
        }},
    },
};

/** All built-in schemas */
export const SCHEMAS: Record<string, ConfigSchema> = {
    agents: AGENT_SCHEMA,
    channels: CHANNEL_SCHEMA,
    security: SECURITY_SCHEMA,
    providers: PROVIDER_SCHEMA,
};

// ================================================================
// Validation Engine
// ================================================================

/**
 * Validate a config object against a schema.
 */
export function validateConfig(
    config: Record<string, unknown>,
    schema: ConfigSchema,
): ValidationResult {
    const errors: ValidationError[] = [];
    const resolved: Record<string, unknown> = {};

    for (const [key, fieldSchema] of Object.entries(schema.properties)) {
        const value = config[key];
        const path = `${schema.name}.${key}`;

        // Check required
        if (fieldSchema.required && (value === undefined || value === null)) {
            errors.push({ path, message: 'Required field is missing', expected: fieldSchema.type });
            continue;
        }

        // Apply default
        if (value === undefined || value === null) {
            resolved[key] = fieldSchema.default;
            continue;
        }

        // Type check
        const typeError = validateType(value, fieldSchema, path);
        if (typeError) {
            errors.push(typeError);
            continue;
        }

        resolved[key] = value;
    }

    return { valid: errors.length === 0, errors, resolved };
}

/**
 * Merge config layers with precedence: default < file < env < override.
 */
export function mergeConfigs(layers: ConfigLayer[]): Record<string, unknown> {
    const sorted = [...layers].sort((a, b) => {
        const order: Record<ConfigSource, number> = { default: 0, file: 1, env: 2, override: 3 };
        return order[a.source] - order[b.source];
    });

    const result: Record<string, unknown> = {};
    for (const layer of sorted) {
        deepMerge(result, layer.data);
    }
    return result;
}

/**
 * Resolve environment variable overrides.
 * Convention: CB_AGENTS_MODEL → agents.model
 */
export function resolveEnvOverrides(prefix: string = 'CB'): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(process.env)) {
        if (!key.startsWith(`${prefix}_`) || !value) continue;

        const parts = key
            .slice(prefix.length + 1)
            .toLowerCase()
            .split('_');

        let current: Record<string, unknown> = result;
        for (let i = 0; i < parts.length - 1; i++) {
            if (!current[parts[i]!]) current[parts[i]!] = {};
            current = current[parts[i]!] as Record<string, unknown>;
        }

        const lastKey = parts[parts.length - 1]!;
        current[lastKey] = parseEnvValue(value);
    }

    return result;
}

/**
 * Validate all top-level config sections.
 */
export function validateFullConfig(config: Record<string, unknown>): {
    valid: boolean;
    results: Record<string, ValidationResult>;
} {
    const results: Record<string, ValidationResult> = {};
    let allValid = true;

    for (const [section, schema] of Object.entries(SCHEMAS)) {
        const sectionConfig = (config[section] ?? {}) as Record<string, unknown>;
        const result = validateConfig(sectionConfig, schema);
        results[section] = result;
        if (!result.valid) allValid = false;
    }

    return { valid: allValid, results };
}

// ================================================================
// Helpers
// ================================================================

function validateType(value: unknown, schema: FieldSchema, path: string): ValidationError | null {
    switch (schema.type) {
        case 'string':
            if (typeof value !== 'string') {
                return { path, message: 'Expected string', expected: 'string', received: typeof value };
            }
            if (schema.minLength && value.length < schema.minLength) {
                return { path, message: `Minimum length is ${schema.minLength}` };
            }
            if (schema.maxLength && value.length > schema.maxLength) {
                return { path, message: `Maximum length is ${schema.maxLength}` };
            }
            if (schema.pattern && !schema.pattern.test(value)) {
                return { path, message: `Does not match pattern` };
            }
            break;

        case 'number':
            if (typeof value !== 'number' || isNaN(value)) {
                return { path, message: 'Expected number', expected: 'number', received: typeof value };
            }
            if (schema.min !== undefined && value < schema.min) {
                return { path, message: `Minimum value is ${schema.min}` };
            }
            if (schema.max !== undefined && value > schema.max) {
                return { path, message: `Maximum value is ${schema.max}` };
            }
            break;

        case 'boolean':
            if (typeof value !== 'boolean') {
                return { path, message: 'Expected boolean', expected: 'boolean', received: typeof value };
            }
            break;

        case 'array':
            if (!Array.isArray(value)) {
                return { path, message: 'Expected array', expected: 'array', received: typeof value };
            }
            break;

        case 'object':
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                return { path, message: 'Expected object', expected: 'object', received: typeof value };
            }
            break;

        case 'enum':
            if (schema.values && !schema.values.includes(String(value))) {
                return { path, message: `Must be one of: ${schema.values.join(', ')}`, received: String(value) };
            }
            break;
    }

    return null;
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): void {
    for (const [key, value] of Object.entries(source)) {
        if (
            value && typeof value === 'object' && !Array.isArray(value) &&
            target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
        ) {
            deepMerge(target[key] as Record<string, unknown>, value as Record<string, unknown>);
        } else {
            target[key] = value;
        }
    }
}

function parseEnvValue(value: string): unknown {
    if (value === 'true') return true;
    if (value === 'false') return false;
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') return num;
    return value;
}
