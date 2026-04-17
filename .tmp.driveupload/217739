/**
 * CoreBlow — Subagent Registry Lifecycle (CoreBlow Parity)
 *
 * Start/end transitions, retry logic, grace period handling,
 * frozen result capture, and cleanup orchestration.
 */

import { createChildLogger } from '../../utils/logger.js';
import type { SubagentRunRecord, SubagentRunOutcome } from './subagent-registry-types.js';
import {
    SUBAGENT_ENDED_REASON_COMPLETE,
    type SubagentLifecycleEndedReason,
} from './subagent-lifecycle-events.js';
import { subagentRuns } from './subagent-registry-memory.js';
import { persistSubagentRunsToDisk } from './subagent-registry-state.js';
import {
    markRunEnded,
    markAnnounceHandled,
    shouldRetryAnnounce,
    recordAnnounceRetry,
} from './subagent-registry-helpers.js';
import { emitSubagentEndedHook } from './subagent-registry-completion.js';
import { scheduleArchive, cleanupAttachments } from './subagent-registry-cleanup.js';
import { isActiveRun } from './subagent-registry-queries.js';

const log = createChildLogger('subagent:lifecycle');

// ─── Constants ──────────────────────────────────────────────────

const ANNOUNCE_EXPIRY_MS = 5 * 60 * 1000;
const MAX_ANNOUNCE_RETRY_COUNT = 10;
const MIN_ANNOUNCE_RETRY_DELAY_MS = 5_000;
const FROZEN_RESULT_CAP = 50_000;

function capFrozenResultText(text: string): string {
    return text.length > FROZEN_RESULT_CAP ? text.slice(0, FROZEN_RESULT_CAP) : text;
}

// ─── Lifecycle Controller ───────────────────────────────────────

export type LifecycleControllerParams = {
    onAnnounce?: (params: {
        run: SubagentRunRecord;
        frozenResultText?: string | null;
    }) => Promise<boolean>;
    onEndedHook?: (run: SubagentRunRecord) => Promise<void>;
};

