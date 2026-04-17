/**
 * CoreBlow Phase 42 — Schema Validator Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - validate: types, enums, nested objects, arrays, missing schemas
 *   - defaults, generate sample
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaValidator } from '../../src/tools/schema-validator.js';

describe('SchemaValidator — Extended', () => {
    let validator: SchemaValidator;

    beforeEach(() => { validator = new SchemaValidator(); });

    it('should register and list schemas', () => {
        validator.register('t1', { auth: { type: 'string' } });
        expect(validator.list()).toContain('t1');
        expect(validator.count()).toBe(1);
    });

    it('should validate string types', () => {
        validator.register('str', { name: { type: 'string', required: true } });
        expect(validator.validate('str', { name: 'Alice' }).valid).toBe(true);
        const errs = validator.validate('str', { name: 123 }).errors;
        expect(errs[0]?.message).toContain('Expected string');

        const reqErr = validator.validate('str', {}).errors;
        expect(reqErr[0]?.message).toContain('is required');
    });

    it('should validate numeric types', () => {
        const res = validator.validateDirect({ age: 30 }, { age: { type: 'number' } });
        expect(res.valid).toBe(true);
    });

    it('should validate boolean types', () => {
        const res = validator.validateDirect({ ok: true }, { ok: { type: 'boolean' } });
        expect(res.valid).toBe(true);
    });

    it('should validate arrays', () => {
        const data = { tags: ['a', 'b'] };
        const schema = { tags: { type: 'array', items: { type: 'string' } } };
        expect(validator.validateDirect(data, schema as any).valid).toBe(true);

        const bad = { tags: ['a', 123] };
        expect(validator.validateDirect(bad, schema as any).valid).toBe(false);
    });

    it('should validate enums', () => {
        const schema = { role: { type: 'enum', enum: ['admin', 'user'] } };
        expect(validator.validateDirect({ role: 'admin' }, schema as any).valid).toBe(true);
        expect(validator.validateDirect({ role: 'guest' }, schema as any).valid).toBe(false);
    });

    it('should validate nested objects', () => {
        const schema = {
            profile: { type: 'object', properties: { age: { type: 'number' } } },
        };
        expect(validator.validateDirect({ profile: { age: 30 } }, schema as any).valid).toBe(true);
        expect(validator.validateDirect({ profile: { age: 'thirty' } }, schema as any).valid).toBe(false);
    });

    it('should apply defaults safely', () => {
        const schema = {
            level: { type: 'number', default: 1 },
            name: { type: 'string' }
        };
        const res = validator.applyDefaults({ name: 'Bob' }, schema as any);
        expect(res['level']).toBe(1);
        expect(res['name']).toBe('Bob');
    });

    it('should generate valid sample data', () => {
        const schema = {
            name: { type: 'string', default: 'Alice' },
            age: { type: 'number', default: 30 },
            active: { type: 'boolean', default: true },
            role: { type: 'enum', enum: ['user'] },
        };
        const sample = validator.generateSample(schema as any);
        expect(sample['name']).toBe('Alice');
        expect(sample['age']).toBe(30);
        expect(sample['active']).toBe(true);
        expect(sample['role']).toBe('user');
    });

    it('should fail on missing schema', () => {
        const res = validator.validate('unknown', { ok: true });
        expect(res.valid).toBe(false);
        expect(res.errors[0]?.message).toContain('not found');
    });
});
