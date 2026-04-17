// @ts-nocheck
/**
 * plugins/config-validator.ts
 *
 * Plugin Config Validator — Schema-based plugin config validation with defaults.
 *
 * Following CoreBlow's config-schema.ts (128 LOC) pattern, upgraded to CoreBlow's
 * OOP class-based architecture with additional type coercion, nested defaults,
 * and rich structured error reporting.
 *
 * Responsibilities:
 *   - Convert ManifestConfigField[] → PluginConfigSchema
 *   - Validate user-provided config values against schema
 *   - Apply defaults for missing optional fields
 *   - Coerce env-string values to proper types
 *   - Report structured validation errors with field paths
 */

import { createChildLogger } from '../utils/logger.js';
import type { ManifestConfigField } from './manifest.js';
import type { PluginConfigSchema, PluginConfigValidation } from './types.js';

const log = createChildLogger('plugin:config-validator');

// ─── Types ───────────────────────────────────────────────────────

/** Validation result for a single plugin's config */
export interface PluginConfigValidationResult {
    /** Whether validation passed */
    valid: boolean;
    /** Plugin ID */
    pluginId: string;
    /** Field-level errors */
    errors: PluginConfigFieldError[];
    /** Non-fatal warnings */
    warnings: string[];
    /** Config with defaults applied and types coerced */
    resolvedConfig: Record<string, unknown>;
    /** Default values that were applied */
    appliedDefaults: Record<string, unknown>;
    /** Original schema fields */
    schemaFields: ManifestConfigField[];
}

/** Structured field-level error */
export interface PluginConfigFieldError {
    /** Field key path */
    field: string;
    /** Human-readable error message */
    message: string;
    /** Expected type or value */
    expected?: string;
    /** Received type or value */
    received?: string;
    /** Constraint that failed (e.g., "min:0", "pattern:/^https/") */
    constraint?: string;
}

/** Batch validation report across all plugins */
export interface ConfigValidationReport {
    /** All plugins valid */
    allValid: boolean;
    /** Per-plugin results */
    results: Map<string, PluginConfigValidationResult>;
    /** Total error count */
    totalErrors: number;
    /** Total warning count */
    totalWarnings: number;
}

// ─── Valid field types ────────────────────────────────────────────

const VALID_FIELD_TYPES = new Set([
    'string', 'number', 'boolean', 'select', 'password', 'array',
]);

// ─── PluginConfigValidator ───────────────────────────────────────

/**
 * CoreBlow Plugin Config Validator
 *
 * OOP equivalent of CoreBlow's config-schema.ts validation functions.
 * Provides schema-based plugin config validation with defaults, type coercion,
 * and structured error reporting.
 */
export class PluginConfigValidator {
    /** Per-plugin validation results */
    private results = new Map<string, PluginConfigValidationResult>();

    /**
     * Validate a plugin's config against its manifest schema.
     *
     * Pipeline: schema parse → defaults → coerce → validate → report
     */
    validatePluginConfig(
        pluginId: string,
        schemaFields: ManifestConfigField[],
        userConfig?: Record<string, unknown>,
    ): PluginConfigValidationResult {
        const errors: PluginConfigFieldError[] = [];
        const warnings: string[] = [];
        const appliedDefaults: Record<string, unknown> = {};

        // Start with empty or user-provided config
        const config: Record<string, unknown> = { ...(userConfig ?? {}) };

        // Phase 1: Apply defaults for missing fields
        for (const field of schemaFields) {
            if (config[field.key] === undefined || config[field.key] === null) {
                if (field.default !== undefined) {
                    config[field.key] = field.default;
                    appliedDefaults[field.key] = field.default;
                }
            }
        }

        // Phase 2: Coerce string values to proper types (env vars come as strings)
        for (const field of schemaFields) {
            const value = config[field.key];
            if (value !== undefined && value !== null) {
                config[field.key] = this.coerceType(field, value);
            }
        }

        // Phase 3: Validate each field
        for (const field of schemaFields) {
            const value = config[field.key];
            const fieldErrors = this.validateField(field, value);
            errors.push(...fieldErrors);
        }

        // Phase 4: Warn about unknown fields
        const knownKeys = new Set(schemaFields.map((f) => f.key));
        for (const key of Object.keys(config)) {
            if (!knownKeys.has(key)) {
                warnings.push(`Unknown config field: "${key}" — not defined in plugin schema`);
            }
        }

        const result: PluginConfigValidationResult = {
            valid: errors.length === 0,
            pluginId,
            errors,
            warnings,
            resolvedConfig: config,
            appliedDefaults,
            schemaFields,
        };

        this.results.set(pluginId, result);

        if (errors.length > 0) {
            log.warn(`Config validation failed for plugin "${pluginId}": ${errors.length} error(s)`);
        } else {
            log.debug(`Config validation passed for plugin "${pluginId}"`);
        }

        return result;
    }

