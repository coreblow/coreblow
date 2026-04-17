/**
 * CoreBlow — Subagent Announce Delivery (CoreBlow Parity)
 *
 * Direct and queued delivery with transient error retry,
 * requester/origin resolution, and announce timeout handling.
 */

import { createChildLogger } from '../../utils/logger.js';
import type { DeliveryContext } from './subagent-registry-types.js';
import {
    runSubagentAnnounceDispatch,
    type SubagentAnnounceDeliveryResult,
} from './subagent-announce-dispatch.js';
import {
    enqueueAnnounce,
    type AnnounceQueueItem,
    type AnnounceQueueSettings,
} from './subagent-announce-queue.js';

const log = createChildLogger('subagent:announce-delivery');

// ─── Constants ──────────────────────────────────────────────────

const DEFAULT_ANNOUNCE_TIMEOUT_MS = 90_000;
const MAX_TIMER_SAFE_TIMEOUT_MS = 2_147_000_000;

const TRANSIENT_RETRY_DELAYS_MS = [5_000, 10_000, 20_000] as const;

const TRANSIENT_ERROR_PATTERNS: readonly RegExp[] = [
    /\berrorcode=unavailable\b/i,
    /\bUNAVAILABLE\b/,
    /no active .* listener/i,
    /gateway not connected/i,
    /gateway closed/i,
    /gateway timeout/i,
    /\b(econnreset|econnrefused|etimedout|enotfound|ehostunreach|network error)\b/i,
];

const PERMANENT_ERROR_PATTERNS: readonly RegExp[] = [
    /unsupported channel/i,
    /unknown channel/i,
    /chat not found/i,
    /user not found/i,
    /bot.*not.*member/i,
    /bot was blocked/i,
    /forbidden/i,
    /recipient is not valid/i,
    /outbound not configured/i,
];

// ─── Error Helpers ──────────────────────────────────────────────

function summarizeDeliveryError(error: unknown): string {
    if (error instanceof Error) return error.message || 'error';
    if (typeof error === 'string') return error;
    if (error === undefined || error === null) return 'unknown error';
    try { return JSON.stringify(error); } catch { return 'error'; }
}

function isTransientError(error: unknown): boolean {
    const message = summarizeDeliveryError(error);
    if (!message) return false;
    if (PERMANENT_ERROR_PATTERNS.some(re => re.test(message))) return false;
    return TRANSIENT_ERROR_PATTERNS.some(re => re.test(message));
}

// ─── Retry With Backoff ─────────────────────────────────────────

async function waitForRetryDelay(ms: number, signal?: AbortSignal): Promise<void> {
    if (ms <= 0) return;
    if (signal?.aborted) return;
    await new Promise<void>(resolve => {
        const timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        const onAbort = () => {
            clearTimeout(timer);
            signal?.removeEventListener('abort', onAbort);
            resolve();
        };
        if (signal) signal.addEventListener('abort', onAbort, { once: true });
    });
}

export async function runAnnounceDeliveryWithRetry<T>(params: {
    operation: string;
    signal?: AbortSignal;
    run: () => Promise<T>;
}): Promise<T> {
    let retryIndex = 0;
    for (;;) {
        if (params.signal?.aborted) throw new Error('announce delivery aborted');
        try {
            return await params.run();
        } catch (err) {
            const delayMs = TRANSIENT_RETRY_DELAYS_MS[retryIndex];
            if (delayMs == null || !isTransientError(err) || params.signal?.aborted) throw err;
            log.warn({
                operation: params.operation,
                attempt: retryIndex + 2,
                maxAttempts: TRANSIENT_RETRY_DELAYS_MS.length + 1,
                error: summarizeDeliveryError(err),
            }, 'Transient delivery failure, retrying');
            retryIndex++;
            await waitForRetryDelay(delayMs, params.signal);
        }
    }
}

// ─── Timeout Resolution ─────────────────────────────────────────

export function resolveAnnounceTimeoutMs(configValue?: number): number {
    if (typeof configValue !== 'number' || !Number.isFinite(configValue)) {
        return DEFAULT_ANNOUNCE_TIMEOUT_MS;
    }
    return Math.min(Math.max(1, Math.floor(configValue)), MAX_TIMER_SAFE_TIMEOUT_MS);
}

