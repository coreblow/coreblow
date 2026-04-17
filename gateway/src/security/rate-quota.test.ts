/**
 * CoreBlow Security — RateQuota Test Suite
 *
 * Covers: default plans (free/pro/enterprise), addPlan(), assign(),
 * check() with daily/monthly request/token limits, record(),
 * getUsage(), getRemaining(), listPlans(), count(),
 * automatic period reset, and edge cases.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateQuota } from './rate-quota.js';

describe('RateQuota', () => {
    let quota: RateQuota;

    beforeEach(() => {
        quota = new RateQuota();
    });

    // ─── Default Plans ──────────────────────────────────────────

    describe('default plans', () => {
        it('has 3 default plans', () => {
            expect(quota.listPlans().length).toBe(3);
        });

        it('includes free, pro, and enterprise plans', () => {
            const ids = quota.listPlans().map(p => p.id);
            expect(ids).toContain('free');
            expect(ids).toContain('pro');
            expect(ids).toContain('enterprise');
        });

        it('free plan has 100 req/day, 1000 req/month', () => {
            const free = quota.listPlans().find(p => p.id === 'free')!;
            expect(free.limits.requestsPerDay).toBe(100);
            expect(free.limits.requestsPerMonth).toBe(1000);
        });

        it('pro plan has 5000 req/day', () => {
            const pro = quota.listPlans().find(p => p.id === 'pro')!;
            expect(pro.limits.requestsPerDay).toBe(5000);
        });

        it('enterprise plan has 50000 req/day', () => {
            const ent = quota.listPlans().find(p => p.id === 'enterprise')!;
            expect(ent.limits.requestsPerDay).toBe(50_000);
        });
    });

    // ─── addPlan() ──────────────────────────────────────────────

    describe('addPlan()', () => {
        it('adds a custom plan', () => {
            quota.addPlan('custom', 'Custom Plan', {
                requestsPerDay: 200,
                requestsPerMonth: 5000,
                tokensPerDay: 100_000,
                tokensPerMonth: 1_000_000,
            });
            expect(quota.listPlans().length).toBe(4);
            expect(quota.listPlans().find(p => p.id === 'custom')).toBeTruthy();
        });

        it('overwrites existing plan with same id', () => {
            quota.addPlan('free', 'Free v2', {
                requestsPerDay: 50,
                requestsPerMonth: 500,
                tokensPerDay: 25_000,
                tokensPerMonth: 250_000,
            });
            const free = quota.listPlans().find(p => p.id === 'free')!;
            expect(free.name).toBe('Free v2');
            expect(free.limits.requestsPerDay).toBe(50);
        });
    });

    // ─── assign() ───────────────────────────────────────────────

    describe('assign()', () => {
        it('assigns a plan to a user', () => {
            const result = quota.assign('user-1', 'free');
            expect(result).toBe(true);
            expect(quota.count()).toBe(1);
        });

        it('initializes usage to zero', () => {
            quota.assign('user-1', 'free');
            const usage = quota.getUsage('user-1')!;
            expect(usage.daily.requests).toBe(0);
            expect(usage.daily.tokens).toBe(0);
            expect(usage.monthly.requests).toBe(0);
            expect(usage.monthly.tokens).toBe(0);
        });

        it('returns false for unknown plan', () => {
            expect(quota.assign('user-1', 'nonexistent')).toBe(false);
        });

        it('reassigns user to new plan', () => {
            quota.assign('user-1', 'free');
            quota.assign('user-1', 'pro');
            expect(quota.getUsage('user-1')!.planId).toBe('pro');
        });
    });

    // ─── check() ────────────────────────────────────────────────

    describe('check()', () => {
        beforeEach(() => {
            quota.assign('user-1', 'free'); // 100 req/day, 1000 req/month, 50K tokens/day
        });

        it('allows request within limits', () => {
            const result = quota.check('user-1', 100);
            expect(result.allowed).toBe(true);
            expect(result.reason).toBeUndefined();
        });

        it('allows request for unassigned user (unlimited)', () => {
            const result = quota.check('unknown-user');
            expect(result.allowed).toBe(true);
        });

        it('blocks when daily request limit reached', () => {
            for (let i = 0; i < 100; i++) quota.record('user-1', 1);
            const result = quota.check('user-1');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Daily request');
        });

        it('blocks when daily token limit would be exceeded', () => {
            const result = quota.check('user-1', 50_001); // Over 50K daily token limit
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Daily token');
        });

        it('blocks when monthly request limit reached', () => {
            // Simulate reaching monthly limit by direct manipulation
            const usage = quota.getUsage('user-1')!;
            usage.monthly.requests = 1000;

            const result = quota.check('user-1');
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Monthly request');
        });

        it('blocks when monthly token limit would be exceeded', () => {
            const usage = quota.getUsage('user-1')!;
            usage.monthly.tokens = 499_999;

            const result = quota.check('user-1', 2); // Would exceed 500K monthly
            expect(result.allowed).toBe(false);
            expect(result.reason).toContain('Monthly token');
        });

        it('defaults tokens to 1 when not specified', () => {
            const result = quota.check('user-1');
            expect(result.allowed).toBe(true);
        });
    });

    // ─── record() ───────────────────────────────────────────────

    describe('record()', () => {
        beforeEach(() => {
            quota.assign('user-1', 'free');
        });

        it('increments daily and monthly request count', () => {
            quota.record('user-1', 100);

            const usage = quota.getUsage('user-1')!;
            expect(usage.daily.requests).toBe(1);
            expect(usage.monthly.requests).toBe(1);
        });

        it('increments daily and monthly token count', () => {
            quota.record('user-1', 500);

            const usage = quota.getUsage('user-1')!;
            expect(usage.daily.tokens).toBe(500);
            expect(usage.monthly.tokens).toBe(500);
        });

        it('accumulates over multiple records', () => {
            quota.record('user-1', 100);
            quota.record('user-1', 200);
            quota.record('user-1', 300);

            const usage = quota.getUsage('user-1')!;
            expect(usage.daily.requests).toBe(3);
            expect(usage.daily.tokens).toBe(600);
        });

        it('does nothing for unassigned user', () => {
            expect(() => quota.record('unknown', 100)).not.toThrow();
        });
    });

    // ─── getUsage() ─────────────────────────────────────────────

    describe('getUsage()', () => {
        it('returns null for unassigned user', () => {
            expect(quota.getUsage('unknown')).toBeNull();
        });

        it('returns usage object for assigned user', () => {
            quota.assign('user-1', 'free');
            const usage = quota.getUsage('user-1');
            expect(usage).toBeTruthy();
            expect(usage!.userId).toBe('user-1');
            expect(usage!.planId).toBe('free');
        });
    });

    // ─── getRemaining() ─────────────────────────────────────────

    describe('getRemaining()', () => {
        it('returns full quotas for fresh user', () => {
            quota.assign('user-1', 'free');
            const remaining = quota.getRemaining('user-1')!;
            expect(remaining.dailyRequests).toBe(100);
            expect(remaining.monthlyRequests).toBe(1000);
            expect(remaining.dailyTokens).toBe(50_000);
        });

        it('returns decremented values after usage', () => {
            quota.assign('user-1', 'free');
            quota.record('user-1', 1000);

            const remaining = quota.getRemaining('user-1')!;
            expect(remaining.dailyRequests).toBe(99);
            expect(remaining.monthlyRequests).toBe(999);
            expect(remaining.dailyTokens).toBe(49_000);
        });

        it('clamps remaining to 0 (never negative)', () => {
            quota.assign('user-1', 'free');
            // Exceed limits via direct manipulation
            const usage = quota.getUsage('user-1')!;
            usage.daily.requests = 200;

            const remaining = quota.getRemaining('user-1')!;
            expect(remaining.dailyRequests).toBe(0);
        });

        it('returns null for unassigned user', () => {
            expect(quota.getRemaining('unknown')).toBeNull();
        });
    });

    // ─── Period Reset ───────────────────────────────────────────

    describe('automatic period reset', () => {
        beforeEach(() => {
            vi.useFakeTimers();
            quota.assign('user-1', 'free');
        });

        afterEach(() => {
            vi.useRealTimers();
        });

        it('resets daily counters after 24 hours', () => {
            quota.record('user-1', 100);
            expect(quota.getUsage('user-1')!.daily.requests).toBe(1);

            // Advance past daily reset (24+ hours)
            vi.advanceTimersByTime(87_000_000); // ~24.2 hours

            // check() triggers resetIfExpired
            quota.check('user-1');
            const usage = quota.getUsage('user-1')!;
            expect(usage.daily.requests).toBe(0);
        });

        it('resets monthly counters after 30 days', () => {
            quota.record('user-1', 100);
            expect(quota.getUsage('user-1')!.monthly.requests).toBe(1);

            // Advance past monthly reset (30+ days)
            vi.advanceTimersByTime(31 * 86_400_000);

            quota.check('user-1');
            const usage = quota.getUsage('user-1')!;
            expect(usage.monthly.requests).toBe(0);
        });
    });

    // ─── count() ────────────────────────────────────────────────

    describe('count()', () => {
        it('returns 0 initially', () => {
            expect(quota.count()).toBe(0);
        });

        it('returns number of assigned users', () => {
            quota.assign('a', 'free');
            quota.assign('b', 'pro');
            expect(quota.count()).toBe(2);
        });
    });
});
