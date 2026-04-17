/**
 * CoreBlow — Content Filter Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ContentFilter } from './content-filter.js';

describe('ContentFilter', () => {
    let filter: ContentFilter;

    beforeEach(() => {
        filter = new ContentFilter();
    });

    // ─── Initialization ──────────────────────────────────────────

    describe('initialization', () => {
        it('should have 4 built-in rules', () => {
            expect(filter.count()).toBe(4);
        });

        it('should list all built-in rules with correct shape', () => {
            const rules = filter.list();
            expect(rules).toHaveLength(4);
            for (const r of rules) {
                expect(r).toHaveProperty('id');
                expect(r).toHaveProperty('category');
                expect(r).toHaveProperty('severity');
                expect(r).toHaveProperty('action');
                expect(r).toHaveProperty('enabled');
                expect(r.enabled).toBe(true);
            }
        });

        it('should include profanity, threats, spam, self-harm categories', () => {
            const cats = filter.list().map((r) => r.category);
            expect(cats).toContain('profanity');
            expect(cats).toContain('threats');
            expect(cats).toContain('spam');
            expect(cats).toContain('self-harm');
        });

        it('should start with zero stats', () => {
            const stats = filter.getStats();
            expect(stats.scanned).toBe(0);
            expect(stats.blocked).toBe(0);
            expect(stats.flagged).toBe(0);
            expect(stats.redacted).toBe(0);
        });
    });

    // ─── Clean Content ───────────────────────────────────────────

    describe('clean content — no violations', () => {
        it('should pass clean text', () => {
            const result = filter.scan('Hello, how are you today?');
            expect(result.passed).toBe(true);
            expect(result.violations).toHaveLength(0);
            expect(result.filteredContent).toBeUndefined();
        });

        it('should pass empty string', () => {
            const result = filter.scan('');
            expect(result.passed).toBe(true);
            expect(result.violations).toHaveLength(0);
        });
    });

    // ─── Profanity (action: redact) ──────────────────────────────

    describe('profanity — redact action', () => {
        it('should detect profanity and redact it', () => {
            const result = filter.scan('What the fuck is this');
            expect(result.passed).toBe(true); // redact doesn't block
            expect(result.violations.length).toBeGreaterThan(0);
            expect(result.violations[0].category).toBe('profanity');
            expect(result.violations[0].action).toBe('redact');
        });

        it('should replace profanity with asterisks in filteredContent', () => {
            const result = filter.scan('This is shit');
            expect(result.filteredContent).toBeDefined();
            expect(result.filteredContent).not.toContain('shit');
            expect(result.filteredContent).toContain('****');
        });

        it('should handle multiple profanity words', () => {
            const result = filter.scan('fuck this shit damn');
            expect(result.violations.length).toBeGreaterThanOrEqual(3);
            expect(result.filteredContent).toBeDefined();
            expect(result.filteredContent).not.toContain('fuck');
            expect(result.filteredContent).not.toContain('shit');
        });
    });

    // ─── Threats (action: block) ─────────────────────────────────

    describe('threats — block action', () => {
        it('should block threatening content', () => {
            const result = filter.scan('I will kill you');
            expect(result.passed).toBe(false);
            expect(result.violations.some((v) => v.category === 'threats')).toBe(true);
            expect(result.violations.some((v) => v.action === 'block')).toBe(true);
        });

        it('should detect "bomb" as a threat', () => {
            const result = filter.scan('There is a bomb in the building');
            expect(result.passed).toBe(false);
            expect(result.violations[0].severity).toBe('high');
        });

        it('should detect "murder" as a threat', () => {
            const result = filter.scan('The murder happened yesterday');
            expect(result.passed).toBe(false);
        });
    });

    // ─── Spam (action: flag) ─────────────────────────────────────

    describe('spam — flag action', () => {
        it('should flag spam content but still pass', () => {
            const result = filter.scan('Click here to win a free prize');
            expect(result.passed).toBe(true); // flag doesn't block
            expect(result.violations.some((v) => v.category === 'spam')).toBe(true);
            expect(result.violations.some((v) => v.action === 'flag')).toBe(true);
        });

        it('should detect "buy now" as spam', () => {
            const result = filter.scan('Buy now and get 50% off');
            expect(result.violations.some((v) => v.match.toLowerCase().includes('buy now'))).toBe(true);
        });
    });

    // ─── Self-harm (action: block, critical) ─────────────────────

    describe('self-harm — critical block', () => {
        it('should block self-harm content', () => {
            const result = filter.scan('I want to commit suicide');
            expect(result.passed).toBe(false);
            const v = result.violations.find((v) => v.category === 'self-harm');
            expect(v).toBeDefined();
            expect(v!.severity).toBe('critical');
        });
    });

    // ─── Custom Rules ────────────────────────────────────────────

    describe('addRule — custom rules', () => {
        it('should add a custom rule and return its ID', () => {
            const id = filter.addRule('personal-info', [/\b\d{3}-\d{2}-\d{4}\b/g], 'high', 'block');
            expect(id).toMatch(/^filter-\d+$/);
            expect(filter.count()).toBe(5);
        });

        it('should detect content matching custom rule', () => {
            filter.addRule('secrets', [/\bpassword\b/gi], 'high', 'block');
            const result = filter.scan('My password is 12345');
            expect(result.passed).toBe(false);
            expect(result.violations.some((v) => v.category === 'secrets')).toBe(true);
        });

        it('custom redact rule should mask matched content', () => {
            filter.addRule('pii', [/\b[A-Z]{2}\d{6}\b/g], 'medium', 'redact');
            const result = filter.scan('Passport: AB123456');
            expect(result.filteredContent).toBeDefined();
            expect(result.filteredContent).not.toContain('AB123456');
        });
    });

    // ─── Enable/Disable Rules ────────────────────────────────────

    describe('setEnabled', () => {
        it('should disable a rule by ID', () => {
            const rules = filter.list();
            const threatRule = rules.find((r) => r.category === 'threats')!;
            expect(filter.setEnabled(threatRule.id, false)).toBe(true);

            const result = filter.scan('I will kill you');
            // Threats rule is disabled so it should NOT detect threats
            expect(result.violations.some((v) => v.category === 'threats')).toBe(false);
        });

        it('should re-enable a disabled rule', () => {
            const rules = filter.list();
            const threatRule = rules.find((r) => r.category === 'threats')!;
            filter.setEnabled(threatRule.id, false);
            filter.setEnabled(threatRule.id, true);

            const result = filter.scan('bomb threat');
            expect(result.passed).toBe(false);
        });

        it('should return false for non-existent rule ID', () => {
            expect(filter.setEnabled('nonexistent', false)).toBe(false);
        });
    });

    // ─── Stats Tracking ──────────────────────────────────────────

    describe('stats', () => {
        it('should increment scanned on each scan', () => {
            filter.scan('hello');
            filter.scan('world');
            expect(filter.getStats().scanned).toBe(2);
        });

        it('should track blocked count', () => {
            filter.scan('I will kill you');
            filter.scan('Clean text');
            expect(filter.getStats().blocked).toBe(1);
        });

        it('should track flagged count', () => {
            filter.scan('Buy now and save');
            expect(filter.getStats().flagged).toBe(1);
        });

        it('should track redacted count', () => {
            filter.scan('What the fuck');
            expect(filter.getStats().redacted).toBe(1);
        });

        it('getStats should return a copy', () => {
            filter.scan('hello');
            const s1 = filter.getStats();
            filter.scan('world');
            const s2 = filter.getStats();
            expect(s1.scanned).toBe(1);
            expect(s2.scanned).toBe(2);
        });
    });

    // ─── Violation Shape ─────────────────────────────────────────

    describe('violation shape', () => {
        it('should have correct properties', () => {
            const result = filter.scan('fuck this bomb threat');
            expect(result.violations.length).toBeGreaterThan(0);
            for (const v of result.violations) {
                expect(v).toHaveProperty('ruleId');
                expect(v).toHaveProperty('category');
                expect(v).toHaveProperty('severity');
                expect(v).toHaveProperty('match');
                expect(v).toHaveProperty('action');
            }
        });
    });

    // ─── Edge Cases ──────────────────────────────────────────────

    describe('edge cases', () => {
        it('should handle mixed violations (block + redact)', () => {
            const result = filter.scan('fuck you I will kill you');
            expect(result.passed).toBe(false); // kill triggers block
            expect(result.filteredContent).toBeDefined(); // fuck triggers redact
        });

        it('should handle case-insensitive matching', () => {
            const result = filter.scan('FUCK THIS SHIT');
            expect(result.violations.length).toBeGreaterThan(0);
        });

        it('separate instances should be independent', () => {
            const filter2 = new ContentFilter();
            filter.addRule('custom', [/test/g], 'low', 'flag');
            expect(filter.count()).toBe(5);
            expect(filter2.count()).toBe(4);
        });
    });
});
