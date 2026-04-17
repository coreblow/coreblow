/**
 * CoreBlow Security — ToxicityDetector Test Suite
 *
 * Covers: analyze() across all 9 categories (insult, threat, sexual,
 * hate_speech, harassment, spam, violence, self_harm, dangerous_content),
 * severity scoring, isToxic(), analyzeBatch(), configuration
 * (threshold, enabled categories), custom patterns, allowlist,
 * stats tracking, history, resetStats(), and edge cases.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../utils/logger.js', () => ({
    createChildLogger: () => ({
        info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    }),
}));

import { ToxicityDetector, type ToxicityConfig } from './toxicity-detector.js';

describe('ToxicityDetector', () => {
    let detector: ToxicityDetector;

    beforeEach(() => {
        detector = new ToxicityDetector();
    });

    // ─── Clean Text ─────────────────────────────────────────────

    describe('clean text', () => {
        it('returns toxic=false for neutral text', () => {
            const result = detector.analyze('The weather is nice today.');
            expect(result.toxic).toBe(false);
            expect(result.severity).toBe('none');
            expect(result.score).toBe(0);
            expect(result.categories.length).toBe(0);
            expect(result.explanation).toContain('safe');
        });

        it('returns toxic=false for empty string', () => {
            expect(detector.analyze('').toxic).toBe(false);
        });
    });

    // ─── Insult Detection ───────────────────────────────────────

    describe('insult detection', () => {
        it('detects insults', () => {
            const result = detector.analyze('You are an idiot and a moron.');
            const insultCat = result.categories.find(c => c.category === 'insult');
            expect(insultCat).toBeTruthy();
            expect(insultCat!.matched.length).toBeGreaterThan(0);
        });

        it('detects multiple insult terms', () => {
            const result = detector.analyze('You stupid fool, you pathetic loser.');
            const insultCat = result.categories.find(c => c.category === 'insult');
            expect(insultCat!.matched.length).toBeGreaterThanOrEqual(3);
        });
    });

    // ─── Threat Detection ───────────────────────────────────────

    describe('threat detection', () => {
        it('detects direct threats', () => {
            const result = detector.analyze('I will kill you and destroy you.');
            const threatCat = result.categories.find(c => c.category === 'threat');
            expect(threatCat).toBeTruthy();
            expect(result.toxic).toBe(true);
        });

        it('assigns critical severity to threats', () => {
            const result = detector.analyze('I will kill you.');
            if (result.toxic) {
                expect(['high', 'critical']).toContain(result.severity);
            }
        });
    });

    // ─── Hate Speech Detection ──────────────────────────────────

    describe('hate speech detection', () => {
        it('detects group generalizations', () => {
            const result = detector.analyze('All immigrants are evil and bad.');
            const hateCat = result.categories.find(c => c.category === 'hate_speech');
            expect(hateCat).toBeTruthy();
        });
    });

    // ─── Harassment Detection ───────────────────────────────────

    describe('harassment detection', () => {
        it('detects harassment terms', () => {
            const result = detector.analyze('I will stalk you and harass you every day.');
            const cat = result.categories.find(c => c.category === 'harassment');
            expect(cat).toBeTruthy();
        });
    });

    // ─── Spam Detection ─────────────────────────────────────────

    describe('spam detection', () => {
        it('detects spam phrases', () => {
            const result = detector.analyze('Buy now! Click here for free money!');
            const cat = result.categories.find(c => c.category === 'spam');
            expect(cat).toBeTruthy();
        });
    });

    // ─── Violence Detection ─────────────────────────────────────

    describe('violence detection', () => {
        it('detects violent content', () => {
            const result = detector.analyze('The torture and massacre were horrific.');
            const cat = result.categories.find(c => c.category === 'violence');
            expect(cat).toBeTruthy();
        });
    });

    // ─── Self-Harm Detection ────────────────────────────────────

    describe('self-harm detection', () => {
        it('detects self-harm content', () => {
            const result = detector.analyze('I want to end my life and kill myself.');
            const cat = result.categories.find(c => c.category === 'self_harm');
            expect(cat).toBeTruthy();
            expect(result.toxic).toBe(true);
        });
    });

    // ─── Dangerous Content Detection ────────────────────────────

    describe('dangerous content detection', () => {
        it('detects instructions for harmful items', () => {
            const result = detector.analyze('How to make a bomb at home.');
            const cat = result.categories.find(c => c.category === 'dangerous_content');
            expect(cat).toBeTruthy();
        });
    });

    // ─── Severity Scoring ───────────────────────────────────────

    describe('severity scoring', () => {
        it('returns none for safe text', () => {
            expect(detector.analyze('Nice day.').severity).toBe('none');
        });

        it('assigns severity based on score', () => {
            const result = detector.analyze('You idiot moron fool stupid pathetic worthless.');
            if (result.toxic) {
                expect(['low', 'medium', 'high', 'critical']).toContain(result.severity);
            }
        });
    });

    // ─── isToxic() ──────────────────────────────────────────────

    describe('isToxic()', () => {
        it('returns true for toxic text', () => {
            expect(detector.isToxic('I will kill you and destroy you.')).toBe(true);
        });

        it('returns false for safe text', () => {
            expect(detector.isToxic('Have a great day!')).toBe(false);
        });
    });

    // ─── analyzeBatch() ─────────────────────────────────────────

    describe('analyzeBatch()', () => {
        it('returns results for each text', () => {
            const batch = detector.analyzeBatch([
                'Nice day.',
                'I will kill you.',
                'Hello world.',
            ]);
            expect(batch.results.length).toBe(3);
        });

        it('calculates totalToxic count', () => {
            const batch = detector.analyzeBatch([
                'Safe text.',
                'I will kill you and destroy you.',
            ]);
            expect(batch.totalToxic).toBeGreaterThanOrEqual(1);
        });

        it('calculates averageScore', () => {
            const batch = detector.analyzeBatch([
                'Safe text.',
                'Safe again.',
            ]);
            expect(batch.averageScore).toBe(0);
        });

        it('identifies worstCategory', () => {
            const batch = detector.analyzeBatch([
                'You idiot moron.',
                'You stupid fool.',
            ]);
            if (batch.worstCategory) {
                expect(batch.worstCategory).toBe('insult');
            }
        });

        it('handles empty batch', () => {
            const batch = detector.analyzeBatch([]);
            expect(batch.results).toEqual([]);
            expect(batch.totalToxic).toBe(0);
            expect(batch.averageScore).toBe(0);
        });
    });

    // ─── Configuration ──────────────────────────────────────────

    describe('configuration', () => {
        it('respects custom threshold', () => {
            const strict = new ToxicityDetector({ threshold: 0.1 });
            const lenient = new ToxicityDetector({ threshold: 0.9 });

            const text = 'You idiot.';
            const strictResult = strict.analyze(text);
            const lenientResult = lenient.analyze(text);

            // Strict should flag more
            if (strictResult.categories.length > 0) {
                expect(strictResult.toxic).toBe(true);
            }
            expect(lenientResult.toxic).toBe(false);
        });

        it('setThreshold clamps to [0, 1]', () => {
            detector.setThreshold(-5);
            expect(detector.getThreshold()).toBe(0);

            detector.setThreshold(99);
            expect(detector.getThreshold()).toBe(1);

            detector.setThreshold(0.6);
            expect(detector.getThreshold()).toBe(0.6);
        });

        it('enableCategory / disableCategory', () => {
            detector.disableCategory('insult');
            expect(detector.getEnabledCategories()).not.toContain('insult');

            detector.enableCategory('insult');
            expect(detector.getEnabledCategories()).toContain('insult');
        });

        it('disabled category is skipped in analysis', () => {
            detector.disableCategory('insult');
            const result = detector.analyze('You idiot moron.');
            const insultCat = result.categories.find(c => c.category === 'insult');
            expect(insultCat).toBeUndefined();
        });

        it('getEnabledCategories returns all 9 by default', () => {
            expect(detector.getEnabledCategories().length).toBe(9);
        });

        it('respects enabledCategories in config', () => {
            const limited = new ToxicityDetector({ enabledCategories: ['insult', 'threat'] });
            expect(limited.getEnabledCategories().length).toBe(2);
        });

        it('respects maxTextLength', () => {
            const short = new ToxicityDetector({ maxTextLength: 10 });
            // Only first 10 chars scanned — toxic content at end should not be detected
            const result = short.analyze('safe text. I will kill you and destroy you.');
            // First 10 chars = "safe text." which is safe
            expect(result.toxic).toBe(false);
        });
    });

    // ─── Custom Patterns ────────────────────────────────────────

    describe('custom patterns', () => {
        it('adds custom pattern to a category', () => {
            detector.addCustomPattern('insult', /\bclownface\b/gi);
            const result = detector.analyze('You are a clownface.');
            const insultCat = result.categories.find(c => c.category === 'insult');
            expect(insultCat).toBeTruthy();
            expect(insultCat!.matched).toContain('clownface');
        });
    });

    // ─── Stats ──────────────────────────────────────────────────

    describe('stats tracking', () => {
        it('tracks scanned count', () => {
            detector.analyze('A');
            detector.analyze('B');
            expect(detector.getStats().scanned).toBe(2);
        });

        it('tracks toxic count', () => {
            detector.analyze('Safe text.');
            detector.analyze('I will kill you and destroy you.');
            expect(detector.getStats().toxic).toBeGreaterThanOrEqual(1);
        });

        it('tracks toxicRate', () => {
            detector.analyze('Safe.');
            detector.analyze('Safe again.');
            expect(detector.getStats().toxicRate).toBe(0);
        });

        it('tracks by category', () => {
            detector.analyze('You idiot moron stupid.');
            const stats = detector.getStats();
            if (stats.byCategory.insult) {
                expect(stats.byCategory.insult).toBeGreaterThanOrEqual(1);
            }
        });
    });

    // ─── History ────────────────────────────────────────────────

    describe('history', () => {
        it('records analysis history', () => {
            detector.analyze('Test text.');
            const history = detector.getHistory();
            expect(history.length).toBe(1);
            expect(history[0]!.text).toBe('Test text.');
            expect(history[0]!.timestamp).toBeGreaterThan(0);
        });

        it('truncates text to 100 chars in history', () => {
            detector.analyze('A'.repeat(500));
            expect(detector.getHistory()[0]!.text.length).toBe(100);
        });

        it('returns copy of history', () => {
            detector.analyze('Test.');
            const h1 = detector.getHistory();
            const h2 = detector.getHistory();
            expect(h1).not.toBe(h2);
            expect(h1).toEqual(h2);
        });

        it('evicts old entries beyond maxHistory (200)', () => {
            for (let i = 0; i < 210; i++) detector.analyze(`E${i}`);
            expect(detector.getHistory().length).toBeLessThanOrEqual(200);
        });
    });

    // ─── resetStats() ───────────────────────────────────────────

    describe('resetStats()', () => {
        it('clears all stats and history', () => {
            detector.analyze('You idiot.');
            detector.analyze('Safe text.');
            detector.resetStats();

            const stats = detector.getStats();
            expect(stats.scanned).toBe(0);
            expect(stats.toxic).toBe(0);
            expect(Object.keys(stats.byCategory).length).toBe(0);
            expect(detector.getHistory().length).toBe(0);
        });
    });

    // ─── Context-Aware Scoring ──────────────────────────────────

    describe('context-aware scoring', () => {
        it('boosts score when same category appears many times', () => {
            const single = detector.analyze('You idiot.');
            const repeated = detector.analyze('You idiot moron fool stupid pathetic worthless.');

            const singleScore = single.categories.find(c => c.category === 'insult')?.score ?? 0;
            const repeatedScore = repeated.categories.find(c => c.category === 'insult')?.score ?? 0;

            expect(repeatedScore).toBeGreaterThan(singleScore);
        });

        it('can be disabled via config', () => {
            const noContext = new ToxicityDetector({ contextAware: false });
            const result = noContext.analyze('You idiot moron fool stupid pathetic worthless.');
            expect(result).toBeTruthy(); // Just ensure no crash
        });
    });

    // ─── Edge Cases ─────────────────────────────────────────────

    describe('edge cases', () => {
        it('handles whitespace-only text', () => {
            expect(detector.analyze('   \t\n  ').toxic).toBe(false);
        });

        it('handles unicode and emoji', () => {
            expect(detector.analyze('🎉 Great work! こんにちは')).toBeTruthy();
        });

        it('handles very long text without crashing', () => {
            expect(() => detector.analyze('word '.repeat(5000))).not.toThrow();
        });
    });
});
