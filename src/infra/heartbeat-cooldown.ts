import type { HeartbeatWakeIntent, HeartbeatWakeSource } from "./heartbeat-wake.js";

export const DEFAULT_MIN_WAKE_SPACING_MS = 30_000;
export const DEFAULT_FLOOD_WINDOW_MS = 60_000;
export const DEFAULT_FLOOD_THRESHOLD = 5;

export type DeferDecision =
  | { defer: false }
  | { defer: true; reason: "not-due" | "min-spacing" | "flood" };

export type ShouldDeferInput = {
  intent: HeartbeatWakeIntent;
  source?: HeartbeatWakeSource;
  reason: string | undefined;
  now: number;
  nextDueMs: number;
  lastRunStartedAtMs?: number;
  recentRunStarts?: readonly number[];
  minSpacingMs?: number;
  floodWindowMs?: number;
  floodThreshold?: number;
};

export function shouldDeferWake(input: ShouldDeferInput): DeferDecision {
  if (input.intent === "manual") {
    return { defer: false };
  }

  if (input.intent === "immediate") {
    return checkFloodGuard(input) ?? { defer: false };
  }

  const floodDefer = checkFloodGuard(input);
  if (floodDefer) {
    return floodDefer;
  }

  if (input.intent === "scheduled") {
    return input.now < input.nextDueMs ? { defer: true, reason: "not-due" } : { defer: false };
  }

  if (input.lastRunStartedAtMs === undefined) {
    return { defer: false };
  }

  if (input.now < input.nextDueMs) {
    return { defer: true, reason: "not-due" };
  }

  const minSpacing = input.minSpacingMs ?? DEFAULT_MIN_WAKE_SPACING_MS;
  if (minSpacing > 0 && input.now - input.lastRunStartedAtMs < minSpacing) {
    return { defer: true, reason: "min-spacing" };
  }

  return { defer: false };
}

function checkFloodGuard(input: ShouldDeferInput): DeferDecision | null {
  const floodWindow = input.floodWindowMs ?? DEFAULT_FLOOD_WINDOW_MS;
  const floodThreshold = input.floodThreshold ?? DEFAULT_FLOOD_THRESHOLD;
  if (!input.recentRunStarts || input.recentRunStarts.length < floodThreshold || floodWindow <= 0) {
    return null;
  }

  const windowStart = input.now - floodWindow;
  let inWindow = 0;
  for (let i = input.recentRunStarts.length - 1; i >= 0; i -= 1) {
    const ts = input.recentRunStarts[i];
    if (ts === undefined || ts < windowStart) {
      break;
    }
    inWindow += 1;
  }

  return inWindow >= floodThreshold ? { defer: true, reason: "flood" } : null;
}

export function recordRunStart(
  buffer: number[],
  ts: number,
  floodThreshold: number = DEFAULT_FLOOD_THRESHOLD,
): number[] {
  buffer.push(ts);
  const max = floodThreshold + 1;
  while (buffer.length > max) {
    buffer.shift();
  }
  return buffer;
}
