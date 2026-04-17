/**
 * plugin-sdk/config-builder.ts
 *
 * Fluent config schema builder for plugin authors.
 * Lets plugins declaratively define their config shape with
 * types, defaults, validation, and UI hints.
 */

import type { PluginConfigSchema, PluginConfigUiHint } from '../plugins/types.js';

// ─── Types ───────────────────────────────────────────────────────

type FieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

interface FieldDef {
    type: FieldType;
    required: boolean;
    default?: unknown;
    description?: string;
    uiHint?: PluginConfigUiHint;
    validator?: (value: unknown) => boolean;
    enum?: unknown[];
}

// ─── ConfigBuilder ───────────────────────────────────────────────

/**
 * Fluent config schema builder for plugin authors.
 *
 * @example
 * ```ts
 * const schema = new ConfigBuilder()
 *   .string('apiKey', { required: true, sensitive: true, label: 'API Key' })
 *   .number('maxRetries', { default: 3, label: 'Max Retries' })
 *   .boolean('debug', { default: false })
 *   .build();
 * ```
 */
export class ConfigBuilder {
    private fields = new Map<string, FieldDef>();

    /**
     * Add a string field.
     */
    string(name: string, opts?: {
        required?: boolean;
        default?: string;
        description?: string;
        label?: string;
        help?: string;
        placeholder?: string;
        sensitive?: boolean;
        advanced?: boolean;
        enum?: string[];
    }): this {
        this.fields.set(name, {
            type: 'string',
            required: opts?.required ?? false,
            default: opts?.default,
            description: opts?.description,
            enum: opts?.enum,
            uiHint: this.buildUiHint(opts),
        });
        return this;
    }

    /**
     * Add a number field.
     */
    number(name: string, opts?: {
        required?: boolean;
        default?: number;
        description?: string;
        label?: string;
        help?: string;
        min?: number;
        max?: number;
        advanced?: boolean;
    }): this {
        const min = opts?.min;
        const max = opts?.max;
        this.fields.set(name, {
            type: 'number',
            required: opts?.required ?? false,
            default: opts?.default,
            description: opts?.description,
            validator: (value: unknown) => {
                if (typeof value !== 'number') return false;
                if (min !== undefined && value < min) return false;
                if (max !== undefined && value > max) return false;
                return true;
            },
            uiHint: this.buildUiHint(opts),
        });
        return this;
    }

    /**
     * Add a boolean field.
     */
    boolean(name: string, opts?: {
        required?: boolean;
        default?: boolean;
        description?: string;
        label?: string;
        help?: string;
        advanced?: boolean;
    }): this {
        this.fields.set(name, {
            type: 'boolean',
            required: opts?.required ?? false,
            default: opts?.default,
            description: opts?.description,
            uiHint: this.buildUiHint(opts),
        });
        return this;
    }

    /**
     * Add an array field.
     */
    array(name: string, opts?: {
        required?: boolean;
        default?: unknown[];
        description?: string;
        label?: string;
        help?: string;
        advanced?: boolean;
    }): this {
        this.fields.set(name, {
            type: 'array',
            required: opts?.required ?? false,
            default: opts?.default,
            description: opts?.description,
            uiHint: this.buildUiHint(opts),
        });
        return this;
    }

    /**
     * Add an object field.
     */
    object(name: string, opts?: {
        required?: boolean;
        default?: Record<string, unknown>;
        description?: string;
        label?: string;
        help?: string;
        advanced?: boolean;
    }): this {
        this.fields.set(name, {
            type: 'object',
            required: opts?.required ?? false,
            default: opts?.default,
            description: opts?.description,
            uiHint: this.buildUiHint(opts),
        });
        return this;
    }

    /**
     * Build the config schema.
     */
    build(): PluginConfigSchema {
        const fields = new Map(this.fields);
        const uiHints: Record<string, PluginConfigUiHint> = {};

        for (const [name, field] of fields) {
            if (field.uiHint) {
                uiHints[name] = field.uiHint;
            }
        }

        // Build JSON Schema
        const properties: Record<string, Record<string, unknown>> = {};
        const required: string[] = [];

        for (const [name, field] of fields) {
            const prop: Record<string, unknown> = { type: field.type };
            if (field.default !== undefined) prop.default = field.default;
            if (field.description) prop.description = field.description;
            if (field.enum) prop.enum = field.enum;
            properties[name] = prop;
            if (field.required) required.push(name);
        }

        const jsonSchema: Record<string, unknown> = {
            type: 'object',
            properties,
            ...(required.length > 0 ? { required } : {}),
        };

        return {
            validate: (value: unknown) => {
                if (!value || typeof value !== 'object') {
                    return { ok: false, errors: ['Config must be an object'] };
                }
                const obj = value as Record<string, unknown>;
                const errors: string[] = [];

                for (const [name, field] of fields) {
                    const val = obj[name];

                    // Check required
                    if (field.required && (val === undefined || val === null)) {
                        errors.push(`${name}: required field is missing`);
                        continue;
                    }

                    // Skip optional missing fields
                    if (val === undefined || val === null) continue;

                    // Type check
                    if (field.type === 'array') {
                        if (!Array.isArray(val)) {
                            errors.push(`${name}: expected array, got ${typeof val}`);
                            continue;
                        }
                    } else if (typeof val !== field.type) {
                        errors.push(`${name}: expected ${field.type}, got ${typeof val}`);
                        continue;
                    }

                    // Enum check
                    if (field.enum && !field.enum.includes(val)) {
                        errors.push(`${name}: must be one of [${field.enum.join(', ')}]`);
                        continue;
                    }

                    // Custom validator
                    if (field.validator && !field.validator(val)) {
                        errors.push(`${name}: validation failed`);
                    }
                }

                if (errors.length > 0) {
                    return { ok: false, errors };
                }
                return { ok: true, value: obj };
            },
            uiHints: Object.keys(uiHints).length > 0 ? uiHints : undefined,
            jsonSchema,
        };
    }

    /**
     * Get all field definitions.
     */
    getFields(): Map<string, FieldDef> {
        return new Map(this.fields);
    }

    /**
     * Get defaults object.
     */
    getDefaults(): Record<string, unknown> {
        const defaults: Record<string, unknown> = {};
        for (const [name, field] of this.fields) {
            if (field.default !== undefined) {
                defaults[name] = field.default;
            }
        }
        return defaults;
    }

    // ─── Private ─────────────────────────────────────────────────

    private buildUiHint(opts?: Record<string, unknown>): PluginConfigUiHint | undefined {
        if (!opts) return undefined;
        const hint: PluginConfigUiHint = {};
        if (typeof opts.label === 'string') hint.label = opts.label;
        if (typeof opts.help === 'string') hint.help = opts.help;
        if (typeof opts.placeholder === 'string') hint.placeholder = opts.placeholder;
        if (typeof opts.sensitive === 'boolean') hint.sensitive = opts.sensitive;
        if (typeof opts.advanced === 'boolean') hint.advanced = opts.advanced;
        return Object.keys(hint).length > 0 ? hint : undefined;
    }
}
