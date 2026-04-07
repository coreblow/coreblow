/**
 * CoreBlow — Embedding Circuit Breaker
 *
 * Self-host pattern: simple circuit breaker for embedding API calls.
 * When Ollama/OpenAI/Gemini is down, stop calling → JSONL continues.
 * Auto-resets after cooldown period.
 *
 * NOT enterprise half-open probing — just fail-fast + auto-reset.
 */

export class EmbeddingCircuitBreaker {
    private failures = 0;
    private lastFailureAt = 0;
    private readonly maxFailures: number;
    private readonly resetMs: number;

    constructor(opts?: { maxFailures?: number; resetMs?: number }) {
        this.maxFailures = opts?.maxFailures ?? 3;
        this.resetMs = opts?.resetMs ?? 30_000;
    }

    /**
     * Check if circuit is open (should NOT call API).
     */
    isOpen(): boolean {
        if (this.failures < this.maxFailures) return false;

        // Auto-reset after cooldown
        if (Date.now() - this.lastFailureAt > this.resetMs) {
            this.reset();
            return false;
        }
        return true;
    }

    /**
     * Record a failed API call.
     */
    recordFailure(): void {
        this.failures++;
        this.lastFailureAt = Date.now();
    }

    /**
     * Record a successful API call.
     */
    recordSuccess(): void {
        this.failures = 0;
    }

    /**
     * Force reset the circuit breaker.
     */
    reset(): void {
        this.failures = 0;
        this.lastFailureAt = 0;
    }

    /**
     * Get circuit breaker state for diagnostics.
     */
    getState(): { failures: number; isOpen: boolean; lastFailureAt: number } {
        return {
            failures: this.failures,
            isOpen: this.isOpen(),
            lastFailureAt: this.lastFailureAt,
        };
    }
}