// ─── Origin Resolution ─────────────────────────────────────────

export function resolveAnnounceOrigin(
    sessionEntry?: { channel?: string; lastChannel?: string; to?: string; threadId?: string | number },
    requesterOrigin?: DeliveryContext,
): DeliveryContext | undefined {
    if (!requesterOrigin && !sessionEntry) return undefined;
    return {
        channel: requesterOrigin?.channel || sessionEntry?.channel || sessionEntry?.lastChannel,
        to: requesterOrigin?.to || sessionEntry?.to,
        threadId: requesterOrigin?.threadId ?? sessionEntry?.threadId,
        accountId: requesterOrigin?.accountId,
    };
}

// ─── Idempotency ────────────────────────────────────────────────

export function buildAnnounceIdempotencyKey(announceId: string): string {
    return `announce:${announceId}`;
}

export function buildAnnounceIdFromChildRun(params: {
    childSessionKey: string;
    childRunId: string;
}): string {
    return `${params.childSessionKey}:${params.childRunId}`;
}

// ─── Queue Delivery ─────────────────────────────────────────────

function buildAnnounceQueueKey(sessionKey: string, origin?: DeliveryContext): string {
    const accountId = origin?.accountId?.trim();
    if (!accountId) return sessionKey;
    return `${sessionKey}:acct:${accountId}`;
}

async function maybeQueueAnnounce(params: {
    requesterSessionKey: string;
    announceId?: string;
    triggerMessage: string;
    steerMessage: string;
    summaryLine?: string;
    requesterOrigin?: DeliveryContext;
    sourceSessionKey?: string;
    sourceChannel?: string;
    sourceTool?: string;
    internalEvents?: Array<{ type: string; [key: string]: unknown }>;
    signal?: AbortSignal;
    queueSettings?: AnnounceQueueSettings;
    send?: (item: AnnounceQueueItem) => Promise<void>;
}): Promise<'steered' | 'queued' | 'none' | 'dropped'> {
    if (params.signal?.aborted) return 'none';

    const settings: AnnounceQueueSettings = params.queueSettings ?? {
        mode: 'followup',
        debounceMs: 1000,
        cap: 20,
        dropPolicy: 'summarize',
    };

    const origin = params.requesterOrigin;
    const key = buildAnnounceQueueKey(params.requesterSessionKey, origin);
    const send = params.send ?? (async (_item: AnnounceQueueItem) => {
        log.info({ key }, 'Announce sent (default handler)');
    });

    const didQueue = enqueueAnnounce({
        key,
        item: {
            announceId: params.announceId,
            prompt: params.triggerMessage,
            summaryLine: params.summaryLine,
            internalEvents: params.internalEvents,
            enqueuedAt: Date.now(),
            sessionKey: params.requesterSessionKey,
            origin,
            sourceSessionKey: params.sourceSessionKey,
            sourceChannel: params.sourceChannel,
            sourceTool: params.sourceTool,
        },
        settings,
        send,
    });
    return didQueue ? 'queued' : 'dropped';
}

// ─── Direct Delivery ────────────────────────────────────────────

