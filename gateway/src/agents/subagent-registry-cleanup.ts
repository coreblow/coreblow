/** Subagent registry cleanup. */
export function cleanupStaleEntries<T extends { lastActivityAt: number }>(entries: Map<string, T>, maxAgeMs: number): number { const cutoff = Date.now() - maxAgeMs; let removed = 0; for (const [k, v] of entries) { if (v.lastActivityAt < cutoff) { entries.delete(k); removed++; } } return removed; }
