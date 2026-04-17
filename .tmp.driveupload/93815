import { describe, it, expect } from 'vitest';
import { buildObjectValidator, formatValidationErrors, errorShape } from '../../src/gateway/protocol/index.js';

describe('Gateway Protocol & Validation', () => {
    it('should build object validator that validates required and properties', () => {
        const validator = buildObjectValidator<any>({
            required: ['foo'],
            properties: {
                foo: { type: 'string' },
                bar: { type: 'number' }
            }
        });

        expect(validator({ foo: 'hello' })).toBe(true);
        expect(validator({ foo: 'hello', bar: 123 })).toBe(true);

        expect(validator({})).toBe(false);
        expect(validator.errors?.[0].path).toBe('foo');

        expect(validator({ foo: 123 })).toBe(false);
        expect(validator.errors?.[0].message).toContain('type string');
    });

    it('should shape errors correctly', () => {
        const err = errorShape('invalid_request', 'Missing param');
        expect(err.code).toBe('invalid_request');
        expect(err.message).toBe('Missing param');
        expect(err.details).toBeUndefined();
    });

    it('should format validation errors into string', () => {
        const msg = formatValidationErrors([{ path: 'foo', message: 'is required' }]);
        expect(msg).toBe('foo: is required');
    });
});
