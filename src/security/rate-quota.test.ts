/**
 * CoreBlow — Rate Quota Unit Tests
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { RateQuota } from './rate-quota.js';

describe('RateQuota', () => {
    let rq: RateQuota;

    beforeEach(() => {
        vi.useFakeTimers();
        rq = new RateQuota();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('initialization', () => {
        it('should have 3 default plans', () => {
            expect(rq.listPlans()).toHaveLength(3);
        });

        it('should include free, pro, enterprise', () => {
            const ids = rq.listPlans().map((p) => p.id);
            expect(ids).toContain('free');
            expect(ids).toContain('pro');
            expect(ids).toContain('enterprise');
        });
    });

    describe('assign', () => {
        it('should assign a valid plan and return true', () => {
            expect(rq.assign('u1', 'free')).toBe(true);
            expect(rq.count()).toBe(1);
        });

        it('should return false for non-existent plan', () => {
            expect(rq.assign('u1', 'nonexistent')).toBe(false);
        });
    });

    describe('check & record', () => {
        it('should allow requests under daily limit', () => {
            rq.assign('u1', 'free');
            expect(rq.check('u1').allowed).toBe(true);
        });

        it('should reject when daily request limit reached', () => {
            rq.assign('u1', 'free');
            for (let i = 0; i < 100; i++) rq.record('u1', 1);
            expect(rq.check('u1').allowed).toBe(false);
            expect(rq.check('u1').reason).toContain('Daily request');
        });

        it('should reject when daily token limit reached', () => {
            rq.assign('u1', 'free');
            rq.record('u1', 50_000);
            expect(rq.check('u1', 1).allowed).toBe(false);
            expect(rq.check('u1').reason).toContain('token');
        });

        it('should allow unlimited for unassigned user', () => {
            expect(rq.check('unassigned').allowed).toBe(true);
        });

        it('should track monthly aggregation', () => {
            rq.assign('u1', 'free');
            for (let i = 0; i < 50; i++) rq.record('u1', 10);
            const u = rq.getUsage('u1')!;
            expect(u.monthly.requests).toBe(50);
            expect(u.monthly.tokens).toBe(500);
        });
    });

    describe('getRemaining', () => {
        it('should return remaining quotas', () => {
            rq.assign('u1', 'free');
            rq.record('u1', 100);
            const rem = rq.getRemaining('u1')!;
            expect(rem.dailyRequests).toBe(99);
            expect(rem.dailyTokens).toBe(50_000 - 100);
        });

        it('should return null for unassigned user', () => {
            expect(rq.getRemaining('unknown')).toBeNull();
        });
    });

    describe('daily reset', () => {
        it('should reset daily counters after 24h', () => {
            rq.assign('u1', 'free');
            for (let i = 0; i < 100; i++) rq.record('u1', 1);
            expect(rq.check('u1').allowed).toBe(false);

            vi.advanceTimersByTime(86400_001);
            expect(rq.check('u1').allowed).toBe(true);
        });
    });

    describe('addPlan', () => {
        it('should add a custom plan', () => {
            rq.addPlan('custom', 'Custom', { requestsPerDay: 10, requestsPerMonth: 100, tokensPerDay: 1000, tokensPerMonth: 10000 });
            expect(rq.listPlans()).toHaveLength(4);
            rq.assign('u1', 'custom');
            expect(rq.assign('u1', 'custom')).toBe(true);
        });
    });
});
