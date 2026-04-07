/**
 * CoreBlow Phase 32 — AppBootstrapper & GracefulShutdown Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - AppBootstrapper: phase ordering, health checks, partial failure, getBootResult
 *   - GracefulShutdown: hook ordering, timeouts, concurrent shutdown guard, getLastResult
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AppBootstrapper } from '../../src/gateway/app-bootstrapper.js';
import { GracefulShutdown } from '../../src/gateway/graceful-shutdown.js';

// ================================================================
describe('AppBootstrapper — Extended', () => {
    let boot: AppBootstrapper;
    beforeEach(() => { boot = new AppBootstrapper(); });

    it('should boot 5 phases in correct order', async () => {
        const order: string[] = [];
        boot.register({ name: 'e', order: 5, required: true, init: async () => { order.push('e'); } });
        boot.register({ name: 'a', order: 1, required: true, init: async () => { order.push('a'); } });
        boot.register({ name: 'c', order: 3, required: true, init: async () => { order.push('c'); } });
        boot.register({ name: 'b', order: 2, required: true, init: async () => { order.push('b'); } });
        boot.register({ name: 'd', order: 4, required: true, init: async () => { order.push('d'); } });

        const result = await boot.boot();
        expect(result.success).toBe(true);
        expect(order).toEqual(['a', 'b', 'c', 'd', 'e']);
        expect(result.phases).toHaveLength(5);
    });

    it('should stop at first required phase failure', async () => {
        const order: string[] = [];
        boot.register({ name: 'ok-1', order: 1, required: true, init: async () => { order.push('ok-1'); } });
        boot.register({ name: 'fail', order: 2, required: true, init: async () => { throw new Error('crash'); } });
        boot.register({ name: 'ok-2', order: 3, required: true, init: async () => { order.push('ok-2'); } });

        const result = await boot.boot();
        expect(result.success).toBe(false);
        expect(order).toEqual(['ok-1']); // ok-2 never ran
        expect(result.phases.find(p => p.name === 'fail')?.status).toBe('failed');
        expect(result.phases.find(p => p.name === 'fail')?.error).toBe('crash');
    });

    it('should skip optional phase failure and continue', async () => {
        const order: string[] = [];
        boot.register({ name: 'required', order: 1, required: true, init: async () => { order.push('required'); } });
        boot.register({ name: 'optional', order: 2, required: false, init: async () => { throw new Error('optional-fail'); } });
        boot.register({ name: 'after', order: 3, required: true, init: async () => { order.push('after'); } });

        const result = await boot.boot();
        expect(result.success).toBe(true);
        expect(order).toEqual(['required', 'after']);
        expect(result.phases.find(p => p.name === 'optional')?.status).toBe('skipped');
    });

    it('should run health checks after init', async () => {
        let healthRan = false;
        boot.register({
            name: 'with-health', order: 1, required: true,
            init: async () => {},
            healthCheck: async () => { healthRan = true; return true; },
        });

        const result = await boot.boot();
        expect(result.success).toBe(true);
        expect(healthRan).toBe(true);
    });

    it('should fail phase if health check returns false', async () => {
        boot.register({
            name: 'unhealthy', order: 1, required: true,
            init: async () => {},
            healthCheck: async () => false,
        });

        const result = await boot.boot();
        expect(result.success).toBe(false);
        expect(result.phases[0]?.error).toContain('Health check');
    });

    it('should track boot timing', async () => {
        boot.register({ name: 'fast', order: 1, required: true, init: async () => {} });
        const result = await boot.boot();
        expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
        expect(result.phases[0]?.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should persist boot result', async () => {
        expect(boot.getBootResult()).toBeNull();
        boot.register({ name: 'x', order: 1, required: true, init: async () => {} });
        await boot.boot();
        expect(boot.getBootResult()?.success).toBe(true);
    });

    it('should list registered phases', () => {
        boot.register({ name: 'a', order: 2, required: false, init: async () => {} });
        boot.register({ name: 'b', order: 1, required: true, init: async () => {} });
        const list = boot.list();
        expect(list).toHaveLength(2);
        expect(list[0]?.name).toBe('b'); // Sorted by order
        expect(list[1]?.name).toBe('a');
    });
});

// ================================================================
describe('GracefulShutdown — Extended', () => {
    let gs: GracefulShutdown;
    beforeEach(() => { gs = new GracefulShutdown(); });

    it('should execute hooks in order', async () => {
        const order: string[] = [];
        gs.register({ name: 'c', order: 3, handler: async () => { order.push('c'); } });
        gs.register({ name: 'a', order: 1, handler: async () => { order.push('a'); } });
        gs.register({ name: 'b', order: 2, handler: async () => { order.push('b'); } });

        const result = await gs.shutdown();
        expect(order).toEqual(['a', 'b', 'c']);
        expect(result.completed).toEqual(['a', 'b', 'c']);
    });

    it('should catch handler failures', async () => {
        gs.register({ name: 'ok', order: 1, handler: async () => {} });
        gs.register({ name: 'fail', order: 2, handler: async () => { throw new Error('boom'); } });
        gs.register({ name: 'after', order: 3, handler: async () => {} });

        const result = await gs.shutdown();
        expect(result.completed).toContain('ok');
        expect(result.completed).toContain('after');
        expect(result.failed).toHaveLength(1);
        expect(result.failed[0]?.name).toBe('fail');
    });

    it('should handle timeouts', async () => {
        gs.register({ name: 'slow', order: 1, timeoutMs: 50, handler: async () => { await new Promise(r => setTimeout(r, 200)); } });
        gs.register({ name: 'fast', order: 2, handler: async () => {} });

        const result = await gs.shutdown();
        expect(result.timedOut).toContain('slow');
        expect(result.completed).toContain('fast');
    });

    it('should persist last result', async () => {
        expect(gs.getLastResult()).toBeNull();
        gs.register({ name: 'x', order: 1, handler: async () => {} });
        await gs.shutdown();
        expect(gs.getLastResult()?.completed).toContain('x');
    });

    it('should track total duration', async () => {
        gs.register({ name: 'a', order: 1, handler: async () => {} });
        const result = await gs.shutdown();
        expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should list registered hooks', () => {
        gs.register({ name: 'b', order: 2, handler: async () => {} });
        gs.register({ name: 'a', order: 1, handler: async () => {} });
        const list = gs.list();
        expect(list).toHaveLength(2);
        expect(list[0]?.name).toBe('a');
    });
});
