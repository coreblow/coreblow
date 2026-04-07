/**
 * secrets/audit.test.ts — Security audit tests
 */
import { describe, it, expect } from 'vitest';
import { auditSecrets, formatAuditReport } from './audit.js';

describe('Secret Audit', () => {
    it('detects hardcoded OpenAI API key', () => {
        const config = { models: { openai: { apiKey: 'sk-1234567890abcdefghijklmnopqrstuvwxyz' } } };
        const report = auditSecrets(config);
        expect(report.entries.some((e) => e.code === 'HARDCODED_API_KEY')).toBe(true);
        expect(report.summary.critical).toBeGreaterThan(0);
    });

    it('detects plaintext secrets in sensitive fields', () => {
        const config = { channels: { discord: { token: 'some-real-token-value' } } };
        const report = auditSecrets(config);
        expect(report.entries.some((e) => e.code === 'PLAINTEXT_SECRET')).toBe(true);
    });

    it('ignores placeholder values', () => {
        const config = { models: { openai: { apiKey: 'your-api-key-here' } } };
        const report = auditSecrets(config);
        expect(report.entries.filter((e) => e.code === 'HARDCODED_API_KEY')).toHaveLength(0);
    });

    it('ignores secret ref strings', () => {
        const config = { models: { openai: { apiKey: 'secret:env:default:OPENAI_API_KEY' } } };
        const report = auditSecrets(config);
        expect(report.entries.filter((e) => e.code === 'HARDCODED_API_KEY')).toHaveLength(0);
    });

    it('checks encryption key presence', () => {
        const origKey = process.env.COREBLOW_ENCRYPTION_KEY;
        delete process.env.COREBLOW_ENCRYPTION_KEY;
        const report = auditSecrets({});
        expect(report.entries.some((e) => e.code === 'NO_ENCRYPTION_KEY')).toBe(true);
        if (origKey) process.env.COREBLOW_ENCRYPTION_KEY = origKey;
    });

    it('returns proper summary counts', () => {
        const config = { models: { openai: { apiKey: 'sk-1234567890abcdefghijklmnopqrstuvwxyz' } } };
        const report = auditSecrets(config);
        const total = report.summary.critical + report.summary.high + report.summary.medium + report.summary.low + report.summary.info;
        expect(total).toBe(report.entries.length);
    });

    it('formatAuditReport returns formatted string', () => {
        const report = auditSecrets({});
        const formatted = formatAuditReport(report);
        expect(formatted).toContain('CoreBlow Security Audit');
        expect(formatted).toContain('findings');
    });

    it('handles empty config', () => {
        const report = auditSecrets({});
        expect(report.timestamp).toBeGreaterThan(0);
        expect(Array.isArray(report.entries)).toBe(true);
    });
});
