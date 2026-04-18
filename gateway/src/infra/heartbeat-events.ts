/** CoreBlow — Heartbeat Events */
export type HeartbeatEventType = "ping" | "pong" | "timeout" | "recovery";
export interface HeartbeatEvent { type: HeartbeatEventType; timestamp: number; latencyMs?: number; }
export function createHeartbeatEvent(type: HeartbeatEventType, latencyMs?: number): HeartbeatEvent { return { type, timestamp: Date.now(), latencyMs }; }
