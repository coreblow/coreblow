/**
 * CoreBlow — Circuit Breaker
 *
 * Protects services from cascading failures with
 * open/closed/half-open states, failure thresholds,
 * and automatic recovery.
 */

/** Circuit state */
export type CircuitState = 'closed' | 'open' | 'half-open';

/** Circuit config */
export interface CircuitConfig {
    failureThreshold: number;
    resetTimeoutMs: number;
    halfOpenMaxCalls: number;
}

/** Circuit stats */
export interface CircuitStats {
    state: CircuitState;
    failures: number;
    successes: number;
    totalCalls: number;
    lastFailure?: number;
    lastSuccess?: number;
}

/**
 * CoreBlow Circuit Breaker
 */
export class CircuitBreaker {
    private circuits = new Map<string, {
        state: CircuitState;
        failures: number;
        successes: number;
        totalCalls: number;
        lastFailure?: number;
        lastSuccess?: number;
        openedAt?: number;
        halfOpenCalls: number;
        config: CircuitConfig;
    }>();

    private defaultConfig: CircuitConfig = {
        failureThreshold: 5,
        resetTimeoutMs: 30_000,
        halfOpenMaxCalls: 3,
    };

    /**
     * Execute through circuit breaker.
     */
    async execute<T>(key: string, fn: () => Promise<T>, config?: Partial<CircuitConfig>): Promise<T> {
        const circuit = this.getOrCreate(key, config);
        this.checkState(circuit);

        if (circuit.state === 'open') {
            throw new Error(`Circuit "${key}" is open`);
        }

        circuit.totalCalls++;

        if (circuit.state === 'half-open') {
            circuit.halfOpenCalls++;
        }

        try {
            const result = await fn();
            this.onSuccess(circuit);
            return result;
        } catch (err) {
            this.onFailure(circuit);
            throw err;
        }
    }

    /**
     * Get circuit state.
     */
    getState(key: string): CircuitState {
        const circuit = this.circuits.get(key);
        if (!circuit) return 'closed';
        this.checkState(circuit);
        return circuit.state;
    }

    /**
     * Get circuit stats.
     */
    getStats(key: string): CircuitStats | null {
        const circuit = this.circuits.get(key);
        if (!circuit) return null;
        return {
            state: circuit.state, failures: circuit.failures,
            successes: circuit.successes, totalCalls: circuit.totalCalls,
            lastFailure: circuit.lastFailure, lastSuccess: circuit.lastSuccess,
        };
    }

    /**
     * Force reset a circuit.
     */
    reset(key: string): boolean {
        const circuit = this.circuits.get(key);
        if (!circuit) return false;
        circuit.state = 'closed';
        circuit.failures = 0;
        circuit.halfOpenCalls = 0;
        return true;
    }

    /**
     * List all circuits.
     */
    list(): Array<{ key: string; state: CircuitState; failures: number }> {
        return Array.from(this.circuits.entries()).map(([key, c]) => ({
            key, state: c.state, failures: c.failures,
        }));
    }

    /** Count */
    count(): number { return this.circuits.size; }

    // === Private ===

    private getOrCreate(key: string, config?: Partial<CircuitConfig>) {
        if (!this.circuits.has(key)) {
            this.circuits.set(key, {
                state: 'closed', failures: 0, successes: 0, totalCalls: 0,
                halfOpenCalls: 0, config: { ...this.defaultConfig, ...config },
            });
        }
        return this.circuits.get(key)!;
    }

    private checkState(circuit: typeof this.circuits extends Map<string, infer V> ? V : never): void {
        if (circuit.state === 'open' && circuit.openedAt) {
            if (Date.now() - circuit.openedAt >= circuit.config.resetTimeoutMs) {
                circuit.state = 'half-open';
                circuit.halfOpenCalls = 0;
            }
        }
    }

    private onSuccess(circuit: typeof this.circuits extends Map<string, infer V> ? V : never): void {
        circuit.successes++;
        circuit.lastSuccess = Date.now();
        if (circuit.state === 'half-open') {
            if (circuit.halfOpenCalls >= circuit.config.halfOpenMaxCalls) {
                circuit.state = 'closed';
                circuit.failures = 0;
            }
        }
    }

    private onFailure(circuit: typeof this.circuits extends Map<string, infer V> ? V : never): void {
        circuit.failures++;
        circuit.lastFailure = Date.now();
        if (circuit.failures >= circuit.config.failureThreshold) {
            circuit.state = 'open';
            circuit.openedAt = Date.now();
        }
    }
}
