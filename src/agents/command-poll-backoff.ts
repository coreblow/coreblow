/**
 * agents/command-poll-backoff.ts
 * Exponential backoff for command polling loops.
 * Ported from CoreBlow reference src/agents/command-poll-backoff.ts.
 */

import { sleep } from "../utils.js";

export interface BackoffPolicy {
    initialMs: number;
    maxMs: number;
    factor: number;
    jitter: number;
}

export interface BackoffState {
    attempt: number;
    nextDelayMs: number;
    totalWaitedMs: number;
}

const DEFAULT_POLICY: BackoffPolicy = {
    initialMs: 500,
    maxMs: 30_000,
    factor: 2,
    jitter: 0.1,
};

/**
 * Compute the backoff delay for a given attempt.
 */
export function computeBackoff(attempt: number, policy?: Partial<BackoffPolicy>): number {
    const p = { ...DEFAULT_POLICY, ...policy };
    const base = Math.min(p.maxMs, p.initialMs * Math.pow(p.factor, attempt));
    const jitterRange = base * p.jitter;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    return Math.max(p.initialMs, Math.floor(base + jitter));
}

/**
 * Create a stateful backoff tracker.
 */
export function createBackoffTracker(policy?: Partial<BackoffPolicy>): {
    next: () => number;
    reset: () => void;
    state: () => BackoffState;
} {
    const p = { ...DEFAULT_POLICY, ...policy };
    let attempt = 0;
    let totalWaited = 0;

    return {
        next: () => {
            const delay = computeBackoff(attempt, p);
            attempt++;
            totalWaited += delay;
            return delay;
        },
        reset: () => { attempt = 0; totalWaited = 0; },
        state: () => ({ attempt, nextDelayMs: computeBackoff(attempt, p), totalWaitedMs: totalWaited }),
    };
}

/**
 * Sleep with backoff.
 */
export function sleepWithBackoff(attempt: number, policy?: Partial<BackoffPolicy>): Promise<void> {
    const delay = computeBackoff(attempt, policy);
    return sleep(delay) as Promise<void>;
}

/**
 * Retry a function with exponential backoff.
 */
export async function retryWithBackoff<T>(
    fn: (attempt: number) => Promise<T>,
    opts?: { maxAttempts?: number; policy?: Partial<BackoffPolicy>; shouldRetry?: (err: unknown) => boolean },
): Promise<T> {
    const maxAttempts = opts?.maxAttempts ?? 3;
    const shouldRetry = opts?.shouldRetry ?? (() => true);
    let lastError: unknown;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            return await fn(attempt);
        } catch (err) {
            lastError = err;
            if (attempt >= maxAttempts - 1 || !shouldRetry(err)) throw err;
            await sleepWithBackoff(attempt, opts?.policy);
        }
    }
    throw lastError;
}

// OC-compat shims — CB uses different API
/** OC-compat: simple backoff calculation using CB's computeBackoff */
export function calculateBackoffMs(consecutiveNoOutputPolls: number): number {
  return computeBackoff(consecutiveNoOutputPolls);
}
export function recordCommandPoll(_state: unknown, _commandId: string): void { /* no-op in CB */ }
export function getCommandPollSuggestion(_state: unknown, _commandId: string): number | undefined { return undefined; }
export function resetCommandPollCount(_state: unknown, _commandId: string): void { /* no-op in CB */ }
export function pruneStaleCommandPolls(_state: unknown, _maxAgeMs?: number): void { /* no-op in CB */ }
