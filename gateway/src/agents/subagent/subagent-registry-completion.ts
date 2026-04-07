/**
 * CoreBlow — Subagent Registry Completion (CoreBlow Parity)
 *
 * Emit ended hook and resolve outcome for completed runs.
 */

import { createChildLogger } from '../../utils/logger.js';
import type { SubagentRunRecord, SubagentRunOutcome } from './subagent-registry-types.js';
import {
    SUBAGENT_ENDED_OUTCOME_OK,
    SUBAGENT_ENDED_OUTCOME_ERROR,
    SUBAGENT_ENDED_OUTCOME_TIMEOUT,
    SUBAGENT_ENDED_OUTCOME_KILLED,
    SUBAGENT_ENDED_OUTCOME_RESET,
    SUBAGENT_ENDED_OUTCOME_DELETED,
    SUBAGENT_ENDED_REASON_COMPLETE,
    SUBAGENT_ENDED_REASON_ERROR,
    SUBAGENT_ENDED_REASON_KILLED,
    SUBAGENT_ENDED_REASON_SESSION_RESET,
    SUBAGENT_ENDED_REASON_SESSION_DELETE,
    type SubagentLifecycleEndedReason,
    type SubagentLifecycleEndedOutcome,
} from './subagent-lifecycle-events.js';

const log = createChildLogger('subagent:completion');

// ─── Outcome Resolution ─────────────────────────────────────────

export function resolveOutcomeFromEndedReason(
    reason: SubagentLifecycleEndedReason,
): SubagentRunOutcome {
    switch (reason) {
        case SUBAGENT_ENDED_REASON_COMPLETE:
            return 'completed';
        case SUBAGENT_ENDED_REASON_ERROR:
            return 'error';
        case SUBAGENT_ENDED_REASON_KILLED:
            return 'killed';
        case SUBAGENT_ENDED_REASON_SESSION_RESET:
            return 'reset';
        case SUBAGENT_ENDED_REASON_SESSION_DELETE:
            return 'deleted';
        default:
            return 'error';
    }
}

export function resolveLifecycleOutcomeFromRunOutcome(
    outcome: SubagentRunOutcome,
): SubagentLifecycleEndedOutcome {
    switch (outcome) {
        case 'completed':
            return SUBAGENT_ENDED_OUTCOME_OK;
        case 'error':
            return SUBAGENT_ENDED_OUTCOME_ERROR;
        case 'timeout':
            return SUBAGENT_ENDED_OUTCOME_TIMEOUT;
        case 'killed':
            return SUBAGENT_ENDED_OUTCOME_KILLED;
        case 'reset':
            return SUBAGENT_ENDED_OUTCOME_RESET;
        case 'deleted':
            return SUBAGENT_ENDED_OUTCOME_DELETED;
        default:
            return SUBAGENT_ENDED_OUTCOME_ERROR;
    }
}

// ─── Ended Hook ─────────────────────────────────────────────────

export type SubagentEndedHookPayload = {
    runId: string;
    childSessionKey: string;
    requesterSessionKey: string;
    outcome: SubagentRunOutcome;
    endedReason: SubagentLifecycleEndedReason;
    durationMs: number;
    task: string;
    label?: string;
    frozenResultText?: string | null;
};

const endedHookListeners: Array<(payload: SubagentEndedHookPayload) => void> = [];

export function onSubagentEnded(listener: (payload: SubagentEndedHookPayload) => void): () => void {
    endedHookListeners.push(listener);
    return () => {
        const idx = endedHookListeners.indexOf(listener);
        if (idx >= 0) endedHookListeners.splice(idx, 1);
    };
}

export function emitSubagentEndedHook(run: SubagentRunRecord): boolean {
    if (run.endedHookEmittedAt) return false;
    if (!run.endedAt || !run.outcome) return false;

    // Infer endedReason from outcome if not explicitly set
    const endedReason = run.endedReason ?? (() => {
        switch (run.outcome) {
            case 'completed': return SUBAGENT_ENDED_REASON_COMPLETE;
            case 'killed': return SUBAGENT_ENDED_REASON_KILLED;
            case 'error': return SUBAGENT_ENDED_REASON_ERROR;
            case 'reset': return SUBAGENT_ENDED_REASON_SESSION_RESET;
            case 'deleted': return SUBAGENT_ENDED_REASON_SESSION_DELETE;
            default: return SUBAGENT_ENDED_REASON_ERROR;
        }
    })();

    const startedAt = run.startedAt ?? run.createdAt;
    const durationMs = (run.accumulatedRuntimeMs ?? 0) + (run.endedAt - startedAt);

    const payload: SubagentEndedHookPayload = {
        runId: run.runId,
        childSessionKey: run.childSessionKey,
        requesterSessionKey: run.requesterSessionKey,
        outcome: run.outcome,
        endedReason,
        durationMs,
        task: run.task,
        label: run.label,
        frozenResultText: run.frozenResultText,
    };

    run.endedHookEmittedAt = Date.now();

    for (const listener of endedHookListeners) {
        try {
            listener(payload);
        } catch (err) {
            log.warn({ runId: run.runId, err }, 'Ended hook listener error');
        }
    }

    log.info({
        runId: run.runId,
        outcome: run.outcome,
        durationMs,
    }, 'Ended hook emitted');

    return true;
}

// ─── Reset for Testing ──────────────────────────────────────────

export function clearEndedHookListeners(): void {
    endedHookListeners.length = 0;
}

// ─── Hook Stats ─────────────────────────────────────────────────

export function getEndedHookListenerCount(): number {
    return endedHookListeners.length;
}

export function hasEndedHookListeners(): boolean {
    return endedHookListeners.length > 0;
}

// ─── Outcome Classification ─────────────────────────────────────

export function isSuccessOutcome(outcome: SubagentRunOutcome): boolean {
    return outcome === 'completed';
}

export function isFailureOutcome(outcome: SubagentRunOutcome): boolean {
    return outcome === 'error' || outcome === 'timeout';
}

export function isTerminationOutcome(outcome: SubagentRunOutcome): boolean {
    return outcome === 'killed' || outcome === 'reset' || outcome === 'deleted';
}

export function classifyOutcome(outcome: SubagentRunOutcome): 'success' | 'failure' | 'termination' {
    if (isSuccessOutcome(outcome)) return 'success';
    if (isFailureOutcome(outcome)) return 'failure';
    return 'termination';
}
