/** CoreBlow — Heartbeat Summary */
export interface HeartbeatSummary { totalPings: number; totalPongs: number; totalTimeouts: number; avgLatencyMs: number; uptimePercent: number; lastPingAt?: number; }
export function formatHeartbeatSummary(s: HeartbeatSummary): string { return `Heartbeat: ${s.totalPongs}/${s.totalPings} ok (${s.uptimePercent.toFixed(1)}% uptime, avg ${s.avgLatencyMs.toFixed(0)}ms)`; }
