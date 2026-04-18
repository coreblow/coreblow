/** CoreBlow — System Events */
export type SystemEventType = "startup" | "shutdown" | "config-change" | "error" | "health-check";
export interface SystemEvent { type: SystemEventType; timestamp: number; details?: Record<string, unknown>; }
const eventLog: SystemEvent[] = [];
export function emitSystemEvent(type: SystemEventType, details?: Record<string, unknown>): void { eventLog.push({ type, timestamp: Date.now(), details }); }
export function getSystemEvents(): SystemEvent[] { return [...eventLog]; }
export function clearSystemEvents(): void { eventLog.length = 0; }
