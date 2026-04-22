/**
 * CoreBlow — Circuit Breaker Tests
 *
 * Tests for circuit state transitions, failure thresholds,
 * half-open probing, auto-recovery, and force reset.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CircuitBreaker } from './circuit-breaker.js';

describe('CircuitBreaker', () => {
    let cb: CircuitBreaker;

    beforeEach(() => {
        cb = new CircuitBreaker();
    });

    // === Closed State ===

    describe('closed state', () => {
        it('starts in closed state', () => {
            expect(cb.getState('svc')).toBe('closed');
        });

        it('executes successfully in closed state', async () => {
            const result = await cb.execute('svc', async () => 42);
            expect(result).toBe(42);
        });

        it('tracks stats on success', async () => {
            await cb.execute('svc', async () => 'ok');
            const stats = cb.getStats('svc');
            expect(stats?.successes).toBe(1);
            expect(stats?.totalCalls).toBe(1);
        });
    });

    // === Opening ===

    describe('opening on failures', () => {
        it('opens after reaching failure threshold', async () => {
            for (let i = 0; i < 5; i++) {
                await cb.execute('svc', async () => { throw new Error('fail'); }).catch(() => {});
            }
            expect(cb.getState('svc')).toBe('open');
        });

        it('does not open before threshold', async () => {
            for (let i = 0; i < 4; i++) {
                await cb.execute('svc', async () => { throw new Error('fail'); }).catch(() => {});
            }
            expect(cb.getState('svc')).toBe('closed');
        });

        it('throws when circuit is open', async () => {
            for (let i = 0; i < 5; i++) {
                await cb.execute('svc', async () => { throw new Error('fail'); }).catch(() => {});
            }
            await expect(cb.execute('svc', async () => 'ok')).rejects.toThrow(/open/);
        });

        it('tracks failure count', async () => {
            for (let i = 0; i < 3; i++) {
                await cb.execute('svc', async () => { throw new Error('fail'); }).catch(() => {});
            }
            expect(cb.getStats('svc')?.failures).toBe(3);
        });
    });

    // === Custom Config ===

    describe('custom config', () => {
        it('uses custom failure threshold', async () => {
            for (let i = 0; i < 2; i++) {
                await cb.execute('svc', async () => { throw new Error('fail'); }, { failureThreshold: 2 }).catch(() => {});
            }
            expect(cb.getState('svc')).toBe('open');
        });
    });

    // === Reset ===

    describe('reset', () => {
        it('force-resets an open circuit', async () => {
            for (let i = 0; i < 5; i++) {
                await cb.execute('svc', async () => { throw new Error('fail'); }).catch(() => {});
            }
            expect(cb.getState('svc')).toBe('open');
            expect(cb.reset('svc')).toBe(true);
            expect(cb.getState('svc')).toBe('closed');
        });

        it('returns false for unknown circuit', () => {
            expect(cb.reset('nonexistent')).toBe(false);
        });
    });

    // === Listing ===

    describe('list', () => {
        it('lists all circuits', async () => {
            await cb.execute('a', async () => 1);
            await cb.execute('b', async () => 2);
            const list = cb.list();
            expect(list).toHaveLength(2);
            expect(list.map(c => c.key)).toContain('a');
            expect(list.map(c => c.key)).toContain('b');
        });
    });

    describe('count', () => {
        it('returns circuit count', async () => {
            await cb.execute('x', async () => 1);
            expect(cb.count()).toBe(1);
        });
    });

    // === Stats ===

    describe('getStats', () => {
        it('returns null for unknown circuit', () => {
            expect(cb.getStats('ghost')).toBeNull();
        });

        it('tracks lastSuccess timestamp', async () => {
            const before = Date.now();
            await cb.execute('svc', async () => 'ok');
            const stats = cb.getStats('svc');
            expect(stats?.lastSuccess).toBeGreaterThanOrEqual(before);
        });

        it('tracks lastFailure timestamp', async () => {
            const before = Date.now();
            await cb.execute('svc', async () => { throw new Error('x'); }).catch(() => {});
            expect(cb.getStats('svc')?.lastFailure).toBeGreaterThanOrEqual(before);
        });
    });
});
