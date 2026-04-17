/**
 * CoreBlow Security — SafetyReport Test Suite
 *
 * Covers: generate() with passing/failing/critical checks,
 * overallSafe/overallScore, recommendations, get(), getRecent(),
 * getStats(), getBySeverity(), count(), report eviction, and edge cases.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SafetyReport, type SafetyCheck } from './safety-report.js';

describe('SafetyReport', () => {
    let report: SafetyReport;

    const SAFE_CHECK: SafetyCheck = { name: 'toxicity', passed: true, score: 1, details: 'Clean', severity: 'safe' };
    const WARN_CHECK: SafetyCheck = { name: 'bias', passed: false, score: 0.4, details: 'Bias detected', severity: 'medium' };
    const CRITICAL_CHECK: SafetyCheck = { name: 'self-harm', passed: false, score: 0, details: 'Self-harm content', severity: 'critical' };

    beforeEach(() => {
        report = new SafetyReport();
    });

    // ─── generate() ─────────────────────────────────────────────

    describe('generate()', () => {
        it('generates report with unique id', () => {
            const r = report.generate('Hello world.', [SAFE_CHECK]);
            expect(r.id).toMatch(/^safety-\d+$/);
            expect(r.timestamp).toBeGreaterThan(0);
        });

        it('truncates text to 200 chars', () => {
            const longText = 'A'.repeat(500);
            const r = report.generate(longText, [SAFE_CHECK]);
            expect(r.text.length).toBe(200);
        });

        it('sets overallSafe=true when all checks pass', () => {
            const r = report.generate('Clean text.', [SAFE_CHECK]);
            expect(r.overallSafe).toBe(true);
            expect(r.overallScore).toBe(1);
        });

        it('sets overallSafe=false when any check fails', () => {
            const r = report.generate('Biased text.', [SAFE_CHECK, WARN_CHECK]);
            expect(r.overallSafe).toBe(false);
        });

        it('calculates overallScore as average of check scores', () => {
            const r = report.generate('Text.', [
                { ...SAFE_CHECK, score: 1 },
                { ...WARN_CHECK, score: 0.5 },
            ]);
            expect(r.overallScore).toBe(0.75);
        });

        it('defaults overallScore to 1 when no checks', () => {
            const r = report.generate('Empty.', []);
            expect(r.overallScore).toBe(1);
            expect(r.overallSafe).toBe(true);
        });

        it('recommendation is positive for all-passing checks', () => {
            const r = report.generate('Clean.', [SAFE_CHECK]);
            expect(r.recommendation).toContain('passes all');
        });

        it('recommendation mentions CRITICAL for critical failures', () => {
            const r = report.generate('Dangerous.', [CRITICAL_CHECK]);
            expect(r.recommendation).toContain('CRITICAL');
            expect(r.recommendation).toContain('blocked');
        });

        it('recommendation mentions Warning for non-critical failures', () => {
            const r = report.generate('Biased.', [WARN_CHECK]);
            expect(r.recommendation).toContain('Warning');
            expect(r.recommendation).toContain('bias');
        });

        it('stores the report internally', () => {
            report.generate('Test.', [SAFE_CHECK]);
            expect(report.count()).toBe(1);
        });

        it('evicts old reports beyond maxReports (500)', () => {
            for (let i = 0; i < 510; i++) {
                report.generate(`Entry ${i}`, [SAFE_CHECK]);
            }
            expect(report.count()).toBeLessThanOrEqual(500);
        });
    });

    // ─── get() ──────────────────────────────────────────────────

    describe('get()', () => {
        it('retrieves report by id', () => {
            const r = report.generate('Test.', [SAFE_CHECK]);
            const found = report.get(r.id);
            expect(found).toBeTruthy();
            expect(found!.id).toBe(r.id);
        });

        it('returns null for unknown id', () => {
            expect(report.get('nonexistent')).toBeNull();
        });
    });

    // ─── getRecent() ────────────────────────────────────────────

    describe('getRecent()', () => {
        it('returns most recent reports', () => {
            report.generate('A', [SAFE_CHECK]);
            report.generate('B', [SAFE_CHECK]);
            report.generate('C', [SAFE_CHECK]);

            const recent = report.getRecent(2);
            expect(recent.length).toBe(2);
        });

        it('defaults to 20', () => {
            for (let i = 0; i < 30; i++) {
                report.generate(`Entry ${i}`, [SAFE_CHECK]);
            }
            expect(report.getRecent().length).toBe(20);
        });

        it('returns all if fewer than limit', () => {
            report.generate('A', [SAFE_CHECK]);
            expect(report.getRecent(10).length).toBe(1);
        });
    });

    // ─── getStats() ─────────────────────────────────────────────

    describe('getStats()', () => {
        it('returns all zeros initially', () => {
            const stats = report.getStats();
            expect(stats.total).toBe(0);
            expect(stats.safe).toBe(0);
            expect(stats.unsafe).toBe(0);
            expect(stats.safeRate).toBe(1); // Default when no reports
        });

        it('tracks safe and unsafe counts', () => {
            report.generate('Clean.', [SAFE_CHECK]);
            report.generate('Dirty.', [WARN_CHECK]);

            const stats = report.getStats();
            expect(stats.total).toBe(2);
            expect(stats.safe).toBe(1);
            expect(stats.unsafe).toBe(1);
            expect(stats.safeRate).toBe(0.5);
        });
    });

    // ─── getBySeverity() ────────────────────────────────────────

    describe('getBySeverity()', () => {
        it('filters reports by check severity', () => {
            report.generate('Safe.', [SAFE_CHECK]);
            report.generate('Critical.', [CRITICAL_CHECK]);
            report.generate('Medium.', [WARN_CHECK]);

            const critical = report.getBySeverity('critical');
            expect(critical.length).toBe(1);

            const medium = report.getBySeverity('medium');
            expect(medium.length).toBe(1);

            const safe = report.getBySeverity('safe');
            expect(safe.length).toBe(1);
        });

        it('returns empty for unmatched severity', () => {
            report.generate('Safe.', [SAFE_CHECK]);
            expect(report.getBySeverity('critical')).toEqual([]);
        });
    });

    // ─── count() ────────────────────────────────────────────────

    describe('count()', () => {
        it('returns 0 initially', () => {
            expect(report.count()).toBe(0);
        });

        it('returns number of stored reports', () => {
            report.generate('A', [SAFE_CHECK]);
            report.generate('B', [SAFE_CHECK]);
            expect(report.count()).toBe(2);
        });
    });
});
