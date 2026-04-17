/**
 * agents/subagent/subagent-registry-store.ts
 * In-memory store backing for the subagent registry.
 */

import type { SubagentRunRecord } from './subagent-registry-types.js';
import { subagentRuns } from './subagent-registry-memory.js';

export function getRunRecord(runId: string): SubagentRunRecord | undefined {
    return subagentRuns.get(runId);
}

export function setRunRecord(runId: string, record: SubagentRunRecord): void {
    subagentRuns.set(runId, record);
}

export function deleteRunRecord(runId: string): boolean {
    return subagentRuns.delete(runId);
}

export function getAllRunRecords(): Map<string, SubagentRunRecord> {
    return subagentRuns;
}

export function clearRunRecords(): void {
    subagentRuns.clear();
}

export function loadSubagentRegistryFromDisk(): Map<string, SubagentRunRecord> {
    return new Map();
}

export function saveSubagentRegistryToDisk(runs: Map<string, SubagentRunRecord>): void {
}
