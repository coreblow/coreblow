/**
 * CoreBlow Announce Idempotency
 *
 * Deduplication layer for subagent announcements. Prevents the same
 * completion/status announcement from being delivered multiple times.
 *
 * Equivalent: CoreBlow src/agents/announce-idempotency.ts (25 LOC)
 */

const seen = new Map<string, number>();
const DEFAULT_TTL_MS = 60_000;

/**
 * Check if an announcement has already been seen (and mark it).
 * Returns true if this is a DUPLICATE (already seen).
 */
export function isDuplicateAnnounce(key: string, ttlMs: number = DEFAULT_TTL_MS): boolean {
    cleanup();
    if (seen.has(key)) return true;
    seen.set(key, Date.now() + ttlMs);
    return false;
}

/**
 * Build a deduplication key for a subagent announcement
 */
export function buildAnnounceKey(sessionId: string, subagentId: string, messageId: string): string {
    return `${sessionId}:${subagentId}:${messageId}`;
}

/**
 * Clear all seen announcements
 */
export function clearAnnounceCache(): void {
    seen.clear();
}

function cleanup(): void {
    const now = Date.now();
    for (const [key, expiresAt] of seen) {
        if (expiresAt <= now) seen.delete(key);
    }
}
