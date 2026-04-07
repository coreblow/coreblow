/**
 * gateway/circuit-breaker.test.ts — Circuit breaker tests (updated for expanded API)
 */
import { describe, it, expect } from 'vitest';
import { CircuitBreaker } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
    it('should start in closed state', () => {
        const cb = new CircuitBreaker('test-start');
        expect(cb.getState()).toBe('closed');
    });

    it('should execute successfully in closed state', async () => {
        const cb = new CircuitBreaker('test-exec');
        const result = await cb.execute(async () => 'ok');
        expect(result).toBe('ok');
    });

    it('should open after threshold failures', async () => {
        const cb = new CircuitBreaker('test-open', { threshold: 2, slidingWindowMs: 60000 });
        const fail = () => cb.execute(async () => { throw new Error('fail'); });
        await expect(fail()).rejects.toThrow();
        await expect(fail()).rejects.toThrow();
        expect(cb.getState()).toBe('open');
    });

    it('should reject calls when open', async () => {
        const cb = new CircuitBreaker('test-reject', { threshold: 1, slidingWindowMs: 60000 });
        await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
        await expect(cb.execute(async () => 'ok')).rejects.toThrow('Circuit');
    });

    it('should reset after timeout', async () => {
        const cb = new CircuitBreaker('test-reset', { threshold: 1, resetMs: 50, slidingWindowMs: 60000 });
        await expect(cb.execute(async () => { throw new Error('fail'); })).rejects.toThrow();
        expect(cb.getState()).toBe('open');
        await new Promise(r => setTimeout(r, 60));
        // Should be half-open now — next call attempts
        const result = await cb.execute(async () => 'recovered');
        expect(result).toBe('recovered');
    });
});
