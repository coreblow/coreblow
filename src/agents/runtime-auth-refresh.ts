import { clamp } from "../utils.js";
const MAX_SAFE_TIMEOUT_MS = 2_147_483_647;

export function clampRuntimeAuthRefreshDelayMs(params: {
  refreshAt: number;
  now: number;
  minDelayMs: number;
}): number {
  return clamp(params.refreshAt - params.now, params.minDelayMs, MAX_SAFE_TIMEOUT_MS);
}