async function sendAnnounceDirect(params: {
    targetRequesterSessionKey: string;
    triggerMessage: string;
    internalEvents?: Array<{ type: string; [key: string]: unknown }>;
    expectsCompletionMessage: boolean;
    directIdempotencyKey: string;
    directOrigin?: DeliveryContext;
    completionDirectOrigin?: DeliveryContext;
    sourceSessionKey?: string;
    sourceChannel?: string;
    sourceTool?: string;
    requesterIsSubagent: boolean;
    signal?: AbortSignal;
    callGateway?: (params: Record<string, unknown>) => Promise<unknown>;
}): Promise<SubagentAnnounceDeliveryResult> {
    if (params.signal?.aborted) return { delivered: false, path: 'none' };

    if (!params.callGateway) {
        // No gateway: mark as delivered for registry-only scenarios
        log.info({
            target: params.targetRequesterSessionKey,
        }, 'Direct announce (no gateway)');
        return { delivered: true, path: 'direct' };
    }

    const origin = params.expectsCompletionMessage && params.completionDirectOrigin
        ? params.completionDirectOrigin : params.directOrigin;

    try {
        await runAnnounceDeliveryWithRetry({
            operation: params.expectsCompletionMessage
                ? 'completion direct announce' : 'direct announce',
            signal: params.signal,
            run: async () => params.callGateway!({
                method: 'agent',
                params: {
                    sessionKey: params.targetRequesterSessionKey,
                    message: params.triggerMessage,
                    deliver: !params.requesterIsSubagent,
                    internalEvents: params.internalEvents,
                    channel: !params.requesterIsSubagent ? origin?.channel : undefined,
                    accountId: !params.requesterIsSubagent ? origin?.accountId : undefined,
                    to: !params.requesterIsSubagent ? origin?.to : undefined,
                    threadId: !params.requesterIsSubagent
                        ? (origin?.threadId != null ? String(origin.threadId) : undefined)
                        : undefined,
                    inputProvenance: {
                        kind: 'inter_session',
                        sourceSessionKey: params.sourceSessionKey,
                        sourceChannel: params.sourceChannel ?? 'internal',
                        sourceTool: params.sourceTool ?? 'subagent_announce',
                    },
                    idempotencyKey: params.directIdempotencyKey,
                },
                timeoutMs: DEFAULT_ANNOUNCE_TIMEOUT_MS,
            }),
        });
        return { delivered: true, path: 'direct' };
    } catch (err) {
        return { delivered: false, path: 'direct', error: summarizeDeliveryError(err) };
    }
}

// ─── Combined Delivery ──────────────────────────────────────────

export async function deliverSubagentAnnouncement(params: {
    requesterSessionKey: string;
    announceId?: string;
    triggerMessage: string;
    steerMessage: string;
    internalEvents?: Array<{ type: string; [key: string]: unknown }>;
    summaryLine?: string;
    requesterOrigin?: DeliveryContext;
    completionDirectOrigin?: DeliveryContext;
    directOrigin?: DeliveryContext;
    sourceSessionKey?: string;
    sourceChannel?: string;
    sourceTool?: string;
    targetRequesterSessionKey: string;
    requesterIsSubagent: boolean;
    expectsCompletionMessage: boolean;
    bestEffortDeliver?: boolean;
    directIdempotencyKey: string;
    signal?: AbortSignal;
    callGateway?: (params: Record<string, unknown>) => Promise<unknown>;
    queueSettings?: AnnounceQueueSettings;
    queueSend?: (item: AnnounceQueueItem) => Promise<void>;
}): Promise<SubagentAnnounceDeliveryResult> {
    return await runSubagentAnnounceDispatch({
        expectsCompletionMessage: params.expectsCompletionMessage,
        signal: params.signal,
        queue: async () => await maybeQueueAnnounce({
            requesterSessionKey: params.requesterSessionKey,
            announceId: params.announceId,
            triggerMessage: params.triggerMessage,
            steerMessage: params.steerMessage,
            summaryLine: params.summaryLine,
            requesterOrigin: params.requesterOrigin,
            sourceSessionKey: params.sourceSessionKey,
            sourceChannel: params.sourceChannel,
            sourceTool: params.sourceTool,
            internalEvents: params.internalEvents,
            signal: params.signal,
            queueSettings: params.queueSettings,
            send: params.queueSend,
        }),
        direct: async () => await sendAnnounceDirect({
            targetRequesterSessionKey: params.targetRequesterSessionKey,
            triggerMessage: params.triggerMessage,
            internalEvents: params.internalEvents,
            expectsCompletionMessage: params.expectsCompletionMessage,
            directIdempotencyKey: params.directIdempotencyKey,
            completionDirectOrigin: params.completionDirectOrigin,
            directOrigin: params.directOrigin,
            sourceSessionKey: params.sourceSessionKey,
            sourceChannel: params.sourceChannel,
            sourceTool: params.sourceTool,
            requesterIsSubagent: params.requesterIsSubagent,
            signal: params.signal,
            callGateway: params.callGateway,
        }),
    });
}

// ─── Delivery Metrics ───────────────────────────────────────────

