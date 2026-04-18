/** CoreBlow — Heartbeat Wake */
export interface WakeSchedule { intervalMs: number; jitterMs: number; }
export function computeNextWake(schedule: WakeSchedule): number { const jitter = Math.random() * schedule.jitterMs; return Date.now() + schedule.intervalMs + jitter; }
export const DEFAULT_WAKE_SCHEDULE: WakeSchedule = { intervalMs: 60_000, jitterMs: 5_000 };
