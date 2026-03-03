/**
 * src/gateway/retry.ts
 * Retry logic + circuit breaker pattern
 * SUPERIOR: CoreBlow = no retry; CoreBlow = exponential backoff + jitter + circuit breaker
 */

import { createChildLogger } from '../utils/logger.js';
import { sleep } from '../utils.js';

const log = createChildLogger('retry');

// ─── Types ────────────────────────────────────────────────────────

export interface RetryConfig {
    /** Max retry attempts */
    maxAttempts: number;
    /** Base delay in ms */
    baseDelayMs: number;
    /** Max delay in ms (cap) */
    maxDelayMs: number;
    /** Whether to add jitter */
    jitter: boolean;
    /** Backoff multiplier */
    backoffMultiplier: number;
    /** Errors that should NOT be retried */
    nonRetryableErrors?: string[];
}

export interface CircuitBreakerConfig {
    /** Number of failures before opening circuit */
    failureThreshold: number;
    /** Time in ms before attempting half-open */
    resetTimeMs: number;
    /** Number of successes in half-open before closing */
    successThreshold: number;
}

export type CircuitState = 'closed' | 'open' | 'half-open';

export interface RetryResult<T> {
    success: boolean;
    result?: T;
    error?: Error;
    attempts: number;
    totalTimeMs: number;
}

// ─── Retry ───────────────────────────────────────────────────────

const DEFAULT_RETRY: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    jitter: true,
    backoffMultiplier: 2,
};

/**
 * Calculate delay with exponential backoff + optional jitter
 */
export function calculateDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY): number {
    const exponential = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt - 1);
    const capped = Math.min(exponential, config.maxDelayMs);

    if (config.jitter) {
        // Full jitter: random between 0 and capped
        return Math.floor(Math.random() * capped);
    }
    return capped;
}

/**
 * Execute a function with retry logic
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    config: Partial<RetryConfig> = {},
): Promise<RetryResult<T>> {
    const cfg = { ...DEFAULT_RETRY, ...config };
    const start = Date.now();

    for (let attempt = 1; attempt <= cfg.maxAttempts; attempt++) {
        try {
            const result = await fn();
            return { success: true, result, attempts: attempt, totalTimeMs: Date.now() - start };
        } catch (err: unknown) {
            // Check if error is non-retryable
            if (cfg.nonRetryableErrors?.some(e => (err instanceof Error ? err.message : String(err)).includes(e))) {
                return { success: false, error: err as Error, attempts: attempt, totalTimeMs: Date.now() - start };
            }

            if (attempt < cfg.maxAttempts) {
                const delay = calculateDelay(attempt, cfg);
                log.debug({ attempt, maxAttempts: cfg.maxAttempts, delay, err: (err instanceof Error ? err.message : String(err)) }, 'Retrying');
                await sleep(delay);
            } else {
                return { success: false, error: err as Error, attempts: attempt, totalTimeMs: Date.now() - start };
            }
        }
    }

    return { success: false, error: new Error('Max attempts reached'), attempts: cfg.maxAttempts, totalTimeMs: Date.now() - start };
}

// ─── Circuit Breaker ─────────────────────────────────────────────

const DEFAULT_CIRCUIT: CircuitBreakerConfig = {
    failureThreshold: 5,
    resetTimeMs: 30000,
    successThreshold: 2,
};

export class CircuitBreaker {
    private state: CircuitState = 'closed';
    private failures = 0;
    private successes = 0;
    private lastFailureAt = 0;
    private config: CircuitBreakerConfig;
    private name: string;
    private stateChangeListeners: ((state: CircuitState) => void)[] = [];

    constructor(name: string, config?: Partial<CircuitBreakerConfig>) {
        this.name = name;
        this.config = { ...DEFAULT_CIRCUIT, ...config };
    }

    /**
     * Execute a function through the circuit breaker
     */
    async execute<T>(fn: () => Promise<T>): Promise<T> {
        // Check state
        if (this.state === 'open') {
            // Check if reset time has passed
            if (Date.now() - this.lastFailureAt >= this.config.resetTimeMs) {
                this.transition('half-open');
            } else {
                throw new Error(`Circuit breaker "${this.name}" is OPEN`);
            }
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (err) {
            this.onFailure();
            throw err;
        }
    }

    private onSuccess(): void {
        this.failures = 0;

        if (this.state === 'half-open') {
            this.successes++;
            if (this.successes >= this.config.successThreshold) {
                this.transition('closed');
            }
        }
    }

    private onFailure(): void {
        this.failures++;
        this.lastFailureAt = Date.now();
        this.successes = 0;

        if (this.state === 'closed' && this.failures >= this.config.failureThreshold) {
            this.transition('open');
        } else if (this.state === 'half-open') {
            this.transition('open');
        }
    }

    private transition(newState: CircuitState): void {
        const old = this.state;
        this.state = newState;
        if (newState === 'closed') { this.failures = 0; this.successes = 0; }
        log.info({ breaker: this.name, from: old, to: newState }, 'Circuit state changed');
        for (const listener of this.stateChangeListeners) {
            listener(newState);
        }
    }

    /**
     * Listen for state changes
     */
    onStateChange(listener: (state: CircuitState) => void): void {
        this.stateChangeListeners.push(listener);
    }

    /**
     * Get current state
     */
    getState(): CircuitState {
        // Auto-check if reset time passed
        if (this.state === 'open' && Date.now() - this.lastFailureAt >= this.config.resetTimeMs) {
            return 'half-open';
        }
        return this.state;
    }

    /**
     * Force reset
     */
    reset(): void {
        this.transition('closed');
    }

    /**
     * Get info
     */
    getInfo(): { name: string; state: CircuitState; failures: number; successes: number } {
        return {
            name: this.name,
            state: this.getState(),
            failures: this.failures,
            successes: this.successes,
        };
    }
}

// sleep imported from utils.ts
