/** CoreBlow — Heartbeat Reason */
export type HeartbeatReason = "scheduled" | "manual" | "recovery" | "startup" | "config-change";
export function formatHeartbeatReason(reason: HeartbeatReason): string { const labels: Record<HeartbeatReason, string> = { scheduled: "Scheduled check", manual: "Manual trigger", recovery: "Recovery probe", startup: "Startup check", "config-change": "Config changed" }; return labels[reason]; }
