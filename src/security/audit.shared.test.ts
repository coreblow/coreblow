import { describe, it, expect } from 'vitest';
import { formatAuditEntry, sanitizeForAudit, AUDIT_CATEGORIES } from './audit.shared.js';

describe('Audit Shared', () => {
    it('should format audit entry', () => {
        const entry = formatAuditEntry({ category: 'auth', severity: 'info', action: 'login' });
        expect(entry).toContain('[INFO]');
        expect(entry).toContain('[auth]');
        expect(entry).toContain('login');
    });

    it('should format with details', () => {
        const entry = formatAuditEntry({ category: 'security', severity: 'critical', action: 'breach', details: 'ip: 1.2.3.4' });
        expect(entry).toContain('CRITICAL');
        expect(entry).toContain('ip: 1.2.3.4');
    });

    it('should sanitize sensitive fields', () => {
        const data = { username: 'admin', apiKey: 'sk-secret123', password: 'pass' };
        const sanitized = sanitizeForAudit(data);
        expect(sanitized.username).toBe('admin');
        expect(sanitized.apiKey).toBe('***REDACTED***');
        expect(sanitized.password).toBe('***REDACTED***');
    });

    it('should have audit categories defined', () => {
        expect(AUDIT_CATEGORIES).toContain('auth');
        expect(AUDIT_CATEGORIES).toContain('security');
    });
});
