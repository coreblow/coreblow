// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import { ConfigValidator, getNestedValue, setNestedValue } from './config-validator.js';

describe('Config Validator — Phase 6', () => {
    let validator: ConfigValidator;

    beforeEach(() => {
        validator = new ConfigValidator();
    });

    it('validates empty config (applies defaults)', () => {
        const config: Record<string, unknown> = {};
        const result = validator.validate(config);
        expect(result.valid).toBe(true);
        expect(result.applied.length).toBeGreaterThan(0);
        expect(getNestedValue(config, 'port')).toBe(3100);
    });

    it('validates correct config', () => {
        const config = { port: 8080, host: 'localhost' };
        const result = validator.validate(config);
        expect(result.valid).toBe(true);
    });

    it('rejects port out of range', () => {
        const result = validator.validate({ port: 99999 });
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.path === 'port')).toBe(true);
    });

    it('rejects wrong type', () => {
        const result = validator.validate({ port: 'not-a-number' });
        expect(result.valid).toBe(false);
        expect(result.errors[0]!.message).toContain('Expected number');
    });

    it('adds custom rules', () => {
        validator.addRules([{
            path: 'custom.flag',
            type: 'boolean',
            required: true,
        }]);
        const result = validator.validate({});
        expect(result.valid).toBe(false);
        expect(result.errors.some(e => e.path === 'custom.flag')).toBe(true);
    });

    it('custom validator function', () => {
        validator.addRules([{
            path: 'apiKey',
            type: 'string',
            validate: (v) => (v as string).startsWith('sk-') ? null : 'Must start with sk-',
        }]);
        const result = validator.validate({ apiKey: 'bad-key' });
        expect(result.valid).toBe(false);
        expect(result.errors[0]!.message).toContain('sk-');
    });

    it('enum validation', () => {
        validator.addRules([{
            path: 'mode',
            type: 'string',
            enum: ['development', 'production', 'test'],
        }]);
        expect(validator.validate({ mode: 'development' }).valid).toBe(true);
        expect(validator.validate({ mode: 'invalid' }).valid).toBe(false);
    });

    it('migration runs in order', () => {
        validator.addMigration({
            fromVersion: 1, toVersion: 2,
            description: 'rename field',
            migrate: (c) => { c.newField = c.oldField; delete c.oldField; return c; },
        });
        const result = validator.migrate({ oldField: 'value' }, 1, 2);
        expect(result.newField).toBe('value');
        expect(result.oldField).toBeUndefined();
    });

    it('getSchema returns documentation', () => {
        const schema = validator.getSchema();
        expect(schema.length).toBeGreaterThan(0);
        expect(schema[0]!.path).toBe('port');
        expect(schema[0]!.type).toBe('number');
    });
});

describe('Nested Value Helpers', () => {
    it('getNestedValue extracts deep value', () => {
        expect(getNestedValue({ a: { b: { c: 42 } } }, 'a.b.c')).toBe(42);
    });

    it('getNestedValue returns undefined for missing', () => {
        expect(getNestedValue({}, 'x.y.z')).toBeUndefined();
    });

    it('setNestedValue creates deep path', () => {
        const obj: Record<string, unknown> = {};
        setNestedValue(obj, 'a.b.c', 99);
        expect(getNestedValue(obj, 'a.b.c')).toBe(99);
    });
});
