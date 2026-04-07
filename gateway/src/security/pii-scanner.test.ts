/**
 * security/pii-scanner.test.ts — PII Scanner tests (co-located)
 */
import { describe, it, expect } from 'vitest';
import { PIIScanner } from './pii-scanner.js';

describe('PII Scanner', () => {
    const scanner = new PIIScanner();

    it('should detect email addresses', () => {
        const result = scanner.scan('Contact me at user@example.com for info');
        expect(result.hasPII).toBe(true);
        expect(result.matches.some(r => r.type === 'email')).toBe(true);
    });

    it('should mask detected PII', () => {
        const result = scanner.scan('Email me at test@test.com');
        expect(result.maskedText).not.toContain('test@test.com');
        expect(result.piiCount).toBeGreaterThan(0);
    });

    it('should return clean for no PII', () => {
        const result = scanner.scan('Hello, this is a clean message');
        expect(result.hasPII).toBe(false);
        expect(result.matches).toHaveLength(0);
        expect(result.piiCount).toBe(0);
    });

    it('should detect credit card patterns', () => {
        const result = scanner.scan('My card is 4111111111111111');
        expect(result.matches.some(r => r.type === 'credit_card')).toBe(true);
    });

    it('should detect SSN patterns', () => {
        const result = scanner.scan('SSN is 123-45-6789');
        expect(result.hasPII).toBe(true);
    });
});
