/** CoreBlow — Heartbeat Events Filter */
export interface HeartbeatFilter { minIntervalMs: number; maxEventsPerWindow: number; windowMs: number; }
const eventLog: number[] = [];
export function shouldEmitHeartbeat(filter: HeartbeatFilter): boolean {
  const now = Date.now(); const windowStart = now - filter.windowMs;
  while (eventLog.length > 0 && eventLog[0] < windowStart) eventLog.shift();
  if (eventLog.length >= filter.maxEventsPerWindow) return false;
  if (eventLog.length > 0 && now - eventLog[eventLog.length - 1] < filter.minIntervalMs) return false;
  eventLog.push(now); return true;
}
