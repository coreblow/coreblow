/**
 * CoreBlow — Bias Detector Unit Tests
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
    createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

import { BiasDetector } from './bias-detector.js';
import type { BiasCategory } from './bias-detector.js';

describe('BiasDetector', () => {
    let detector: BiasDetector;

    beforeEach(() => {
        detector = new BiasDetector();
    });

    // ─── Initialization ──────────────────────────────────────────

    describe('initialization', () => {
        it('should default to threshold 0.4', () => {
            expect(detector.getThreshold()).toBe(0.4);
        });

        it('should enable all 8 categories by default', () => {
            expect(detector.getEnabledCategories()).toHaveLength(8);
        });

        it('should accept custom threshold', () => {
            const d = new BiasDetector({ threshold: 0.2 });
            expect(d.getThreshold()).toBe(0.2);
        });
    });

    // ─── Clean Text ──────────────────────────────────────────────

    describe('clean text', () => {
        it('should return biased=false for neutral text', () => {
            const r = detector.analyze('The team completed the project successfully.');
            expect(r.biased).toBe(false);
            expect(r.overallScore).toBe(0);
            expect(r.indicators).toHaveLength(0);
            expect(r.balanceScore).toBe(1);
        });
    });

    // ─── Gender Bias ─────────────────────────────────────────────

    describe('gender bias', () => {
        it('should detect gendered terms', () => {
            const r = detector.analyze('The chairman and fireman arrived with the policeman and mailman');
            expect(r.indicators.some((i) => i.category === 'gender')).toBe(true);
        });

        it('should suggest gender-neutral language', () => {
            const r = detector.analyze('The chairman decided');
            const gi = r.indicators.find((i) => i.category === 'gender');
            expect(gi?.suggestion).toContain('gender-neutral');
        });

        it('should detect gender stereotypes', () => {
            const r = detector.analyze("Women can't do math");
            expect(r.indicators.some((i) => i.category === 'gender')).toBe(true);
        });

        it('should mitigate score when inclusive terms present', () => {
            const r1 = detector.analyze('The chairman decided');
            const r2 = detector.analyze('The chairman decided, following inclusive chairperson guidelines');
            const g1 = r1.indicators.find((i) => i.category === 'gender');
            const g2 = r2.indicators.find((i) => i.category === 'gender');
            if (g1 && g2) {
                expect(g2.mitigated).toBe(true);
                expect(g2.score).toBeLessThanOrEqual(g1.score);
            }
        });
    });

    // ─── Disability Bias ─────────────────────────────────────────

    describe('disability bias', () => {
        it('should detect ableist language', () => {
            const r = detector.analyze('That idea is so lame and crazy');
            expect(r.indicators.some((i) => i.category === 'disability')).toBe(true);
        });

        it('should suggest person-first language', () => {
            const r = detector.analyze('The crippled man');
            const di = r.indicators.find((i) => i.category === 'disability');
            expect(di?.suggestion).toContain('person-first');
        });
    });

    // ─── Cultural Bias ───────────────────────────────────────────

    describe('cultural bias', () => {
        it('should detect culturally insensitive terms', () => {
            const r = detector.analyze('Those primitive backward people');
            expect(r.indicators.some((i) => i.category === 'cultural')).toBe(true);
        });
    });

    // ─── Age Bias ────────────────────────────────────────────────

    describe('age bias', () => {
        it('should detect age stereotypes', () => {
            const r = detector.analyze('Kids these days are too lazy');
            expect(r.indicators.some((i) => i.category === 'age')).toBe(true);
        });
    });

    // ─── isBiased ────────────────────────────────────────────────

    describe('isBiased', () => {
        it('should return true for biased text', () => {
            expect(detector.isBiased('Those primitive backward people')).toBe(true);
        });

        it('should return false for neutral text', () => {
            expect(detector.isBiased('The weather is nice today')).toBe(false);
        });
    });

    // ─── Batch Analysis ──────────────────────────────────────────

    describe('analyzeBatch', () => {
        it('should analyze multiple texts', () => {
            const r = detector.analyzeBatch([
                'The chairman and fireman and policeman and mailman decided',
                'Normal text here',
                'Those primitive backward uncivilized savage people',
            ]);
            expect(r.results).toHaveLength(3);
            expect(r.totalBiased).toBeGreaterThanOrEqual(1);
        });

        it('should identify prevalent category', () => {
            const r = detector.analyzeBatch([
                'The chairman and fireman',
                'The policeman and mailman',
            ]);
            expect(r.prevalentCategory).toBe('gender');
        });

        it('should handle empty batch', () => {
            const r = detector.analyzeBatch([]);
            expect(r.results).toHaveLength(0);
            expect(r.averageScore).toBe(0);
        });
    });

    // ─── Configuration ───────────────────────────────────────────

    describe('configuration', () => {
        it('setThreshold should clamp between 0 and 1', () => {
            detector.setThreshold(2);
            expect(detector.getThreshold()).toBe(1);
            detector.setThreshold(-1);
            expect(detector.getThreshold()).toBe(0);
        });

        it('disableCategory should skip analysis', () => {
            detector.disableCategory('gender');
            const r = detector.analyze('The chairman decided');
            expect(r.indicators.some((i) => i.category === 'gender')).toBe(false);
        });

        it('enableCategory should re-enable', () => {
            detector.disableCategory('gender');
            detector.enableCategory('gender');
            expect(detector.getEnabledCategories()).toContain('gender');
        });
    });

    // ─── Stats & History ─────────────────────────────────────────

    describe('stats', () => {
        it('should track scanned count', () => {
            detector.analyze('Hello');
            detector.analyze('World');
            expect(detector.getStats().scanned).toBe(2);
        });

        it('should track biasDetected count', () => {
            detector.analyze('Those primitive backward people');
            detector.analyze('Hello');
            expect(detector.getStats().biasDetected).toBe(1);
        });

        it('should compute biasRate', () => {
            detector.analyze('Those primitive backward uncivilized people');
            detector.analyze('Hello');
            const stats = detector.getStats();
            expect(stats.biasRate).toBeCloseTo(0.5);
        });
    });

    describe('history', () => {
        it('should record and return history', () => {
            detector.analyze('Test');
            expect(detector.getHistory()).toHaveLength(1);
        });
    });

    describe('resetStats', () => {
        it('should clear all stats and history', () => {
            detector.analyze('Chairman decided');
            detector.resetStats();
            expect(detector.getStats().scanned).toBe(0);
            expect(detector.getHistory()).toHaveLength(0);
        });
    });

    // ─── Balance Score ───────────────────────────────────────────

    describe('balance score', () => {
        it('should return 1.0 for clean text (no biased terms)', () => {
            const r = detector.analyze('A perfectly neutral sentence');
            expect(r.balanceScore).toBe(1);
        });

        it('should be lower when biased terms outweigh inclusive terms', () => {
            const r = detector.analyze('The chairman and fireman and policeman are here');
            expect(r.balanceScore).toBeLessThan(1);
        });
    });
});
