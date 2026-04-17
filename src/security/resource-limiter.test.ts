/**
 * CoreBlow — Resource Limiter Unit Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceLimiter } from './resource-limiter.js';

describe('ResourceLimiter', () => {
    let rl: ResourceLimiter;

    beforeEach(() => {
        rl = new ResourceLimiter();
    });

    describe('record & limits', () => {
        it('should allow recording under limit', () => {
            const r = rl.record('u1', 'api', 1);
            expect(r.allowed).toBe(true);
        });

        it('should reject when limit exceeded', () => {
            rl.record('u1', 'api', 10_000);
            const r = rl.record('u1', 'api', 1);
            expect(r.allowed).toBe(false);
            expect(r.warning).toContain('api');
        });

        it('should warn at 80% usage', () => {
            rl.record('u1', 'api', 8500);
            const r = rl.record('u1', 'api', 1);
            expect(r.allowed).toBe(true);
            expect(r.warning).toBeDefined();
        });

        it('should track CPU usage cumulatively', () => {
            rl.record('u1', 'cpu', 30_000);
            rl.record('u1', 'cpu', 30_000);
            const u = rl.getUsage('u1')!;
            expect(u.cpuMs).toBe(60_000);
        });

        it('should track memory as peak (max)', () => {
            rl.record('u1', 'memory', 256);
            rl.record('u1', 'memory', 100);
            expect(rl.getUsage('u1')!.memoryMB).toBe(256);
        });

        it('should track storage cumulatively', () => {
            rl.record('u1', 'storage', 500);
            rl.record('u1', 'storage', 200);
            expect(rl.getUsage('u1')!.storageMB).toBe(700);
        });
    });

    describe('setLimits', () => {
        it('should override default limits', () => {
            rl.setLimits('u1', { maxApiCalls: 50 });
            rl.record('u1', 'api', 50);
            const r = rl.record('u1', 'api', 1);
            expect(r.allowed).toBe(false);
        });
    });

    describe('isWithinLimits', () => {
        it('should return true for unknown user', () => {
            expect(rl.isWithinLimits('unknown')).toBe(true);
        });

        it('should return true when under limits', () => {
            rl.record('u1', 'api', 5);
            expect(rl.isWithinLimits('u1')).toBe(true);
        });

        it('should return false when any limit exceeded', () => {
            rl.record('u1', 'api', 10_001);
            expect(rl.isWithinLimits('u1')).toBe(false);
        });
    });

    describe('getPercentage', () => {
        it('should return null for unknown user', () => {
            expect(rl.getPercentage('unknown')).toBeNull();
        });

        it('should return correct percentages', () => {
            rl.setLimits('u1', { maxApiCalls: 100 });
            rl.record('u1', 'api', 50);
            const pct = rl.getPercentage('u1')!;
            expect(pct.api).toBe(50);
        });
    });

    describe('reset', () => {
        it('should reset usage to zero', () => {
            rl.record('u1', 'api', 5000);
            expect(rl.reset('u1')).toBe(true);
            expect(rl.getUsage('u1')!.apiCalls).toBe(0);
        });

        it('should return false for unknown user', () => {
            expect(rl.reset('unknown')).toBe(false);
        });
    });

    describe('count', () => {
        it('should track entity count', () => {
            rl.record('a', 'api', 1);
            rl.record('b', 'api', 1);
            expect(rl.count()).toBe(2);
        });
    });
});