export function createSubagentRegistryLifecycleController(
    controllerParams?: LifecycleControllerParams,
) {
    const persist = () => {
        try { persistSubagentRunsToDisk(subagentRuns); } catch { /* ignore */ }
    };

    /**
     * Freeze the completion text from the child session.
     */
    const freezeRunResultAtCompletion = async (
        entry: SubagentRunRecord,
        resultText?: string,
    ): Promise<boolean> => {
        if (entry.frozenResultText !== undefined) return false;
        try {
            entry.frozenResultText = resultText?.trim()
                ? capFrozenResultText(resultText)
                : null;
        } catch {
            entry.frozenResultText = null;
        }
        entry.frozenResultCapturedAt = Date.now();
        return true;
    };

    /**
     * Complete a subagent run — set ended fields, freeze result,
     * emit hooks, and trigger cleanup flow.
     */
    const completeSubagentRun = async (params: {
        runId: string;
        endedAt?: number;
        outcome: SubagentRunOutcome;
        reason: SubagentLifecycleEndedReason;
        resultText?: string;
        triggerCleanup: boolean;
    }): Promise<void> => {
        const entry = subagentRuns.get(params.runId);
        if (!entry) return;

        let mutated = false;

        // Handle kill-then-complete sequence
        if (
            params.reason === SUBAGENT_ENDED_REASON_COMPLETE &&
            entry.suppressAnnounceReason === 'killed' &&
            (entry.cleanupHandled || typeof entry.cleanupCompletedAt === 'number')
        ) {
            entry.suppressAnnounceReason = undefined;
            entry.cleanupHandled = false;
            entry.cleanupCompletedAt = undefined;
            mutated = true;
        }

        const endedAt = typeof params.endedAt === 'number' ? params.endedAt : Date.now();
        if (entry.endedAt !== endedAt) {
            entry.endedAt = endedAt;
            mutated = true;
        }
        if (entry.outcome !== params.outcome) {
            entry.outcome = params.outcome;
            mutated = true;
        }
        if (entry.endedReason !== params.reason) {
            entry.endedReason = params.reason;
            mutated = true;
        }

        // Accumulate runtime
        if (entry.startedAt) {
            const thisRunMs = endedAt - entry.startedAt;
            entry.accumulatedRuntimeMs = (entry.accumulatedRuntimeMs ?? 0) + thisRunMs;
        }

        // Freeze result
        if (await freezeRunResultAtCompletion(entry, params.resultText)) {
            mutated = true;
        }

        if (mutated) persist();

        // Emit ended hook
        const isSteerSuppressed = entry.suppressAnnounceReason === 'steer-restart';
        if (!isSteerSuppressed) {
            emitSubagentEndedHook(entry);
            if (controllerParams?.onEndedHook) {
                try { await controllerParams.onEndedHook(entry); } catch { /* ignore */ }
            }
        }

        // Trigger cleanup if requested
        if (params.triggerCleanup && !isSteerSuppressed) {
            startAnnounceCleanupFlow(params.runId, entry);
        }

        log.info({
            runId: params.runId,
            outcome: params.outcome,
            reason: params.reason,
        }, 'Subagent run completed');
    };

    /**
     * Start the announce + cleanup flow for a completed run.
     */
    const startAnnounceCleanupFlow = (runId: string, entry: SubagentRunRecord): boolean => {
        if (entry.cleanupCompletedAt || entry.cleanupHandled) return false;
        entry.cleanupHandled = true;
        persist();

        // Attempt announce delivery
        if (controllerParams?.onAnnounce) {
            controllerParams.onAnnounce({
                run: entry,
                frozenResultText: entry.frozenResultText,
            })
                .then(didAnnounce => {
                    finalizeSubagentCleanup(runId, entry.cleanup, didAnnounce);
                })
                .catch(() => {
                    finalizeSubagentCleanup(runId, entry.cleanup, false);
                });
        } else {
            // No announce handler — complete immediately
            finalizeSubagentCleanup(runId, entry.cleanup, true);
        }
        return true;
    };

    /**
     * Finalize cleanup after announce attempt.
     */
    const finalizeSubagentCleanup = (
        runId: string,
        cleanup: 'delete' | 'keep',
        didAnnounce: boolean,
    ): void => {
        const entry = subagentRuns.get(runId);
        if (!entry) return;

        if (didAnnounce) {
            // Successful announce — complete cleanup
            entry.wakeOnDescendantSettle = undefined;
            entry.fallbackFrozenResultText = undefined;
            entry.fallbackFrozenResultCapturedAt = undefined;

            const shouldDeleteAttachments = cleanup === 'delete' || !entry.retainAttachmentsOnKeep;
            if (shouldDeleteAttachments) {
                cleanupAttachments(entry);
            }

            completeCleanupBookkeeping({ runId, entry, cleanup, completedAt: Date.now() });
            return;
        }

        // Announce failed — check retry eligibility
        if (shouldRetryAnnounce(entry, {
            maxRetries: MAX_ANNOUNCE_RETRY_COUNT,
            backoffMs: MIN_ANNOUNCE_RETRY_DELAY_MS,
        })) {
            recordAnnounceRetry(entry);
            entry.cleanupHandled = false;
            persist();

            // Schedule retry
            const delay = MIN_ANNOUNCE_RETRY_DELAY_MS * Math.pow(2, entry.announceRetryCount ?? 0);
            setTimeout(() => {
                const current = subagentRuns.get(runId);
                if (current && !current.cleanupCompletedAt && !current.cleanupHandled) {
                    startAnnounceCleanupFlow(runId, current);
                }
            }, delay).unref?.();
            return;
        }

        // Give up — finalize
        entry.wakeOnDescendantSettle = undefined;
        entry.fallbackFrozenResultText = undefined;
        const shouldDeleteAttachments = cleanup === 'delete' || !entry.retainAttachmentsOnKeep;
        if (shouldDeleteAttachments) {
            cleanupAttachments(entry);
        }
        log.warn({ runId, retryCount: entry.announceRetryCount }, 'Announce give-up');
        completeCleanupBookkeeping({ runId, entry, cleanup, completedAt: Date.now() });
    };

    /**
     * Complete bookkeeping — either delete run or mark archived.
     */
    const completeCleanupBookkeeping = (params: {
        runId: string;
        entry: SubagentRunRecord;
        cleanup: 'delete' | 'keep';
        completedAt: number;
    }): void => {
        if (params.cleanup === 'delete') {
            subagentRuns.delete(params.runId);
            persist();
            retryDeferredAnnounces(params.runId);
            return;
        }
        params.entry.cleanupCompletedAt = params.completedAt;
        scheduleArchive(params.entry);
        persist();
        retryDeferredAnnounces(params.runId);
    };

    /**
     * Retry deferred announces after a slot frees up.
     */
    const retryDeferredAnnounces = (excludeRunId?: string): void => {
        const now = Date.now();
        for (const [runId, entry] of subagentRuns.entries()) {
            if (excludeRunId && runId === excludeRunId) continue;
            if (typeof entry.endedAt !== 'number') continue;
            if (entry.cleanupCompletedAt || entry.cleanupHandled) continue;
            if (entry.suppressAnnounceReason) continue;
            const endedAgo = now - (entry.endedAt ?? now);
            if (endedAgo > ANNOUNCE_EXPIRY_MS) {
                // Expired — force cleanup
                markAnnounceHandled(entry, now);
                cleanupAttachments(entry);
                completeCleanupBookkeeping({ runId, entry, cleanup: entry.cleanup, completedAt: now });
                continue;
            }
            // Retry announce
            startAnnounceCleanupFlow(runId, entry);
        }
    };

    /**
     * Refresh frozen result text from an updated session.
     */
    const refreshFrozenResultFromSession = (
        sessionKey: string,
        newResultText: string,
    ): boolean => {
        let changed = false;
        for (const entry of subagentRuns.values()) {
            if (entry.childSessionKey !== sessionKey) continue;
            if (entry.expectsCompletionMessage !== true) continue;
            if (typeof entry.endedAt !== 'number') continue;
            if (typeof entry.cleanupCompletedAt === 'number') continue;

            const capped = capFrozenResultText(newResultText);
            if (entry.frozenResultText !== capped) {
                entry.frozenResultText = capped;
                entry.frozenResultCapturedAt = Date.now();
                changed = true;
            }
        }
        if (changed) persist();
        return changed;
    };

    return {
        completeSubagentRun,
        completeCleanupBookkeeping,
        startAnnounceCleanupFlow,
        refreshFrozenResultFromSession,
        freezeRunResultAtCompletion,
    };
}

