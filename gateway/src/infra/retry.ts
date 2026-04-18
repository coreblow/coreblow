/** CoreBlow — Retry Logic */
import { computeBackoff, type BackoffPolicy, BackoffPresets } from "./backoff.js";
export interface RetryOptions { maxAttempts: number; policy?: BackoffPolicy; signal?: AbortSignal; onRetry?: (attempt: number, error: unknown) => void; }
export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const policy = opts.policy ?? BackoffPresets.conservative; let lastError: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try { return await fn(); } catch (err) { lastError = err; if (attempt >= opts.maxAttempts) break; opts.onRetry?.(attempt, err);
    const delay = computeBackoff(policy, attempt);
    await new Promise((r) => setTimeout(r, delay)); if (opts.signal?.aborted) throw lastError; } } throw lastError; }
