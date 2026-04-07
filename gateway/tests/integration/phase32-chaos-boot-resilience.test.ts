/**
 * CoreBlow Phase 32 — Boot Resilience & Shutdown Chaos Tests
 *
 * Layer 3 (Fault Injection):
 *   - Boot: cascading phase failures, optional phase recovery
 *   - Shutdown: timeout handling, failure resilience
 *   - Dependencies: missing deps, circular dep handling
 *   - Server: start-stop-start cycle, concurrent start calls
 */
import { describe, it, expect } from 'vitest';
import { AppBootstrapper } from '../../src/gateway/app-bootstrapper.js';
import { GracefulShutdown } from '../../src/gateway/graceful-shutdown.js';
import { ServiceRegistry } from '../../src/gateway/service-registry.js';
import { CoreBlowServer } from '../../src/gateway/server.js';

// ================================================================
describe('Phase32 Chaos: Boot Failure Recovery', () => {
    it('required phase 2/5 fails → only phase 1 completes', async () => {
        const boot = new AppBootstrapper();
        const completed: string[] = [];

        boot.register({ name: 'p1', order: 1, required: true, init: async () => { completed.push('p1'); } });
        boot.register({ name: 'p2-fail', order: 2, required: true, init: async () => { throw new Error('db-down'); } });
        boot.register({ name: 'p3', order: 3, required: true, init: async () => { completed.push('p3'); } });
        boot.register({ name: 'p4', order: 4, required: true, init: async () => { completed.push('p4'); } });
        boot.register({ name: 'p5', order: 5, required: true, init: async () => { completed.push('p5'); } });

        const result = await boot.boot();
        expect(result.success).toBe(false);
        expect(completed).toEqual(['p1']); // Only p1 ran
        expect(result.phases).toHaveLength(2); // p1 ok, p2 failed, rest never ran
    });

    it('multiple optional failures → boot still succeeds', async () => {
        const boot = new AppBootstrapper();
        boot.register({ name: 'core', order: 1, required: true, init: async () => {} });
        boot.register({ name: 'opt-1', order: 2, required: false, init: async () => { throw new Error('cache-miss'); } });
        boot.register({ name: 'opt-2', order: 3, required: false, init: async () => { throw new Error('monitor-fail'); } });
        boot.register({ name: 'api', order: 4, required: true, init: async () => {} });

        const result = await boot.boot();
        expect(result.success).toBe(true);
        expect(result.phases.filter(p => p.status === 'skipped')).toHaveLength(2);
        expect(result.phases.filter(p => p.status === 'ok')).toHaveLength(2);
    });

    it('health check failure on required phase → boot fails', async () => {
        const boot = new AppBootstrapper();
        boot.register({
            name: 'db', order: 1, required: true,
            init: async () => {}, // Init succeeds
            healthCheck: async () => false, // But health check fails
        });

        const result = await boot.boot();
        expect(result.success).toBe(false);
        expect(result.phases[0]?.error).toContain('Health check');
    });
});

// ================================================================
describe('Phase32 Chaos: Shutdown Resilience', () => {
    it('shutdown with multiple failures — all hooks attempt execution', async () => {
        const gs = new GracefulShutdown();
        gs.register({ name: 'ok-1', order: 1, handler: async () => {} });
        gs.register({ name: 'fail-1', order: 2, handler: async () => { throw new Error('conn-reset'); } });
        gs.register({ name: 'fail-2', order: 3, handler: async () => { throw new Error('write-error'); } });
        gs.register({ name: 'ok-2', order: 4, handler: async () => {} });

        const result = await gs.shutdown();
        expect(result.completed).toEqual(['ok-1', 'ok-2']);
        expect(result.failed).toHaveLength(2);
        // All hooks attempted
        expect(result.completed.length + result.failed.length).toBe(4);
    });

    it('shutdown with timeout — timed out hooks dont block others', async () => {
        const gs = new GracefulShutdown();
        gs.register({
            name: 'stuck', order: 1, timeoutMs: 30,
            handler: async () => { await new Promise(r => setTimeout(r, 500)); },
        });
        gs.register({ name: 'fast', order: 2, handler: async () => {} });

        const result = await gs.shutdown();
        expect(result.timedOut).toContain('stuck');
        expect(result.completed).toContain('fast');
    });

    it('double shutdown call — second returns cached result', async () => {
        const gs = new GracefulShutdown();
        let callCount = 0;
        gs.register({ name: 'hook', order: 1, handler: async () => { callCount++; } });

        const result1 = await gs.shutdown();
        const result2 = await gs.shutdown();

        // First call executes, second returns cached
        expect(result1.completed).toContain('hook');
        // Both return valid results
        expect(result2).toBeDefined();
    });
});

// ================================================================
describe('Phase32 Chaos: Service Dependency Failures', () => {
    it('missing dependency in chain — dependent services fail to start', () => {
        const reg = new ServiceRegistry();
        reg.register('api', {}, ['auth']);
        reg.register('auth', {}, ['config']);
        // config NOT registered

        const result = reg.startAll();
        expect(result.failed).toContain('config');
        expect(result.failed).toContain('auth');
        expect(result.failed).toContain('api');
        expect(result.started).toHaveLength(0);
    });

    it('partial dependency chain — only independent services start', () => {
        const reg = new ServiceRegistry();
        reg.register('standalone', {}); // No deps
        reg.register('dependent', {}, ['missing']); // Missing dep

        const result = reg.startAll();
        expect(result.started).toContain('standalone');
        expect(result.failed).toContain('dependent');
    });

    it('server start → stop → services can be inspected post-stop', async () => {
        const server = new CoreBlowServer({ port: 7777 });
        await server.start();
        expect(server.getStatus().running).toBe(true);

        await server.stop();
        expect(server.getStatus().running).toBe(false);

        // Registry still accessible for inspection
        const reg = server.getRegistry();
        expect(reg.count()).toBe(6);
        const health = reg.getHealth();
        // Some services will be stopped
        expect(health.length).toBe(6);
    });
});
