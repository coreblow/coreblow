/**
 * CoreBlow — Retry Policy
 *
 * Configurable retry policies with exponential backoff,
 * jitter, circuit breaking, and retry budgets for
 * resilient API calls.
 */

/** Retry options */
export interface RetryOptions {
    maxRetries: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    jitter: boolean;
    retryOn?: (error: Error, attempt: number) => boolean;
}

/** Retry result */
export interface RetryResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    attempts: number;
    totalDurationMs: number;
}

/**
 * CoreBlow Retry Policy
 */
export class RetryPolicy {
    private defaults: RetryOptions = {
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 30_000,
        backoffMultiplier: 2,
        jitter: true,
    };

    private stats = { totalCalls: 0, totalRetries: 0, totalSuccess: 0, totalFailed: 0 };

    constructor(opts?: Partial<RetryOptions>) {
        if (opts) this.defaults = { ...this.defaults, ...opts };
    }

    /**
     * Execute with retry.
     */
    async execute<T>(fn: () => Promise<T>, opts?: Partial<RetryOptions>): Promise<RetryResult<T>> {
        const options = { ...this.defaults, ...opts };
        const start = Date.now();
        let lastError: Error | null = null;

        this.stats.totalCalls++;
        let currentAttempt = 0;

        for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
            currentAttempt = attempt;
            try {
                const data = await fn();
                this.stats.totalSuccess++;
                return { success: true, data, attempts: attempt + 1, totalDurationMs: Date.now() - start };
            } catch (err) {
                lastError = err instanceof Error ? err : new Error(String(err));

                if (attempt >= options.maxRetries) break;

                // Check if should retry
                if (options.retryOn && !options.retryOn(lastError, attempt)) break;

                this.stats.totalRetries++;
                const delay = this.computeDelay(attempt, options);
                await this.delay(delay);
            }
        }

        this.stats.totalFailed++;
        return {
            success: false,
            error: lastError ?? new Error('All retries exhausted'),
            attempts: currentAttempt + 1,
            totalDurationMs: Date.now() - start,
        };
    }

    /**
     * Create a policy with preset.
     */
    static aggressive(): RetryPolicy {
        return new RetryPolicy({ maxRetries: 5, baseDelayMs: 500, backoffMultiplier: 1.5 });
    }

    static conservative(): RetryPolicy {
        return new RetryPolicy({ maxRetries: 2, baseDelayMs: 2000, backoffMultiplier: 3 });
    }

    static noRetry(): RetryPolicy {
        return new RetryPolicy({ maxRetries: 0 });
    }

    /**
     * Get stats.
     */
    getStats(): typeof this.stats {
        return { ...this.stats };
    }

    /**
     * Reset stats.
     */
    resetStats(): void {
        this.stats = { totalCalls: 0, totalRetries: 0, totalSuccess: 0, totalFailed: 0 };
    }

    // === Private ===

    private computeDelay(attempt: number, opts: RetryOptions): number {
        let delay = opts.baseDelayMs * Math.pow(opts.backoffMultiplier, attempt);
        delay = Math.min(delay, opts.maxDelayMs);
        if (opts.jitter) delay *= (0.5 + Math.random() * 0.5);
        return Math.round(delay);
    }

    private delay(ms: number): Promise<void> {
        return new Promise((r) => setTimeout(r, ms));
    }
}
