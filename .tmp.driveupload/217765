/**
 * agents/subagent/subagent-registry-helpers.ts
 * Helper utilities for the subagent registry.
 */

import crypto from 'node:crypto';
import type { SubagentRunRecord, SubagentRunOutcome } from './subagent-registry-types.js';
import type { SubagentLifecycleEndedReason } from './subagent-lifecycle-events.js';
import { subagentRuns } from './subagent-registry-memory.js';

export function generateRunId(): string {
    return crypto.randomUUID();
}

export function markRunEnded(params: {
    run: SubagentRunRecord;
    outcome: SubagentRunOutcome;
    reason: SubagentLifecycleEndedReason;
    now?: number;
}): void {
    const now = params.now ?? Date.now();
    params.run.endedAt = now;
    params.run.outcome = params.outcome;
    params.run.endedReason = params.reason;
}

export function markAnnounceHandled(run: SubagentRunRecord, now?: number): void {
    run.cleanupHandled = true;
    run.cleanupCompletedAt = now ?? Date.now();
}

export function shouldRetryAnnounce(run: SubagentRunRecord, opts: {
    maxRetries: number;
    backoffMs: number;
}): boolean {
    const count = run.announceRetryCount ?? 0;
    if (count >= opts.maxRetries) return false;
    const lastRetry = run.lastAnnounceRetryAt ?? 0;
    const elapsed = Date.now() - lastRetry;
    return elapsed >= opts.backoffMs * Math.pow(2, count);
}

export function recordAnnounceRetry(run: SubagentRunRecord): void {
    run.announceRetryCount = (run.announceRetryCount ?? 0) + 1;
    run.lastAnnounceRetryAt = Date.now();
}

export function detectOrphanedRuns(params: {
    activeSessionKeys: Set<string>;
    gracePeriodMs: number;
    now?: number;
}): SubagentRunRecord[] {
    const now = params.now ?? Date.now();
    const orphans: SubagentRunRecord[] = [];
    for (const run of subagentRuns.values()) {
        if (typeof run.endedAt === 'number') continue;
        if (params.activeSessionKeys.has(run.childSessionKey)) continue;
        const age = now - run.createdAt;
        if (age > params.gracePeriodMs) orphans.push(run);
    }
    return orphans;
}

export function cascadeEndDescendants(params: {
    parentSessionKey: string;
    outcome: SubagentRunOutcome;
    reason: SubagentLifecycleEndedReason;
    suppressAnnounce?: boolean;
    now?: number;
}): number {
    const now = params.now ?? Date.now();
    let count = 0;
    for (const run of subagentRuns.values()) {
        if (run.requesterSessionKey !== params.parentSessionKey) continue;
        if (typeof run.endedAt === 'number') continue;
        markRunEnded({ run, outcome: params.outcome, reason: params.reason, now });
        if (params.suppressAnnounce) run.suppressAnnounceReason = 'killed';
        count++;
    }
    return count;
}
