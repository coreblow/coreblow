import { describe, it, expect, beforeEach } from 'vitest';
import { EmbeddingCircuitBreaker } from './embedding-circuit-breaker.js';

describe('EmbeddingCircuitBreaker', () => {
    let cb: EmbeddingCircuitBreaker;

    beforeEach(() => {
        cb = new EmbeddingCircuitBreaker({ maxFailures: 3, resetMs: 100 });
    });

    it('starts closed', () => {
        expect(cb.isOpen()).toBe(false);
    });

    it('stays closed after 1-2 failures', () => {
        cb.recordFailure();
        expect(cb.isOpen()).toBe(false);
        cb.recordFailure();
        expect(cb.isOpen()).toBe(false);
    });

    it('opens after maxFailures (3)', () => {
        cb.recordFailure();
        cb.recordFailure();
        cb.recordFailure();
        expect(cb.isOpen()).toBe(true);
    });

    it('resets on success', () => {
        cb.recordFailure();
        cb.recordFailure();
        cb.recordSuccess();
        expect(cb.isOpen()).toBe(false);
        // Need 3 more failures to open again
        cb.recordFailure();
        cb.recordFailure();
        expect(cb.isOpen()).toBe(false);
    });

    it('auto-resets after cooldown period', async () => {
        cb.recordFailure();
        cb.recordFailure();
        cb.recordFailure();
        expect(cb.isOpen()).toBe(true);

        // Wait for resetMs (100ms in test)
        await new Promise(r => setTimeout(r, 150));

        expect(cb.isOpen()).toBe(false);
    });

    it('manual reset clears state', () => {
        cb.recordFailure();
        cb.recordFailure();
        cb.recordFailure();
        expect(cb.isOpen()).toBe(true);

        cb.reset();
        expect(cb.isOpen()).toBe(false);
        expect(cb.getState().failures).toBe(0);
    });

    it('getState returns diagnostics', () => {
        cb.recordFailure();
        const state = cb.getState();
        expect(state.failures).toBe(1);
        expect(state.isOpen).toBe(false);
        expect(state.lastFailureAt).toBeGreaterThan(0);
    });
});
