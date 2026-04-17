/**
 * tests/security/pii-scanner-deep.test.ts
 * Deep tests for PII detection patterns.
 */
import { describe, it, expect } from 'vitest';
import { PIIScanner } from '../../src/security/pii-scanner.js';

describe('PIIScanner — Deep', () => {
    const scanner = new PIIScanner();

    // ── Email ────────────────────────────────────────────────────
    it('should detect standard email', () => {
        const r = scanner.scan('Email: user@example.com');
        expect(r.hasPII).toBe(true);
        expect(r.matches[0].type).toBe('email');
    });

    it('should detect email with dots', () => {
        const r = scanner.scan('first.last@company.co.uk');
        expect(r.hasPII).toBe(true);
    });

    it('should detect email with plus', () => {
        const r = scanner.scan('user+tag@gmail.com');
        expect(r.hasPII).toBe(true);
    });

    // ── Phone ────────────────────────────────────────────────────
    it('should detect US phone with parens', () => {
        const r = scanner.scan('(555) 123-4567');
        expect(r.hasPII).toBe(true);
        expect(r.matches[0].type).toBe('phone');
    });

    it('should detect phone with dashes', () => {
        const r = scanner.scan('555-123-4567');
        expect(r.hasPII).toBe(true);
    });

    it('should detect international phone', () => {
        const r = scanner.scan('+1-555-123-4567');
        expect(r.hasPII).toBe(true);
    });

    // ── SSN ──────────────────────────────────────────────────────
    it('should detect SSN', () => {
        const r = scanner.scan('SSN: 123-45-6789');
        expect(r.hasPII).toBe(true);
        expect(r.matches[0].type).toBe('ssn');
    });

    it('should mask SSN correctly', () => {
        const r = scanner.scan('123-45-6789');
        expect(r.maskedText).toBe('***-**-****');
    });

    // ── Credit Card ──────────────────────────────────────────────
    it('should detect credit card with dashes', () => {
        const r = scanner.scan('4111-1111-1111-1111');
        expect(r.hasPII).toBe(true);
        expect(r.matches[0].type).toBe('credit_card');
    });

    it('should detect credit card with spaces', () => {
        const r = scanner.scan('4111 1111 1111 1111');
        expect(r.hasPII).toBe(true);
    });

    it('should mask credit card keeping last 4', () => {
        const r = scanner.scan('4111-1111-1111-1234');
        expect(r.maskedText).toContain('1234');
        expect(r.maskedText).toContain('****');
    });

    // ── IP Address ───────────────────────────────────────────────
    it('should detect IP address', () => {
        const r = scanner.scan('Server: 192.168.1.1');
        expect(r.hasPII).toBe(true);
        expect(r.matches[0].type).toBe('ip_address');
    });

    it('should mask IP address last octet', () => {
        const r = scanner.scan('10.0.0.42');
        expect(r.maskedText).toContain('***');
    });

    // ── Multiple PII ─────────────────────────────────────────────
    it('should detect multiple PII in single text', () => {
        const r = scanner.scan('Email: a@b.com, Phone: 555-123-4567, SSN: 111-22-3333');
        expect(r.piiCount).toBeGreaterThanOrEqual(3);
    });

    // ── Clean Text ───────────────────────────────────────────────
    it('should report clean for safe text', () => {
        const r = scanner.scan('Hello, how are you today?');
        expect(r.hasPII).toBe(false);
        expect(r.piiCount).toBe(0);
    });

    // ── Custom Patterns ──────────────────────────────────────────
    it('should support custom patterns', () => {
        const s = new PIIScanner();
        s.addPattern('passport', /\b[A-Z]{2}\d{7}\b/g, (v) => '**' + v.slice(-3));
        const r = s.scan('Passport: AB1234567');
        expect(r.hasPII).toBe(true);
    });

    // ── Stats ────────────────────────────────────────────────────
    it('should track scan stats', () => {
        const s = new PIIScanner();
        s.scan('email@test.com');
        s.scan('clean text');
        const stats = s.getStats();
        expect(stats.scanned).toBe(2);
        expect(stats.piiFound).toBe(1);
    });

    it('should list available pattern types', () => {
        const types = scanner.listTypes();
        expect(types).toContain('email');
        expect(types).toContain('phone');
        expect(types).toContain('ssn');
    });

    it('should count patterns', () => {
        expect(scanner.count()).toBeGreaterThanOrEqual(5);
    });
});
