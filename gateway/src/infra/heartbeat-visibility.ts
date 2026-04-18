/** CoreBlow — Heartbeat Visibility */
export type HeartbeatVisibility = "visible" | "hidden" | "minimized";
export function resolveHeartbeatVisibility(env: NodeJS.ProcessEnv = process.env): HeartbeatVisibility {
  const v = env.COREBLOW_HEARTBEAT_VISIBILITY?.trim()?.toLowerCase();
  if (v === "hidden" || v === "minimized") return v; return "visible";
}
