/**
 * secrets/env-secrets.test.ts — Environment secrets tests
 */
import { describe, it, expect } from 'vitest';
import { getSecret } from './env-secrets.js';
import { maskSecret } from './shared.js';

describe('Env Secrets', () => {
    it('should get secret from env', () => {
        process.env.__TEST_SECRET = 'value123';
        expect(getSecret('__TEST_SECRET')).toBe('value123');
        delete process.env.__TEST_SECRET;
    });

    it('should return undefined for missing', () => {
        expect(getSecret('__NONEXISTENT_SECRET')).toBeUndefined();
    });

    it('should mask secrets', () => {
        const masked = maskSecret('sk-1234567890abcdefghij');
        expect(masked).toContain('****');
        expect(masked).not.toBe('sk-1234567890abcdefghij');
        expect(masked.startsWith('sk-1')).toBe(true);
    });

    it('should fully mask short secrets', () => {
        expect(maskSecret('short')).toBe('****');
    });
});
