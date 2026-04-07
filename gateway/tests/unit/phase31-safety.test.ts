/**
 * CoreBlow Phase 31 — AI Safety & Guardrails Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ContentFilter } from '../../src/security/content-filter.js';
import { ToxicityDetector } from '../../src/security/toxicity-detector.js';
import { PIIScanner } from '../../src/security/pii-scanner.js';
import { BiasDetector } from '../../src/security/bias-detector.js';
import { SafetyReport } from '../../src/security/safety-report.js';

// ================================================================
describe('ContentFilter', () => {
    let filter: ContentFilter;
    beforeEach(() => { filter = new ContentFilter(); });

    it('should pass clean content', () => {
        const result = filter.scan('Hello, how are you today?');
        expect(result.passed).toBe(true);
    });

    it('should block threats', () => {
        const result = filter.scan('I will attack the system');
        expect(result.passed).toBe(false);
    });

    it('should redact profanity', () => {
        const result = filter.scan('This is damn annoying');
        expect(result.filteredContent).toContain('****');
    });

    it('should flag spam', () => {
        const result = filter.scan('Click here for free money');
        expect(result.violations.some((v) => v.category === 'spam')).toBe(true);
    });

    it('should have built-in rules', () => {
        expect(filter.count()).toBe(4);
    });

    it('should track stats', () => {
        filter.scan('Hello');
        filter.scan('I will attack');
        expect(filter.getStats().scanned).toBe(2);
    });

    it('should enable/disable rules', () => {
        const rules = filter.list();
        filter.setEnabled(rules[0]!.id, false);
        expect(filter.list().find((r) => r.id === rules[0]!.id)?.enabled).toBe(false);
    });
});

// ================================================================
describe('ToxicityDetector', () => {
    let detector: ToxicityDetector;
    beforeEach(() => { detector = new ToxicityDetector(); });

    it('should detect safe content', () => {
        const result = detector.analyze('Have a wonderful day!');
        expect(result.toxic).toBe(false);
    });

    it('should detect insults', () => {
        const result = detector.analyze('You are such an idiot and a moron and also stupid and dumb');
        expect(result.toxic).toBe(true);
        expect(result.categories.some((c) => c.category === 'insult')).toBe(true);
    });

    it('should detect harassment', () => {
        const result = detector.analyze('I will harass and bully and stalk you');
        expect(result.categories.some((c) => c.category === 'harassment')).toBe(true);
    });

    it('should set threshold', () => {
        detector.setThreshold(0.9);
        expect(detector.getThreshold()).toBe(0.9);
    });

    it('should track stats', () => {
        detector.analyze('hello');
        detector.analyze('you stupid idiot moron');
        expect(detector.getStats().scanned).toBe(2);
    });
});

// ================================================================
describe('PIIScanner', () => {
    let scanner: PIIScanner;
    beforeEach(() => { scanner = new PIIScanner(); });

    it('should detect emails', () => {
        const result = scanner.scan('Contact me at john@example.com');
        expect(result.hasPII).toBe(true);
        expect(result.matches.some((m) => m.type === 'email')).toBe(true);
    });

    it('should detect phone numbers', () => {
        const result = scanner.scan('Call me at 555-123-4567');
        expect(result.matches.some((m) => m.type === 'phone')).toBe(true);
    });

    it('should detect SSNs', () => {
        const result = scanner.scan('My SSN is 123-45-6789');
        expect(result.matches.some((m) => m.type === 'ssn')).toBe(true);
    });

    it('should detect credit cards', () => {
        const result = scanner.scan('Card: 4111 1111 1111 1111');
        expect(result.matches.some((m) => m.type === 'credit_card')).toBe(true);
    });

    it('should mask PII', () => {
        const result = scanner.scan('Email: john@example.com');
        expect(result.maskedText).not.toContain('john@example.com');
    });

    it('should handle clean text', () => {
        const result = scanner.scan('Hello world, no PII here');
        expect(result.hasPII).toBe(false);
    });

    it('should add custom patterns', () => {
        scanner.addPattern('custom', /\bCUSTOM-\d+\b/g, () => 'CUSTOM-***');
        const result = scanner.scan('Reference: CUSTOM-12345');
        expect(result.hasPII).toBe(true);
    });
});

// ================================================================
describe('BiasDetector', () => {
    let detector: BiasDetector;
    beforeEach(() => { detector = new BiasDetector(); });

    it('should detect no bias in neutral text', () => {
        const result = detector.analyze('The weather is nice today');
        expect(result.biased).toBe(false);
    });

    it('should detect gender-biased language', () => {
        const result = detector.analyze('A chairman should always manage his employees. He must ensure his team performs well. She should support him.');
        expect(result.indicators.some((i) => i.category === 'gender')).toBe(true);
    });

    it('should provide suggestions', () => {
        const result = detector.analyze('The chairman decided for his team, he said');
        if (result.indicators.length > 0) {
            expect(result.indicators[0]!.suggestion).toBeTruthy();
        }
    });

    it('should set threshold', () => {
        detector.setThreshold(0.8);
        expect(detector.getThreshold()).toBe(0.8);
    });

    it('should track stats', () => {
        detector.analyze('text 1');
        detector.analyze('text 2');
        expect(detector.getStats().scanned).toBe(2);
    });
});

// ================================================================
describe('SafetyReport', () => {
    let report: SafetyReport;
    beforeEach(() => { report = new SafetyReport(); });

    it('should generate safe report', () => {
        const r = report.generate('Hello', [
            { name: 'content', passed: true, score: 1, details: 'OK', severity: 'safe' },
        ]);
        expect(r.overallSafe).toBe(true);
    });

    it('should generate unsafe report', () => {
        const r = report.generate('Bad content', [
            { name: 'toxicity', passed: false, score: 0.2, details: 'Toxic', severity: 'high' },
        ]);
        expect(r.overallSafe).toBe(false);
    });

    it('should handle critical checks', () => {
        const r = report.generate('Danger', [
            { name: 'self-harm', passed: false, score: 0, details: 'Detected', severity: 'critical' },
        ]);
        expect(r.recommendation).toContain('CRITICAL');
    });

    it('should get stats', () => {
        report.generate('a', [{ name: 'x', passed: true, score: 1, details: '', severity: 'safe' }]);
        report.generate('b', [{ name: 'x', passed: false, score: 0, details: '', severity: 'high' }]);
        const stats = report.getStats();
        expect(stats.safe).toBe(1);
        expect(stats.unsafe).toBe(1);
    });

    it('should get recent', () => {
        report.generate('a', []);
        expect(report.getRecent()).toHaveLength(1);
    });

    it('should filter by severity', () => {
        report.generate('a', [{ name: 'x', passed: false, score: 0, details: '', severity: 'critical' }]);
        expect(report.getBySeverity('critical')).toHaveLength(1);
    });
});
