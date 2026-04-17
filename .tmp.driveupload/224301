/**
 * CoreBlow — Safety Report Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SafetyReport } from './safety-report.js';
import type { SafetyCheck } from './safety-report.js';

describe('SafetyReport', () => {
    let sr: SafetyReport;

    const safeCheck: SafetyCheck = { name: 'toxicity', passed: true, score: 1, details: 'Clean', severity: 'safe' };
    const failedCheck: SafetyCheck = { name: 'content', passed: false, score: 0, details: 'Violation', severity: 'high' };
    const criticalCheck: SafetyCheck = { name: 'threats', passed: false, score: 0, details: 'Threat', severity: 'critical' };

    beforeEach(() => {
        sr = new SafetyReport();
    });

    // ─── generate ────────────────────────────────────────────────

    describe('generate', () => {
        it('should generate a report with unique ID', () => {
            const r = sr.generate('Hello', [safeCheck]);
            expect(r.id).toMatch(/^safety-\d+$/);
        });

        it('should mark overallSafe=true when all checks pass', () => {
            const r = sr.generate('Hello', [safeCheck, { ...safeCheck, name: 'pii' }]);
            expect(r.overallSafe).toBe(true);
        });

        it('should mark overallSafe=false when any check fails', () => {
            const r = sr.generate('Bad', [safeCheck, failedCheck]);
            expect(r.overallSafe).toBe(false);
        });

        it('should compute overallScore as average', () => {
            const r = sr.generate('Test', [
                { ...safeCheck, score: 1 },
                { ...safeCheck, score: 0.5 },
            ]);
            expect(r.overallScore).toBeCloseTo(0.75);
        });

        it('should return score=1 for empty checks', () => {
            const r = sr.generate('Test', []);
            expect(r.overallScore).toBe(1);
            expect(r.overallSafe).toBe(true);
        });

        it('should truncate text to 200 chars', () => {
            const longText = 'a'.repeat(500);
            const r = sr.generate(longText, [safeCheck]);
            expect(r.text.length).toBe(200);
        });

        it('should include recommendation for safe content', () => {
            const r = sr.generate('Hello', [safeCheck]);
            expect(r.recommendation).toContain('passes all safety checks');
        });

        it('should include CRITICAL recommendation for critical failures', () => {
            const r = sr.generate('Threat', [criticalCheck]);
            expect(r.recommendation).toContain('CRITICAL');
            expect(r.recommendation).toContain('threats');
        });

        it('should include Warning recommendation for non-critical failures', () => {
            const r = sr.generate('Bad', [failedCheck]);
            expect(r.recommendation).toContain('Warning');
            expect(r.recommendation).toContain('content');
        });

        it('should store report in history', () => {
            sr.generate('Test', [safeCheck]);
            expect(sr.count()).toBe(1);
        });
    });

    // ─── get ─────────────────────────────────────────────────────

    describe('get', () => {
        it('should retrieve a report by ID', () => {
            const r = sr.generate('Test', [safeCheck]);
            expect(sr.get(r.id)).toBe(r);
        });

        it('should return null for non-existent ID', () => {
            expect(sr.get('nonexistent')).toBeNull();
        });
    });

    // ─── getRecent ───────────────────────────────────────────────

    describe('getRecent', () => {
        it('should return last N reports', () => {
            for (let i = 0; i < 30; i++) sr.generate(`Test ${i}`, [safeCheck]);
            expect(sr.getRecent(5)).toHaveLength(5);
        });

        it('should default to 20', () => {
            for (let i = 0; i < 30; i++) sr.generate(`Test ${i}`, [safeCheck]);
            expect(sr.getRecent()).toHaveLength(20);
        });
    });

    // ─── getStats ────────────────────────────────────────────────

    describe('getStats', () => {
        it('should return correct stats', () => {
            sr.generate('Good', [safeCheck]);
            sr.generate('Bad', [failedCheck]);
            sr.generate('Good2', [safeCheck]);
            const stats = sr.getStats();
            expect(stats.total).toBe(3);
            expect(stats.safe).toBe(2);
            expect(stats.unsafe).toBe(1);
            expect(stats.safeRate).toBeCloseTo(2 / 3);
        });

        it('should return safeRate=1 when empty', () => {
            expect(sr.getStats().safeRate).toBe(1);
        });
    });

    // ─── getBySeverity ───────────────────────────────────────────

    describe('getBySeverity', () => {
        it('should filter reports by check severity', () => {
            sr.generate('Safe', [safeCheck]);
            sr.generate('Critical', [criticalCheck]);
            sr.generate('High', [failedCheck]);
            expect(sr.getBySeverity('critical')).toHaveLength(1);
            expect(sr.getBySeverity('high')).toHaveLength(1);
            expect(sr.getBySeverity('safe')).toHaveLength(1);
        });
    });
});
