/**
 * agents/subagent-orphan-recovery.ts — Detect and clean up orphaned subagents.
 */
export interface OrphanedSubagent { agentId: string; sessionId: string; parentId: string; startedAt: number; reason: string; }
export function detectOrphans(sessions: Array<{ agentId: string; sessionId: string; parentId: string; startedAt: number; isAlive: boolean }>): OrphanedSubagent[] {
    const alive = new Set(sessions.filter((s) => s.isAlive).map((s) => s.sessionId));
    return sessions.filter((s) => s.parentId && !alive.has(s.parentId) && s.isAlive).map((s) => ({ ...s, reason: 'Parent terminated' }));
}
export function shouldRecover(orphan: OrphanedSubagent, maxAgeMs = 300_000): boolean { return Date.now() - orphan.startedAt < maxAgeMs; }