// ─── Lifecycle Metrics ──────────────────────────────────────────

export type LifecycleMetrics = {
    totalCompleted: number;
    totalFailed: number;
    totalTimedOut: number;
    totalKilled: number;
    totalRetries: number;
    avgCompletionMs: number;
    avgCleanupMs: number;
};

const lifecycleMetrics: LifecycleMetrics = {
    totalCompleted: 0,
    totalFailed: 0,
    totalTimedOut: 0,
    totalKilled: 0,
    totalRetries: 0,
    avgCompletionMs: 0,
    avgCleanupMs: 0,
};

let totalCompletionDuration = 0;
let completionDurationCount = 0;
let totalCleanupDuration = 0;
let cleanupDurationCount = 0;

export function recordLifecycleCompletion(params: {
    outcome: string;
    completionMs?: number;
    cleanupMs?: number;
    retried?: boolean;
}): void {
    switch (params.outcome) {
        case 'completed': lifecycleMetrics.totalCompleted++; break;
        case 'error': lifecycleMetrics.totalFailed++; break;
        case 'timeout': lifecycleMetrics.totalTimedOut++; break;
        case 'killed': lifecycleMetrics.totalKilled++; break;
    }
    if (params.retried) lifecycleMetrics.totalRetries++;
    if (params.completionMs !== undefined) {
        totalCompletionDuration += params.completionMs;
        completionDurationCount++;
        lifecycleMetrics.avgCompletionMs = Math.round(totalCompletionDuration / completionDurationCount);
    }
    if (params.cleanupMs !== undefined) {
        totalCleanupDuration += params.cleanupMs;
        cleanupDurationCount++;
        lifecycleMetrics.avgCleanupMs = Math.round(totalCleanupDuration / cleanupDurationCount);
    }
}

export function getLifecycleMetrics(): LifecycleMetrics {
    return { ...lifecycleMetrics };
}

