/**
 * CoreBlow Security — InputValidator Test Suite
 *
 * Covers: validate() with all types (string, number, boolean, email, url,
 * json, array, object), required fields, minLength/maxLength, min/max,
 * pattern matching, custom validators, sanitizeString(), isEmail(), isURL(),
 * multiple field schemas, and edge cases.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { InputValidator, type ValidationSchema } from './input-validator.js';

describe('InputValidator', () => {
    let validator: InputValidator;

    beforeEach(() => {
        validator = new InputValidator();
    });

    // ─── Required Fields ────────────────────────────────────────

    describe('required fields', () => {
        it('fails when required field is missing', () => {
            const schema: ValidationSchema = { name: { type: 'string', required: true } };
            const result = validator.validate({}, schema);
            expect(result.valid).toBe(false);
            expect(result.errors[0]!.field).toBe('name');
            expect(result.errors[0]!.message).toContain('required');
        });

        it('fails when required field is null', () => {
            const schema: ValidationSchema = { name: { type: 'string', required: true } };
            const result = validator.validate({ name: null }, schema);
            expect(result.valid).toBe(false);
        });

        it('fails when required field is empty string', () => {
            const schema: ValidationSchema = { name: { type: 'string', required: true } };
            const result = validator.validate({ name: '' }, schema);
            expect(result.valid).toBe(false);
        });

        it('passes when required field is present', () => {
            const schema: ValidationSchema = { name: { type: 'string', required: true } };
            const result = validator.validate({ name: 'Alice' }, schema);
            expect(result.valid).toBe(true);
        });

        it('skips optional missing fields without error', () => {
            const schema: ValidationSchema = { name: { type: 'string' } };
            const result = validator.validate({}, schema);
            expect(result.valid).toBe(true);
        });
    });

    // ─── Type: string ───────────────────────────────────────────

    describe('type: string', () => {
        it('passes for valid string', () => {
            const schema: ValidationSchema = { name: { type: 'string', required: true } };
            const result = validator.validate({ name: 'hello' }, schema);
            expect(result.valid).toBe(true);
            expect(result.sanitized.name).toBe('hello');
        });

        it('fails for non-string value', () => {
            const schema: ValidationSchema = { name: { type: 'string', required: true } };
            const result = validator.validate({ name: 42 }, schema);
            expect(result.valid).toBe(false);
            expect(result.errors[0]!.message).toContain('string');
        });
    });

    // ─── Type: number ───────────────────────────────────────────

    describe('type: number', () => {
        it('passes for valid number', () => {
            const schema: ValidationSchema = { age: { type: 'number', required: true } };
            const result = validator.validate({ age: 25 }, schema);
            expect(result.valid).toBe(true);
        });

        it('fails for non-number value', () => {
            const schema: ValidationSchema = { age: { type: 'number', required: true } };
            const result = validator.validate({ age: 'twenty' }, schema);
            expect(result.valid).toBe(false);
        });
    });

    // ─── Type: boolean ──────────────────────────────────────────

    describe('type: boolean', () => {
        it('passes for valid boolean', () => {
            const schema: ValidationSchema = { active: { type: 'boolean', required: true } };
            expect(validator.validate({ active: true }, schema).valid).toBe(true);
            expect(validator.validate({ active: false }, schema).valid).toBe(true);
        });

        it('fails for non-boolean value', () => {
            const schema: ValidationSchema = { active: { type: 'boolean', required: true } };
            expect(validator.validate({ active: 'yes' }, schema).valid).toBe(false);
        });
    });

    // ─── Type: email ────────────────────────────────────────────

    describe('type: email', () => {
        it('passes for valid email', () => {
            const schema: ValidationSchema = { email: { type: 'email', required: true } };
            const result = validator.validate({ email: 'user@example.com' }, schema);
            expect(result.valid).toBe(true);
        });

        it('fails for invalid email', () => {
            const schema: ValidationSchema = { email: { type: 'email', required: true } };
            expect(validator.validate({ email: 'not-an-email' }, schema).valid).toBe(false);
            expect(validator.validate({ email: '@missing.com' }, schema).valid).toBe(false);
        });
    });

    // ─── Type: url ──────────────────────────────────────────────

    describe('type: url', () => {
        it('passes for valid URL', () => {
            const schema: ValidationSchema = { site: { type: 'url', required: true } };
            expect(validator.validate({ site: 'https://example.com' }, schema).valid).toBe(true);
        });

        it('fails for invalid URL', () => {
            const schema: ValidationSchema = { site: { type: 'url', required: true } };
            expect(validator.validate({ site: 'not a url' }, schema).valid).toBe(false);
        });
    });

    // ─── Type: json ─────────────────────────────────────────────

    describe('type: json', () => {
        it('passes for valid JSON string', () => {
            const schema: ValidationSchema = { data: { type: 'json', required: true } };
            expect(validator.validate({ data: '{"key":"value"}' }, schema).valid).toBe(true);
        });

        it('fails for invalid JSON string', () => {
            const schema: ValidationSchema = { data: { type: 'json', required: true } };
            expect(validator.validate({ data: '{broken' }, schema).valid).toBe(false);
        });
    });

    // ─── Type: array ────────────────────────────────────────────

    describe('type: array', () => {
        it('passes for array value', () => {
            const schema: ValidationSchema = { tags: { type: 'array', required: true } };
            expect(validator.validate({ tags: [1, 2, 3] }, schema).valid).toBe(true);
        });

        it('fails for non-array', () => {
            const schema: ValidationSchema = { tags: { type: 'array', required: true } };
            expect(validator.validate({ tags: 'not-array' }, schema).valid).toBe(false);
        });
    });

    // ─── Type: object ───────────────────────────────────────────

    describe('type: object', () => {
        it('passes for object value', () => {
            const schema: ValidationSchema = { meta: { type: 'object', required: true } };
            expect(validator.validate({ meta: { a: 1 } }, schema).valid).toBe(true);
        });

        it('fails for array (not plain object)', () => {
            const schema: ValidationSchema = { meta: { type: 'object', required: true } };
            expect(validator.validate({ meta: [1, 2] }, schema).valid).toBe(false);
        });

        it('fails for non-object', () => {
            const schema: ValidationSchema = { meta: { type: 'object', required: true } };
            expect(validator.validate({ meta: 'string' }, schema).valid).toBe(false);
        });
    });

    // ─── String Constraints ─────────────────────────────────────

    describe('string constraints', () => {
        it('enforces minLength', () => {
            const schema: ValidationSchema = { pw: { type: 'string', required: true, minLength: 8 } };
            expect(validator.validate({ pw: 'abc' }, schema).valid).toBe(false);
            expect(validator.validate({ pw: 'abcdefgh' }, schema).valid).toBe(true);
        });

        it('enforces maxLength', () => {
            const schema: ValidationSchema = { name: { type: 'string', required: true, maxLength: 5 } };
            expect(validator.validate({ name: 'toolong' }, schema).valid).toBe(false);
            expect(validator.validate({ name: 'ok' }, schema).valid).toBe(true);
        });

        it('enforces pattern', () => {
            const schema: ValidationSchema = { code: { type: 'string', required: true, pattern: /^[A-Z]{3}-\d{3}$/ } };
            expect(validator.validate({ code: 'ABC-123' }, schema).valid).toBe(true);
            expect(validator.validate({ code: 'abc-123' }, schema).valid).toBe(false);
        });
    });

    // ─── Number Constraints ─────────────────────────────────────

    describe('number constraints', () => {
        it('enforces min', () => {
            const schema: ValidationSchema = { age: { type: 'number', required: true, min: 18 } };
            expect(validator.validate({ age: 10 }, schema).valid).toBe(false);
            expect(validator.validate({ age: 18 }, schema).valid).toBe(true);
        });

        it('enforces max', () => {
            const schema: ValidationSchema = { score: { type: 'number', required: true, max: 100 } };
            expect(validator.validate({ score: 150 }, schema).valid).toBe(false);
            expect(validator.validate({ score: 99 }, schema).valid).toBe(true);
        });

        it('enforces both min and max', () => {
            const schema: ValidationSchema = { pct: { type: 'number', required: true, min: 0, max: 100 } };
            expect(validator.validate({ pct: -1 }, schema).valid).toBe(false);
            expect(validator.validate({ pct: 101 }, schema).valid).toBe(false);
            expect(validator.validate({ pct: 50 }, schema).valid).toBe(true);
        });
    });

    // ─── Custom Validators ──────────────────────────────────────

    describe('custom validators', () => {
        it('calls custom validator and uses its error', () => {
            const schema: ValidationSchema = {
                role: {
                    type: 'string',
                    required: true,
                    custom: (v) => (v === 'admin' || v === 'user') ? null : 'Role must be admin or user',
                },
            };
            expect(validator.validate({ role: 'admin' }, schema).valid).toBe(true);
            expect(validator.validate({ role: 'hacker' }, schema).valid).toBe(false);
        });
    });

    // ─── Multi-Field Schema ─────────────────────────────────────

    describe('multi-field schema', () => {
        it('validates multiple fields', () => {
            const schema: ValidationSchema = {
                name: { type: 'string', required: true, minLength: 2 },
                email: { type: 'email', required: true },
                age: { type: 'number', min: 0 },
            };

            const valid = validator.validate({ name: 'Alice', email: 'alice@test.com', age: 30 }, schema);
            expect(valid.valid).toBe(true);
            expect(Object.keys(valid.sanitized).length).toBe(3);

            const invalid = validator.validate({ name: 'A', email: 'bad' }, schema);
            expect(invalid.valid).toBe(false);
            expect(invalid.errors.length).toBeGreaterThanOrEqual(2);
        });
    });

    // ─── sanitizeString() ───────────────────────────────────────

    describe('sanitizeString()', () => {
        it('escapes HTML entities', () => {
            expect(validator.sanitizeString('<script>alert("xss")</script>'))
                .toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
        });

        it('escapes ampersand', () => {
            expect(validator.sanitizeString('a & b')).toBe('a &amp; b');
        });

        it('escapes single quotes', () => {
            expect(validator.sanitizeString("it's")).toBe("it&#x27;s");
        });

        it('returns empty string unchanged', () => {
            expect(validator.sanitizeString('')).toBe('');
        });
    });

    // ─── isEmail() ──────────────────────────────────────────────

    describe('isEmail()', () => {
        it('returns true for valid emails', () => {
            expect(validator.isEmail('user@example.com')).toBe(true);
            expect(validator.isEmail('a.b@c.d.com')).toBe(true);
        });

        it('returns false for invalid emails', () => {
            expect(validator.isEmail('no-at-sign')).toBe(false);
            expect(validator.isEmail('@no-local.com')).toBe(false);
            expect(validator.isEmail('no-domain@')).toBe(false);
            expect(validator.isEmail('spaces in@email.com')).toBe(false);
        });
    });

    // ─── isURL() ────────────────────────────────────────────────

    describe('isURL()', () => {
        it('returns true for valid URLs', () => {
            expect(validator.isURL('https://example.com')).toBe(true);
            expect(validator.isURL('http://localhost:3000')).toBe(true);
            expect(validator.isURL('ftp://files.example.com')).toBe(true);
        });

        it('returns false for invalid URLs', () => {
            expect(validator.isURL('not a url')).toBe(false);
            expect(validator.isURL('')).toBe(false);
        });
    });

    // ─── Edge Cases ─────────────────────────────────────────────

    describe('edge cases', () => {
        it('handles empty schema', () => {
            const result = validator.validate({ anything: 'goes' }, {});
            expect(result.valid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('handles empty data with empty schema', () => {
            expect(validator.validate({}, {}).valid).toBe(true);
        });

        it('ignores extra fields not in schema', () => {
            const schema: ValidationSchema = { name: { type: 'string', required: true } };
            const result = validator.validate({ name: 'Bob', extra: 'ignored' }, schema);
            expect(result.valid).toBe(true);
            expect(result.sanitized.extra).toBeUndefined();
        });
    });
});
