/**
 * CoreBlow Phase 31 — ContentFilter & PIIScanner Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - ContentFilter: rule management, multi-violation, redaction, custom rules
 *   - PIIScanner: multi-PII, IP addresses, custom patterns, masking accuracy
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ContentFilter } from '../../src/security/content-filter.js';
import { PIIScanner } from '../../src/security/pii-scanner.js';

// ================================================================
describe('ContentFilter — Extended', () => {
    let filter: ContentFilter;
    beforeEach(() => { filter = new ContentFilter(); });

    it('should detect multiple violation categories in single text', () => {
        const result = filter.scan('Click here for free money or I will attack you');
        expect(result.passed).toBe(false); // Has 'attack' (block)
        expect(result.violations.length).toBeGreaterThanOrEqual(2);
        const cats = result.violations.map(v => v.category);
        expect(cats).toContain('threats');
        expect(cats).toContain('spam');
    });

    it('should redact profanity while keeping non-profane words', () => {
        const result = filter.scan('This is damn good work');
        expect(result.filteredContent).toBeTruthy();
        expect(result.filteredContent).toContain('good work');
        expect(result.filteredContent).toContain('****');
    });

    it('should block threats but still return violations list', () => {
        const result = filter.scan('I will attack the system and kill the process');
        expect(result.passed).toBe(false);
        expect(result.violations.some(v => v.action === 'block')).toBe(true);
    });

    it('should flag spam without blocking', () => {
        const result = filter.scan('Click here for amazing deals');
        expect(result.passed).toBe(true); // Spam only flags, doesn't block
        expect(result.violations.some(v => v.category === 'spam')).toBe(true);
    });

    it('should pass completely clean content', () => {
        const result = filter.scan('The weather is nice today, lets go for a walk');
        expect(result.passed).toBe(true);
        expect(result.violations).toHaveLength(0);
        expect(result.filteredContent).toBeUndefined();
    });

    it('should add and match custom rules', () => {
        filter.addRule('internal', [/\bCONFIDENTIAL-\d+\b/g], 'high', 'block');
        const result = filter.scan('See document CONFIDENTIAL-12345');
        expect(result.passed).toBe(false);
        expect(result.violations.some(v => v.category === 'internal')).toBe(true);
    });

    it('should disable and re-enable rules', () => {
        const rules = filter.list();
        const threatRule = rules.find(r => r.category === 'threats')!;

        filter.setEnabled(threatRule.id, false);
        const r1 = filter.scan('I will attack you');
        expect(r1.passed).toBe(true); // Threat rule disabled

        filter.setEnabled(threatRule.id, true);
        const r2 = filter.scan('I will attack you');
        expect(r2.passed).toBe(false); // Re-enabled
    });

    it('should track stats accurately across scans', () => {
        filter.scan('Hello world');          // clean
        filter.scan('I will attack');        // blocked
        filter.scan('This is damn');         // redacted
        filter.scan('Click here winner');    // flagged

        const stats = filter.getStats();
        expect(stats.scanned).toBe(4);
        expect(stats.blocked).toBe(1);
        expect(stats.redacted).toBe(1);
        // 'This is damn' (redact only, no block → flagged) + 'Click here winner' (spam flag)
        expect(stats.flagged).toBe(2);
    });
});

// ================================================================
describe('PIIScanner — Extended', () => {
    let scanner: PIIScanner;
    beforeEach(() => { scanner = new PIIScanner(); });

    it('should detect multiple PII types in single text', () => {
        const result = scanner.scan('Email: john@example.com, SSN: 123-45-6789, Card: 4111 1111 1111 1111');
        expect(result.hasPII).toBe(true);
        expect(result.piiCount).toBeGreaterThanOrEqual(3);
        const types = result.matches.map(m => m.type);
        expect(types).toContain('email');
        expect(types).toContain('ssn');
        expect(types).toContain('credit_card');
    });

    it('should detect IP addresses', () => {
        const result = scanner.scan('Server at 192.168.1.100 is responding');
        expect(result.hasPII).toBe(true);
        expect(result.matches.some(m => m.type === 'ip_address')).toBe(true);
    });

    it('should mask each PII type correctly', () => {
        const emailResult = scanner.scan('Contact: alice@company.com');
        expect(emailResult.maskedText).not.toContain('alice@company.com');
        expect(emailResult.maskedText).toContain('***');

        const ssnResult = scanner.scan('SSN: 987-65-4321');
        expect(ssnResult.maskedText).toContain('***-**-****');
    });

    it('should detect phone numbers with various formats', () => {
        const result = scanner.scan('Call 555-123-4567 or (555) 987-6543');
        expect(result.matches.filter(m => m.type === 'phone')).toHaveLength(2);
    });

    it('should handle text with no PII', () => {
        const result = scanner.scan('The quick brown fox jumps over the lazy dog');
        expect(result.hasPII).toBe(false);
        expect(result.matches).toHaveLength(0);
        expect(result.maskedText).toBe('The quick brown fox jumps over the lazy dog');
    });

    it('should support custom patterns', () => {
        scanner.addPattern('employee_id', /\bEMP-\d{6}\b/g, () => 'EMP-******');
        const result = scanner.scan('Employee EMP-123456 filed a report');
        expect(result.hasPII).toBe(true);
        expect(result.matches.some(m => (m.type as string) === 'employee_id')).toBe(true);
        expect(result.maskedText).toContain('EMP-******');
    });

    it('should track scan stats', () => {
        scanner.scan('Email: a@b.com');
        scanner.scan('No PII here');
        scanner.scan('SSN: 111-22-3333 and phone: 555-000-1234');

        const stats = scanner.getStats();
        expect(stats.scanned).toBe(3);
        expect(stats.piiFound).toBeGreaterThanOrEqual(3);
    });

    it('should list all registered pattern types', () => {
        const types = scanner.listTypes();
        expect(types).toContain('email');
        expect(types).toContain('phone');
        expect(types).toContain('ssn');
        expect(types).toContain('credit_card');
        expect(types).toContain('ip_address');
        expect(scanner.count()).toBe(5);
    });
});
