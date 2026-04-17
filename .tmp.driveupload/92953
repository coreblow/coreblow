/**
 * sessions/session-cleanup.ts
 */
export function cleanupSessions(sessions: Map<string, unknown>, maxAgeMs = 3600000) { const now = Date.now(); let cleaned = 0; for (const [id, s] of sessions) { if (now - (s as { createdAt: number }).createdAt > maxAgeMs) { sessions.delete(id); cleaned++; } } return cleaned; }