export type DeliveryMetrics = {
    totalAttempts: number;
    directSuccess: number;
    directFailure: number;
    queuedSuccess: number;
    queuedFailure: number;
    retriesTotal: number;
    transientErrors: number;
    permanentErrors: number;
    avgDeliveryMs: number;
};

const deliveryMetrics: DeliveryMetrics = {
    totalAttempts: 0,
    directSuccess: 0,
    directFailure: 0,
    queuedSuccess: 0,
    queuedFailure: 0,
    retriesTotal: 0,
    transientErrors: 0,
    permanentErrors: 0,
    avgDeliveryMs: 0,
};

let totalDeliveryDuration = 0;
let deliveryDurationCount = 0;

export function recordDeliveryAttempt(params: {
    path: 'direct' | 'queued';
    success: boolean;
    durationMs?: number;
    isTransient?: boolean;
    retryCount?: number;
}): void {
    deliveryMetrics.totalAttempts++;
    if (params.path === 'direct') {
        if (params.success) deliveryMetrics.directSuccess++;
        else deliveryMetrics.directFailure++;
    } else {
        if (params.success) deliveryMetrics.queuedSuccess++;
        else deliveryMetrics.queuedFailure++;
    }
    if (params.retryCount) deliveryMetrics.retriesTotal += params.retryCount;
    if (!params.success) {
        if (params.isTransient) deliveryMetrics.transientErrors++;
        else deliveryMetrics.permanentErrors++;
    }
    if (params.durationMs !== undefined) {
        totalDeliveryDuration += params.durationMs;
        deliveryDurationCount++;
        deliveryMetrics.avgDeliveryMs = Math.round(totalDeliveryDuration / deliveryDurationCount);
    }
}

export function getDeliveryMetrics(): DeliveryMetrics {
    return { ...deliveryMetrics };
}

export function resetDeliveryMetrics(): void {
    deliveryMetrics.totalAttempts = 0;
    deliveryMetrics.directSuccess = 0;
    deliveryMetrics.directFailure = 0;
    deliveryMetrics.queuedSuccess = 0;
    deliveryMetrics.queuedFailure = 0;
    deliveryMetrics.retriesTotal = 0;
    deliveryMetrics.transientErrors = 0;
    deliveryMetrics.permanentErrors = 0;
    deliveryMetrics.avgDeliveryMs = 0;
    totalDeliveryDuration = 0;
    deliveryDurationCount = 0;
}

export function formatDeliveryMetrics(metrics: DeliveryMetrics): string {
    return [
        `Total: ${metrics.totalAttempts}`,
        `Direct OK: ${metrics.directSuccess}`,
        `Direct Fail: ${metrics.directFailure}`,
        `Queued OK: ${metrics.queuedSuccess}`,
        `Queued Fail: ${metrics.queuedFailure}`,
        `Retries: ${metrics.retriesTotal}`,
        `Avg: ${(metrics.avgDeliveryMs / 1000).toFixed(1)}s`,
    ].join(' | ');
}

// ─── Circuit Breaker ────────────────────────────────────────────

export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

export type CircuitBreakerConfig = {
    failureThreshold: number;
    resetTimeMs: number;
    halfOpenAttempts: number;
};

const circuitBreakers = new Map<string, {
    state: CircuitBreakerState;
    failureCount: number;
    lastFailureAt: number;
    halfOpenAttempts: number;
}>();

export function getCircuitBreakerState(targetKey: string, config?: CircuitBreakerConfig): CircuitBreakerState {
    const cb = circuitBreakers.get(targetKey);
    if (!cb) return 'closed';

    const resetTimeMs = config?.resetTimeMs ?? 60_000;
    if (cb.state === 'open' && Date.now() - cb.lastFailureAt > resetTimeMs) {
        cb.state = 'half-open';
        cb.halfOpenAttempts = 0;
    }
    return cb.state;
}

export function recordCircuitBreakerSuccess(targetKey: string): void {
    const cb = circuitBreakers.get(targetKey);
    if (cb) {
        cb.state = 'closed';
        cb.failureCount = 0;
        cb.halfOpenAttempts = 0;
    }
}

