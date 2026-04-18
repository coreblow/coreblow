/**
 * Tests for Subagent Announce Delivery (CoreBlow Parity)
 *
 * Covers: retry with backoff, timeout resolution, origin resolution,
 * idempotency keys, delivery metrics, circuit breaker, audit trail,
 * delivery path, payload building.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
    runAnnounceDeliveryWithRetry,
    resolveAnnounceTimeoutMs,
    resolveAnnounceOrigin,
    buildAnnounceIdempotencyKey,
    buildAnnounceIdFromChildRun,
    deliverSubagentAnnouncement,
    recordDeliveryAttempt,
    getDeliveryMetrics,
    resetDeliveryMetrics,
    formatDeliveryMetrics,
    getCircuitBreakerState,
    recordCircuitBreakerSuccess,
    recordCircuitBreakerFailure,
    resetCircuitBreaker,
    resetAllCircuitBreakers,
    checkDeliveryHealth,
    recordDeliveryAudit,
    getDeliveryAuditTrail,
    clearDeliveryAuditTrail,
    resolveDeliveryPath,
    buildDeliveryPayload,
} from '../../src/agents/subagent/subagent-announce-delivery.js';

// ─── Setup ──────────────────────────────────────────────────────

beforeEach(() => {
    resetDeliveryMetrics();
    resetAllCircuitBreakers();
    clearDeliveryAuditTrail();
});

// ═══════════════════════════════════════════════════════════════
// RETRY WITH BACKOFF
// ═══════════════════════════════════════════════════════════════

describe('runAnnounceDeliveryWithRetry', () => {
    it('returns result on first success', async () => {
        const result = await runAnnounceDeliveryWithRetry({
            operation: 'test',
            run: async () => 'ok',
        });
        expect(result).toBe('ok');
    });

    it('throws non-transient errors immediately', async () => {
        await expect(
            runAnnounceDeliveryWithRetry({
                operation: 'test',
                run: async () => { throw new Error('unsupported channel'); },
            }),
        ).rejects.toThrow('unsupported channel');
    });

    it('throws when signal is already aborted', async () => {
        const controller = new AbortController();
        controller.abort();
        await expect(
            runAnnounceDeliveryWithRetry({
                operation: 'test',
                signal: controller.signal,
                run: async () => 'ok',
            }),
        ).rejects.toThrow('aborted');
    });

    it('retries on transient UNAVAILABLE errors', async () => {
        vi.useFakeTimers();
        let attempts = 0;
        const promise = runAnnounceDeliveryWithRetry({
            operation: 'test',
            run: async () => {
                attempts++;
                if (attempts < 2) throw new Error('UNAVAILABLE');
                return 'recovered';
            },
        });
        await vi.advanceTimersByTimeAsync(10_000);
        const result = await promise;
        expect(result).toBe('recovered');
        expect(attempts).toBe(2);
        vi.useRealTimers();
    });

    it('retries on ECONNRESET errors', async () => {
        vi.useFakeTimers();
        let attempts = 0;
        const promise = runAnnounceDeliveryWithRetry({
            operation: 'test',
            run: async () => {
                attempts++;
                if (attempts < 2) throw new Error('econnreset');
                return 'ok';
            },
        });
        await vi.advanceTimersByTimeAsync(10_000);
        const result = await promise;
        expect(result).toBe('ok');
        expect(attempts).toBe(2);
        vi.useRealTimers();
    });

    it('retries on gateway timeout errors', async () => {
        vi.useFakeTimers();
        let attempts = 0;
        const promise = runAnnounceDeliveryWithRetry({
            operation: 'test',
            run: async () => {
                attempts++;
                if (attempts < 2) throw new Error('gateway timeout');
                return 'recovered';
            },
        });
        await vi.advanceTimersByTimeAsync(10_000);
        const result = await promise;
        expect(result).toBe('recovered');
        vi.useRealTimers();
    });

    it('retries on network error patterns', async () => {
        vi.useFakeTimers();
        let attempts = 0;
        const promise = runAnnounceDeliveryWithRetry({
            operation: 'test',
            run: async () => {
                attempts++;
                if (attempts < 2) throw new Error('network error');
                return 'ok';
            },
        });
        await vi.advanceTimersByTimeAsync(10_000);
        const result = await promise;
        expect(result).toBe('ok');
        vi.useRealTimers();
    });

    it('does not retry permanent errors like forbidden', async () => {
        let attempts = 0;
        await expect(
            runAnnounceDeliveryWithRetry({
                operation: 'test',
                run: async () => { attempts++; throw new Error('forbidden'); },
            }),
        ).rejects.toThrow('forbidden');
        expect(attempts).toBe(1);
    });

    it('does not retry "chat not found"', async () => {
        let attempts = 0;
        await expect(
            runAnnounceDeliveryWithRetry({
                operation: 'test',
                run: async () => { attempts++; throw new Error('chat not found'); },
            }),
        ).rejects.toThrow('chat not found');
        expect(attempts).toBe(1);
    });

    it('does not retry "bot was blocked"', async () => {
        await expect(
            runAnnounceDeliveryWithRetry({
                operation: 'test',
                run: async () => { throw new Error('bot was blocked'); },
            }),
        ).rejects.toThrow('bot was blocked');
    });

    it('does not retry "outbound not configured"', async () => {
        await expect(
            runAnnounceDeliveryWithRetry({
                operation: 'test',
                run: async () => { throw new Error('outbound not configured'); },
            }),
        ).rejects.toThrow('outbound not configured');
    });

    it('respects abort signal during retries', async () => {
        const controller = new AbortController();
        let attempts = 0;
        const promise = runAnnounceDeliveryWithRetry({
            operation: 'test',
            signal: controller.signal,
            run: async () => {
                attempts++;
                if (attempts === 1) {
                    controller.abort();
                    throw new Error('UNAVAILABLE');
                }
                return 'ok';
            },
        });
        await expect(promise).rejects.toThrow('UNAVAILABLE');
    });

    it('handles non-Error throwables', async () => {
        await expect(
            runAnnounceDeliveryWithRetry({
                operation: 'test',
                run: async () => { throw 'string error'; },
            }),
        ).rejects.toBe('string error');
    });
});

// ═══════════════════════════════════════════════════════════════
// TIMEOUT RESOLUTION
// ═══════════════════════════════════════════════════════════════

describe('resolveAnnounceTimeoutMs', () => {
    it('returns default for undefined', () => {
        expect(resolveAnnounceTimeoutMs()).toBe(90_000);
    });

    it('returns default for NaN', () => {
        expect(resolveAnnounceTimeoutMs(NaN)).toBe(90_000);
    });

    it('returns default for Infinity', () => {
        expect(resolveAnnounceTimeoutMs(Infinity)).toBe(90_000);
    });

    it('returns default for non-number', () => {
        expect(resolveAnnounceTimeoutMs('abc' as unknown as number)).toBe(90_000);
    });

    it('clamps to minimum of 1', () => {
        expect(resolveAnnounceTimeoutMs(-100)).toBe(1);
        expect(resolveAnnounceTimeoutMs(0)).toBe(1);
    });

    it('clamps to max timer-safe value', () => {
        expect(resolveAnnounceTimeoutMs(999_999_999_999)).toBe(2_147_000_000);
    });

    it('accepts valid values', () => {
        expect(resolveAnnounceTimeoutMs(30_000)).toBe(30_000);
        expect(resolveAnnounceTimeoutMs(120_000)).toBe(120_000);
    });

    it('floors fractional values', () => {
        expect(resolveAnnounceTimeoutMs(5000.7)).toBe(5000);
    });
});

// ═══════════════════════════════════════════════════════════════
// ORIGIN RESOLUTION
// ═══════════════════════════════════════════════════════════════

describe('resolveAnnounceOrigin', () => {
    it('returns undefined when both params undefined', () => {
        expect(resolveAnnounceOrigin()).toBeUndefined();
    });

    it('resolves from session entry only', () => {
        const result = resolveAnnounceOrigin({ channel: 'slack', to: 'user1', threadId: 't1' });
        expect(result).toEqual({
            channel: 'slack', to: 'user1', threadId: 't1', accountId: undefined,
        });
    });

    it('resolves from requester origin only', () => {
        const result = resolveAnnounceOrigin(undefined, {
            channel: 'telegram', to: 'user2', accountId: 'acct1',
        });
        expect(result).toEqual({
            channel: 'telegram', to: 'user2', threadId: undefined, accountId: 'acct1',
        });
    });

    it('requester origin takes precedence', () => {
        const result = resolveAnnounceOrigin(
            { channel: 'slack', to: 'user1', threadId: 't1' },
            { channel: 'telegram', to: 'user2', accountId: 'acct1' },
        );
        expect(result?.channel).toBe('telegram');
        expect(result?.to).toBe('user2');
        expect(result?.accountId).toBe('acct1');
    });

    it('falls back to session entry for missing requester fields', () => {
        const result = resolveAnnounceOrigin(
            { channel: 'slack', to: 'user1', threadId: 't1' },
            { accountId: 'acct1' },
        );
        expect(result?.channel).toBe('slack');
        expect(result?.to).toBe('user1');
        expect(result?.threadId).toBe('t1');
    });

    it('uses lastChannel fallback from session entry', () => {
        const result = resolveAnnounceOrigin({ lastChannel: 'discord' });
        expect(result?.channel).toBe('discord');
    });

    it('prefers channel over lastChannel', () => {
        const result = resolveAnnounceOrigin({ channel: 'slack', lastChannel: 'discord' });
        expect(result?.channel).toBe('slack');
    });

    it('handles numeric threadId in session entry', () => {
        const result = resolveAnnounceOrigin({ threadId: 12345 });
        expect(result?.threadId).toBe(12345);
    });
});

// ═══════════════════════════════════════════════════════════════
// IDEMPOTENCY
// ═══════════════════════════════════════════════════════════════

describe('Idempotency Keys', () => {
    it('buildAnnounceIdempotencyKey creates prefixed key', () => {
        expect(buildAnnounceIdempotencyKey('abc')).toBe('announce:abc');
    });

    it('buildAnnounceIdempotencyKey handles empty string', () => {
        expect(buildAnnounceIdempotencyKey('')).toBe('announce:');
    });

    it('buildAnnounceIdFromChildRun combines session and run', () => {
        const id = buildAnnounceIdFromChildRun({
            childSessionKey: 'agent:sub:0:child', childRunId: 'run-123',
        });
        expect(id).toBe('agent:sub:0:child:run-123');
    });

    it('produces different keys for different runs', () => {
        const id1 = buildAnnounceIdFromChildRun({ childSessionKey: 'k1', childRunId: 'r1' });
        const id2 = buildAnnounceIdFromChildRun({ childSessionKey: 'k1', childRunId: 'r2' });
        expect(id1).not.toBe(id2);
    });
});

// ═══════════════════════════════════════════════════════════════
// DELIVERY METRICS
// ═══════════════════════════════════════════════════════════════

describe('Delivery Metrics', () => {
    it('starts with zero metrics', () => {
        const m = getDeliveryMetrics();
        expect(m.totalAttempts).toBe(0);
        expect(m.directSuccess).toBe(0);
    });

    it('records direct success', () => {
        recordDeliveryAttempt({ path: 'direct', success: true, durationMs: 100 });
        const m = getDeliveryMetrics();
        expect(m.totalAttempts).toBe(1);
        expect(m.directSuccess).toBe(1);
        expect(m.avgDeliveryMs).toBe(100);
    });

    it('records direct failure with transient flag', () => {
        recordDeliveryAttempt({ path: 'direct', success: false, isTransient: true });
        const m = getDeliveryMetrics();
        expect(m.directFailure).toBe(1);
        expect(m.transientErrors).toBe(1);
        expect(m.permanentErrors).toBe(0);
    });

    it('records queued success', () => {
        recordDeliveryAttempt({ path: 'queued', success: true });
        expect(getDeliveryMetrics().queuedSuccess).toBe(1);
    });

    it('records queued failure as permanent', () => {
        recordDeliveryAttempt({ path: 'queued', success: false, isTransient: false });
        const m = getDeliveryMetrics();
        expect(m.queuedFailure).toBe(1);
        expect(m.permanentErrors).toBe(1);
    });

    it('accumulates retry counts', () => {
        recordDeliveryAttempt({ path: 'direct', success: true, retryCount: 3 });
        recordDeliveryAttempt({ path: 'direct', success: true, retryCount: 2 });
        expect(getDeliveryMetrics().retriesTotal).toBe(5);
    });

    it('calculates average delivery time', () => {
        recordDeliveryAttempt({ path: 'direct', success: true, durationMs: 100 });
        recordDeliveryAttempt({ path: 'direct', success: true, durationMs: 300 });
        expect(getDeliveryMetrics().avgDeliveryMs).toBe(200);
    });

    it('resetDeliveryMetrics clears all', () => {
        recordDeliveryAttempt({ path: 'direct', success: true, durationMs: 100 });
        resetDeliveryMetrics();
        expect(getDeliveryMetrics().totalAttempts).toBe(0);
    });

    it('returns a copy, not a reference', () => {
        recordDeliveryAttempt({ path: 'direct', success: true });
        const m1 = getDeliveryMetrics();
        const m2 = getDeliveryMetrics();
        expect(m1).toEqual(m2);
        expect(m1).not.toBe(m2);
    });

    it('formatDeliveryMetrics produces formatted string', () => {
        recordDeliveryAttempt({ path: 'direct', success: true, durationMs: 5000 });
        const formatted = formatDeliveryMetrics(getDeliveryMetrics());
        expect(formatted).toContain('Total: 1');
        expect(formatted).toContain('Direct OK: 1');
        expect(formatted).toContain('5.0s');
    });

    it('formatDeliveryMetrics handles zero metrics', () => {
        const formatted = formatDeliveryMetrics(getDeliveryMetrics());
        expect(formatted).toContain('Total: 0');
    });
});

// ═══════════════════════════════════════════════════════════════
// CIRCUIT BREAKER
// ═══════════════════════════════════════════════════════════════

describe('Circuit Breaker', () => {
    it('starts in closed state', () => {
        expect(getCircuitBreakerState('target-1')).toBe('closed');
    });

    it('stays closed below threshold', () => {
        const cfg = { failureThreshold: 5, resetTimeMs: 60000, halfOpenAttempts: 1 };
        recordCircuitBreakerFailure('t1', cfg);
        recordCircuitBreakerFailure('t1', cfg);
        expect(getCircuitBreakerState('t1')).toBe('closed');
    });

    it('opens after reaching failure threshold', () => {
        const cfg = { failureThreshold: 3, resetTimeMs: 60000, halfOpenAttempts: 1 };
        recordCircuitBreakerFailure('t2', cfg);
        recordCircuitBreakerFailure('t2', cfg);
        recordCircuitBreakerFailure('t2', cfg);
        expect(getCircuitBreakerState('t2', cfg)).toBe('open');
    });

    it('uses default threshold of 5', () => {
        for (let i = 0; i < 5; i++) recordCircuitBreakerFailure('t3');
        expect(getCircuitBreakerState('t3')).toBe('open');
    });

    it('transitions to half-open after reset time', () => {
        const cfg = { failureThreshold: 2, resetTimeMs: 100, halfOpenAttempts: 1 };
        recordCircuitBreakerFailure('t4', cfg);
        recordCircuitBreakerFailure('t4', cfg);
        expect(getCircuitBreakerState('t4', cfg)).toBe('open');
        vi.useFakeTimers();
        vi.advanceTimersByTime(200);
        expect(getCircuitBreakerState('t4', cfg)).toBe('half-open');
        vi.useRealTimers();
    });

    it('resets to closed on success', () => {
        const cfg = { failureThreshold: 2, resetTimeMs: 60000, halfOpenAttempts: 1 };
        recordCircuitBreakerFailure('t5', cfg);
        recordCircuitBreakerFailure('t5', cfg);
        recordCircuitBreakerSuccess('t5');
        expect(getCircuitBreakerState('t5')).toBe('closed');
    });

    it('resetCircuitBreaker removes by key', () => {
        recordCircuitBreakerFailure('t6');
        resetCircuitBreaker('t6');
        expect(getCircuitBreakerState('t6')).toBe('closed');
    });

    it('resetAllCircuitBreakers clears everything', () => {
        recordCircuitBreakerFailure('a');
        recordCircuitBreakerFailure('b');
        resetAllCircuitBreakers();
        expect(getCircuitBreakerState('a')).toBe('closed');
        expect(getCircuitBreakerState('b')).toBe('closed');
    });

    it('tracks independent breakers per key', () => {
        const cfg = { failureThreshold: 2, resetTimeMs: 60000, halfOpenAttempts: 1 };
        recordCircuitBreakerFailure('ka', cfg);
        recordCircuitBreakerFailure('ka', cfg);
        recordCircuitBreakerFailure('kb', cfg);
        expect(getCircuitBreakerState('ka', cfg)).toBe('open');
        expect(getCircuitBreakerState('kb', cfg)).toBe('closed');
    });
});

// ═══════════════════════════════════════════════════════════════
// DELIVERY HEALTH
// ═══════════════════════════════════════════════════════════════

describe('Delivery Health', () => {
    it('reports healthy by default', () => {
        const h = checkDeliveryHealth();
        expect(h.healthy).toBe(true);
        expect(h.openCircuitBreakers).toHaveLength(0);
    });

    it('reports unhealthy with open circuit breakers', () => {
        for (let i = 0; i < 5; i++) recordCircuitBreakerFailure('bad');
        expect(checkDeliveryHealth().healthy).toBe(false);
        expect(checkDeliveryHealth().openCircuitBreakers).toContain('bad');
    });

    it('reports unhealthy with high failure rate', () => {
        recordDeliveryAttempt({ path: 'direct', success: false });
        recordDeliveryAttempt({ path: 'direct', success: false });
        expect(checkDeliveryHealth().healthy).toBe(false);
    });

    it('reports healthy with low failure rate', () => {
        recordDeliveryAttempt({ path: 'direct', success: true });
        recordDeliveryAttempt({ path: 'direct', success: true });
        recordDeliveryAttempt({ path: 'direct', success: false });
        expect(checkDeliveryHealth().healthy).toBe(true);
    });

    it('counts recent errors', () => {
        recordDeliveryAttempt({ path: 'direct', success: false, isTransient: true });
        recordDeliveryAttempt({ path: 'direct', success: false, isTransient: false });
        expect(checkDeliveryHealth().recentErrors).toBe(2);
    });
});

// ═══════════════════════════════════════════════════════════════
// AUDIT TRAIL
// ═══════════════════════════════════════════════════════════════

describe('Delivery Audit Trail', () => {
    const makeAudit = (overrides?: Partial<{
        announceId: string; targetSessionKey: string;
        path: string; delivered: boolean; retries: number;
    }>) => ({
        announceId: 'a1', targetSessionKey: 'sk', path: 'direct',
        delivered: true, timestamp: Date.now(), retries: 0, ...overrides,
    });

    it('records and retrieves audit entries', () => {
        recordDeliveryAudit(makeAudit());
        expect(getDeliveryAuditTrail()).toHaveLength(1);
    });

    it('respects limit parameter', () => {
        for (let i = 0; i < 10; i++) recordDeliveryAudit(makeAudit({ announceId: `a${i}` }));
        expect(getDeliveryAuditTrail(3)).toHaveLength(3);
    });

    it('filters by target key', () => {
        recordDeliveryAudit(makeAudit({ targetSessionKey: 'sk-1' }));
        recordDeliveryAudit(makeAudit({ targetSessionKey: 'sk-2' }));
        expect(getDeliveryAuditTrail(50, 'sk-1')).toHaveLength(1);
    });

    it('clearDeliveryAuditTrail returns count and empties', () => {
        recordDeliveryAudit(makeAudit());
        expect(clearDeliveryAuditTrail()).toBe(1);
        expect(getDeliveryAuditTrail()).toHaveLength(0);
    });

    it('enforces max 1000 entries', () => {
        for (let i = 0; i < 1050; i++) recordDeliveryAudit(makeAudit({ announceId: `a${i}` }));
        expect(getDeliveryAuditTrail(9999)).toHaveLength(1000);
    });

    it('records entries with error field', () => {
        recordDeliveryAudit({ ...makeAudit(), delivered: false, error: 'timeout', retries: 2 });
        const trail = getDeliveryAuditTrail();
        expect(trail[0]!.error).toBe('timeout');
        expect(trail[0]!.retries).toBe(2);
    });

    it('records entries with duration', () => {
        recordDeliveryAudit({ ...makeAudit(), durationMs: 350 });
        expect(getDeliveryAuditTrail()[0]!.durationMs).toBe(350);
    });
});

// ═══════════════════════════════════════════════════════════════
// DELIVERY PATH RESOLUTION
// ═══════════════════════════════════════════════════════════════

describe('resolveDeliveryPath', () => {
    it('returns none when no gateway', () => {
        expect(resolveDeliveryPath({
            expectsCompletionMessage: false, requesterIsSubagent: false, hasGateway: false,
        })).toBe('none');
    });

    it('returns direct for completion messages', () => {
        expect(resolveDeliveryPath({
            expectsCompletionMessage: true, requesterIsSubagent: false, hasGateway: true,
        })).toBe('direct');
    });

    it('returns direct for subagent requester', () => {
        expect(resolveDeliveryPath({
            expectsCompletionMessage: false, requesterIsSubagent: true, hasGateway: true,
        })).toBe('direct');
    });

    it('returns queue for non-completion non-subagent with gateway', () => {
        expect(resolveDeliveryPath({
            expectsCompletionMessage: false, requesterIsSubagent: false, hasGateway: true,
        })).toBe('queue');
    });
});

// ═══════════════════════════════════════════════════════════════
// DELIVERY PAYLOAD
// ═══════════════════════════════════════════════════════════════

describe('buildDeliveryPayload', () => {
    it('builds correct structure', () => {
        const payload = buildDeliveryPayload({
            sessionKey: 'sk-1', message: 'hello', deliver: true,
            channel: 'slack', accountId: 'acct1', to: 'user1',
            threadId: 't1', sourceSessionKey: 'src', idempotencyKey: 'idem',
        });
        expect(payload.method).toBe('agent');
        const params = payload.params as Record<string, unknown>;
        expect(params.sessionKey).toBe('sk-1');
        expect(params.message).toBe('hello');
        expect(params.deliver).toBe(true);
        expect(params.channel).toBe('slack');
        expect(params.idempotencyKey).toBe('idem');
    });

    it('includes inputProvenance', () => {
        const payload = buildDeliveryPayload({
            sessionKey: 'sk', message: 'msg', deliver: false,
            sourceSessionKey: 'src', idempotencyKey: 'k',
        });
        const prov = (payload.params as Record<string, unknown>).inputProvenance as Record<string, unknown>;
        expect(prov.kind).toBe('inter_session');
        expect(prov.sourceSessionKey).toBe('src');
        expect(prov.sourceChannel).toBe('internal');
        expect(prov.sourceTool).toBe('subagent_announce');
    });

    it('includes timeoutMs', () => {
        const payload = buildDeliveryPayload({
            sessionKey: 'sk', message: 'msg', deliver: true, idempotencyKey: 'k',
        });
        expect(payload.timeoutMs).toBe(90_000);
    });

    it('handles undefined optional fields', () => {
        const payload = buildDeliveryPayload({
            sessionKey: 'sk', message: 'msg', deliver: false, idempotencyKey: 'k',
        });
        const params = payload.params as Record<string, unknown>;
        expect(params.channel).toBeUndefined();
        expect(params.accountId).toBeUndefined();
    });
});

// ═══════════════════════════════════════════════════════════════
// COMBINED DELIVERY
// ═══════════════════════════════════════════════════════════════

describe('deliverSubagentAnnouncement', () => {
    it('delivers without gateway (no-op)', async () => {
        const result = await deliverSubagentAnnouncement({
            requesterSessionKey: 'rsk', triggerMessage: 'hello',
            steerMessage: 'steer', targetRequesterSessionKey: 'tsk',
            requesterIsSubagent: false, expectsCompletionMessage: false,
            directIdempotencyKey: 'k1',
        });
        expect(result.delivered).toBe(true);
    });

    it('returns not delivered when aborted', async () => {
        const ctrl = new AbortController();
        ctrl.abort();
        const result = await deliverSubagentAnnouncement({
            requesterSessionKey: 'rsk', triggerMessage: 'hello',
            steerMessage: 'steer', targetRequesterSessionKey: 'tsk',
            requesterIsSubagent: false, expectsCompletionMessage: false,
            directIdempotencyKey: 'k1', signal: ctrl.signal,
        });
        expect(result.delivered).toBe(false);
    });

    it('records dispatch phases', async () => {
        const result = await deliverSubagentAnnouncement({
            requesterSessionKey: 'rsk', triggerMessage: 'hello',
            steerMessage: 'steer', targetRequesterSessionKey: 'tsk',
            requesterIsSubagent: false, expectsCompletionMessage: true,
            directIdempotencyKey: 'k2',
        });
        expect(result.phases).toBeDefined();
        expect(Array.isArray(result.phases)).toBe(true);
    });

    it('handles completion flow through phases', async () => {
        const result = await deliverSubagentAnnouncement({
            requesterSessionKey: 'rsk', triggerMessage: 'msg',
            steerMessage: 'steer', targetRequesterSessionKey: 'tsk',
            requesterIsSubagent: true, expectsCompletionMessage: true,
            directIdempotencyKey: 'k3',
        });
        expect(result.delivered).toBe(true);
        expect(result.path).toBe('direct');
    });
});
