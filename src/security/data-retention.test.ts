import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DataRetention } from './data-retention.js';

describe('DataRetention', () => {
    let dr: DataRetention;

    beforeEach(() => {
        vi.useFakeTimers({ now: new Date('2025-06-01T00:00:00Z') });
        dr = new DataRetention();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    // ─── Initialization ──────────────────────────────────────────

    describe('initialization', () => {
        it('should have 3 default policies', () => {
            expect(dr.count()).toBe(3);
        });

        it('should include conversations, logs, analytics', () => {
            const ids = dr.list().map((p) => p.id);
            expect(ids).toContain('conversations');
            expect(ids).toContain('logs');
            expect(ids).toContain('analytics');
        });

        it('conversations = 90 days, archive', () => {
            const p = dr.get('conversations')!;
            expect(p.retentionDays).toBe(90);
            expect(p.action).toBe('archive');
            expect(p.enabled).toBe(true);
        });

        it('logs = 30 days, delete', () => {
            const p = dr.get('logs')!;
            expect(p.retentionDays).toBe(30);
            expect(p.action).toBe('delete');
        });

        it('analytics = 365 days, anonymize', () => {
            const p = dr.get('analytics')!;
            expect(p.retentionDays).toBe(365);
            expect(p.action).toBe('anonymize');
        });
    });

    // ─── addPolicy ───────────────────────────────────────────────

    describe('addPolicy', () => {
        it('should add a custom policy', () => {
            const p = dr.addPolicy('audit', 'Audit Trail', 'audit', 180, 'archive');
            expect(p.id).toBe('audit');
            expect(p.name).toBe('Audit Trail');
            expect(dr.count()).toBe(4);
        });

        it('should overwrite policy with same id', () => {
            dr.addPolicy('logs', 'Updated Logs', 'log', 60, 'archive');
            const p = dr.get('logs')!;
            expect(p.retentionDays).toBe(60);
            expect(p.action).toBe('archive');
            expect(p.name).toBe('Updated Logs');
        });

        it('should auto-generate id when empty string is passed', () => {
            const p = dr.addPolicy('', 'Auto ID', 'data', 7, 'delete');
            expect(p.id).toMatch(/^ret-\d+$/);
        });

        it('list should return correct shape', () => {
            const policies = dr.list();
            for (const p of policies) {
                expect(p).toHaveProperty('id');
                expect(p).toHaveProperty('name');
                expect(p).toHaveProperty('dataType');
                expect(p).toHaveProperty('days');
                expect(p).toHaveProperty('action');
                expect(p).toHaveProperty('enabled');
            }
        });
    });

    // ─── apply ───────────────────────────────────────────────────

    describe('apply', () => {
        const now = new Date('2025-06-01T00:00:00Z').getTime();

        it('should process items older than retention period', () => {
            const items = [
                { id: 'old-1', createdAt: now - 100 * 86400_000 }, // 100 days ago (> 90)
                { id: 'old-2', createdAt: now - 95 * 86400_000 },  // 95 days ago (> 90)
                { id: 'recent', createdAt: now - 10 * 86400_000 }, // 10 days ago (< 90)
            ];
            const result = dr.apply('conversations', items);
            expect(result.processed).toContain('old-1');
            expect(result.processed).toContain('old-2');
            expect(result.processed).not.toContain('recent');
            expect(result.action).toBe('archive');
        });

        it('should return empty for no expired items', () => {
            const items = [
                { id: 'fresh', createdAt: now - 5 * 86400_000 },
            ];
            const result = dr.apply('logs', items);
            expect(result.processed).toHaveLength(0);
            expect(result.action).toBe('delete');
        });

        it('should return action=none for disabled policy', () => {
            dr.setEnabled('logs', false);
            const items = [{ id: 'old', createdAt: now - 60 * 86400_000 }];
            const result = dr.apply('logs', items);
            expect(result.processed).toHaveLength(0);
            expect(result.action).toBe('none');
        });

        it('should return action=none for non-existent policy', () => {
            const result = dr.apply('nonexistent', []);
            expect(result.processed).toHaveLength(0);
            expect(result.action).toBe('none');
        });

        it('should record execution in history', () => {
            const items = [{ id: 'x', createdAt: now - 100 * 86400_000 }];
            dr.apply('conversations', items);
            const history = dr.getHistory();
            expect(history).toHaveLength(1);
            expect(history[0].policyId).toBe('conversations');
            expect(history[0].itemsProcessed).toBe(1);
            expect(history[0].action).toBe('archive');
        });
    });

    // ─── dryRun ──────────────────────────────────────────────────

    describe('dryRun', () => {
        const now = new Date('2025-06-01T00:00:00Z').getTime();

        it('should return affected item IDs without executing', () => {
            const items = [
                { id: 'old', createdAt: now - 100 * 86400_000 },
                { id: 'fresh', createdAt: now - 10 * 86400_000 },
            ];
            const result = dr.dryRun('conversations', items);
            expect(result).toEqual(['old']);
            // History should NOT be updated
            expect(dr.getHistory()).toHaveLength(0);
        });

        it('should return empty for non-existent policy', () => {
            expect(dr.dryRun('nonexistent', [])).toEqual([]);
        });
    });

    // ─── get ─────────────────────────────────────────────────────

    describe('get', () => {
        it('should return policy by id', () => {
            const p = dr.get('logs');
            expect(p).not.toBeNull();
            expect(p!.id).toBe('logs');
        });

        it('should return null for non-existent id', () => {
            expect(dr.get('nonexistent')).toBeNull();
        });
    });

    // ─── setEnabled ──────────────────────────────────────────────

    describe('setEnabled', () => {
        it('should disable a policy', () => {
            expect(dr.setEnabled('logs', false)).toBe(true);
            expect(dr.get('logs')!.enabled).toBe(false);
        });

        it('should re-enable a policy', () => {
            dr.setEnabled('logs', false);
            dr.setEnabled('logs', true);
            expect(dr.get('logs')!.enabled).toBe(true);
        });

        it('should return false for non-existent policy', () => {
            expect(dr.setEnabled('nonexistent', false)).toBe(false);
        });
    });

    // ─── getHistory ──────────────────────────────────────────────

    describe('getHistory', () => {
        const now = new Date('2025-06-01T00:00:00Z').getTime();

        it('should return empty array initially', () => {
            expect(dr.getHistory()).toEqual([]);
        });

        it('should return last N records when limit is provided', () => {
            const items = [{ id: 'x', createdAt: now - 100 * 86400_000 }];
            dr.apply('conversations', items);
            dr.apply('logs', items);
            dr.apply('analytics', items);
            expect(dr.getHistory(2)).toHaveLength(2);
        });

        it('should default to 20 limit', () => {
            const items = [{ id: 'x', createdAt: now - 400 * 86400_000 }];
            for (let i = 0; i < 25; i++) {
                dr.apply('analytics', items);
            }
            expect(dr.getHistory()).toHaveLength(20);
        });
    });

    // ─── Instance Isolation ──────────────────────────────────────

    describe('instance isolation', () => {
        it('should be independent across instances', () => {
            const dr2 = new DataRetention();
            dr.addPolicy('custom', 'Custom', 'data', 7, 'delete');
            expect(dr.count()).toBe(4);
            expect(dr2.count()).toBe(3);
        });
    });
});