export function recordCircuitBreakerFailure(targetKey: string, config?: CircuitBreakerConfig): void {
    const threshold = config?.failureThreshold ?? 5;
    let cb = circuitBreakers.get(targetKey);
    if (!cb) {
        cb = { state: 'closed', failureCount: 0, lastFailureAt: 0, halfOpenAttempts: 0 };
        circuitBreakers.set(targetKey, cb);
    }

    cb.failureCount++;
    cb.lastFailureAt = Date.now();

    if (cb.failureCount >= threshold) {
        cb.state = 'open';
        log.warn({ targetKey, failureCount: cb.failureCount }, 'Circuit breaker opened');
    }
}

export function resetCircuitBreaker(targetKey: string): void {
    circuitBreakers.delete(targetKey);
}

export function resetAllCircuitBreakers(): void {
    circuitBreakers.clear();
}

// ─── Delivery Health Check ──────────────────────────────────────

export type DeliveryHealthStatus = {
    healthy: boolean;
    openCircuitBreakers: string[];
    failureRate: number;
    recentErrors: number;
};

export function checkDeliveryHealth(): DeliveryHealthStatus {
    const openBreakers: string[] = [];
    for (const [key, cb] of circuitBreakers) {
        if (cb.state === 'open') openBreakers.push(key);
    }

    const totalAttempts = deliveryMetrics.totalAttempts || 1;
    const failureRate = (deliveryMetrics.directFailure + deliveryMetrics.queuedFailure) / totalAttempts;

    return {
        healthy: openBreakers.length === 0 && failureRate < 0.5,
        openCircuitBreakers: openBreakers,
        failureRate,
        recentErrors: deliveryMetrics.transientErrors + deliveryMetrics.permanentErrors,
    };
}

// ─── Delivery Audit Trail ───────────────────────────────────────

export type DeliveryAuditEntry = {
    announceId: string;
    targetSessionKey: string;
    path: string;
    delivered: boolean;
    timestamp: number;
    durationMs?: number;
    retries: number;
    error?: string;
};

const deliveryAuditTrail: DeliveryAuditEntry[] = [];
const MAX_AUDIT_ENTRIES = 1000;

export function recordDeliveryAudit(entry: DeliveryAuditEntry): void {
    deliveryAuditTrail.push(entry);
    if (deliveryAuditTrail.length > MAX_AUDIT_ENTRIES) {
        deliveryAuditTrail.splice(0, deliveryAuditTrail.length - MAX_AUDIT_ENTRIES);
    }
}

export function getDeliveryAuditTrail(limit = 50, targetKey?: string): DeliveryAuditEntry[] {
    let entries = targetKey
        ? deliveryAuditTrail.filter(e => e.targetSessionKey === targetKey)
        : deliveryAuditTrail;
    return entries.slice(-limit);
}

export function clearDeliveryAuditTrail(): number {
    const count = deliveryAuditTrail.length;
    deliveryAuditTrail.length = 0;
    return count;
}

// ─── Message Routing Helpers ────────────────────────────────────

export function resolveDeliveryPath(params: {
    expectsCompletionMessage: boolean;
    requesterIsSubagent: boolean;
    hasGateway: boolean;
}): 'direct' | 'queue' | 'none' {
    if (!params.hasGateway) return 'none';
    if (params.expectsCompletionMessage) return 'direct';
    if (params.requesterIsSubagent) return 'direct';
    return 'queue';
}

export function buildDeliveryPayload(params: {
    sessionKey: string;
    message: string;
    deliver: boolean;
    channel?: string;
    accountId?: string;
    to?: string;
    threadId?: string;
    sourceSessionKey?: string;
    idempotencyKey: string;
}): Record<string, unknown> {
    return {
        method: 'agent',
        params: {
            sessionKey: params.sessionKey,
            message: params.message,
            deliver: params.deliver,
            channel: params.channel,
            accountId: params.accountId,
            to: params.to,
            threadId: params.threadId,
            inputProvenance: {
                kind: 'inter_session',
                sourceSessionKey: params.sourceSessionKey,
                sourceChannel: 'internal',
                sourceTool: 'subagent_announce',
            },
            idempotencyKey: params.idempotencyKey,
        },
        timeoutMs: DEFAULT_ANNOUNCE_TIMEOUT_MS,
    };
}