    /**
     * Build a PluginConfigSchema from manifest config fields.
     * Returns an object implementing the PluginConfigSchema contract
     * (validate + jsonSchema + uiHints).
     */
    buildSchemaFromManifest(fields: ManifestConfigField[]): PluginConfigSchema {
        const validator = this;

        // Build JSON Schema
        const properties: Record<string, Record<string, unknown>> = {};
        const required: string[] = [];

        for (const field of fields) {
            const prop: Record<string, unknown> = {
                type: field.type === 'select' ? 'string' : field.type === 'password' ? 'string' : field.type,
            };
            if (field.default !== undefined) prop.default = field.default;
            if (field.description) prop.description = field.description;
            if (field.options) prop.enum = field.options;
            if (field.validation) {
                if (field.validation.min !== undefined) prop.minimum = field.validation.min;
                if (field.validation.max !== undefined) prop.maximum = field.validation.max;
                if (field.validation.pattern) prop.pattern = field.validation.pattern;
            }
            properties[field.key] = prop;
            if (field.required) required.push(field.key);
        }

        const jsonSchema: Record<string, unknown> = {
            type: 'object',
            properties,
            ...(required.length > 0 ? { required } : {}),
        };

        // Build UI hints
        const uiHints: Record<string, { label?: string; help?: string; sensitive?: boolean; placeholder?: string }> = {};
        for (const field of fields) {
            const hint: Record<string, unknown> = {};
            if (field.label) hint.label = field.label;
            if (field.description) hint.help = field.description;
            if (field.type === 'password') hint.sensitive = true;
            if (Object.keys(hint).length > 0) {
                uiHints[field.key] = hint as typeof uiHints[string];
            }
        }

        return {
            validate: (value: unknown): PluginConfigValidation => {
                if (!value || typeof value !== 'object') {
                    return { ok: false, errors: ['Config must be an object'] };
                }
                const result = validator.validatePluginConfig('inline', fields, value as Record<string, unknown>);
                if (result.valid) {
                    return { ok: true, value: result.resolvedConfig };
                }
                return { ok: false, errors: result.errors.map((e) => `${e.field}: ${e.message}`) };
            },
            jsonSchema,
            uiHints: Object.keys(uiHints).length > 0 ? uiHints : undefined,
        };
    }

    /**
     * Apply defaults from schema to a config object.
     * Returns a new object, does not mutate the input.
     */
    applyDefaults(
        fields: ManifestConfigField[],
        config: Record<string, unknown>,
    ): Record<string, unknown> {
        const result = { ...config };
        for (const field of fields) {
            if ((result[field.key] === undefined || result[field.key] === null) && field.default !== undefined) {
                result[field.key] = field.default;
            }
        }
        return result;
    }

    /**
     * Coerce string environment values to proper types based on schema.
     * Returns a new object, does not mutate the input.
     */
    coerceConfig(
        fields: ManifestConfigField[],
        config: Record<string, unknown>,
    ): Record<string, unknown> {
        const result = { ...config };
        for (const field of fields) {
            const value = result[field.key];
            if (value !== undefined && value !== null) {
                result[field.key] = this.coerceType(field, value);
            }
        }
        return result;
    }

    /**
     * Get validation result for a specific plugin.
     */
    getResult(pluginId: string): PluginConfigValidationResult | undefined {
        return this.results.get(pluginId);
    }

    /**
     * Get batch validation report across all validated plugins.
     */
    getReport(): ConfigValidationReport {
        let totalErrors = 0;
        let totalWarnings = 0;
        let allValid = true;

        for (const [, result] of this.results) {
            totalErrors += result.errors.length;
            totalWarnings += result.warnings.length;
            if (!result.valid) allValid = false;
        }

        return {
            allValid,
            results: new Map(this.results),
            totalErrors,
            totalWarnings,
        };
    }

    /**
     * Clear all stored validation results.
     */
    clear(): void {
        this.results.clear();
    }

    // ─── Private ─────────────────────────────────────────────────

