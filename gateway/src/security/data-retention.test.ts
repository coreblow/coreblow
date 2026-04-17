/**
 * CoreBlow Security — DataRetention Test Suite
 *
 * Covers: default policies, addPolicy(), apply() with TTL-based
 * expiration, dryRun(), get(), setEnabled(), getHistory(), list(),
 * count(), and edge cases.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { DataRetention } from './data-retention.js';

describe('DataRetention', () => {
    let retention: DataRetention;

    beforeEach(() => {
        retention = new DataRetention();
    });

    const DAY_MS = 86400_000;

    // ─── Default Policies ───────────────────────────────────────

    describe('default policies', () => {
        it('has 3 default policies', () => {
            expect(retention.count()).toBe(3);
        });

        it('includes conversations (90d archive), logs (30d delete), analytics (365d anonymize)', () => {
            const policies = retention.list();
            const conv = policies.find(p => p.id === 'conversations')!;
            expect(conv.days).toBe(90);
            expect(conv.action).toBe('archive');

            const logs = policies.find(p => p.id === 'logs')!;
            expect(logs.days).toBe(30);
            expect(logs.action).toBe('delete');

            const analytics = policies.find(p => p.id === 'analytics')!;
            expect(analytics.days).toBe(365);
            expect(analytics.action).toBe('anonymize');
        });
    });

    // ─── addPolicy() ────────────────────────────────────────────

    describe('addPolicy()', () => {
        it('adds a custom policy', () => {
            const policy = retention.addPolicy('reports', 'Report Retention', 'report', 60, 'delete');
            expect(policy.id).toBe('reports');
            expect(policy.retentionDays).toBe(60);
            expect(policy.enabled).toBe(true);
            expect(retention.count()).toBe(4);
        });

        it('overwrites existing policy with same id', () => {
            retention.addPolicy('logs', 'Updated Logs', 'log', 7, 'delete');
            const policy = retention.get('logs')!;
            expect(policy.name).toBe('Updated Logs');
            expect(policy.retentionDays).toBe(7);
        });

        it('auto-generates id when empty string provided', () => {
            const policy = retention.addPolicy('', 'Auto ID', 'misc', 10, 'delete');
            expect(policy.id).toMatch(/^ret-\d+$/);
        });
    });

    // ─── apply() ────────────────────────────────────────────────

    describe('apply()', () => {
        it('processes expired items according to policy', () => {
            const now = Date.now();
            const items = [
                { id: 'new', createdAt: now - 10 * DAY_MS },       // 10 days old — within 30d
                { id: 'old', createdAt: now - 60 * DAY_MS },       // 60 days old — expired
                { id: 'ancient', createdAt: now - 120 * DAY_MS },  // 120 days old — expired
            ];

            const result = retention.apply('logs', items);
            expect(result.action).toBe('delete');
            expect(result.processed).toContain('old');
            expect(result.processed).toContain('ancient');
            expect(result.processed).not.toContain('new');
        });

        it('returns no items when all are within retention period', () => {
            const now = Date.now();
            const items = [
                { id: 'item-1', createdAt: now - 5 * DAY_MS },
                { id: 'item-2', createdAt: now - 10 * DAY_MS },
            ];

            const result = retention.apply('logs', items);
            expect(result.processed).toEqual([]);
        });

        it('returns empty result for unknown policy', () => {
            const result = retention.apply('nonexistent', []);
            expect(result.processed).toEqual([]);
            expect(result.action).toBe('none');
        });

        it('returns empty result for disabled policy', () => {
            retention.setEnabled('logs', false);
            const items = [{ id: 'old', createdAt: Date.now() - 60 * DAY_MS }];
            const result = retention.apply('logs', items);
            expect(result.processed).toEqual([]);
            expect(result.action).toBe('none');
        });

        it('records execution in history', () => {
            const items = [{ id: 'old', createdAt: Date.now() - 60 * DAY_MS }];
            retention.apply('logs', items);

            const history = retention.getHistory();
            expect(history.length).toBe(1);
            expect(history[0]!.policyId).toBe('logs');
            expect(history[0]!.itemsProcessed).toBe(1);
            expect(history[0]!.action).toBe('delete');
            expect(history[0]!.executedAt).toBeGreaterThan(0);
        });

        it('works with archive action', () => {
            const items = [{ id: 'old-convo', createdAt: Date.now() - 100 * DAY_MS }];
            const result = retention.apply('conversations', items);
            expect(result.action).toBe('archive');
            expect(result.processed).toContain('old-convo');
        });

        it('works with anonymize action', () => {
            const items = [{ id: 'old-data', createdAt: Date.now() - 400 * DAY_MS }];
            const result = retention.apply('analytics', items);
            expect(result.action).toBe('anonymize');
            expect(result.processed).toContain('old-data');
        });

        it('handles empty items array', () => {
            const result = retention.apply('logs', []);
            expect(result.processed).toEqual([]);
        });
    });

    // ─── dryRun() ───────────────────────────────────────────────

    describe('dryRun()', () => {
        it('returns ids of items that would be affected', () => {
            const items = [
                { id: 'recent', createdAt: Date.now() - 5 * DAY_MS },
                { id: 'expired', createdAt: Date.now() - 60 * DAY_MS },
            ];

            const affected = retention.dryRun('logs', items);
            expect(affected).toContain('expired');
            expect(affected).not.toContain('recent');
        });

        it('does not record in history (no side effects)', () => {
            const items = [{ id: 'old', createdAt: Date.now() - 60 * DAY_MS }];
            retention.dryRun('logs', items);
            expect(retention.getHistory().length).toBe(0);
        });

        it('returns empty for unknown policy', () => {
            expect(retention.dryRun('nonexistent', [])).toEqual([]);
        });
    });

    // ─── get() ──────────────────────────────────────────────────

    describe('get()', () => {
        it('returns policy by id', () => {
            const policy = retention.get('logs');
            expect(policy).toBeTruthy();
            expect(policy!.name).toBe('Log Retention');
        });

        it('returns null for unknown id', () => {
            expect(retention.get('nonexistent')).toBeNull();
        });
    });

    // ─── setEnabled() ───────────────────────────────────────────

    describe('setEnabled()', () => {
        it('disables a policy', () => {
            expect(retention.setEnabled('logs', false)).toBe(true);
            const policy = retention.get('logs')!;
            expect(policy.enabled).toBe(false);
        });

        it('re-enables a policy', () => {
            retention.setEnabled('logs', false);
            retention.setEnabled('logs', true);
            expect(retention.get('logs')!.enabled).toBe(true);
        });

        it('returns false for unknown id', () => {
            expect(retention.setEnabled('nonexistent', false)).toBe(false);
        });
    });

    // ─── getHistory() ───────────────────────────────────────────

    describe('getHistory()', () => {
        it('returns empty array initially', () => {
            expect(retention.getHistory()).toEqual([]);
        });

        it('returns most recent records', () => {
            for (let i = 0; i < 5; i++) {
                retention.apply('logs', [{ id: `item-${i}`, createdAt: Date.now() - 60 * DAY_MS }]);
            }
            expect(retention.getHistory().length).toBe(5);
        });

        it('respects limit parameter', () => {
            for (let i = 0; i < 5; i++) {
                retention.apply('logs', [{ id: `item-${i}`, createdAt: Date.now() - 60 * DAY_MS }]);
            }
            expect(retention.getHistory(2).length).toBe(2);
        });

        it('defaults to 20 limit', () => {
            for (let i = 0; i < 25; i++) {
                retention.apply('logs', [{ id: `item-${i}`, createdAt: Date.now() - 60 * DAY_MS }]);
            }
            expect(retention.getHistory().length).toBe(20);
        });
    });

    // ─── list() ─────────────────────────────────────────────────

    describe('list()', () => {
        it('returns summary of all policies', () => {
            const policies = retention.list();
            expect(policies.length).toBe(3);
            for (const p of policies) {
                expect(p.id).toBeTruthy();
                expect(p.name).toBeTruthy();
                expect(p.dataType).toBeTruthy();
                expect(typeof p.days).toBe('number');
                expect(p.action).toBeTruthy();
                expect(typeof p.enabled).toBe('boolean');
            }
        });
    });
});
