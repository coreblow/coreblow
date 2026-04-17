/**
 * CoreBlow Phase 34 — ConfigValidator Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - Schema validation: type checks, range, pattern, enum, custom
 *   - Default application, migration, nested helpers
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigValidator, getNestedValue, setNestedValue } from '../../src/gateway/config-validator.js';

describe('ConfigValidator — Extended', () => {
    let validator: ConfigValidator;
    beforeEach(() => { validator = new ConfigValidator(); });

    it('should validate valid config with all defaults', () => {
        const config: Record<string, unknown> = {};
        const result = validator.validate(config);
        expect(result.valid).toBe(true);
        expect(result.applied.length).toBeGreaterThan(0); // Defaults applied
    });

    it('should apply default values for missing fields', () => {
        const config: Record<string, unknown> = {};
        validator.validate(config);
        expect(getNestedValue(config, 'port')).toBe(3100);
        expect(getNestedValue(config, 'host')).toBe('0.0.0.0');
        expect(getNestedValue(config, 'agent.provider')).toBe('anthropic');
    });

    it('should error on wrong type', () => {
        const config: Record<string, unknown> = { port: 'not-a-number' };
        const result = validator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.path === 'port')).toBe(true);
    });

    it('should error on out-of-range number', () => {
        const config: Record<string, unknown> = { port: 99999 };
        const result = validator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors[0]?.message).toContain('above maximum');
    });

    it('should error on number below minimum', () => {
        const config: Record<string, unknown> = { port: 0 };
        const result = validator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors[0]?.message).toContain('below minimum');
    });

    it('should support custom validation rules', () => {
        validator.addRules([{
            path: 'custom.field', type: 'string', required: true,
            validate: (v) => (v as string).length < 3 ? 'Too short' : null,
        }]);
        const config = { custom: { field: 'ab' } };
        const result = validator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.message === 'Too short')).toBe(true);
    });

    it('should support enum validation', () => {
        validator.addRules([{
            path: 'mode', type: 'string', enum: ['development', 'production', 'test'],
        }]);
        const config = { mode: 'invalid' };
        const result = validator.validate(config);
        expect(result.valid).toBe(false);
        expect(result.errors[0]?.message).toContain('one of');
    });

    it('should support pattern validation', () => {
        validator.addRules([{
            path: 'email', type: 'string', pattern: /^[\w.]+@[\w.]+$/,
        }]);
        const good = { email: 'test@example.com' };
        const bad = { email: 'not-email' };
        expect(validator.validate(good).valid).toBe(true);
        expect(validator.validate(bad).valid).toBe(false);
    });

    it('should run migrations in order', () => {
        validator.addMigration({
            fromVersion: 1, toVersion: 2, description: 'Rename field',
            migrate: (cfg) => { cfg.newField = cfg.oldField; delete cfg.oldField; return cfg; },
        });
        validator.addMigration({
            fromVersion: 2, toVersion: 3, description: 'Add default',
            migrate: (cfg) => { cfg.extra = 'added'; return cfg; },
        });

        const migrated = validator.migrate({ oldField: 'value' }, 1, 3);
        expect(migrated.newField).toBe('value');
        expect(migrated.extra).toBe('added');
    });

    it('should return schema documentation', () => {
        const schema = validator.getSchema();
        expect(schema.length).toBeGreaterThan(0);
        expect(schema[0]?.path).toBe('port');
        expect(schema[0]?.type).toBe('number');
    });

    it('should validate required fields', () => {
        validator.addRules([{ path: 'required.field', type: 'string', required: true }]);
        const result = validator.validate({});
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.path === 'required.field')).toBe(true);
    });
});

describe('Nested Value Helpers', () => {
    it('should get deeply nested value', () => {
        const obj = { a: { b: { c: 42 } } };
        expect(getNestedValue(obj, 'a.b.c')).toBe(42);
    });

    it('should return undefined for missing path', () => {
        expect(getNestedValue({}, 'a.b.c')).toBeUndefined();
    });

    it('should set deeply nested value', () => {
        const obj: Record<string, unknown> = {};
        setNestedValue(obj, 'a.b.c', 'deep');
        expect(getNestedValue(obj, 'a.b.c')).toBe('deep');
    });
});
