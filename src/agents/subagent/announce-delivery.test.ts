// @ts-nocheck
import { describe, it, expect, beforeEach } from 'vitest';
import {
    resolveAnnounceTimeoutMs,
    resolveAnnounceOrigin,
    buildAnnounceIdempotencyKey,
    buildAnnounceIdFromChildRun,
    resolveDeliveryPath,
    buildDeliveryPayload,
    recordDeliveryAttempt,
    getDeliveryMetrics,
    resetDeliveryMetrics,
    formatDeliveryMetrics,
    getCircuitBreakerState,
    recordCircuitBreakerFailure,
    recordCircuitBreakerSuccess,
    resetCircuitBreaker,
    resetAllCircuitBreakers,
    checkDeliveryHealth,
    recordDeliveryAudit,
    getDeliveryAuditTrail,
    clearDeliveryAuditTrail,
    runAnnounceDeliveryWithRetry,
} from './subagent-announce-delivery.js';

describe('Subagent Announce Delivery — Phase 13', () => {

    beforeEach(() => {
        resetDeliveryMetrics();
        resetAllCircuitBreakers();
        clearDeliveryAuditTrail();
    });

    // ─── Timeout Resolution ────────────────────────────────────

    describe('resolveAnnounceTimeoutMs', () => {
        it('returns default for undefined', () => {
            expect(resolveAnnounceTimeoutMs(undefined)).toBe(90_000);
        });

        it('returns default for NaN', () => {
            expect(resolveAnnounceTimeoutMs(NaN)).toBe(90_000);
        });

        it('returns clamped value', () => {
            expect(resolveAnnounceTimeoutMs(5000)).toBe(5000);
        });

        it('clamps to at least 1', () => {
            expect(resolveAnnounceTimeoutMs(-100)).toBe(1);
        });
    });

    // ─── Origin Resolution ─────────────────────────────────────

    describe('resolveAnnounceOrigin', () => {
        it('returns undefined when both null', () => {
            expect(resolveAnnounceOrigin(undefined, undefined)).toBeUndefined();
        });

        it('merges session entry and requester origin', () => {
            const result = resolveAnnounceOrigin(
                { channel: 'discord', to: 'user-1' },
                { accountId: 'acct-1' },
            );
            expect(result!.channel).toBe('discord');
            expect(result!.to).toBe('user-1');
            expect(result!.accountId).toBe('acct-1');
        });

        it('prefers requester origin channel', () => {
            const result = resolveAnnounceOrigin(
                { channel: 'slack' },
                { channel: 'teams' },
            );
            expect(result!.channel).toBe('teams');
        });
    });

    // ─── Idempotency Keys ──────────────────────────────────────

    describe('idempotency', () => {
        it('builds announce idempotency key', () => {
            expect(buildAnnounceIdempotencyKey('ann-1')).toBe('announce:ann-1');
        });

        it('builds announce ID from child run', () => {
            const id = buildAnnounceIdFromChildRun({ childSessionKey: 'child-1', childRunId: 'run-1' });
            expect(id).toBe('child-1:run-1');
        });
    });

    // ─── Delivery Path ─────────────────────────────────────────

    describe('resolveDeliveryPath', () => {
        it('returns none when no gateway', () => {
            expect(resolveDeliveryPath({ expectsCompletionMessage: false, requesterIsSubagent: false, hasGateway: false })).toBe('none');
        });

        it('returns direct for completion message', () => {
            expect(resolveDeliveryPath({ expectsCompletionMessage: true, requesterIsSubagent: false, hasGateway: true })).toBe('direct');
        });

        it('returns direct for subagent requester', () => {
            expect(resolveDeliveryPath({ expectsCompletionMessage: false, requesterIsSubagent: true, hasGateway: true })).toBe('direct');
        });

        it('returns queue for normal delivery', () => {
            expect(resolveDeliveryPath({ expectsCompletionMessage: false, requesterIsSubagent: false, hasGateway: true })).toBe('queue');
        });
    });

    // ─── Delivery Payload ──────────────────────────────────────

    describe('buildDeliveryPayload', () => {
        it('builds correct payload structure', () => {
            const payload = buildDeliveryPayload({
                sessionKey: 'sess-1',
                message: 'Hello',
                deliver: true,
                channel: 'discord',
                idempotencyKey: 'key-1',
            });
            expect(payload.method).toBe('agent');
            expect(payload.params.sessionKey).toBe('sess-1');
            expect(payload.params.message).toBe('Hello');
            expect(payload.params.deliver).toBe(true);
            expect(payload.params.inputProvenance.kind).toBe('inter_session');
        });
    });

    // ─── Delivery Metrics ──────────────────────────────────────

    describe('delivery metrics', () => {
        it('records direct success', () => {
            recordDeliveryAttempt({ path: 'direct', success: true, durationMs: 50 });
            const m = getDeliveryMetrics();
            expect(m.totalAttempts).toBe(1);
            expect(m.directSuccess).toBe(1);
            expect(m.avgDeliveryMs).toBe(50);
        });

        it('records queued failure', () => {
            recordDeliveryAttempt({ path: 'queued', success: false, isTransient: true });
            const m = getDeliveryMetrics();
            expect(m.queuedFailure).toBe(1);
            expect(m.transientErrors).toBe(1);
        });

        it('tracks retries', () => {
            recordDeliveryAttempt({ path: 'direct', success: true, retryCount: 2 });
            expect(getDeliveryMetrics().retriesTotal).toBe(2);
        });

        it('formats metrics string', () => {
            recordDeliveryAttempt({ path: 'direct', success: true, durationMs: 100 });
            const str = formatDeliveryMetrics(getDeliveryMetrics());
            expect(str).toContain('Total: 1');
            expect(str).toContain('Direct OK: 1');
        });

        it('reset clears all', () => {
            recordDeliveryAttempt({ path: 'direct', success: true });
            resetDeliveryMetrics();
            expect(getDeliveryMetrics().totalAttempts).toBe(0);
        });
    });

    // ─── Circuit Breaker ───────────────────────────────────────

    describe('circuit breaker', () => {
        it('starts closed', () => {
            expect(getCircuitBreakerState('target-1')).toBe('closed');
        });

        it('opens after threshold failures', () => {
            for (let i = 0; i < 5; i++) {
                recordCircuitBreakerFailure('target-1');
            }
            expect(getCircuitBreakerState('target-1')).toBe('open');
        });

        it('success resets to closed', () => {
            for (let i = 0; i < 5; i++) recordCircuitBreakerFailure('target-1');
            recordCircuitBreakerSuccess('target-1');
            expect(getCircuitBreakerState('target-1')).toBe('closed');
        });

        it('resetCircuitBreaker removes entry', () => {
            recordCircuitBreakerFailure('target-1');
            resetCircuitBreaker('target-1');
            expect(getCircuitBreakerState('target-1')).toBe('closed');
        });
    });

    // ─── Delivery Health ───────────────────────────────────────

    describe('delivery health', () => {
        it('healthy when no failures', () => {
            recordDeliveryAttempt({ path: 'direct', success: true });
            expect(checkDeliveryHealth().healthy).toBe(true);
        });

        it('unhealthy with open circuit breaker', () => {
            for (let i = 0; i < 5; i++) recordCircuitBreakerFailure('x');
            expect(checkDeliveryHealth().healthy).toBe(false);
            expect(checkDeliveryHealth().openCircuitBreakers).toContain('x');
        });
    });

    // ─── Audit Trail ───────────────────────────────────────────

    describe('delivery audit trail', () => {
        it('records and retrieves entries', () => {
            recordDeliveryAudit({ announceId: 'a1', targetSessionKey: 'sess-1', path: 'direct', delivered: true, timestamp: Date.now(), retries: 0 });
            recordDeliveryAudit({ announceId: 'a2', targetSessionKey: 'sess-2', path: 'queue', delivered: false, timestamp: Date.now(), retries: 1, error: 'timeout' });
            expect(getDeliveryAuditTrail()).toHaveLength(2);
        });

        it('filters by target key', () => {
            recordDeliveryAudit({ announceId: 'a1', targetSessionKey: 'sess-1', path: 'direct', delivered: true, timestamp: Date.now(), retries: 0 });
            recordDeliveryAudit({ announceId: 'a2', targetSessionKey: 'sess-2', path: 'direct', delivered: true, timestamp: Date.now(), retries: 0 });
            expect(getDeliveryAuditTrail(50, 'sess-1')).toHaveLength(1);
        });

        it('clear returns count', () => {
            recordDeliveryAudit({ announceId: 'a1', targetSessionKey: 's', path: 'd', delivered: true, timestamp: 0, retries: 0 });
            expect(clearDeliveryAuditTrail()).toBe(1);
            expect(getDeliveryAuditTrail()).toHaveLength(0);
        });
    });

    // ─── Retry Logic ───────────────────────────────────────────

    describe('runAnnounceDeliveryWithRetry', () => {
        it('succeeds on first try', async () => {
            const result = await runAnnounceDeliveryWithRetry({
                operation: 'test',
                run: async () => 'ok',
            });
            expect(result).toBe('ok');
        });

        it('throws for permanent error', async () => {
            await expect(runAnnounceDeliveryWithRetry({
                operation: 'test',
                run: async () => { throw new Error('unsupported channel'); },
            })).rejects.toThrow('unsupported channel');
        });
    });
});
