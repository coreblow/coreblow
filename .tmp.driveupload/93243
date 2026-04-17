/**
 * plugins/config-validator.test.ts
 *
 * Comprehensive test suite for PluginConfigValidator.
 * Tests schema building, validation, defaults, coercion, and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
    PluginConfigValidator,
    type PluginConfigValidationResult,
    type PluginConfigFieldError,
} from './config-validator.js';
import type { ManifestConfigField } from './manifest.js';

// ─── Helpers ─────────────────────────────────────────────────────

function makeField(overrides: Partial<ManifestConfigField> & { key: string; type: ManifestConfigField['type'] }): ManifestConfigField {
    return {
        label: overrides.key,
        ...overrides,
    };
}

// ─── Test Suite ──────────────────────────────────────────────────

describe('PluginConfigValidator', () => {
    let validator: PluginConfigValidator;

    beforeEach(() => {
        validator = new PluginConfigValidator();
    });

    // ════════════════════════════════════════════════════════════
    // Schema Building (8 tests)
    // ════════════════════════════════════════════════════════════

    describe('buildSchemaFromManifest', () => {
        it('should build schema with string field', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'apiKey', type: 'string', required: true }),
            ];
            const schema = validator.buildSchemaFromManifest(fields);
            expect(schema.jsonSchema).toBeDefined();
            expect((schema.jsonSchema as Record<string, unknown>).type).toBe('object');
            const props = (schema.jsonSchema as Record<string, Record<string, unknown>>).properties as Record<string, Record<string, unknown>>;
            expect(props.apiKey.type).toBe('string');
        });

        it('should build schema with number field', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'maxRetries', type: 'number', default: 3 }),
            ];
            const schema = validator.buildSchemaFromManifest(fields);
            const props = (schema.jsonSchema as Record<string, Record<string, unknown>>).properties as Record<string, Record<string, unknown>>;
            expect(props.maxRetries.type).toBe('number');
            expect(props.maxRetries.default).toBe(3);
        });

        it('should build schema with boolean field', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'debug', type: 'boolean', default: false }),
            ];
            const schema = validator.buildSchemaFromManifest(fields);
            const props = (schema.jsonSchema as Record<string, Record<string, unknown>>).properties as Record<string, Record<string, unknown>>;
            expect(props.debug.type).toBe('boolean');
            expect(props.debug.default).toBe(false);
        });

        it('should build schema with select field and options', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'mode', type: 'select', options: ['fast', 'balanced', 'thorough'] }),
            ];
            const schema = validator.buildSchemaFromManifest(fields);
            const props = (schema.jsonSchema as Record<string, Record<string, unknown>>).properties as Record<string, Record<string, unknown>>;
            expect(props.mode.type).toBe('string');
            expect(props.mode.enum).toEqual(['fast', 'balanced', 'thorough']);
        });

        it('should build schema with password field (maps to string)', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'secret', type: 'password' }),
            ];
            const schema = validator.buildSchemaFromManifest(fields);
            const props = (schema.jsonSchema as Record<string, Record<string, unknown>>).properties as Record<string, Record<string, unknown>>;
            expect(props.secret.type).toBe('string');
        });

        it('should build schema with array field', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'tags', type: 'array', default: [] }),
            ];
            const schema = validator.buildSchemaFromManifest(fields);
            const props = (schema.jsonSchema as Record<string, Record<string, unknown>>).properties as Record<string, Record<string, unknown>>;
            expect(props.tags.type).toBe('array');
        });

        it('should include required fields in JSON schema', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'apiKey', type: 'string', required: true }),
                makeField({ key: 'debug', type: 'boolean' }),
            ];
            const schema = validator.buildSchemaFromManifest(fields);
            expect((schema.jsonSchema as Record<string, unknown>).required).toEqual(['apiKey']);
        });

        it('should build UI hints for labeled/password fields', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'token', type: 'password', label: 'API Token', description: 'Your secret token' }),
            ];
            const schema = validator.buildSchemaFromManifest(fields);
            expect(schema.uiHints).toBeDefined();
            expect(schema.uiHints!.token).toMatchObject({
                label: 'API Token',
                help: 'Your secret token',
                sensitive: true,
            });
        });
    });

    // ════════════════════════════════════════════════════════════
    // Validation (12 tests)
    // ════════════════════════════════════════════════════════════

    describe('validatePluginConfig', () => {
        it('should pass for valid config', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'apiKey', type: 'string', required: true }),
                makeField({ key: 'debug', type: 'boolean', default: false }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { apiKey: 'sk-123' });
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should fail for missing required field', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'apiKey', type: 'string', required: true }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, {});
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].field).toBe('apiKey');
            expect(result.errors[0].constraint).toBe('required');
        });

        it('should fail for type mismatch — string expected, number given', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'name', type: 'string' }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { name: 123 });
            expect(result.valid).toBe(false);
            expect(result.errors[0].expected).toBe('string');
        });

        it('should fail for type mismatch — number expected, string given (non-numeric)', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'count', type: 'number' }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { count: 'abc' });
            expect(result.valid).toBe(false);
        });

        it('should fail for type mismatch — boolean expected, number given', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'enabled', type: 'boolean' }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { enabled: 42 });
            expect(result.valid).toBe(false);
        });

        it('should fail for type mismatch — array expected, string given', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'items', type: 'array' }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { items: 'not-array' });
            expect(result.valid).toBe(false);
        });

        it('should fail for invalid select option', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'mode', type: 'select', options: ['fast', 'slow'] }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { mode: 'invalid' });
            expect(result.valid).toBe(false);
            expect(result.errors[0].constraint).toContain('enum');
        });

        it('should fail for string pattern mismatch', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'url', type: 'string', validation: { pattern: '^https://' } }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { url: 'http://example.com' });
            expect(result.valid).toBe(false);
            expect(result.errors[0].constraint).toContain('pattern');
        });

        it('should fail for number below min', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'retries', type: 'number', validation: { min: 0, max: 10 } }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { retries: -1 });
            expect(result.valid).toBe(false);
            expect(result.errors[0].constraint).toContain('min');
        });

        it('should fail for number above max', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'retries', type: 'number', validation: { min: 0, max: 10 } }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { retries: 999 });
            expect(result.valid).toBe(false);
            expect(result.errors[0].constraint).toContain('max');
        });

        it('should fail for string below min length', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'name', type: 'string', validation: { min: 3 } }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { name: 'ab' });
            expect(result.valid).toBe(false);
            expect(result.errors[0].constraint).toContain('minLength');
        });

        it('should fail for string above max length', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'name', type: 'string', validation: { max: 5 } }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { name: 'toolong' });
            expect(result.valid).toBe(false);
            expect(result.errors[0].constraint).toContain('maxLength');
        });
    });

    // ════════════════════════════════════════════════════════════
    // Defaults (6 tests)
    // ════════════════════════════════════════════════════════════

    describe('defaults', () => {
        it('should apply default for missing optional field', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'debug', type: 'boolean', default: false }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, {});
            expect(result.resolvedConfig.debug).toBe(false);
            expect(result.appliedDefaults.debug).toBe(false);
        });

        it('should not override user-provided value with default', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'debug', type: 'boolean', default: false }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { debug: true });
            expect(result.resolvedConfig.debug).toBe(true);
            expect(result.appliedDefaults).not.toHaveProperty('debug');
        });

        it('should apply multiple defaults simultaneously', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'timeout', type: 'number', default: 30 }),
                makeField({ key: 'retries', type: 'number', default: 3 }),
                makeField({ key: 'verbose', type: 'boolean', default: false }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, {});
            expect(result.resolvedConfig.timeout).toBe(30);
            expect(result.resolvedConfig.retries).toBe(3);
            expect(result.resolvedConfig.verbose).toBe(false);
        });

        it('should apply defaults via applyDefaults() utility', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'port', type: 'number', default: 8080 }),
            ];
            const result = validator.applyDefaults(fields, {});
            expect(result.port).toBe(8080);
        });

        it('should not override existing value via applyDefaults()', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'port', type: 'number', default: 8080 }),
            ];
            const result = validator.applyDefaults(fields, { port: 3000 });
            expect(result.port).toBe(3000);
        });

        it('should apply default for null value', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'name', type: 'string', default: 'default-name' }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { name: null });
            expect(result.resolvedConfig.name).toBe('default-name');
        });
    });

    // ════════════════════════════════════════════════════════════
    // Type Coercion (6 tests)
    // ════════════════════════════════════════════════════════════

    describe('coercion', () => {
        it('should coerce string "42" to number 42', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'port', type: 'number' }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { port: '42' });
            expect(result.valid).toBe(true);
            expect(result.resolvedConfig.port).toBe(42);
        });

        it('should coerce string "true" to boolean true', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'debug', type: 'boolean' }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { debug: 'true' });
            expect(result.valid).toBe(true);
            expect(result.resolvedConfig.debug).toBe(true);
        });

        it('should coerce string "false" to boolean false', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'debug', type: 'boolean' }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { debug: 'false' });
            expect(result.valid).toBe(true);
            expect(result.resolvedConfig.debug).toBe(false);
        });

        it('should coerce JSON array string to array', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'tags', type: 'array' }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { tags: '["a","b","c"]' });
            expect(result.valid).toBe(true);
            expect(result.resolvedConfig.tags).toEqual(['a', 'b', 'c']);
        });

        it('should coerce comma-separated string to array', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'tags', type: 'array' }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { tags: 'a,b,c' });
            expect(result.valid).toBe(true);
            expect(result.resolvedConfig.tags).toEqual(['a', 'b', 'c']);
        });

        it('should coerce via coerceConfig() utility', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'port', type: 'number' }),
                makeField({ key: 'debug', type: 'boolean' }),
            ];
            const result = validator.coerceConfig(fields, { port: '3000', debug: '1' });
            expect(result.port).toBe(3000);
            expect(result.debug).toBe(true);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Integration (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('integration', () => {
        it('should handle full manifest → validate → resolve pipeline', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'apiKey', type: 'string', required: true, label: 'API Key' }),
                makeField({ key: 'maxRetries', type: 'number', default: 3, validation: { min: 0, max: 10 } }),
                makeField({ key: 'debug', type: 'boolean', default: false }),
                makeField({ key: 'mode', type: 'select', options: ['fast', 'slow'], default: 'fast' }),
            ];

            const result = validator.validatePluginConfig('weather-plugin', fields, {
                apiKey: 'sk-test-123',
                maxRetries: 5,
            });

            expect(result.valid).toBe(true);
            expect(result.resolvedConfig).toEqual({
                apiKey: 'sk-test-123',
                maxRetries: 5,
                debug: false,
                mode: 'fast',
            });
            expect(result.appliedDefaults).toEqual({
                debug: false,
                mode: 'fast',
            });
        });

        it('should validate schema built from manifest via validate()', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'name', type: 'string', required: true }),
            ];
            const schema = validator.buildSchemaFromManifest(fields);
            const result = schema.validate!({ name: 'test' });
            expect(result.ok).toBe(true);
        });

        it('should reject invalid config via schema validate()', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'name', type: 'string', required: true }),
            ];
            const schema = validator.buildSchemaFromManifest(fields);
            const result = schema.validate!({});
            expect(result.ok).toBe(false);
        });

        it('should produce batch report across multiple plugins', () => {
            const fields1: ManifestConfigField[] = [
                makeField({ key: 'key', type: 'string', required: true }),
            ];
            const fields2: ManifestConfigField[] = [
                makeField({ key: 'port', type: 'number', default: 8080 }),
            ];

            validator.validatePluginConfig('plugin-a', fields1, { key: 'valid' });
            validator.validatePluginConfig('plugin-b', fields2, {});

            const report = validator.getReport();
            expect(report.allValid).toBe(true);
            expect(report.totalErrors).toBe(0);
            expect(report.results.size).toBe(2);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Edge Cases (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('edge cases', () => {
        it('should pass for empty schema (no fields)', () => {
            const result = validator.validatePluginConfig('test-plugin', [], { anything: 'goes' });
            expect(result.valid).toBe(true);
            expect(result.warnings.length).toBeGreaterThan(0); // unknown field warning
        });

        it('should pass for undefined user config', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'debug', type: 'boolean', default: false }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, undefined);
            expect(result.valid).toBe(true);
            expect(result.resolvedConfig.debug).toBe(false);
        });

        it('should warn about unknown fields in user config', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'name', type: 'string' }),
            ];
            const result = validator.validatePluginConfig('test-plugin', fields, { name: 'ok', extra: true });
            expect(result.valid).toBe(true);
            expect(result.warnings.some((w) => w.includes('extra'))).toBe(true);
        });

        it('should clear results', () => {
            const fields: ManifestConfigField[] = [
                makeField({ key: 'x', type: 'string' }),
            ];
            validator.validatePluginConfig('a', fields, {});
            expect(validator.getResult('a')).toBeDefined();
            validator.clear();
            expect(validator.getResult('a')).toBeUndefined();
        });
    });
});
