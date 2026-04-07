/**
 * tests/security/guardrails.test.ts
 * Full pipeline tests for the CoreBlow GuardrailsEngine.
 */
import { describe, it, expect } from 'vitest';
import { GuardrailsEngine } from '../../src/security/guardrails.js';

describe('GuardrailsEngine', () => {
    it('should pass clean text', () => {
        const engine = new GuardrailsEngine();
        const result = engine.scan('Hello, how are you today?');
        expect(result.safe).toBe(true);
        expect(result.blocked).toBe(false);
        expect(result.enforcements).toHaveLength(0);
    });

    it('should detect toxic content', () => {
        const engine = new GuardrailsEngine({ policy: 'strict' });
        const result = engine.scan('I will kill you and destroy everything');
        expect(result.toxicity).toBeDefined();
        expect(result.toxicity!.toxic).toBe(true);
    });

    it('should block toxic content in strict mode', () => {
        const engine = new GuardrailsEngine({ policy: 'strict' });
        const result = engine.scan('I will kill you violently');
        if (result.toxicity?.toxic) {
            expect(result.blocked).toBe(true);
            expect(result.enforcements.some(e => e.includes('toxic'))).toBe(true);
        }
    });

    it('should detect PII (emails)', () => {
        const engine = new GuardrailsEngine();
        const result = engine.scan('Contact me at john.doe@example.com please');
        expect(result.pii).toBeDefined();
        expect(result.pii!.hasPII).toBe(true);
        expect(result.pii!.matches.some(m => m.type === 'email')).toBe(true);
    });

    it('should mask PII in standard mode', () => {
        const engine = new GuardrailsEngine({ policy: 'standard' });
        const result = engine.scan('My SSN is 123-45-6789');
        expect(result.pii!.hasPII).toBe(true);
        expect(result.pii!.maskedText).toContain('***');
    });

    it('should support monitor policy (no blocking)', () => {
        const engine = new GuardrailsEngine({ policy: 'monitor' });
        const result = engine.scan('Some potentially bad content with 123-45-6789');
        expect(result.blocked).toBe(false);
        expect(result.policy).toBe('monitor');
    });

    it('should batch scan multiple texts', () => {
        const engine = new GuardrailsEngine();
        const results = engine.scanBatch(['Hello', 'World', 'email@test.com']);
        expect(results).toHaveLength(3);
        expect(results[2].pii!.hasPII).toBe(true);
    });

    it('should track stats', () => {
        const engine = new GuardrailsEngine();
        engine.scan('text1');
        engine.scan('text2');
        const stats = engine.getStats();
        expect(stats.scans).toBe(2);
    });

    it('should change policy at runtime', () => {
        const engine = new GuardrailsEngine({ policy: 'strict' });
        expect(engine.getPolicy()).toBe('strict');
        engine.setPolicy('permissive');
        expect(engine.getPolicy()).toBe('permissive');
    });

    it('should enable/disable individual checks', () => {
        const engine = new GuardrailsEngine();
        engine.disableCheck('pii');
        const checks = engine.getEnabledChecks();
        expect(checks['pii']).toBe(false);
        engine.enableCheck('pii');
        expect(engine.getEnabledChecks()['pii']).toBe(true);
    });

    it('isSafe returns boolean shortcut', () => {
        const engine = new GuardrailsEngine();
        expect(typeof engine.isSafe('hello')).toBe('boolean');
    });

    it('should detect phone numbers as PII', () => {
        const engine = new GuardrailsEngine();
        const result = engine.scan('Call me at (555) 123-4567');
        expect(result.pii!.hasPII).toBe(true);
        expect(result.pii!.matches.some(m => m.type === 'phone')).toBe(true);
    });

    it('should detect credit card numbers', () => {
        const engine = new GuardrailsEngine();
        const result = engine.scan('Card: 4111-1111-1111-1111');
        expect(result.pii!.hasPII).toBe(true);
        expect(result.pii!.matches.some(m => m.type === 'credit_card')).toBe(true);
    });

    it('should detect IP addresses', () => {
        const engine = new GuardrailsEngine();
        const result = engine.scan('Server at 192.168.1.100');
        expect(result.pii!.hasPII).toBe(true);
        expect(result.pii!.matches.some(m => m.type === 'ip_address')).toBe(true);
    });

    it('should generate safety report', () => {
        const engine = new GuardrailsEngine();
        const result = engine.scan('Clean text');
        expect(result.report).toBeDefined();
        expect(result.report.overallScore).toBeDefined();
    });

    it('should handle empty text', () => {
        const engine = new GuardrailsEngine();
        const result = engine.scan('');
        expect(result.safe).toBe(true);
    });

    it('getRecentReports returns array', () => {
        const engine = new GuardrailsEngine();
        engine.scan('test');
        const reports = engine.getRecentReports(5);
        expect(Array.isArray(reports)).toBe(true);
    });

    it('should expose sub-detector accessors', () => {
        const engine = new GuardrailsEngine();
        expect(engine.getToxicity()).toBeDefined();
        expect(engine.getBias()).toBeDefined();
        expect(engine.getPII()).toBeDefined();
        expect(engine.getContentFilter()).toBeDefined();
    });
});
