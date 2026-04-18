/** CoreBlow — Session Store Summary */
export interface StoreSummary { totalSessions: number; activeSessions: number; totalSizeBytes: number; oldestSessionAt?: number; }
export function formatStoreSummary(s: StoreSummary): string { return s.totalSessions + " sessions (" + s.activeSessions + " active, " + Math.round(s.totalSizeBytes / 1024) + " KB)"; }
