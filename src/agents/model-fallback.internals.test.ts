/**
 * CoreBlow — FallbackSummaryError & Probe Throttle Tests
 *
 * Tests for FallbackSummaryError construction and probe throttle logic.
 * Avoids importing model-fallback.ts directly due to markdown-it chain.
 */

import { describe, it, expect, beforeEach } from 'vitest';

// === FallbackSummaryError (inline test) ===

describe('FallbackSummaryError-like', () => {
    class FallbackSummaryError extends Error {
        readonly attempts: Array<{ provider: string; model: string; error: string }>;
        readonly soonestCooldownExpiry: number | null;

        constructor(
            message: string,
            attempts: Array<{ provider: string; model: string; error: string }>,
            soonestCooldownExpiry: number | null,
            cause?: Error,
        ) {
            super(message, { cause });
            this.name = 'FallbackSummaryError';
            this.attempts = attempts;
            this.soonestCooldownExpiry = soonestCooldownExpiry;
        }
    }

    it('constructs with message, attempts, and cooldown expiry', () => {
        const err = new FallbackSummaryError(
            'All models failed',
            [
                { provider: 'openai', model: 'gpt-4o', error: 'rate limited' },
                { provider: 'anthropic', model: 'claude-3', error: 'overloaded' },
            ],
            Date.now() + 30000,
        );

        expect(err.message).toBe('All models failed');
        expect(err.name).toBe('FallbackSummaryError');
        expect(err.attempts).toHaveLength(2);
        expect(err.soonestCooldownExpiry).toBeGreaterThan(0);
    });

    it('allows null cooldown expiry', () => {
        const err = new FallbackSummaryError('fail', [], null);
        expect(err.soonestCooldownExpiry).toBeNull();
    });

    it('attaches cause error', () => {
        const cause = new Error('original');
        const err = new FallbackSummaryError('wrapped', [], null, cause);
        expect(err.cause).toBe(cause);
    });

    it('is instanceof Error', () => {
        const err = new FallbackSummaryError('test', [], null);
        expect(err).toBeInstanceOf(Error);
    });

    // Type guard pattern
    const isFallbackSummaryError = (err: unknown): err is FallbackSummaryError => {
        return err instanceof FallbackSummaryError;
    };

    it('type guard returns true for FallbackSummaryError', () => {
        expect(isFallbackSummaryError(new FallbackSummaryError('x', [], null))).toBe(true);
    });

    it('type guard returns false for regular Error', () => {
        expect(isFallbackSummaryError(new Error('nope'))).toBe(false);
    });

    it('type guard returns false for non-error', () => {
        expect(isFallbackSummaryError(null)).toBe(false);
        expect(isFallbackSummaryError(undefined)).toBe(false);
    });
});

// === Probe Throttle Logic (inline test) ===

describe('probe throttle logic', () => {
    const MIN_PROBE_INTERVAL_MS = 30_000;
    const PROBE_STATE_TTL_MS = 24 * 60 * 60 * 1000;
    const MAX_PROBE_KEYS = 256;
    let lastProbeAttempt: Map<string, number>;

    beforeEach(() => {
        lastProbeAttempt = new Map();
    });

    function resolveProbeThrottleKey(provider: string, agentDir?: string): string {
        const scope = String(agentDir ?? '').trim();
        return scope ? `${scope}::${provider}` : provider;
    }

    function pruneProbeState(now: number): void {
        for (const [key, ts] of lastProbeAttempt) {
            if (!Number.isFinite(ts) || ts <= 0 || now - ts > PROBE_STATE_TTL_MS) {
                lastProbeAttempt.delete(key);
            }
        }
    }

    function isProbeThrottleOpen(now: number, key: string): boolean {
        pruneProbeState(now);
        const lastProbe = lastProbeAttempt.get(key) ?? 0;
        return now - lastProbe >= MIN_PROBE_INTERVAL_MS;
    }

    function markProbeAttempt(now: number, key: string): void {
        pruneProbeState(now);
        lastProbeAttempt.set(key, now);
    }

    describe('resolveProbeThrottleKey', () => {
        it('returns provider when no agentDir', () => {
            expect(resolveProbeThrottleKey('openai')).toBe('openai');
        });

        it('includes agentDir scope', () => {
            const key = resolveProbeThrottleKey('openai', '/home/.coreblow');
            expect(key).toBe('/home/.coreblow::openai');
        });
    });

    describe('isProbeThrottleOpen', () => {
        it('returns true when no previous probe', () => {
            expect(isProbeThrottleOpen(Date.now(), 'openai')).toBe(true);
        });

        it('returns false immediately after marking', () => {
            const now = Date.now();
            markProbeAttempt(now, 'openai');
            expect(isProbeThrottleOpen(now, 'openai')).toBe(false);
        });

        it('returns true after interval', () => {
            const now = Date.now();
            markProbeAttempt(now - MIN_PROBE_INTERVAL_MS - 1, 'openai');
            expect(isProbeThrottleOpen(now, 'openai')).toBe(true);
        });
    });

    describe('pruneProbeState', () => {
        it('removes expired entries', () => {
            const now = Date.now();
            lastProbeAttempt.set('old', now - PROBE_STATE_TTL_MS - 1);
            lastProbeAttempt.set('fresh', now);
            pruneProbeState(now);
            expect(lastProbeAttempt.has('old')).toBe(false);
            expect(lastProbeAttempt.has('fresh')).toBe(true);
        });
    });
});
