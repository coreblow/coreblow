/**
 * CoreBlow Security — ContentFilter Test Suite
 *
 * Covers: built-in rules (profanity, threats, spam, self-harm),
 * addRule(), scan() with flag/block/redact actions, setEnabled(),
 * getStats(), list(), count(), and edge cases.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ContentFilter, type FilterResult } from './content-filter.js';

describe('ContentFilter', () => {
    let filter: ContentFilter;

    beforeEach(() => {
        filter = new ContentFilter();
    });

    // ─── Built-in Rules ─────────────────────────────────────────

    describe('built-in rules', () => {
        it('has 4 default rules', () => {
            expect(filter.count()).toBe(4);
        });

        it('lists profanity, threats, spam, and self-harm categories', () => {
            const categories = filter.list().map(r => r.category);
            expect(categories).toContain('profanity');
            expect(categories).toContain('threats');
            expect(categories).toContain('spam');
            expect(categories).toContain('self-harm');
        });
    });

    // ─── scan() — Clean Text ────────────────────────────────────

    describe('scan() — clean text', () => {
        it('passes clean text with no violations', () => {
            const result = filter.scan('The weather is beautiful today.');
            expect(result.passed).toBe(true);
            expect(result.violations.length).toBe(0);
            expect(result.filteredContent).toBeUndefined();
        });

        it('passes empty string', () => {
            const result = filter.scan('');
            expect(result.passed).toBe(true);
            expect(result.violations.length).toBe(0);
        });
    });

    // ─── scan() — Profanity (action: redact) ────────────────────

    describe('scan() — profanity (redact)', () => {
        it('detects profanity and provides redacted content', () => {
            const result = filter.scan('What the fuck is going on?');
            expect(result.violations.length).toBeGreaterThan(0);
            expect(result.violations[0]!.category).toBe('profanity');
            expect(result.violations[0]!.action).toBe('redact');
            expect(result.filteredContent).toBeTruthy();
            expect(result.filteredContent).toContain('****');
        });

        it('passes content with profanity (redact does not block)', () => {
            const result = filter.scan('This is shit.');
            expect(result.passed).toBe(true); // Redact action doesn't block
        });

        it('redacts multiple profanity instances', () => {
            const result = filter.scan('Damn this shit!');
            expect(result.violations.length).toBe(2);
            expect(result.filteredContent).toBeTruthy();
        });
    });

    // ─── scan() — Threats (action: block) ───────────────────────

    describe('scan() — threats (block)', () => {
        it('blocks content with threat keywords', () => {
            const result = filter.scan('I will kill you.');
            expect(result.passed).toBe(false);
            expect(result.violations.some(v => v.category === 'threats')).toBe(true);
            expect(result.violations.some(v => v.action === 'block')).toBe(true);
        });

        it('blocks bomb/attack threats', () => {
            const result = filter.scan('There is a bomb threat and attack planned.');
            expect(result.passed).toBe(false);
            expect(result.violations.length).toBeGreaterThanOrEqual(2);
        });
    });

    // ─── scan() — Spam (action: flag) ───────────────────────────

    describe('scan() — spam (flag)', () => {
        it('flags spam but does not block', () => {
            const result = filter.scan('Click here for free money!');
            expect(result.passed).toBe(true); // Flag doesn't block
            expect(result.violations.some(v => v.category === 'spam')).toBe(true);
            expect(result.violations.some(v => v.action === 'flag')).toBe(true);
        });

        it('flags "buy now" and "winner"', () => {
            const result = filter.scan('You are the winner! Buy now!');
            expect(result.violations.length).toBeGreaterThanOrEqual(2);
        });
    });

    // ─── scan() — Self-harm (action: block, critical) ───────────

    describe('scan() — self-harm (block)', () => {
        it('blocks self-harm content with critical severity', () => {
            const result = filter.scan('I want to commit suicide.');
            expect(result.passed).toBe(false);
            expect(result.violations.some(v => v.category === 'self-harm')).toBe(true);
            expect(result.violations.some(v => v.severity === 'critical')).toBe(true);
        });
    });

    // ─── scan() — Multiple Violations ───────────────────────────

    describe('scan() — multiple violations', () => {
        it('detects violations across multiple categories', () => {
            const result = filter.scan('Fuck you, I will kill you. Buy now!');
            expect(result.passed).toBe(false); // Threat blocks
            expect(result.violations.length).toBeGreaterThanOrEqual(3);

            const categories = result.violations.map(v => v.category);
            expect(categories).toContain('profanity');
            expect(categories).toContain('threats');
            expect(categories).toContain('spam');
        });
    });

    // ─── addRule() ──────────────────────────────────────────────

    describe('addRule()', () => {
        it('adds a custom rule and returns its id', () => {
            const id = filter.addRule('pii-leak', [/\b\d{3}-\d{2}-\d{4}\b/g], 'high', 'block');
            expect(id).toMatch(/^filter-/);
            expect(filter.count()).toBe(5);
        });

        it('custom rule is active immediately', () => {
            filter.addRule('custom', [/\bsecret-code\b/gi], 'medium', 'block');
            const result = filter.scan('The secret-code is revealed.');
            expect(result.passed).toBe(false);
        });
    });

    // ─── setEnabled() ───────────────────────────────────────────

    describe('setEnabled()', () => {
        it('disables a rule so it is skipped during scan', () => {
            const rules = filter.list();
            const threatRule = rules.find(r => r.category === 'threats')!;

            filter.setEnabled(threatRule.id, false);

            const result = filter.scan('I will kill you.');
            // Threats rule is disabled — should pass
            const threatViolation = result.violations.find(v => v.category === 'threats');
            expect(threatViolation).toBeUndefined();
        });

        it('re-enables a rule', () => {
            const rules = filter.list();
            const threatRule = rules.find(r => r.category === 'threats')!;

            filter.setEnabled(threatRule.id, false);
            filter.setEnabled(threatRule.id, true);

            const result = filter.scan('I will kill you.');
            expect(result.violations.some(v => v.category === 'threats')).toBe(true);
        });

        it('returns false for unknown rule id', () => {
            expect(filter.setEnabled('nonexistent', false)).toBe(false);
        });

        it('returns true for valid rule id', () => {
            const rules = filter.list();
            expect(filter.setEnabled(rules[0]!.id, false)).toBe(true);
        });
    });

    // ─── getStats() ─────────────────────────────────────────────

    describe('getStats()', () => {
        it('starts with all zeros', () => {
            const stats = filter.getStats();
            expect(stats.scanned).toBe(0);
            expect(stats.blocked).toBe(0);
            expect(stats.flagged).toBe(0);
            expect(stats.redacted).toBe(0);
        });

        it('increments scanned on every scan', () => {
            filter.scan('Clean text.');
            filter.scan('Another clean text.');
            expect(filter.getStats().scanned).toBe(2);
        });

        it('increments blocked when content is blocked', () => {
            filter.scan('I will kill you.');
            expect(filter.getStats().blocked).toBe(1);
        });

        it('increments flagged for flag-only violations', () => {
            filter.scan('Click here for free money!');
            expect(filter.getStats().flagged).toBe(1);
        });

        it('increments redacted when profanity is redacted', () => {
            filter.scan('What the fuck?');
            expect(filter.getStats().redacted).toBe(1);
        });

        it('returns a copy (not reference)', () => {
            const s1 = filter.getStats();
            const s2 = filter.getStats();
            expect(s1).not.toBe(s2);
            expect(s1).toEqual(s2);
        });
    });

    // ─── list() ─────────────────────────────────────────────────

    describe('list()', () => {
        it('returns rule summaries with id, category, severity, action, enabled', () => {
            const rules = filter.list();
            for (const rule of rules) {
                expect(rule.id).toBeTruthy();
                expect(rule.category).toBeTruthy();
                expect(rule.severity).toBeTruthy();
                expect(rule.action).toBeTruthy();
                expect(typeof rule.enabled).toBe('boolean');
            }
        });
    });

    // ─── Edge Cases ─────────────────────────────────────────────

    describe('edge cases', () => {
        it('case insensitive matching', () => {
            const result = filter.scan('FUCK this SHIT.');
            expect(result.violations.length).toBeGreaterThan(0);
        });

        it('word boundary — does not match partial words', () => {
            const result = filter.scan('The classic Scunthorpe problem.');
            // Should not flag "classic" or "Scunthorpe" as profanity
            const profanity = result.violations.filter(v => v.category === 'profanity');
            expect(profanity.length).toBe(0);
        });
    });
});
