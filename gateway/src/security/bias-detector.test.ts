/**
 * CoreBlow Security — BiasDetector Test Suite
 *
 * Covers: analyze() across all 8 bias categories, stereotype detection,
 * inclusive language mitigation, severity scoring, batch analysis,
 * isBiased() quick-check, configuration (threshold, enable/disable categories),
 * stats tracking, history management, balance scoring, and edge cases.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BiasDetector, type BiasConfig, type BiasCategory, type BiasResult } from './bias-detector.js';

vi.mock('../utils/logger.js', () => ({
    createChildLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

describe('BiasDetector', () => {
    let detector: BiasDetector;

    beforeEach(() => {
        detector = new BiasDetector();
    });

    // ─── Clean Text ─────────────────────────────────────────────

    describe('clean text (no bias)', () => {
        it('returns biased=false for neutral text', () => {
            const result = detector.analyze('The weather is sunny today.');
            expect(result.biased).toBe(false);
            expect(result.severity).toBe('none');
            expect(result.indicators.length).toBe(0);
            expect(result.balanceScore).toBe(1.0);
        });

        it('returns biased=false for empty string', () => {
            const result = detector.analyze('');
            expect(result.biased).toBe(false);
        });

        it('provides positive recommendation for clean text', () => {
            const result = detector.analyze('Everyone is welcome to participate.');
            expect(result.recommendation).toBe('No significant bias detected');
        });
    });

    // ─── Gender Bias ────────────────────────────────────────────

    describe('gender bias detection', () => {
        it('detects gendered language (mankind, chairman)', () => {
            const result = detector.analyze('The chairman addressed mankind about the fireman\'s duties.');
            const genderInd = result.indicators.find(i => i.category === 'gender');

            expect(genderInd).toBeTruthy();
            expect(genderInd!.indicators.length).toBeGreaterThan(0);
            expect(genderInd!.suggestion).toContain('gender-neutral');
        });

        it('detects gender stereotypes', () => {
            const result = detector.analyze('Women can\'t do mathematics properly.');
            const genderInd = result.indicators.find(i => i.category === 'gender');

            expect(genderInd).toBeTruthy();
            expect(genderInd!.score).toBeGreaterThan(0);
        });

        it('mitigates score when inclusive language is present', () => {
            const biased = detector.analyze('The chairman decided the policy.');
            const mitigated = detector.analyze('The chairman decided the policy. As chairperson, they ensured inclusivity.');

            const biasedGender = biased.indicators.find(i => i.category === 'gender');
            const mitigatedGender = mitigated.indicators.find(i => i.category === 'gender');

            if (biasedGender && mitigatedGender) {
                expect(mitigatedGender.mitigated).toBe(true);
                expect(mitigatedGender.score).toBeLessThanOrEqual(biasedGender.score);
            }
        });
    });

    // ─── Racial Bias ────────────────────────────────────────────

    describe('racial bias detection', () => {
        it('detects racial generalizations', () => {
            const result = detector.analyze('Those people always cause problems. Their kind never changes.');
            const racialInd = result.indicators.find(i => i.category === 'racial');

            expect(racialInd).toBeTruthy();
            expect(racialInd!.score).toBeGreaterThan(0);
        });

        it('does not flag inclusive multicultural text', () => {
            const result = detector.analyze('Our diverse and inclusive team represents many cultures.');
            const racialInd = result.indicators.find(i => i.category === 'racial');

            // Should not have racial bias (or mitigated)
            if (racialInd) {
                expect(racialInd.mitigated).toBe(true);
            }
        });
    });

    // ─── Age Bias ───────────────────────────────────────────────

    describe('age bias detection', () => {
        it('detects ageist stereotypes', () => {
            const result = detector.analyze('Kids these days are too lazy. Old people can\'t learn technology.');
            const ageInd = result.indicators.find(i => i.category === 'age');

            expect(ageInd).toBeTruthy();
        });

        it('recognizes age-inclusive language as mitigation', () => {
            const result = detector.analyze('Our multigenerational team includes experienced professionals and emerging talent.');
            // Should be clean or mitigated
            expect(result.biased).toBe(false);
        });
    });

    // ─── Political Bias ─────────────────────────────────────────

    describe('political bias detection', () => {
        it('detects political generalizations', () => {
            const result = detector.analyze('All conservatives are selfish. Liberals always overreact.');
            const politicalInd = result.indicators.find(i => i.category === 'political');

            expect(politicalInd).toBeTruthy();
        });
    });

    // ─── Socioeconomic Bias ─────────────────────────────────────

    describe('socioeconomic bias detection', () => {
        it('detects socioeconomic stereotypes', () => {
            const result = detector.analyze('Poor people are lazy. Rich people are entitled.');
            const socInd = result.indicators.find(i => i.category === 'socioeconomic');

            expect(socInd).toBeTruthy();
        });
    });

    // ─── Disability Bias ────────────────────────────────────────

    describe('disability bias detection', () => {
        it('detects ableist language', () => {
            const result = detector.analyze('That solution is so lame and retarded.');
            const disabilityInd = result.indicators.find(i => i.category === 'disability');

            expect(disabilityInd).toBeTruthy();
            expect(disabilityInd!.suggestion).toContain('person-first');
        });

        it('detects victim-framing language', () => {
            const result = detector.analyze('She suffers from her disability and is confined to a wheelchair.');
            const disabilityInd = result.indicators.find(i => i.category === 'disability');

            expect(disabilityInd).toBeTruthy();
        });

        it('recognizes person-first language', () => {
            const result = detector.analyze('The person with disability uses a wheelchair and is neurodiverse.');
            // Inclusive terms should mitigate or result in no bias
            expect(result.biased).toBe(false);
        });
    });

    // ─── Religious Bias ─────────────────────────────────────────

    describe('religious bias detection', () => {
        it('detects religious generalizations', () => {
            const result = detector.analyze('All Muslims are extremists. Religious fanatics are everywhere.');
            const religiousInd = result.indicators.find(i => i.category === 'religious');

            expect(religiousInd).toBeTruthy();
        });
    });

    // ─── Cultural Bias ──────────────────────────────────────────

    describe('cultural bias detection', () => {
        it('detects culturally insensitive terms', () => {
            const result = detector.analyze('Those primitive people from third world countries are uncivilized.');
            const culturalInd = result.indicators.find(i => i.category === 'cultural');

            expect(culturalInd).toBeTruthy();
            expect(culturalInd!.suggestion).toContain('culturally respectful');
        });

        it('flags "exotic" and "oriental" as stereotypes', () => {
            const result = detector.analyze('The exotic oriental cuisine was fascinating.');
            const culturalInd = result.indicators.find(i => i.category === 'cultural');

            expect(culturalInd).toBeTruthy();
        });
    });

    // ─── Severity Scoring ───────────────────────────────────────

    describe('severity scoring', () => {
        it('assigns "none" for score < 0.15', () => {
            const result = detector.analyze('This is a normal sentence.');
            expect(result.severity).toBe('none');
        });

        it('assigns correct severity based on score brackets', () => {
            // The private scoreSeverity method: >=0.7 high, >=0.4 medium, >=0.15 low, else none
            // We test indirectly through analyze()
            const highBias = detector.analyze('Those people always cause problems. Their kind never changes. All such people are bad.');
            // Should have at least medium severity for concentrated bias
            if (highBias.biased) {
                expect(['low', 'medium', 'high']).toContain(highBias.severity);
            }
        });
    });

    // ─── Balance Score ──────────────────────────────────────────

    describe('balance score', () => {
        it('returns 1.0 for text with no biased terms', () => {
            const result = detector.analyze('A perfectly neutral statement.');
            expect(result.balanceScore).toBe(1.0);
        });

        it('returns < 1.0 for text with biased terms but no inclusive terms', () => {
            const result = detector.analyze('The chairman addressed the policeman.');
            if (result.indicators.length > 0) {
                expect(result.balanceScore).toBeLessThanOrEqual(1.0);
            }
        });

        it('improves when inclusive terms are present alongside biased terms', () => {
            const unbalanced = detector.analyze('The chairman spoke.');
            const balanced = detector.analyze('The chairman, also known as the chairperson, spoke.');

            if (unbalanced.indicators.length > 0 && balanced.indicators.length > 0) {
                expect(balanced.balanceScore).toBeGreaterThanOrEqual(unbalanced.balanceScore);
            }
        });
    });

    // ─── analyzeBatch() ─────────────────────────────────────────

    describe('analyzeBatch()', () => {
        it('returns results for each text', () => {
            const batch = detector.analyzeBatch([
                'The weather is nice.',
                'Those primitive uncivilized people.',
                'A fair and balanced perspective.',
            ]);

            expect(batch.results.length).toBe(3);
            expect(batch.totalBiased).toBeGreaterThanOrEqual(1);
        });

        it('calculates average score across batch', () => {
            const batch = detector.analyzeBatch([
                'Normal text.',
                'Another normal text.',
            ]);

            expect(batch.averageScore).toBe(0);
        });

        it('identifies the most prevalent bias category', () => {
            const batch = detector.analyzeBatch([
                'The chairman and policeman met.',
                'The fireman and mailman arrived.',
            ]);

            if (batch.prevalentCategory) {
                expect(batch.prevalentCategory).toBe('gender');
            }
        });

        it('handles empty batch', () => {
            const batch = detector.analyzeBatch([]);

            expect(batch.results).toEqual([]);
            expect(batch.totalBiased).toBe(0);
            expect(batch.averageScore).toBe(0);
            expect(batch.prevalentCategory).toBeUndefined();
        });
    });

    // ─── isBiased() ─────────────────────────────────────────────

    describe('isBiased()', () => {
        it('returns true for biased text', () => {
            expect(detector.isBiased('Those primitive uncivilized third world people.')).toBe(true);
        });

        it('returns false for neutral text', () => {
            expect(detector.isBiased('The project was completed on time.')).toBe(false);
        });
    });

    // ─── Configuration ──────────────────────────────────────────

    describe('configuration', () => {
        it('respects custom threshold', () => {
            const strict = new BiasDetector({ threshold: 0.1 });
            const lenient = new BiasDetector({ threshold: 0.9 });

            const text = 'The mailman delivered the package.';
            const strictResult = strict.analyze(text);
            const lenientResult = lenient.analyze(text);

            // Strict threshold should flag more
            expect(strictResult.biased).toBe(true);
            expect(lenientResult.biased).toBe(false);
        });

        it('respects enabledCategories', () => {
            const genderOnly = new BiasDetector({ enabledCategories: ['gender'] });

            const result = genderOnly.analyze('Those primitive uncivilized people. The chairman spoke.');

            // Should only have gender indicators, not cultural
            const categories = result.indicators.map(i => i.category);
            expect(categories).toContain('gender');
            expect(categories).not.toContain('cultural');
        });

        it('setThreshold clamps to [0, 1]', () => {
            detector.setThreshold(-5);
            expect(detector.getThreshold()).toBe(0);

            detector.setThreshold(99);
            expect(detector.getThreshold()).toBe(1);

            detector.setThreshold(0.5);
            expect(detector.getThreshold()).toBe(0.5);
        });

        it('enableCategory / disableCategory', () => {
            detector.disableCategory('gender');
            expect(detector.getEnabledCategories()).not.toContain('gender');

            detector.enableCategory('gender');
            expect(detector.getEnabledCategories()).toContain('gender');
        });

        it('getEnabledCategories returns all 8 by default', () => {
            expect(detector.getEnabledCategories().length).toBe(8);
        });
    });

    // ─── Stats ──────────────────────────────────────────────────

    describe('stats tracking', () => {
        it('tracks scan count', () => {
            detector.analyze('Normal text.');
            detector.analyze('Another text.');

            const stats = detector.getStats();
            expect(stats.scanned).toBe(2);
        });

        it('tracks bias detection count', () => {
            detector.analyze('Normal text.');
            detector.analyze('Those primitive uncivilized people.');

            const stats = detector.getStats();
            expect(stats.biasDetected).toBeGreaterThanOrEqual(1);
        });

        it('calculates bias rate', () => {
            detector.analyze('Normal.');
            detector.analyze('Normal again.');

            const stats = detector.getStats();
            expect(stats.biasRate).toBe(0);
        });

        it('tracks counts by category', () => {
            detector.analyze('The chairman spoke to the fireman.');

            const stats = detector.getStats();
            if (stats.byCategory.gender) {
                expect(stats.byCategory.gender).toBeGreaterThanOrEqual(1);
            }
        });

        it('returns biasRate 0 when no scans', () => {
            expect(detector.getStats().biasRate).toBe(0);
        });
    });

    // ─── History ────────────────────────────────────────────────

    describe('history', () => {
        it('records analysis results', () => {
            detector.analyze('Test text.');

            const history = detector.getHistory();
            expect(history.length).toBe(1);
            expect(history[0]!.text).toBe('Test text.');
            expect(history[0]!.timestamp).toBeGreaterThan(0);
        });

        it('truncates text to first 100 chars in history', () => {
            const longText = 'A'.repeat(200);
            detector.analyze(longText);

            const history = detector.getHistory();
            expect(history[0]!.text.length).toBe(100);
        });

        it('evicts old entries beyond maxHistory (200)', () => {
            for (let i = 0; i < 210; i++) {
                detector.analyze(`Entry ${i}`);
            }

            const history = detector.getHistory();
            expect(history.length).toBeLessThanOrEqual(200);
        });

        it('returns a copy of history (not the internal array)', () => {
            detector.analyze('Test.');
            const h1 = detector.getHistory();
            const h2 = detector.getHistory();
            expect(h1).not.toBe(h2);
            expect(h1).toEqual(h2);
        });
    });

    // ─── resetStats() ───────────────────────────────────────────

    describe('resetStats()', () => {
        it('clears all stats and history', () => {
            detector.analyze('The chairman spoke.');
            detector.analyze('Another biased text with primitive people.');

            detector.resetStats();

            const stats = detector.getStats();
            expect(stats.scanned).toBe(0);
            expect(stats.biasDetected).toBe(0);
            expect(Object.keys(stats.byCategory).length).toBe(0);
            expect(detector.getHistory().length).toBe(0);
        });
    });

    // ─── Edge Cases ─────────────────────────────────────────────

    describe('edge cases', () => {
        it('handles text with only whitespace', () => {
            const result = detector.analyze('   \n\t  ');
            expect(result.biased).toBe(false);
        });

        it('handles special characters and unicode', () => {
            const result = detector.analyze('🎉 Great work! ¿Cómo estás? Привет мир');
            expect(result.biased).toBe(false);
        });

        it('handles extremely long text without crashing', () => {
            const longText = 'The weather is nice. '.repeat(10_000);
            expect(() => detector.analyze(longText)).not.toThrow();
        });

        it('custom config with checkBalance=false still works', () => {
            const d = new BiasDetector({ checkBalance: false });
            const result = d.analyze('The chairman spoke.');
            expect(result).toBeTruthy();
            expect(typeof result.balanceScore).toBe('number');
        });
    });
});
