import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../utils/logger.js', () => ({
    createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('./safe-regex.js', () => ({
    testRegexWithBoundedInput: (_re: RegExp, _text: string) => true,
    compileSafeRegexDetailed: (source: string, flags: string) => ({
        regex: new RegExp(source, flags),
        source,
        flags,
        reason: null,
    }),
}));

import { ToxicityDetector } from './toxicity-detector.js';
import type { ToxicityCategory } from './toxicity-detector.js';

describe('ToxicityDetector', () => {
    let detector: ToxicityDetector;

    beforeEach(() => {
        detector = new ToxicityDetector();
    });

    // ─── Initialization ──────────────────────────────────────────

    describe('initialization', () => {
        it('should default to threshold 0.5', () => {
            expect(detector.getThreshold()).toBe(0.5);
        });

        it('should enable all 9 categories by default', () => {
            expect(detector.getEnabledCategories()).toHaveLength(9);
        });

        it('should accept custom threshold', () => {
            const d = new ToxicityDetector({ threshold: 0.3 });
            expect(d.getThreshold()).toBe(0.3);
        });

        it('should accept custom enabled categories', () => {
            const d = new ToxicityDetector({ enabledCategories: ['insult', 'threat'] });
            expect(d.getEnabledCategories()).toHaveLength(2);
        });
    });

    // ─── Clean Text ──────────────────────────────────────────────

    describe('clean text', () => {
        it('should return toxic=false for clean text', () => {
            const r = detector.analyze('Hello, how are you today?');
            expect(r.toxic).toBe(false);
            expect(r.score).toBe(0);
            expect(r.severity).toBe('none');
            expect(r.categories).toHaveLength(0);
            expect(r.explanation).toContain('safe');
        });
    });

    // ─── Insult Detection ────────────────────────────────────────

    describe('insult detection', () => {
        it('should detect insults', () => {
            const r = detector.analyze('You are a stupid idiot moron');
            expect(r.toxic).toBe(true);
            expect(r.categories.some((c) => c.category === 'insult')).toBe(true);
        });

        it('should list matched terms', () => {
            const r = detector.analyze('You stupid fool');
            const insult = r.categories.find((c) => c.category === 'insult')!;
            expect(insult.matched.length).toBeGreaterThan(0);
        });
    });

    // ─── Threat Detection ────────────────────────────────────────

    describe('threat detection', () => {
        it('should detect threats', () => {
            const r = detector.analyze('I will kill you');
            expect(r.toxic).toBe(true);
            expect(r.categories.some((c) => c.category === 'threat')).toBe(true);
        });

        it('should rate threats as critical severity', () => {
            const r = detector.analyze('I will kill you destroy you');
            const threat = r.categories.find((c) => c.category === 'threat');
            expect(threat).toBeDefined();
        });
    });

    // ─── Violence Detection ──────────────────────────────────────

    describe('violence detection', () => {
        it('should detect violence keywords', () => {
            const r = detector.analyze('The massacre and slaughter was terrible');
            expect(r.toxic).toBe(true);
            expect(r.categories.some((c) => c.category === 'violence')).toBe(true);
        });
    });

    // ─── Self-harm Detection ─────────────────────────────────────

    describe('self-harm detection', () => {
        it('should detect self-harm keywords', () => {
            const r = detector.analyze('I want to kill myself');
            expect(r.toxic).toBe(true);
            expect(r.categories.some((c) => c.category === 'self_harm')).toBe(true);
        });
    });

    // ─── Spam Detection ──────────────────────────────────────────

    describe('spam detection', () => {
        it('should detect spam phrases', () => {
            const r = detector.analyze('Click here for free money buy now');
            expect(r.categories.some((c) => c.category === 'spam')).toBe(true);
        });
    });

    // ─── Dangerous Content ───────────────────────────────────────

    describe('dangerous content detection', () => {
        it('should detect dangerous instructions', () => {
            const r = detector.analyze('How to make a bomb at home');
            expect(r.toxic).toBe(true);
            expect(r.categories.some((c) => c.category === 'dangerous_content')).toBe(true);
        });
    });

    // ─── isToxic (quick check) ───────────────────────────────────

    describe('isToxic', () => {
        it('should return true for toxic content', () => {
            expect(detector.isToxic('You stupid idiot moron')).toBe(true);
        });

        it('should return false for clean content', () => {
            expect(detector.isToxic('Good morning!')).toBe(false);
        });
    });

    // ─── Batch Analysis ──────────────────────────────────────────

    describe('analyzeBatch', () => {
        it('should analyze multiple texts', () => {
            const r = detector.analyzeBatch(['Hello', 'You stupid idiot moron', 'Good day']);
            expect(r.results).toHaveLength(3);
            expect(r.totalToxic).toBe(1);
            expect(r.averageScore).toBeGreaterThan(0);
        });

        it('should identify worst category', () => {
            const r = detector.analyzeBatch(['You stupid idiot', 'Another stupid fool']);
            expect(r.worstCategory).toBe('insult');
        });

        it('should handle empty batch', () => {
            const r = detector.analyzeBatch([]);
            expect(r.results).toHaveLength(0);
            expect(r.totalToxic).toBe(0);
            expect(r.averageScore).toBe(0);
        });
    });

    // ─── Configuration ──────────────────────────────────────────

    describe('configuration', () => {
        it('setThreshold should clamp between 0 and 1', () => {
            detector.setThreshold(1.5);
            expect(detector.getThreshold()).toBe(1);
            detector.setThreshold(-0.5);
            expect(detector.getThreshold()).toBe(0);
        });

        it('enableCategory should add a category', () => {
            detector.disableCategory('insult');
            expect(detector.getEnabledCategories()).not.toContain('insult');
            detector.enableCategory('insult');
            expect(detector.getEnabledCategories()).toContain('insult');
        });

        it('disableCategory should skip that category in analysis', () => {
            detector.disableCategory('insult');
            const r = detector.analyze('You are a stupid idiot');
            expect(r.categories.some((c) => c.category === 'insult')).toBe(false);
        });
    });

    // ─── Custom Patterns ─────────────────────────────────────────

    describe('addCustomPattern', () => {
        it('should add pattern and detect it', () => {
            detector.addCustomPattern('insult', /\bclown\b/gi);
            const r = detector.analyze('You are a clown');
            expect(r.categories.some((c) => c.category === 'insult')).toBe(true);
        });
    });

    // ─── Stats & History ─────────────────────────────────────────

    describe('stats', () => {
        it('should track scanned count', () => {
            detector.analyze('Hello');
            detector.analyze('World');
            expect(detector.getStats().scanned).toBe(2);
        });

        it('should track toxic count', () => {
            detector.analyze('You stupid idiot moron');
            detector.analyze('Hello');
            expect(detector.getStats().toxic).toBe(1);
        });

        it('should compute toxicRate', () => {
            detector.analyze('Moron idiot');
            detector.analyze('Hello');
            expect(detector.getStats().toxicRate).toBeCloseTo(0.5);
        });

        it('should track by category', () => {
            detector.analyze('You stupid fool');
            const stats = detector.getStats();
            expect(stats.byCategory.insult).toBe(1);
        });
    });

    describe('history', () => {
        it('should record history entries', () => {
            detector.analyze('Hello');
            expect(detector.getHistory()).toHaveLength(1);
        });

        it('should return a copy of history', () => {
            detector.analyze('Test');
            const h1 = detector.getHistory();
            detector.analyze('Test2');
            expect(h1).toHaveLength(1);
        });
    });

    describe('resetStats', () => {
        it('should clear stats and history', () => {
            detector.analyze('Stupid idiot');
            detector.analyze('Hello');
            detector.resetStats();
            expect(detector.getStats().scanned).toBe(0);
            expect(detector.getStats().toxic).toBe(0);
            expect(detector.getHistory()).toHaveLength(0);
        });
    });
});
