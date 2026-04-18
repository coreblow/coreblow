/**
 * CoreBlow — Backoff & Sleep Utilities
 *
 * Provides exponential backoff computation with configurable
 * jitter, and AbortSignal-aware async sleep for retry loops.
 */

import { setTimeout as delay } from 'node:timers/promises';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Configuration for exponential backoff calculation */
export interface BackoffPolicy {
  /** Initial delay in milliseconds */
  initialMs: number;
  /** Maximum delay cap in milliseconds */
  maxMs: number;
  /** Multiplier per attempt (e.g. 2 for doubling) */
  factor: number;
  /** Jitter ratio (0–1). 0 = no jitter, 1 = up to +100% random */
  jitter: number;
}

/** Pre-configured backoff presets */
export const BackoffPresets = {
  /** Conservative: starts at 1s, max 60s, factor 2, 25% jitter */
  conservative: { initialMs: 1000, maxMs: 60_000, factor: 2, jitter: 0.25 } satisfies BackoffPolicy,
  /** Aggressive: starts at 100ms, max 10s, factor 3, 50% jitter */
  aggressive: { initialMs: 100, maxMs: 10_000, factor: 3, jitter: 0.5 } satisfies BackoffPolicy,
  /** Gentle: starts at 500ms, max 30s, factor 1.5, 10% jitter */
  gentle: { initialMs: 500, maxMs: 30_000, factor: 1.5, jitter: 0.1 } satisfies BackoffPolicy,
} as const;

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Compute the backoff delay for a given attempt number.
 *
 * @param policy - Backoff configuration
 * @param attempt - Attempt number (1-based). Attempt 1 returns ~initialMs.
 * @returns Delay in milliseconds, capped at policy.maxMs
 */
export function computeBackoff(policy: BackoffPolicy, attempt: number): number {
  const safeAttempt = Math.max(attempt - 1, 0);
  const base = policy.initialMs * Math.pow(policy.factor, safeAttempt);
  const jitterAmount = base * policy.jitter * Math.random();
  return Math.min(policy.maxMs, Math.round(base + jitterAmount));
}

/**
 * Sleep for the given duration, respecting an optional AbortSignal.
 * Resolves immediately if ms <= 0.
 * Throws if the abort signal fires during the sleep.
 */
export async function sleepWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (ms <= 0) return;
  try {
    await delay(ms, undefined, { signal });
  } catch (err) {
    if (signal?.aborted) {
      throw new Error('Backoff sleep aborted', { cause: err });
    }
    throw err;
  }
}

/**
 * Convenience: compute backoff delay and sleep in one call.
 * Useful inside retry loops.
 */
export async function backoffSleep(
  policy: BackoffPolicy,
  attempt: number,
  signal?: AbortSignal,
): Promise<number> {
  const delayMs = computeBackoff(policy, attempt);
  await sleepWithAbort(delayMs, signal);
  return delayMs;
}
