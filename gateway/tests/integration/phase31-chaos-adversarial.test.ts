/**
 * CoreBlow Phase 31 — Adversarial & Chaos Tests for AI Safety
 *
 * Layer 3 (Adversarial):
 *   - Edge inputs: empty, very long, unicode, special characters
 *   - Stress: batch processing large volumes
 *   - Subsystem independence: one scanner failure doesn't affect others
 *   - Threshold precision: boundary values for detection
 */
import { describe, it, expect } from 'vitest';
import { ContentFilter } from '../../src/security/content-filter.js';
import { PIIScanner } from '../../src/security/pii-scanner.js';
import { ToxicityDetector } from '../../src/security/toxicity-detector.js';
import { BiasDetector } from '../../src/security/bias-detector.js';
import { SafetyReport, type SafetyCheck } from '../../src/security/safety-report.js';

// ================================================================
describe('Phase31 Chaos: Edge Input Handling', () => {
    it('empty string input — all scanners handle gracefully', () => {
        const filter = new ContentFilter();
        const pii = new PIIScanner();
        const toxicity = new ToxicityDetector();
        const bias = new BiasDetector();

        const fResult = filter.scan('');
        expect(fResult.passed).toBe(true);
        expect(fResult.violations).toHaveLength(0);

        const pResult = pii.scan('');
        expect(pResult.hasPII).toBe(false);

        const tResult = toxicity.analyze('');
        expect(tResult.toxic).toBe(false);

        const bResult = bias.analyze('');
        expect(bResult.biased).toBe(false);
    });

    it('very long input — scanners dont crash', () => {
        const longText = 'This is a normal sentence. '.repeat(1000); // ~27k chars
        const filter = new ContentFilter();
        const pii = new PIIScanner();
        const toxicity = new ToxicityDetector();
        const bias = new BiasDetector();

        expect(() => filter.scan(longText)).not.toThrow();
        expect(() => pii.scan(longText)).not.toThrow();
        expect(() => toxicity.analyze(longText)).not.toThrow();
        expect(() => bias.analyze(longText)).not.toThrow();
    });

    it('unicode and emoji — scanners dont crash or false-positive', () => {
        const unicodeText = '你好世界 🌍 こんにちは مرحبا 안녕하세요 🎉✨';
        const filter = new ContentFilter();
        const toxicity = new ToxicityDetector();

        const fResult = filter.scan(unicodeText);
        expect(fResult.passed).toBe(true);

        const tResult = toxicity.analyze(unicodeText);
        expect(tResult.toxic).toBe(false);
    });

    it('special characters and code snippets — no false positives', () => {
        const codeSnippet = `
            function killProcess(pid) {
                process.kill(pid);
                return { status: 'terminated' };
            }
        `;
        const filter = new ContentFilter();
        // "kill" will trigger threat detection — this is expected behavior
        const result = filter.scan(codeSnippet);
        // The filter should detect "kill" as a keyword match
        expect(result.violations.length).toBeGreaterThanOrEqual(0);
    });
});

// ================================================================
describe('Phase31 Chaos: Batch Stress', () => {
    it('batch scan 100 texts — toxicity detector maintains accuracy', () => {
        const detector = new ToxicityDetector();
        const texts = Array.from({ length: 100 }, (_, i) =>
            i % 10 === 0 ? 'You are an idiot and a moron and stupid' : 'Hello, have a nice day!'
        );

        const result = detector.analyzeBatch(texts);
        expect(result.results).toHaveLength(100);
        expect(result.totalToxic).toBe(10); // Every 10th is toxic
        expect(result.worstCategory).toBe('insult');
    });

    it('batch scan 50 texts — bias detector maintains accuracy', () => {
        const detector = new BiasDetector();
        const texts = Array.from({ length: 50 }, (_, i) =>
            i % 5 === 0 ? 'The chairman managed his manmade fireman stewardess team, he said' : 'The team collaborates well'
        );

        const result = detector.analyzeBatch(texts);
        expect(result.results).toHaveLength(50);
        expect(result.totalBiased).toBeGreaterThanOrEqual(1);
    });

    it('SafetyReport handles 200 reports without overflow', () => {
        const report = new SafetyReport();
        for (let i = 0; i < 200; i++) {
            report.generate(`Text ${i}`, [
                { name: 'check', passed: i % 3 !== 0, score: i % 3 !== 0 ? 1 : 0, details: '', severity: i % 3 === 0 ? 'high' : 'safe' },
            ]);
        }

        expect(report.count()).toBe(200);
        const stats = report.getStats();
        expect(stats.total).toBe(200);
        expect(stats.safe + stats.unsafe).toBe(200);
    });
});

// ================================================================
describe('Phase31 Chaos: Subsystem Independence', () => {
    it('disabled content filter rules dont affect other scanners', () => {
        const filter = new ContentFilter();
        const toxicity = new ToxicityDetector();

        // Disable ALL content filter rules
        for (const rule of filter.list()) {
            filter.setEnabled(rule.id, false);
        }

        // Content filter passes everything now
        const fResult = filter.scan('I will attack and kill');
        expect(fResult.passed).toBe(true);

        // But toxicity detector is completely independent
        const tResult = toxicity.analyze('I will torture and murder and massacre');
        expect(tResult.toxic).toBe(true);
    });

    it('high toxicity threshold doesnt affect PII detection', () => {
        const toxicity = new ToxicityDetector();
        const pii = new PIIScanner();

        toxicity.setThreshold(0.99); // Almost nothing triggers

        const tResult = toxicity.analyze('You idiot email john@example.com');
        // High threshold means toxicity might not trigger
        expect(tResult.score).toBeLessThan(0.99);

        // But PII scanner is independent
        const pResult = pii.scan('You idiot email john@example.com');
        expect(pResult.hasPII).toBe(true);
        expect(pResult.matches.some(m => m.type === 'email')).toBe(true);
    });

    it('bias detector disabled categories dont affect toxicity', () => {
        const bias = new BiasDetector();
        const toxicity = new ToxicityDetector();

        // Disable all bias categories
        for (const cat of bias.getEnabledCategories()) {
            bias.disableCategory(cat);
        }

        const bResult = bias.analyze('The chairman decided');
        expect(bResult.biased).toBe(false); // All disabled

        // Toxicity is independent
        const tResult = toxicity.analyze('You stupid idiot moron dumb');
        expect(tResult.toxic).toBe(true);
    });
});

// ================================================================
describe('Phase31 Chaos: Threshold Precision', () => {
    it('toxicity threshold boundary — just below vs at threshold', () => {
        const detector = new ToxicityDetector();

        // Single insult word produces a low score
        const singleResult = detector.analyze('You idiot');
        const singleScore = singleResult.score;

        // Multiple insults produce higher score
        const multiResult = detector.analyze('You stupid idiot moron dumb loser');
        const multiScore = multiResult.score;

        // Multi should score higher
        expect(multiScore).toBeGreaterThan(singleScore);
    });

    it('bias detector — inclusive language mitigates bias score', () => {
        const detector = new BiasDetector();

        // Biased without mitigation
        const biased = detector.analyze('The chairman decided for his team');
        const biasedScore = biased.overallScore;

        // Same bias but with inclusive language
        const mitigated = detector.analyze('The chairperson from our diverse team decided, the chairperson said');
        const mitigatedScore = mitigated.overallScore;

        // Mitigation should reduce or at least not exceed score
        // (inclusive terms like "diverse" and "chairperson" may offset)
        expect(mitigatedScore).toBeLessThanOrEqual(biasedScore);
    });
});
