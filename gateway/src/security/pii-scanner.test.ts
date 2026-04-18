/**
 * CoreBlow Security — PIIScanner Test Suite
 *
 * Covers: scan() with email, phone, SSN, credit card, IP address detection,
 * masking output, addPattern() for custom PII, getStats(), listTypes(),
 * count(), multiple PII in single text, and edge cases.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { PIIScanner } from './pii-scanner.js';

describe('PIIScanner', () => {
    let scanner: PIIScanner;

    beforeEach(() => {
        scanner = new PIIScanner();
    });

    // ─── Default Patterns ───────────────────────────────────────

    describe('default patterns', () => {
        it('has 5 built-in patterns', () => {
            expect(scanner.count()).toBe(5);
        });

        it('lists email, phone, ssn, credit_card, ip_address types', () => {
            const types = scanner.listTypes();
            expect(types).toContain('email');
            expect(types).toContain('phone');
            expect(types).toContain('ssn');
            expect(types).toContain('credit_card');
            expect(types).toContain('ip_address');
        });
    });

    // ─── Clean Text ─────────────────────────────────────────────

    describe('clean text', () => {
        it('returns hasPII=false for text without PII', () => {
            const result = scanner.scan('The weather is nice today.');
            expect(result.hasPII).toBe(false);
            expect(result.matches.length).toBe(0);
            expect(result.piiCount).toBe(0);
            expect(result.maskedText).toBe('The weather is nice today.');
        });

        it('returns hasPII=false for empty string', () => {
            expect(scanner.scan('').hasPII).toBe(false);
        });
    });

    // ─── Email Detection ────────────────────────────────────────

    describe('email detection', () => {
        it('detects email addresses', () => {
            const result = scanner.scan('Contact me at john@example.com please.');
            expect(result.hasPII).toBe(true);
            expect(result.piiCount).toBe(1);

            const match = result.matches[0]!;
            expect(match.type).toBe('email');
            expect(match.value).toBe('john@example.com');
        });

        it('masks email (keeps first 2 chars + domain)', () => {
            const result = scanner.scan('Email: john@example.com');
            expect(result.maskedText).toContain('jo***@example.com');
        });

        it('detects multiple emails', () => {
            const result = scanner.scan('From alice@test.com to bob@test.com.');
            expect(result.piiCount).toBe(2);
        });
    });

    // ─── Phone Detection ────────────────────────────────────────

    describe('phone detection', () => {
        it('detects US phone numbers', () => {
            const result = scanner.scan('Call me at 555-123-4567.');
            expect(result.hasPII).toBe(true);
            const match = result.matches.find(m => m.type === 'phone')!;
            expect(match).toBeTruthy();
            expect(match.value).toContain('555');
        });

        it('detects phone with parentheses', () => {
            const result = scanner.scan('Phone: (555) 123-4567');
            expect(result.matches.some(m => m.type === 'phone')).toBe(true);
        });

        it('masks phone (keeps first 3 + last 2)', () => {
            const result = scanner.scan('Call 555-123-4567.');
            const match = result.matches.find(m => m.type === 'phone')!;
            expect(match.masked).toContain('555');
            expect(match.masked).toContain('***');
        });
    });

    // ─── SSN Detection ──────────────────────────────────────────

    describe('SSN detection', () => {
        it('detects SSN patterns', () => {
            const result = scanner.scan('My SSN is 123-45-6789.');
            expect(result.hasPII).toBe(true);
            const match = result.matches.find(m => m.type === 'ssn')!;
            expect(match).toBeTruthy();
            expect(match.value).toBe('123-45-6789');
        });

        it('masks SSN completely', () => {
            const result = scanner.scan('SSN: 123-45-6789');
            const match = result.matches.find(m => m.type === 'ssn')!;
            expect(match.masked).toBe('***-**-****');
        });
    });

    // ─── Credit Card Detection ──────────────────────────────────

    describe('credit card detection', () => {
        it('detects credit card numbers (with dashes)', () => {
            const result = scanner.scan('Card: 4111-1111-1111-1111');
            expect(result.hasPII).toBe(true);
            const match = result.matches.find(m => m.type === 'credit_card')!;
            expect(match).toBeTruthy();
        });

        it('detects credit card numbers (with spaces)', () => {
            const result = scanner.scan('Card: 4111 1111 1111 1111');
            expect(result.matches.some(m => m.type === 'credit_card')).toBe(true);
        });

        it('masks credit card (keeps last 4)', () => {
            const result = scanner.scan('Card: 4111-1111-1111-1234');
            const match = result.matches.find(m => m.type === 'credit_card')!;
            expect(match.masked).toContain('****-****-****-');
            expect(match.masked).toContain('1234');
        });
    });

    // ─── IP Address Detection ───────────────────────────────────

    describe('IP address detection', () => {
        it('detects IPv4 addresses', () => {
            const result = scanner.scan('Server at 192.168.1.100.');
            expect(result.hasPII).toBe(true);
            const match = result.matches.find(m => m.type === 'ip_address')!;
            expect(match).toBeTruthy();
            expect(match.value).toBe('192.168.1.100');
        });

        it('masks IP (last octet)', () => {
            const result = scanner.scan('IP: 10.0.0.1');
            const match = result.matches.find(m => m.type === 'ip_address')!;
            expect(match.masked).toContain('10.0.0.***');
        });
    });

    // ─── Multiple PII Types ─────────────────────────────────────

    describe('multiple PII types in one text', () => {
        it('detects multiple types simultaneously', () => {
            const result = scanner.scan('Email: john@test.com, SSN: 123-45-6789, IP: 10.0.0.1');
            expect(result.piiCount).toBeGreaterThanOrEqual(3);

            const types = result.matches.map(m => m.type);
            expect(types).toContain('email');
            expect(types).toContain('ssn');
            expect(types).toContain('ip_address');
        });

        it('provides maskedText with all PII replaced', () => {
            const result = scanner.scan('Email: john@test.com, SSN: 123-45-6789');
            expect(result.maskedText).not.toContain('john@test.com');
            expect(result.maskedText).not.toContain('123-45-6789');
        });
    });

    // ─── Match Properties ───────────────────────────────────────

    describe('match properties', () => {
        it('includes startIndex and endIndex', () => {
            const result = scanner.scan('SSN: 123-45-6789');
            const match = result.matches.find(m => m.type === 'ssn')!;
            expect(match.startIndex).toBeGreaterThanOrEqual(0);
            expect(match.endIndex).toBeGreaterThan(match.startIndex);
        });
    });

    // ─── addPattern() ───────────────────────────────────────────

    describe('addPattern()', () => {
        it('adds a custom PII pattern', () => {
            scanner.addPattern('passport', /\b[A-Z]{2}\d{7}\b/g, (v) => '**' + v.slice(-4));
            expect(scanner.count()).toBe(6);
            expect(scanner.listTypes()).toContain('passport');
        });

        it('custom pattern is active in scan', () => {
            scanner.addPattern('custom_id', /\bCORE-\d{6}\b/g, () => 'CORE-******');
            const result = scanner.scan('ID: CORE-123456');
            expect(result.hasPII).toBe(true);
            expect(result.matches.some(m => (m.type as string) === 'custom_id')).toBe(true);
        });
    });

    // ─── getStats() ─────────────────────────────────────────────

    describe('getStats()', () => {
        it('starts at zero', () => {
            const stats = scanner.getStats();
            expect(stats.scanned).toBe(0);
            expect(stats.piiFound).toBe(0);
        });

        it('tracks scanned count', () => {
            scanner.scan('No PII here.');
            scanner.scan('Still clean.');
            expect(scanner.getStats().scanned).toBe(2);
        });

        it('tracks PII found count', () => {
            scanner.scan('Email: a@b.com, SSN: 123-45-6789');
            const stats = scanner.getStats();
            expect(stats.piiFound).toBeGreaterThanOrEqual(2);
        });

        it('returns a copy', () => {
            const s1 = scanner.getStats();
            const s2 = scanner.getStats();
            expect(s1).not.toBe(s2);
            expect(s1).toEqual(s2);
        });
    });

    // ─── Edge Cases ─────────────────────────────────────────────

    describe('edge cases', () => {
        it('does not false-positive on partial patterns', () => {
            const result = scanner.scan('Version 1.2.3 is released.');
            // Should not detect as IP address (only 3 octets)
            const ipMatches = result.matches.filter(m => m.type === 'ip_address');
            expect(ipMatches.length).toBe(0);
        });

        it('handles text with only whitespace', () => {
            expect(scanner.scan('   \t\n  ').hasPII).toBe(false);
        });
    });
});
