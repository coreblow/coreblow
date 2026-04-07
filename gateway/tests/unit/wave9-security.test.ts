/**
 * Wave 9 — Security Hardening Tests
 *
 * Tests for: ToxicityDetector, BiasDetector, GuardrailsEngine
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ToxicityDetector } from '../../src/security/toxicity-detector.js';
import { BiasDetector } from '../../src/security/bias-detector.js';
import { GuardrailsEngine } from '../../src/security/guardrails.js';

// ═══════════════════════════════════════════════════════════════════
// ToxicityDetector
// ═══════════════════════════════════════════════════════════════════

describe('ToxicityDetector', () => {
    let detector: ToxicityDetector;

    beforeEach(() => {
        detector = new ToxicityDetector();
    });

    describe('basic detection', () => {
        it('should detect insults', () => {
            const result = detector.analyze('You are such an idiot');
            expect(result.toxic).toBe(true);
            expect(result.categories.some((c) => c.category === 'insult')).toBe(true);
        });

        it('should detect threats', () => {
            const result = detector.analyze('I will kill you if you do that');
            expect(result.toxic).toBe(true);
            expect(result.severity).toBe('critical');
        });

        it('should pass safe content', () => {
            const result = detector.analyze('The weather is nice today');
            expect(result.toxic).toBe(false);
            expect(result.score).toBe(0);
            expect(result.severity).toBe('none');
        });

        it('should detect harassment', () => {
            const result = detector.analyze('I will stalk and harass you');
            expect(result.toxic).toBe(true);
            expect(result.categories.some((c) => c.category === 'harassment')).toBe(true);
        });

        it('should detect spam', () => {
            const result = detector.analyze('Buy now! Click here for free money!');
            expect(result.categories.some((c) => c.category === 'spam')).toBe(true);
        });

        it('should detect violence', () => {
            const result = detector.analyze('The massacre was horrific with bloodshed');
            expect(result.toxic).toBe(true);
            expect(result.categories.some((c) => c.category === 'violence')).toBe(true);
        });

        it('should detect self harm', () => {
            const result = detector.analyze('How to kill myself');
            expect(result.toxic).toBe(true);
            expect(result.severity).toBe('critical');
        });
    });

    describe('severity classification', () => {
        it('should classify critical threats', () => {
            const result = detector.analyze('I will kill you');
            expect(result.severity).toBe('critical');
        });

        it('should classify safe content as none', () => {
            const result = detector.analyze('Hello world');
            expect(result.severity).toBe('none');
        });
    });

    describe('batch scanning', () => {
        it('should scan multiple texts', () => {
            const result = detector.analyzeBatch([
                'You are an idiot',
                'Hello friend',
                'I will kill you',
            ]);
            expect(result.results).toHaveLength(3);
            expect(result.totalToxic).toBe(2);
            expect(result.averageScore).toBeGreaterThan(0);
        });
    });

    describe('quick check', () => {
        it('should return true for toxic', () => {
            expect(detector.isToxic('you moron')).toBe(true);
        });

        it('should return false for safe', () => {
            expect(detector.isToxic('have a nice day')).toBe(false);
        });
    });

    describe('configuration', () => {
        it('should adjust threshold', () => {
            detector.setThreshold(0.99);
            expect(detector.isToxic('you idiot')).toBe(false); // below higher threshold
        });

        it('should disable categories', () => {
            detector.disableCategory('insult');
            const result = detector.analyze('you are an idiot');
            expect(result.categories.some((c) => c.category === 'insult')).toBe(false);
        });

        it('should enable categories', () => {
            detector.disableCategory('insult');
            detector.enableCategory('insult');
            expect(detector.getEnabledCategories()).toContain('insult');
        });

        it('should support custom patterns', () => {
            detector.addCustomPattern('spam', /\bspecial_promo\b/gi);
            const result = detector.analyze('Check out this special_promo');
            expect(result.categories.some((c) => c.category === 'spam')).toBe(true);
        });
    });

    describe('statistics', () => {
        it('should track scan stats', () => {
            detector.analyze('hello');
            detector.analyze('you idiot');
            const stats = detector.getStats();
            expect(stats.scanned).toBe(2);
            expect(stats.toxic).toBe(1);
            expect(stats.toxicRate).toBe(0.5);
        });

        it('should track per-category stats', () => {
            detector.analyze('you idiot moron');
            const stats = detector.getStats();
            expect(stats.byCategory['insult']).toBeGreaterThan(0);
        });

        it('should maintain history', () => {
            detector.analyze('test text');
            expect(detector.getHistory()).toHaveLength(1);
        });

        it('should reset stats', () => {
            detector.analyze('test');
            detector.resetStats();
            expect(detector.getStats().scanned).toBe(0);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// BiasDetector
// ═══════════════════════════════════════════════════════════════════

describe('BiasDetector', () => {
    let detector: BiasDetector;

    beforeEach(() => {
        detector = new BiasDetector();
    });

    describe('basic detection', () => {
        it('should detect gender-biased language', () => {
            const result = detector.analyze('The chairman decided on behalf of mankind');
            expect(result.indicators.some((i) => i.category === 'gender')).toBe(true);
        });

        it('should detect age bias', () => {
            const result = detector.analyze('Old people are too old to learn technology');
            expect(result.indicators.some((i) => i.category === 'age')).toBe(true);
        });

        it('should detect disability bias', () => {
            const result = detector.analyze('The crippled man was insane and retarded');
            expect(result.biased).toBe(true);
            expect(result.indicators.some((i) => i.category === 'disability')).toBe(true);
        });

        it('should detect cultural bias', () => {
            const result = detector.analyze('Those primitive uncivilized countries');
            expect(result.biased).toBe(true);
            expect(result.indicators.some((i) => i.category === 'cultural')).toBe(true);
        });

        it('should pass neutral content', () => {
            const result = detector.analyze('Machine learning models use gradient descent optimization');
            expect(result.biased).toBe(false);
            expect(result.overallScore).toBe(0);
        });
    });

    describe('balance scoring', () => {
        it('should give high balance score for neutral text', () => {
            const result = detector.analyze('Everyone deserves equal opportunity');
            expect(result.balanceScore).toBe(1.0);
        });
    });

    describe('batch scanning', () => {
        it('should scan multiple texts', () => {
            const result = detector.analyzeBatch([
                'The chairman said hello',
                'The chairperson said hello',
                'The doctor helped everyone',
            ]);
            expect(result.results).toHaveLength(3);
        });
    });

    describe('quick check', () => {
        it('should return true for biased', () => {
            expect(detector.isBiased('The crippled handicapped man')).toBe(true);
        });

        it('should return false for neutral', () => {
            expect(detector.isBiased('The algorithm converged')).toBe(false);
        });
    });

    describe('configuration', () => {
        it('should adjust threshold', () => {
            detector.setThreshold(0.99);
            expect(detector.isBiased('The chairman decided')).toBe(false);
        });

        it('should disable categories', () => {
            detector.disableCategory('gender');
            const result = detector.analyze('The chairman decided');
            expect(result.indicators.some((i) => i.category === 'gender')).toBe(false);
        });
    });

    describe('statistics', () => {
        it('should track scan stats', () => {
            detector.analyze('hello');
            detector.analyze('The crippled retarded man');
            const stats = detector.getStats();
            expect(stats.scanned).toBe(2);
            expect(stats.biasDetected).toBeGreaterThanOrEqual(1);
        });

        it('should maintain history', () => {
            detector.analyze('test');
            expect(detector.getHistory()).toHaveLength(1);
        });

        it('should reset stats', () => {
            detector.analyze('test');
            detector.resetStats();
            expect(detector.getStats().scanned).toBe(0);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// GuardrailsEngine
// ═══════════════════════════════════════════════════════════════════

describe('GuardrailsEngine', () => {
    let engine: GuardrailsEngine;

    beforeEach(() => {
        engine = new GuardrailsEngine({ policy: 'standard' });
    });

    describe('safe content', () => {
        it('should pass safe content', () => {
            const result = engine.scan('Hello, how are you today?');
            expect(result.safe).toBe(true);
            expect(result.blocked).toBe(false);
            expect(result.enforcements).toHaveLength(0);
        });

        it('should generate safety report', () => {
            const result = engine.scan('Normal conversation');
            expect(result.report).toBeDefined();
            expect(result.report.overallSafe).toBe(true);
        });
    });

    describe('toxic content', () => {
        it('should detect and block toxic content in standard mode', () => {
            const result = engine.scan('I will kill you and destroy everything');
            expect(result.safe).toBe(false);
            expect(result.blocked).toBe(true);
            expect(result.toxicity?.toxic).toBe(true);
            expect(result.enforcements.length).toBeGreaterThan(0);
        });
    });

    describe('content filter', () => {
        it('should block threats via content filter', () => {
            const result = engine.scan('I have a bomb and will attack');
            expect(result.blocked).toBe(true);
            expect(result.content?.passed).toBe(false);
        });
    });

    describe('PII detection', () => {
        it('should detect PII and mask it', () => {
            const result = engine.scan('My email is test@example.com');
            expect(result.pii?.hasPII).toBe(true);
            expect(result.filteredText).toBeDefined();
            expect(result.enforcements.some((e) => e.includes('PII'))).toBe(true);
        });
    });

    describe('bias detection', () => {
        it('should detect bias in standard mode (not blocked)', () => {
            const result = engine.scan('The crippled handicapped retarded person');
            expect(result.bias?.biased).toBe(true);
            // Standard mode doesn't block on bias
            expect(result.blocked).toBe(false);
        });
    });

    describe('policy enforcement', () => {
        it('should block bias in strict mode', () => {
            const strictEngine = new GuardrailsEngine({ policy: 'strict' });
            const result = strictEngine.scan('The crippled handicapped retarded person');
            expect(result.blocked).toBe(true);
        });

        it('should not block toxic content in monitor mode', () => {
            const monitorEngine = new GuardrailsEngine({ policy: 'monitor' });
            const result = monitorEngine.scan('You are an idiot and a moron');
            expect(result.blocked).toBe(false);
            expect(result.toxicity?.toxic).toBe(true);
        });

        it('should switch policies', () => {
            engine.setPolicy('permissive');
            expect(engine.getPolicy()).toBe('permissive');
        });
    });

    describe('check enable/disable', () => {
        it('should disable specific checks', () => {
            engine.disableCheck('toxicity');
            const result = engine.scan('You are an idiot');
            expect(result.toxicity).toBeUndefined();
        });

        it('should re-enable checks', () => {
            engine.disableCheck('toxicity');
            engine.enableCheck('toxicity');
            const checks = engine.getEnabledChecks();
            expect(checks.toxicity).toBe(true);
        });
    });

    describe('batch scanning', () => {
        it('should scan multiple texts', () => {
            const results = engine.scanBatch([
                'Hello world',
                'I will kill you',
                'Nice weather today',
            ]);
            expect(results).toHaveLength(3);
            expect(results[0]!.safe).toBe(true);
            expect(results[1]!.blocked).toBe(true);
        });
    });

    describe('quick check', () => {
        it('should return true for safe', () => {
            expect(engine.isSafe('Hello!')).toBe(true);
        });

        it('should return false for unsafe', () => {
            expect(engine.isSafe('I will kill you')).toBe(false);
        });
    });

    describe('statistics', () => {
        it('should track combined stats', () => {
            engine.scan('Hello');
            engine.scan('I will kill you');
            const stats = engine.getStats();
            expect(stats.scans).toBe(2);
            expect(stats.blocked).toBe(1);
            expect(stats.blockRate).toBe(0.5);
        });

        it('should track sub-module stats', () => {
            engine.scan('test@example.com');
            const stats = engine.getStats();
            expect(stats.pii.scanned).toBe(1);
            expect(stats.toxicity.scanned).toBe(1);
        });

        it('should get recent reports', () => {
            engine.scan('Hello');
            engine.scan('World');
            const reports = engine.getRecentReports();
            expect(reports).toHaveLength(2);
        });
    });

    describe('accessors', () => {
        it('should expose sub-engines', () => {
            expect(engine.getToxicity()).toBeInstanceOf(ToxicityDetector);
            expect(engine.getBias()).toBeInstanceOf(BiasDetector);
        });
    });
});
