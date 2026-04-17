/**
 * CoreBlow Phase 27 — Governance & Compliance Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AuditTrail } from '../../src/security/audit-trail.js';
import { DataRetention } from '../../src/security/data-retention.js';
import { ConsentManager } from '../../src/security/consent-manager.js';
import { RateQuota } from '../../src/security/rate-quota.js';
import { AccessLog } from '../../src/observability/access-log.js';

// ================================================================
// Audit Trail Tests
// ================================================================
describe('AuditTrail', () => {
    let audit: AuditTrail;
    beforeEach(() => { audit = new AuditTrail(); });

    it('should log events', () => {
        audit.log('login', 'user1', 'auth');
        expect(audit.count()).toBe(1);
    });

    it('should chain hashes', () => {
        const e1 = audit.log('create', 'admin', 'config');
        const e2 = audit.log('update', 'admin', 'config');
        expect(e2.previousHash).toBe(e1.hash);
    });

    it('should verify integrity', () => {
        audit.log('a', 'u', 'r');
        audit.log('b', 'u', 'r');
        expect(audit.verifyIntegrity().valid).toBe(true);
    });

    it('should query by actor', () => {
        audit.log('login', 'alice', 'auth');
        audit.log('login', 'bob', 'auth');
        expect(audit.getByActor('alice')).toHaveLength(1);
    });

    it('should query by action', () => {
        audit.log('create', 'u', 'r');
        audit.log('delete', 'u', 'r');
        expect(audit.getByAction('create')).toHaveLength(1);
    });

    it('should search', () => {
        audit.log('api.create', 'admin', 'users');
        expect(audit.search('admin')).toHaveLength(1);
    });

    it('should get recent', () => {
        audit.log('a', 'u', 'r');
        audit.log('b', 'u', 'r');
        expect(audit.getRecent(1)).toHaveLength(1);
    });
});

// ================================================================
// Data Retention Tests
// ================================================================
describe('DataRetention', () => {
    let retention: DataRetention;
    beforeEach(() => { retention = new DataRetention(); });

    it('should have default policies', () => {
        expect(retention.count()).toBe(3);
    });

    it('should apply policies', () => {
        const items = [
            { id: 'old', createdAt: Date.now() - 100 * 86400_000 },
            { id: 'new', createdAt: Date.now() },
        ];
        const result = retention.apply('conversations', items);
        expect(result.processed).toContain('old');
        expect(result.action).toBe('archive');
    });

    it('should dry run', () => {
        const items = [{ id: 'old', createdAt: Date.now() - 400 * 86400_000 }];
        const affected = retention.dryRun('analytics', items);
        expect(affected).toContain('old');
    });

    it('should enable/disable', () => {
        retention.setEnabled('logs', false);
        expect(retention.get('logs')?.enabled).toBe(false);
    });

    it('should add custom policies', () => {
        retention.addPolicy('custom', 'Custom', 'files', 7, 'delete');
        expect(retention.count()).toBe(4);
    });

    it('should track history', () => {
        retention.apply('logs', [{ id: 'x', createdAt: 0 }]);
        expect(retention.getHistory()).toHaveLength(1);
    });
});

// ================================================================
// Consent Manager Tests
// ================================================================
describe('ConsentManager', () => {
    let consent: ConsentManager;
    beforeEach(() => { consent = new ConsentManager(); });

    it('should have default categories', () => {
        expect(consent.listCategories()).toHaveLength(4);
    });

    it('should set consent', () => {
        consent.setConsent('user1', 'analytics', true);
        expect(consent.hasConsent('user1', 'analytics')).toBe(true);
    });

    it('should prevent refusing required', () => {
        expect(consent.setConsent('user1', 'essential', false)).toBe(false);
    });

    it('should return defaults for new users', () => {
        expect(consent.hasConsent('new-user', 'essential')).toBe(true);
        expect(consent.hasConsent('new-user', 'analytics')).toBe(false);
    });

    it('should withdraw all', () => {
        consent.setConsent('user1', 'analytics', true);
        consent.setConsent('user1', 'personalization', true);
        consent.withdrawAll('user1');
        expect(consent.hasConsent('user1', 'analytics')).toBe(false);
        expect(consent.hasConsent('user1', 'essential')).toBe(true);
    });

    it('should set all consents', () => {
        consent.setAllConsents('user1', { analytics: true, 'ai-training': true });
        expect(consent.hasConsent('user1', 'analytics')).toBe(true);
        expect(consent.hasConsent('user1', 'ai-training')).toBe(true);
    });

    it('should get user consents', () => {
        consent.setConsent('user1', 'analytics', true);
        const consents = consent.getUserConsents('user1');
        expect(consents.essential).toBe(true);
    });
});

// ================================================================
// Rate Quota Tests
// ================================================================
describe('RateQuota', () => {
    let quota: RateQuota;
    beforeEach(() => { quota = new RateQuota(); });

    it('should have default plans', () => {
        expect(quota.listPlans()).toHaveLength(3);
    });

    it('should assign plans', () => {
        expect(quota.assign('user1', 'free')).toBe(true);
    });

    it('should check quota', () => {
        quota.assign('user1', 'free');
        expect(quota.check('user1').allowed).toBe(true);
    });

    it('should record usage', () => {
        quota.assign('user1', 'free');
        quota.record('user1', 100);
        const usage = quota.getUsage('user1');
        expect(usage?.daily.requests).toBe(1);
        expect(usage?.daily.tokens).toBe(100);
    });

    it('should get remaining', () => {
        quota.assign('user1', 'free');
        quota.record('user1', 1000);
        const remaining = quota.getRemaining('user1');
        expect(remaining?.dailyRequests).toBe(99);
    });

    it('should reject at limit', () => {
        quota.assign('user1', 'free');
        for (let i = 0; i < 100; i++) quota.record('user1', 1);
        expect(quota.check('user1').allowed).toBe(false);
    });
});

// ================================================================
// Access Log Tests
// ================================================================
describe('AccessLog', () => {
    let log: AccessLog;
    beforeEach(() => { log = new AccessLog(); });

    it('should log entries', () => {
        log.log('GET', '/api/chat', 200, 50);
        expect(log.count()).toBe(1);
    });

    it('should filter by path', () => {
        log.log('GET', '/chat', 200, 10);
        log.log('GET', '/health', 200, 5);
        expect(log.getByPath('/chat')).toHaveLength(1);
    });

    it('should filter by user', () => {
        log.log('POST', '/chat', 200, 100, { userId: 'u1' });
        log.log('POST', '/chat', 200, 100, { userId: 'u2' });
        expect(log.getByUser('u1')).toHaveLength(1);
    });

    it('should filter by status', () => {
        log.log('GET', '/a', 200, 10);
        log.log('GET', '/b', 500, 10);
        expect(log.getByStatus(500, 599)).toHaveLength(1);
    });

    it('should compute stats', () => {
        log.log('GET', '/chat', 200, 20);
        log.log('GET', '/chat', 200, 40);
        log.log('POST', '/chat', 500, 100);
        const stats = log.getStats();
        expect(stats.totalRequests).toBe(3);
        expect(stats.errorRate).toBeCloseTo(1 / 3, 1);
    });

    it('should get recent', () => {
        log.log('GET', '/a', 200, 10);
        log.log('GET', '/b', 200, 10);
        expect(log.getRecent(1)).toHaveLength(1);
    });
});
