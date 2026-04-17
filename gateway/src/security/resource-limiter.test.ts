/**
 * CoreBlow Security — ResourceLimiter Test Suite
 *
 * Covers: setLimits(), record() with cpu/memory/storage/api resources,
 * isWithinLimits(), getUsage(), getPercentage(), reset(), count(),
 * soft warnings at 80%, hard limits at 100%, and edge cases.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ResourceLimiter } from './resource-limiter.js';

describe('ResourceLimiter', () => {
    let limiter: ResourceLimiter;

    beforeEach(() => {
        limiter = new ResourceLimiter();
    });

    // ─── setLimits() ────────────────────────────────────────────

    describe('setLimits()', () => {
        it('creates entity with custom limits', () => {
            limiter.setLimits('tenant-1', { maxCpuMs: 30_000, maxApiCalls: 5000 });
            const usage = limiter.getUsage('tenant-1')!;
            expect(usage.limits.maxCpuMs).toBe(30_000);
            expect(usage.limits.maxApiCalls).toBe(5000);
            // Defaults for unspecified
            expect(usage.limits.maxMemoryMB).toBe(512);
            expect(usage.limits.maxStorageMB).toBe(1024);
        });

        it('merges with existing limits', () => {
            limiter.setLimits('t', { maxCpuMs: 10_000 });
            limiter.setLimits('t', { maxApiCalls: 999 });
            const usage = limiter.getUsage('t')!;
            expect(usage.limits.maxCpuMs).toBe(10_000);
            expect(usage.limits.maxApiCalls).toBe(999);
        });
    });

    // ─── record() ───────────────────────────────────────────────

    describe('record()', () => {
        it('records CPU usage (additive)', () => {
            limiter.record('t', 'cpu', 1000);
            limiter.record('t', 'cpu', 2000);
            expect(limiter.getUsage('t')!.cpuMs).toBe(3000);
        });

        it('records memory usage (max/high-water-mark)', () => {
            limiter.record('t', 'memory', 100);
            limiter.record('t', 'memory', 200);
            limiter.record('t', 'memory', 150);
            expect(limiter.getUsage('t')!.memoryMB).toBe(200); // Max of all
        });

        it('records storage usage (additive)', () => {
            limiter.record('t', 'storage', 50);
            limiter.record('t', 'storage', 30);
            expect(limiter.getUsage('t')!.storageMB).toBe(80);
        });

        it('records API calls (additive)', () => {
            limiter.record('t', 'api', 5);
            limiter.record('t', 'api', 3);
            expect(limiter.getUsage('t')!.apiCalls).toBe(8);
        });

        it('returns allowed=true when within limits', () => {
            const result = limiter.record('t', 'cpu', 1000);
            expect(result.allowed).toBe(true);
        });

        it('returns warning when at 80%+ of limit', () => {
            // Default maxCpuMs = 60_000; 80% = 48_000
            limiter.record('t', 'cpu', 50_000);
            const result = limiter.record('t', 'cpu', 0); // Check current state
            // First record of 50_000 triggers the 80% warning
            const usage = limiter.getUsage('t')!;
            expect(usage.cpuMs).toBe(50_000);
            // Re-record a small amount to trigger check
            const r2 = limiter.record('t', 'cpu', 1);
            expect(r2.warning).toBeTruthy();
            expect(r2.allowed).toBe(true);
        });

        it('returns allowed=false when exceeding 100% of limit', () => {
            const result = limiter.record('t', 'cpu', 70_000); // Exceeds 60_000 default
            expect(result.allowed).toBe(false);
            expect(result.warning).toContain('exceeded');
        });

        it('auto-creates entity on first record', () => {
            limiter.record('new-entity', 'api', 1);
            expect(limiter.count()).toBe(1);
        });
    });

    // ─── isWithinLimits() ───────────────────────────────────────

    describe('isWithinLimits()', () => {
        it('returns true for unknown entity', () => {
            expect(limiter.isWithinLimits('unknown')).toBe(true);
        });

        it('returns true when all resources within limits', () => {
            limiter.record('t', 'cpu', 1000);
            limiter.record('t', 'api', 10);
            expect(limiter.isWithinLimits('t')).toBe(true);
        });

        it('returns false when any resource exceeds limit', () => {
            limiter.record('t', 'cpu', 999_999);
            expect(limiter.isWithinLimits('t')).toBe(false);
        });
    });

    // ─── getUsage() ─────────────────────────────────────────────

    describe('getUsage()', () => {
        it('returns null for unknown entity', () => {
            expect(limiter.getUsage('unknown')).toBeNull();
        });

        it('returns usage object for tracked entity', () => {
            limiter.record('t', 'api', 5);
            const usage = limiter.getUsage('t');
            expect(usage).toBeTruthy();
            expect(usage!.id).toBe('t');
            expect(usage!.apiCalls).toBe(5);
        });
    });

    // ─── getPercentage() ────────────────────────────────────────

    describe('getPercentage()', () => {
        it('returns null for unknown entity', () => {
            expect(limiter.getPercentage('unknown')).toBeNull();
        });

        it('returns percentages for all resource types', () => {
            limiter.record('t', 'cpu', 30_000); // 50% of 60_000
            limiter.record('t', 'api', 5000);   // 50% of 10_000

            const pct = limiter.getPercentage('t')!;
            expect(pct.cpu).toBe(50);
            expect(pct.api).toBe(50);
            expect(pct.memory).toBe(0);
            expect(pct.storage).toBe(0);
        });

        it('returns 100+ for exceeded limits', () => {
            limiter.record('t', 'cpu', 90_000);
            const pct = limiter.getPercentage('t')!;
            expect(pct.cpu).toBe(150); // 90k/60k * 100
        });
    });

    // ─── reset() ────────────────────────────────────────────────

    describe('reset()', () => {
        it('resets all usage counters to 0', () => {
            limiter.record('t', 'cpu', 10_000);
            limiter.record('t', 'memory', 200);
            limiter.record('t', 'storage', 500);
            limiter.record('t', 'api', 100);

            expect(limiter.reset('t')).toBe(true);

            const usage = limiter.getUsage('t')!;
            expect(usage.cpuMs).toBe(0);
            expect(usage.memoryMB).toBe(0);
            expect(usage.storageMB).toBe(0);
            expect(usage.apiCalls).toBe(0);
            expect(usage.warnings).toEqual([]);
        });

        it('returns false for unknown entity', () => {
            expect(limiter.reset('unknown')).toBe(false);
        });

        it('preserves limits after reset', () => {
            limiter.setLimits('t', { maxCpuMs: 99_999 });
            limiter.record('t', 'cpu', 50_000);
            limiter.reset('t');
            expect(limiter.getUsage('t')!.limits.maxCpuMs).toBe(99_999);
        });
    });

    // ─── count() ────────────────────────────────────────────────

    describe('count()', () => {
        it('returns 0 initially', () => {
            expect(limiter.count()).toBe(0);
        });

        it('returns number of tracked entities', () => {
            limiter.record('a', 'api', 1);
            limiter.record('b', 'api', 1);
            expect(limiter.count()).toBe(2);
        });
    });
});
