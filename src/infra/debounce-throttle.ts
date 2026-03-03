/**
 * CoreBlow — Debounce & Throttle
 *
 * Async-safe execution rate controllers for rapid incoming
 * events, preventing resource exhaustion during heavy load.
 */

/**
 * Creates a debounced function that delays invoking the provided function
 * until after `waitMs` milliseconds have elapsed since the last time it was invoked.
 */
export function debounce<Args extends any[], R>(
    fn: (...args: Args) => Promise<R> | R,
    waitMs: number
): ((...args: Args) => Promise<R>) & { cancel: () => void } {
    let timeout: NodeJS.Timeout | null = null;
    let pendingReject: ((reason?: unknown) => void) | null = null;

    const debounced = (...args: Args): Promise<R> => {
        return new Promise((resolve, reject) => {
            if (timeout) {
                clearTimeout(timeout);
                if (pendingReject) {
                    pendingReject(new Error('Debounced: cancelled by subsequent call'));
                }
            }

            pendingReject = reject;

            timeout = setTimeout(async () => {
                timeout = null;
                pendingReject = null;
                try {
                    resolve(await fn(...args));
                } catch (err) {
                    reject(err);
                }
            }, waitMs);
        });
    };

    debounced.cancel = () => {
        if (timeout) clearTimeout(timeout);
        if (pendingReject) {
            pendingReject(new Error('Debounced: cancelled manually'));
            pendingReject = null;
        }
        timeout = null;
    };

    return debounced;
}

/**
 * Creates a throttled function that only invokes `fn` at most once per
 * every `limitMs` milliseconds. Successive calls within the limit
 * will return the result of the last successful invocation or throw if none exists yet.
 */
export function throttle<Args extends any[], R>(
    fn: (...args: Args) => Promise<R> | R,
    limitMs: number
): ((...args: Args) => Promise<R>) {
    let inThrottle = false;
    let lastResult: R | undefined;
    let lastError: Error | undefined;

    return async (...args: Args): Promise<R> => {
        if (inThrottle) {
            if (lastError !== undefined) throw lastError;
            if (lastResult !== undefined) return lastResult;
            throw new Error('Throttle: Call suppressed but no prior cached result exists');
        }

        inThrottle = true;
        try {
            lastResult = await fn(...args);
            lastError = undefined;
            return lastResult;
        } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err));
            throw lastError;
        } finally {
            setTimeout(() => {
                inThrottle = false;
            }, limitMs);
        }
    };
}

// ---------------------------------------------------------------------------
// DebounceThrottleService — Tier-1 Standalone Singleton
// ---------------------------------------------------------------------------

import { createStandaloneSingleton } from "./service-patterns.js";
export class DebounceThrottleService {
  [Symbol.toStringTag] = 'DebounceThrottleService';
}


const { getInstance: getDebounceThrottleService, __testing: __testing_debounceThrottle } =
  createStandaloneSingleton({ create: () => new DebounceThrottleService(), defaultDeps: {} });

export { getDebounceThrottleService, __testing_debounceThrottle };
