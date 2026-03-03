import { describe, it, expect } from 'vitest';

// ── Inline replicas ────────────────────────────────────────────────

type Usage = {
    input: number; output: number; cacheRead: number; cacheWrite: number;
    totalTokens: number; cost: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number };
};

function buildZeroUsage(): Usage {
    return {
        input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    };
}

function buildUsageWithNoCost(params: {
    input?: number; output?: number; cacheRead?: number; cacheWrite?: number; totalTokens?: number;
}): Usage {
    const input = params.input ?? 0;
    const output = params.output ?? 0;
    const cacheRead = params.cacheRead ?? 0;
    const cacheWrite = params.cacheWrite ?? 0;
    return {
        input, output, cacheRead, cacheWrite,
        totalTokens: params.totalTokens ?? input + output,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('buildZeroUsage', () => {
    it('returns all zeros', () => {
        const u = buildZeroUsage();
        expect(u.input).toBe(0);
        expect(u.output).toBe(0);
        expect(u.cacheRead).toBe(0);
        expect(u.cacheWrite).toBe(0);
        expect(u.totalTokens).toBe(0);
        expect(u.cost.total).toBe(0);
    });
});

describe('buildUsageWithNoCost', () => {
    it('sets input/output with auto totalTokens', () => {
        const u = buildUsageWithNoCost({ input: 100, output: 50 });
        expect(u.input).toBe(100);
        expect(u.output).toBe(50);
        expect(u.totalTokens).toBe(150);
    });

    it('allows explicit totalTokens override', () => {
        const u = buildUsageWithNoCost({ input: 100, output: 50, totalTokens: 200 });
        expect(u.totalTokens).toBe(200);
    });

    it('defaults to 0 for missing params', () => {
        const u = buildUsageWithNoCost({});
        expect(u.input).toBe(0);
        expect(u.output).toBe(0);
        expect(u.totalTokens).toBe(0);
    });

    it('sets cache counters', () => {
        const u = buildUsageWithNoCost({ cacheRead: 10, cacheWrite: 5 });
        expect(u.cacheRead).toBe(10);
        expect(u.cacheWrite).toBe(5);
    });

    it('cost is always zero', () => {
        const u = buildUsageWithNoCost({ input: 1000, output: 500 });
        expect(u.cost.input).toBe(0);
        expect(u.cost.output).toBe(0);
        expect(u.cost.total).toBe(0);
    });
});
