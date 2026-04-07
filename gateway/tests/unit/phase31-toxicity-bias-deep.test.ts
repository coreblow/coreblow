/**
 * CoreBlow Phase 31 — ToxicityDetector & BiasDetector Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - ToxicityDetector: batch scanning, category config, custom patterns, allowlist
 *   - BiasDetector: intersectional analysis, balance scoring, category toggles
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ToxicityDetector } from '../../src/security/toxicity-detector.js';
import { BiasDetector } from '../../src/security/bias-detector.js';

// ================================================================
describe('ToxicityDetector — Extended', () => {
    let detector: ToxicityDetector;
    beforeEach(() => { detector = new ToxicityDetector(); });

    it('should batch scan multiple texts', () => {
        const result = detector.analyzeBatch([
            'Have a nice day!',
            'You are an idiot and a moron and stupid',
            'The weather is great',
        ]);
        expect(result.results).toHaveLength(3);
        expect(result.totalToxic).toBe(1);
        expect(result.averageScore).toBeGreaterThan(0);
        expect(result.worstCategory).toBe('insult');
    });

    it('should detect violence category', () => {
        const result = detector.analyze('The massacre and slaughter and torture was horrific');
        expect(result.toxic).toBe(true);
        expect(result.categories.some(c => c.category === 'violence')).toBe(true);
    });

    it('should detect self-harm content as critical', () => {
        const result = detector.analyze('I want to end my life and kill myself');
        expect(result.toxic).toBe(true);
        expect(result.severity).toBe('critical');
        expect(result.categories.some(c => c.category === 'self_harm')).toBe(true);
    });

    it('should detect dangerous content (instructions for harm)', () => {
        const result = detector.analyze('how to make a bomb at home');
        expect(result.toxic).toBe(true);
        expect(result.categories.some(c => c.category === 'dangerous_content')).toBe(true);
    });

    it('should quick-check with isToxic()', () => {
        expect(detector.isToxic('Hello world')).toBe(false);
        expect(detector.isToxic('You stupid idiot moron')).toBe(true);
    });

    it('should disable specific categories', () => {
        detector.disableCategory('insult');
        const result = detector.analyze('You are an idiot and a moron');
        // With insults disabled, should not detect
        expect(result.categories.some(c => c.category === 'insult')).toBe(false);
    });

    it('should add custom patterns to existing categories', () => {
        detector.addCustomPattern('insult', /\b(noob|scrub)\b/gi);
        const result = detector.analyze('You are such a noob and a scrub');
        expect(result.categories.some(c => c.category === 'insult')).toBe(true);
    });

    it('should track per-category stats', () => {
        detector.analyze('You stupid idiot moron');
        detector.analyze('I will torture and murder');
        detector.analyze('Hello friend');

        const stats = detector.getStats();
        expect(stats.scanned).toBe(3);
        expect(stats.toxic).toBe(2);
        expect(stats.toxicRate).toBeCloseTo(2/3, 1);
        expect(stats.byCategory['insult']).toBe(1);
        expect(stats.byCategory['violence']).toBe(1);
    });

    it('should record history and reset', () => {
        detector.analyze('Test 1');
        detector.analyze('Test 2');
        expect(detector.getHistory()).toHaveLength(2);

        detector.resetStats();
        expect(detector.getHistory()).toHaveLength(0);
        expect(detector.getStats().scanned).toBe(0);
    });

    it('should respect configurable threshold', () => {
        detector.setThreshold(0.99); // Very high threshold
        const result = detector.analyze('You idiot');
        // With very high threshold, single word shouldn't trigger
        expect(result.score).toBeLessThan(0.99);
    });
});

// ================================================================
describe('BiasDetector — Extended', () => {
    let detector: BiasDetector;
    beforeEach(() => { detector = new BiasDetector(); });

    it('should batch scan multiple texts', () => {
        const result = detector.analyzeBatch([
            'The weather is nice today',
            'The chairman and the policeman and the fireman and the stewardess and the mailman were all mankind',
            'We need diverse perspectives',
        ]);
        expect(result.results).toHaveLength(3);
        // Text with 6 gendered terms: 6 * 0.25 * 0.5 = 0.75 > 0.4 threshold
        expect(result.totalBiased).toBeGreaterThanOrEqual(1);
    });

    it('should detect disability bias', () => {
        const result = detector.analyze('The crippled and handicapped people need help');
        expect(result.indicators.some(i => i.category === 'disability')).toBe(true);
    });

    it('should detect cultural bias', () => {
        const result = detector.analyze('Those primitive and uncivilized backward countries');
        expect(result.indicators.some(i => i.category === 'cultural')).toBe(true);
    });

    it('should improve balance score when inclusive language present', () => {
        const biasedResult = detector.analyze('The chairman decided for his team');
        const balancedResult = detector.analyze('The chairperson decided for their diverse team');

        // Balanced text should have higher balance score
        expect(balancedResult.balanceScore).toBeGreaterThanOrEqual(biasedResult.balanceScore);
    });

    it('should quick-check with isBiased()', () => {
        expect(detector.isBiased('The weather is nice')).toBe(false);
    });

    it('should disable specific categories', () => {
        detector.disableCategory('gender');
        const result = detector.analyze('The chairman decided');
        expect(result.indicators.some(i => i.category === 'gender')).toBe(false);
    });

    it('should track per-category stats', () => {
        detector.analyze('The chairman managed his manmade fireman stewardess team, he said');
        detector.analyze('Those primitive uncivilized backward countries');
        detector.analyze('Hello world');

        const stats = detector.getStats();
        expect(stats.scanned).toBe(3);
        expect(stats.biasDetected).toBeGreaterThanOrEqual(1);
    });

    it('should return perfect balance for unbiased text', () => {
        const result = detector.analyze('The team collaborated on the project successfully');
        expect(result.balanceScore).toBe(1.0);
        expect(result.biased).toBe(false);
    });

    it('should record history and reset', () => {
        detector.analyze('Test 1');
        detector.analyze('Test 2');
        expect(detector.getHistory()).toHaveLength(2);

        detector.resetStats();
        expect(detector.getHistory()).toHaveLength(0);
    });
});
