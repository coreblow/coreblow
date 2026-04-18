/** CoreBlow — Session Types */
export type SessionStatus = "active" | "idle" | "archived" | "expired";
export interface SessionTypes { status: SessionStatus; maxIdleMs: number; maxDurationMs: number; archiveAfterMs: number; }
export const DEFAULT_SESSION_TYPES: SessionTypes = { status: "active", maxIdleMs: 30 * 60_000, maxDurationMs: 24 * 3600_000, archiveAfterMs: 7 * 24 * 3600_000 };
