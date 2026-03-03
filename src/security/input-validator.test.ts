import { describe, it, expect, beforeEach } from 'vitest';
import { InputValidator } from './input-validator.js';
import type { ValidationSchema } from './input-validator.js';

describe('InputValidator', () => {
    let v: InputValidator;

    beforeEach(() => {
        v = new InputValidator();
    });

    // ─── Type Validation ─────────────────────────────────────────

    describe('type checking', () => {
        it('should accept string type', () => {
            const r = v.validate({ name: 'John' }, { name: { type: 'string' } });
            expect(r.valid).toBe(true);
            expect(r.sanitized.name).toBe('John');
        });

        it('should reject non-string for string type', () => {
            const r = v.validate({ name: 123 }, { name: { type: 'string' } });
            expect(r.valid).toBe(false);
            expect(r.errors[0].field).toBe('name');
        });

        it('should accept number type', () => {
            const r = v.validate({ age: 25 }, { age: { type: 'number' } });
            expect(r.valid).toBe(true);
        });

        it('should reject non-number for number type', () => {
            const r = v.validate({ age: '25' }, { age: { type: 'number' } });
            expect(r.valid).toBe(false);
        });

        it('should accept boolean type', () => {
            const r = v.validate({ active: true }, { active: { type: 'boolean' } });
            expect(r.valid).toBe(true);
        });

        it('should reject non-boolean for boolean type', () => {
            const r = v.validate({ active: 'yes' }, { active: { type: 'boolean' } });
            expect(r.valid).toBe(false);
        });

        it('should accept valid email type', () => {
            const r = v.validate({ mail: 'a@b.com' }, { mail: { type: 'email' } });
            expect(r.valid).toBe(true);
        });

        it('should reject invalid email type', () => {
            const r = v.validate({ mail: 'notanemail' }, { mail: { type: 'email' } });
            expect(r.valid).toBe(false);
        });

        it('should accept valid url type', () => {
            const r = v.validate({ link: 'https://example.com' }, { link: { type: 'url' } });
            expect(r.valid).toBe(true);
        });

        it('should reject invalid url type', () => {
            const r = v.validate({ link: 'not a url' }, { link: { type: 'url' } });
            expect(r.valid).toBe(false);
        });

        it('should accept valid json type', () => {
            const r = v.validate({ data: '{"a":1}' }, { data: { type: 'json' } });
            expect(r.valid).toBe(true);
        });

        it('should reject invalid json type', () => {
            const r = v.validate({ data: '{bad' }, { data: { type: 'json' } });
            expect(r.valid).toBe(false);
        });

        it('should accept array type', () => {
            const r = v.validate({ items: [1, 2] }, { items: { type: 'array' } });
            expect(r.valid).toBe(true);
        });

        it('should reject non-array for array type', () => {
            const r = v.validate({ items: 'not array' }, { items: { type: 'array' } });
            expect(r.valid).toBe(false);
        });

        it('should accept object type', () => {
            const r = v.validate({ meta: { a: 1 } }, { meta: { type: 'object' } });
            expect(r.valid).toBe(true);
        });

        it('should reject array as object type', () => {
            const r = v.validate({ meta: [1, 2] }, { meta: { type: 'object' } });
            expect(r.valid).toBe(false);
        });
    });

    // ─── Required Fields ─────────────────────────────────────────

    describe('required fields', () => {
        it('should fail when required field is missing', () => {
            const r = v.validate({}, { name: { type: 'string', required: true } });
            expect(r.valid).toBe(false);
            expect(r.errors[0].message).toContain('required');
        });

        it('should fail when required field is empty string', () => {
            const r = v.validate({ name: '' }, { name: { type: 'string', required: true } });
            expect(r.valid).toBe(false);
        });

        it('should fail when required field is null', () => {
            const r = v.validate({ name: null }, { name: { type: 'string', required: true } });
            expect(r.valid).toBe(false);
        });

        it('should skip optional missing fields', () => {
            const r = v.validate({}, { name: { type: 'string' } });
            expect(r.valid).toBe(true);
        });
    });

    // ─── String Constraints ──────────────────────────────────────

    describe('string constraints', () => {
        it('should enforce minLength', () => {
            const r = v.validate({ pw: 'ab' }, { pw: { type: 'string', minLength: 3 } });
            expect(r.valid).toBe(false);
        });

        it('should enforce maxLength', () => {
            const r = v.validate({ pw: 'abcdef' }, { pw: { type: 'string', maxLength: 3 } });
            expect(r.valid).toBe(false);
        });

        it('should accept within range', () => {
            const r = v.validate({ pw: 'abc' }, { pw: { type: 'string', minLength: 2, maxLength: 5 } });
            expect(r.valid).toBe(true);
        });

        it('should enforce pattern', () => {
            const r = v.validate({ code: 'abc' }, { code: { type: 'string', pattern: /^\d+$/ } });
            expect(r.valid).toBe(false);
        });

        it('should accept matching pattern', () => {
            const r = v.validate({ code: '123' }, { code: { type: 'string', pattern: /^\d+$/ } });
            expect(r.valid).toBe(true);
        });
    });

    // ─── Number Constraints ──────────────────────────────────────

    describe('number constraints', () => {
        it('should enforce min', () => {
            const r = v.validate({ age: 5 }, { age: { type: 'number', min: 18 } });
            expect(r.valid).toBe(false);
        });

        it('should enforce max', () => {
            const r = v.validate({ age: 200 }, { age: { type: 'number', max: 150 } });
            expect(r.valid).toBe(false);
        });

        it('should accept within range', () => {
            const r = v.validate({ age: 25 }, { age: { type: 'number', min: 0, max: 150 } });
            expect(r.valid).toBe(true);
        });

        it('should accept exact min boundary', () => {
            const r = v.validate({ val: 0 }, { val: { type: 'number', min: 0 } });
            expect(r.valid).toBe(true);
        });
    });

    // ─── Custom Validator ────────────────────────────────────────

    describe('custom validator', () => {
        it('should call custom function and accept null return', () => {
            const r = v.validate({ val: 'ok' }, {
                val: { type: 'string', custom: () => null },
            });
            expect(r.valid).toBe(true);
        });

        it('should fail when custom returns error string', () => {
            const r = v.validate({ val: 'bad' }, {
                val: { type: 'string', custom: () => 'custom error' },
            });
            expect(r.valid).toBe(false);
            expect(r.errors[0].message).toBe('custom error');
        });
    });

    // ─── Multi-field Schema ──────────────────────────────────────

    describe('multi-field', () => {
        it('should validate multiple fields at once', () => {
            const schema: ValidationSchema = {
                name: { type: 'string', required: true, minLength: 1 },
                age: { type: 'number', min: 0 },
                email: { type: 'email', required: true },
            };
            const r = v.validate({ name: 'Alice', age: 30, email: 'a@b.com' }, schema);
            expect(r.valid).toBe(true);
            expect(Object.keys(r.sanitized)).toHaveLength(3);
        });

        it('should collect all errors', () => {
            const schema: ValidationSchema = {
                name: { type: 'string', required: true },
                age: { type: 'number', required: true },
            };
            const r = v.validate({}, schema);
            expect(r.valid).toBe(false);
            expect(r.errors).toHaveLength(2);
        });
    });

    // ─── sanitizeString ──────────────────────────────────────────

    describe('sanitizeString', () => {
        it('should escape HTML entities', () => {
            expect(v.sanitizeString('<script>alert("xss")</script>')).toBe(
                '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
            );
        });

        it('should escape ampersand', () => {
            expect(v.sanitizeString('a&b')).toBe('a&amp;b');
        });

        it('should escape single quotes', () => {
            expect(v.sanitizeString("it's")).toBe("it&#x27;s");
        });
    });

    // ─── isEmail / isURL ─────────────────────────────────────────

    describe('isEmail', () => {
        it('should accept valid emails', () => {
            expect(v.isEmail('user@example.com')).toBe(true);
        });

        it('should reject invalid emails', () => {
            expect(v.isEmail('notanemail')).toBe(false);
            expect(v.isEmail('@no-local')).toBe(false);
        });
    });

    describe('isURL', () => {
        it('should accept valid URLs', () => {
            expect(v.isURL('https://example.com')).toBe(true);
        });

        it('should reject invalid URLs', () => {
            expect(v.isURL('not a url')).toBe(false);
        });
    });
});