export function resetLifecycleMetrics(): void {
    lifecycleMetrics.totalCompleted = 0;
    lifecycleMetrics.totalFailed = 0;
    lifecycleMetrics.totalTimedOut = 0;
    lifecycleMetrics.totalKilled = 0;
    lifecycleMetrics.totalRetries = 0;
    lifecycleMetrics.avgCompletionMs = 0;
    lifecycleMetrics.avgCleanupMs = 0;
    totalCompletionDuration = 0;
    completionDurationCount = 0;
    totalCleanupDuration = 0;
    cleanupDurationCount = 0;
}

export function formatLifecycleMetrics(metrics: LifecycleMetrics): string {
    return [
        `Completed: ${metrics.totalCompleted}`,
        `Failed: ${metrics.totalFailed}`,
        `Timed out: ${metrics.totalTimedOut}`,
        `Killed: ${metrics.totalKilled}`,
        `Retries: ${metrics.totalRetries}`,
        `Avg completion: ${(metrics.avgCompletionMs / 1000).toFixed(1)}s`,
        `Avg cleanup: ${(metrics.avgCleanupMs / 1000).toFixed(1)}s`,
    ].join(' | ');
}

// ─── Grace Period Management ────────────────────────────────────

export type GracePeriodConfig = {
    defaultMs: number;
    maxMs: number;
    perOutcome?: Record<string, number>;
};

const DEFAULT_GRACE_CONFIG: GracePeriodConfig = {
    defaultMs: 30_000,
    maxMs: 300_000,
    perOutcome: {
        timeout: 60_000,
        error: 15_000,
        killed: 5_000,
    },
};

export function resolveGracePeriodMs(
    outcome: string,
    config?: GracePeriodConfig,
): number {
    const cfg = config ?? DEFAULT_GRACE_CONFIG;
    const perOutcome = cfg.perOutcome?.[outcome];
    const value = perOutcome ?? cfg.defaultMs;
    return Math.min(value, cfg.maxMs);
}

// ─── Bulk Completion ────────────────────────────────────────────

export type BulkCompletionResult = {
    total: number;
    completed: number;
    skipped: number;
    errors: number;
};

export function bulkMarkRunsEnded(params: {
    runIds: string[];
    outcome: SubagentRunOutcome;
    reason: SubagentLifecycleEndedReason;
    now?: number;
}): BulkCompletionResult {
    const now = params.now ?? Date.now();
    const result: BulkCompletionResult = {
        total: params.runIds.length,
        completed: 0,
        skipped: 0,
        errors: 0,
    };

    for (const runId of params.runIds) {
        const entry = subagentRuns.get(runId);
        if (!entry) {
            result.skipped++;
            continue;
        }
        if (entry.endedAt) {
            result.skipped++;
            continue;
        }
        try {
            markRunEnded({
                run: entry,
                outcome: params.outcome,
                reason: params.reason,
                now,
            });
            result.completed++;
        } catch {
            result.errors++;
        }
    }

    if (result.completed > 0) {
        persistSubagentRunsToDisk(subagentRuns);
    }
    return result;
}

// ─── Lifecycle Diagnostics ──────────────────────────────────────

export type LifecycleDiagnostics = {
    pendingCleanup: number;
    pendingAnnounce: number;
    staleFrozenResults: number;
    expiredRuns: number;
};

export function getLifecycleDiagnostics(now?: number): LifecycleDiagnostics {
    const time = now ?? Date.now();
    const diag: LifecycleDiagnostics = {
        pendingCleanup: 0,
        pendingAnnounce: 0,
        staleFrozenResults: 0,
        expiredRuns: 0,
    };

    for (const entry of subagentRuns.values()) {
        if (entry.endedAt && !entry.cleanupCompletedAt) {
            diag.pendingCleanup++;
            if (!entry.cleanupHandled) diag.pendingAnnounce++;
        }
        if (entry.frozenResultCapturedAt && time - entry.frozenResultCapturedAt > ANNOUNCE_EXPIRY_MS) {
            diag.staleFrozenResults++;
        }
        if (entry.endedAt && time - entry.endedAt > ANNOUNCE_EXPIRY_MS * 2) {
            if (!entry.cleanupCompletedAt) diag.expiredRuns++;
        }
    }

    return diag;
}
