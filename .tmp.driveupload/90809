/**
 * agents/subagent/subagent-registry-queries.ts
 * Query functions for the subagent run registry.
 */

import type { SubagentRunRecord } from './subagent-registry-types.js';
import { subagentRuns } from './subagent-registry-memory.js';

export function isActiveRun(run: SubagentRunRecord): boolean {
    return typeof run.endedAt !== 'number';
}

export function isEndedRun(run: SubagentRunRecord): boolean {
    return typeof run.endedAt === 'number';
}

export function isArchivedRun(run: SubagentRunRecord): boolean {
    return typeof run.cleanupCompletedAt === 'number';
}

export function listActiveRuns(): SubagentRunRecord[] {
    return [...subagentRuns.values()].filter(isActiveRun);
}

export function countActiveRunsByRequester(requesterSessionKey: string): number {
    let count = 0;
    for (const run of subagentRuns.values()) {
        if (run.requesterSessionKey === requesterSessionKey && isActiveRun(run)) count++;
    }
    return count;
}