    /**
     * Validate a single field value against its schema definition.
     */
    private validateField(
        field: ManifestConfigField,
        value: unknown,
    ): PluginConfigFieldError[] {
        const errors: PluginConfigFieldError[] = [];

        // Validate field type is recognized
        if (!VALID_FIELD_TYPES.has(field.type)) {
            errors.push({
                field: field.key,
                message: `Unknown field type: "${field.type}"`,
                expected: `one of [${[...VALID_FIELD_TYPES].join(', ')}]`,
                received: field.type,
            });
            return errors;
        }

        // Check required
        if (field.required && (value === undefined || value === null)) {
            errors.push({
                field: field.key,
                message: 'Required field is missing',
                expected: field.type,
                constraint: 'required',
            });
            return errors;
        }

        // Skip optional missing fields
        if (value === undefined || value === null) {
            return errors;
        }

        // Type validation
        switch (field.type) {
            case 'string':
            case 'password':
                if (typeof value !== 'string') {
                    errors.push({
                        field: field.key,
                        message: `Expected string, got ${typeof value}`,
                        expected: 'string',
                        received: typeof value,
                    });
                    break;
                }
                this.validateStringConstraints(field, value, errors);
                break;

            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    errors.push({
                        field: field.key,
                        message: `Expected number, got ${typeof value}`,
                        expected: 'number',
                        received: typeof value,
                    });
                    break;
                }
                this.validateNumberConstraints(field, value, errors);
                break;

            case 'boolean':
                if (typeof value !== 'boolean') {
                    errors.push({
                        field: field.key,
                        message: `Expected boolean, got ${typeof value}`,
                        expected: 'boolean',
                        received: typeof value,
                    });
                }
                break;

            case 'select':
                if (typeof value !== 'string') {
                    errors.push({
                        field: field.key,
                        message: `Expected string for select, got ${typeof value}`,
                        expected: 'string',
                        received: typeof value,
                    });
                    break;
                }
                if (field.options && !field.options.includes(value)) {
                    errors.push({
                        field: field.key,
                        message: `Value "${value}" is not a valid option`,
                        expected: `one of [${field.options.join(', ')}]`,
                        received: value,
                        constraint: `enum:[${field.options.join(',')}]`,
                    });
                }
                break;

            case 'array':
                if (!Array.isArray(value)) {
                    errors.push({
                        field: field.key,
                        message: `Expected array, got ${typeof value}`,
                        expected: 'array',
                        received: typeof value,
                    });
                }
                break;
        }

        return errors;
    }

    /**
     * Validate string-specific constraints (pattern, minLength via validation.min).
     */
    private validateStringConstraints(
        field: ManifestConfigField,
        value: string,
        errors: PluginConfigFieldError[],
    ): void {
        if (!field.validation) return;

        if (field.validation.pattern) {
            try {
                const regex = new RegExp(field.validation.pattern);
                if (!regex.test(value)) {
                    errors.push({
                        field: field.key,
                        message: `Value does not match pattern: ${field.validation.pattern}`,
                        received: value,
                        constraint: `pattern:${field.validation.pattern}`,
                    });
                }
            } catch {
                errors.push({
                    field: field.key,
                    message: `Invalid regex pattern in schema: ${field.validation.pattern}`,
                    constraint: 'pattern-invalid',
                });
            }
        }

        if (field.validation.min !== undefined && value.length < field.validation.min) {
            errors.push({
                field: field.key,
                message: `String length ${value.length} is below minimum ${field.validation.min}`,
                constraint: `minLength:${field.validation.min}`,
            });
        }

        if (field.validation.max !== undefined && value.length > field.validation.max) {
            errors.push({
                field: field.key,
                message: `String length ${value.length} exceeds maximum ${field.validation.max}`,
                constraint: `maxLength:${field.validation.max}`,
            });
        }
    }

    /**
     * Validate number-specific constraints (min, max).
     */
    private validateNumberConstraints(
        field: ManifestConfigField,
        value: number,
        errors: PluginConfigFieldError[],
    ): void {
        if (!field.validation) return;

        if (field.validation.min !== undefined && value < field.validation.min) {
            errors.push({
                field: field.key,
                message: `Value ${value} is below minimum ${field.validation.min}`,
                expected: `>= ${field.validation.min}`,
                received: String(value),
                constraint: `min:${field.validation.min}`,
            });
        }

        if (field.validation.max !== undefined && value > field.validation.max) {
            errors.push({
                field: field.key,
                message: `Value ${value} exceeds maximum ${field.validation.max}`,
                expected: `<= ${field.validation.max}`,
                received: String(value),
                constraint: `max:${field.validation.max}`,
            });
        }
    }

    /**
     * Coerce a value to the expected type based on field schema.
     * Useful when config comes from environment variables (always strings).
     */
    private coerceType(field: ManifestConfigField, value: unknown): unknown {
        if (typeof value !== 'string') return value;

        switch (field.type) {
            case 'number': {
                const num = Number(value);
                return isNaN(num) ? value : num;
            }
            case 'boolean': {
                if (value === 'true' || value === '1') return true;
                if (value === 'false' || value === '0') return false;
                return value;
            }
            case 'array': {
                // Try JSON parse for array strings
                try {
                    const parsed = JSON.parse(value);
                    return Array.isArray(parsed) ? parsed : value;
                } catch {
                    // Try comma-separated
                    if (value.includes(',')) {
                        return value.split(',').map((s) => s.trim()).filter(Boolean);
                    }
                    return value;
                }
            }
            default:
                return value;
        }
    }
}
