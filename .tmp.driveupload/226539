/**
 * CoreBlow Phase 31 — SafetyReport Extended Edge Cases
 *
 * Layer 1 (Edge Cases):
 *   - SafetyReport: multi-check aggregation, severity ranking, history, retrieval
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SafetyReport } from '../../src/security/safety-report.js';

describe('SafetyReport — Extended', () => {
    let report: SafetyReport;
    beforeEach(() => { report = new SafetyReport(); });

    it('should aggregate multiple checks into overall safety', () => {
        const r = report.generate('Test content', [
            { name: 'content', passed: true, score: 0.9, details: 'Clean', severity: 'safe' },
            { name: 'toxicity', passed: true, score: 0.8, details: 'OK', severity: 'safe' },
            { name: 'pii', passed: true, score: 1.0, details: 'No PII', severity: 'safe' },
        ]);
        expect(r.overallSafe).toBe(true);
        expect(r.overallScore).toBeCloseTo(0.9, 1);
    });

    it('should fail if ANY check fails', () => {
        const r = report.generate('Mixed', [
            { name: 'content', passed: true, score: 1.0, details: 'OK', severity: 'safe' },
            { name: 'toxicity', passed: false, score: 0.2, details: 'Toxic', severity: 'high' },
            { name: 'pii', passed: true, score: 1.0, details: 'OK', severity: 'safe' },
        ]);
        expect(r.overallSafe).toBe(false);
    });

    it('should generate CRITICAL recommendation for critical failures', () => {
        const r = report.generate('Dangerous', [
            { name: 'self-harm', passed: false, score: 0, details: 'Detected', severity: 'critical' },
        ]);
        expect(r.recommendation).toContain('CRITICAL');
        expect(r.recommendation).toContain('self-harm');
    });

    it('should generate Warning recommendation for non-critical failures', () => {
        const r = report.generate('Flagged', [
            { name: 'bias', passed: false, score: 0.3, details: 'Bias detected', severity: 'medium' },
        ]);
        expect(r.recommendation).toContain('Warning');
        expect(r.recommendation).toContain('bias');
    });

    it('should retrieve report by ID', () => {
        const r = report.generate('Test', []);
        const retrieved = report.get(r.id);
        expect(retrieved).not.toBeNull();
        expect(retrieved!.id).toBe(r.id);
    });

    it('should return null for unknown report ID', () => {
        expect(report.get('nonexistent')).toBeNull();
    });

    it('should get recent reports with limit', () => {
        for (let i = 0; i < 10; i++) {
            report.generate(`Text ${i}`, []);
        }
        expect(report.getRecent(5)).toHaveLength(5);
        expect(report.getRecent()).toHaveLength(10); // Default limit = 20
    });

    it('should filter by severity', () => {
        report.generate('OK', [{ name: 'a', passed: true, score: 1, details: '', severity: 'safe' }]);
        report.generate('Bad', [{ name: 'b', passed: false, score: 0, details: '', severity: 'critical' }]);
        report.generate('Med', [{ name: 'c', passed: false, score: 0.5, details: '', severity: 'medium' }]);

        expect(report.getBySeverity('critical')).toHaveLength(1);
        expect(report.getBySeverity('medium')).toHaveLength(1);
        expect(report.getBySeverity('safe')).toHaveLength(1);
    });

    it('should track stats with safe rate', () => {
        report.generate('a', [{ name: 'x', passed: true, score: 1, details: '', severity: 'safe' }]);
        report.generate('b', [{ name: 'x', passed: true, score: 1, details: '', severity: 'safe' }]);
        report.generate('c', [{ name: 'x', passed: false, score: 0, details: '', severity: 'high' }]);

        const stats = report.getStats();
        expect(stats.total).toBe(3);
        expect(stats.safe).toBe(2);
        expect(stats.unsafe).toBe(1);
        expect(stats.safeRate).toBeCloseTo(2/3, 1);
    });

    it('should handle empty checks list', () => {
        const r = report.generate('Empty', []);
        expect(r.overallSafe).toBe(true);
        expect(r.overallScore).toBe(1);
        expect(r.recommendation).toContain('passes all');
    });
});
