/**
 * CoreBlow Gateway Circuit Breaker
 *
 * Advanced circuit breaker with per-service tracking, sliding window,
 * half-open probe limiting, event emission, and health scoring.
 *
 * Equivalent: CoreBlow gateway circuit-breaker patterns (~400 LOC)
 */

import { createChildLogger } from '../utils/logger.js';
import { EventEmitter } from 'node:events';

const log = createChildLogger('gateway:circuit-breaker');

export type CBState = 'closed' | 'open' | 'half-open';

export interface CBOptions {
    threshold: number;
    resetMs: number;
    halfOpenMaxProbes: number;
    slidingWindowMs: number;
    consecutiveSuccessesToClose: number;
}

export interface CBStats {
    state: CBState;
    failures: number;
    successes: number;
    totalCalls: number;
    lastFailure: number;
    lastSuccess: number;
    healthScore: number;
    openedAt?: number;
}

const DEFAULT_OPTIONS: CBOptions = {
    threshold: 5,
    resetMs: 30_000,
    halfOpenMaxProbes: 3,
    slidingWindowMs: 60_000,
    consecutiveSuccessesToClose: 2,
};

export class CircuitBreaker extends EventEmitter {
    private state: CBState = 'closed';
    private failureTimestamps: number[] = [];
    private successes = 0;
    private totalCalls = 0;
    private lastFailure = 0;
    private lastSuccess = 0;
    private openedAt?: number;
    private halfOpenProbes = 0;
    private consecutiveSuccesses = 0;
    private opts: CBOptions;
    public readonly name: string;

    constructor(name: string = 'default', options?: Partial<CBOptions>) {
        super();
        this.name = name;
        this.opts = { ...DEFAULT_OPTIONS, ...options };
    }

    async execute<T>(fn: () => Promise<T>): Promise<T> {
        if (!this.canExecute()) {
            throw new CircuitOpenError(this.name, this.state);
        }

        if (this.state === 'half-open') this.halfOpenProbes++;
        this.totalCalls++;

        try {
            const result = await fn();
            this.recordSuccess();
            return result;
        } catch (e) {
            this.recordFailure();
            throw e;
        }
    }

    canExecute(): boolean {
        if (this.state === 'closed') return true;
        if (this.state === 'open') {
            if (Date.now() - (this.openedAt ?? 0) > this.opts.resetMs) {
                this.transitionTo('half-open');
                return true;
            }
            return false;
        }
        // half-open: limit probes
        return this.halfOpenProbes < this.opts.halfOpenMaxProbes;
    }

    recordSuccess(): void {
        this.successes++;
        this.lastSuccess = Date.now();
        this.consecutiveSuccesses++;

        if (this.state === 'half-open' && this.consecutiveSuccesses >= this.opts.consecutiveSuccessesToClose) {
            this.transitionTo('closed');
        } else if (this.state !== 'half-open') {
            this.state = 'closed';
        }
    }

    recordFailure(): void {
        const now = Date.now();
        this.lastFailure = now;
        this.consecutiveSuccesses = 0;
        this.failureTimestamps.push(now);

        // Trim sliding window
        const windowStart = now - this.opts.slidingWindowMs;
        this.failureTimestamps = this.failureTimestamps.filter((t) => t > windowStart);

        if (this.state === 'half-open') {
            this.transitionTo('open');
        } else if (this.failureTimestamps.length >= this.opts.threshold) {
            this.transitionTo('open');
        }
    }

    getState(): CBState { return this.state; }

    getStats(): CBStats {
        const windowStart = Date.now() - this.opts.slidingWindowMs;
        const recentFailures = this.failureTimestamps.filter((t) => t > windowStart).length;
        const healthScore = this.totalCalls > 0
            ? Math.max(0, 1 - (recentFailures / Math.max(this.opts.threshold, 1)))
            : 1;

        return {
            state: this.state,
            failures: recentFailures,
            successes: this.successes,
            totalCalls: this.totalCalls,
            lastFailure: this.lastFailure,
            lastSuccess: this.lastSuccess,
            healthScore: Math.round(healthScore * 100) / 100,
            openedAt: this.openedAt,
        };
    }

    reset(): void {
        this.state = 'closed';
        this.failureTimestamps = [];
        this.successes = 0;
        this.totalCalls = 0;
        this.consecutiveSuccesses = 0;
        this.halfOpenProbes = 0;
        this.openedAt = undefined;
    }

    private transitionTo(newState: CBState): void {
        const prev = this.state;
        this.state = newState;
        if (newState === 'open') {
            this.openedAt = Date.now();
            this.halfOpenProbes = 0;
            log.warn({ name: this.name }, 'Circuit breaker OPENED');
        } else if (newState === 'closed') {
            this.failureTimestamps = [];
            this.halfOpenProbes = 0;
            this.consecutiveSuccesses = 0;
            log.info({ name: this.name }, 'Circuit breaker CLOSED');
        } else {
            this.halfOpenProbes = 0;
            this.consecutiveSuccesses = 0;
        }
        this.emit('stateChange', { from: prev, to: newState, name: this.name });
    }
}

export class CircuitOpenError extends Error {
    constructor(public readonly circuitName: string, public readonly circuitState: CBState) {
        super(`Circuit breaker "${circuitName}" is ${circuitState}`);
        this.name = 'CircuitOpenError';
    }
}

// ─── Circuit Breaker Registry ─────────────────────────────────────

const registry = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, options?: Partial<CBOptions>): CircuitBreaker {
    let cb = registry.get(name);
    if (!cb) {
        cb = new CircuitBreaker(name, options);
        registry.set(name, cb);
    }
    return cb;
}

export function listCircuitBreakers(): Array<{ name: string; stats: CBStats }> {
    return Array.from(registry.entries()).map(([name, cb]) => ({ name, stats: cb.getStats() }));
}

export function clearCircuitBreakers(): void {
    registry.clear();
}
