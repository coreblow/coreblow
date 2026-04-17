/**
 * CoreBlow Phase 32 — Boot→Run→Shutdown Lifecycle Chain Tests
 *
 * Layer 2 (Pipeline):
 *   EnvManager.load → AppBootstrapper.boot → ServiceRegistry.startAll
 *   → [Run] → GracefulShutdown.shutdown → verify clean state
 */
import { describe, it, expect } from 'vitest';
import { EnvManager } from '../../src/config/env-manager.js';
import { AppBootstrapper } from '../../src/gateway/app-bootstrapper.js';
import { ServiceRegistry } from '../../src/gateway/service-registry.js';
import { GracefulShutdown } from '../../src/gateway/graceful-shutdown.js';
import { CoreBlowServer } from '../../src/gateway/server.js';

describe('Phase32 Chain: Full Boot→Run→Shutdown Lifecycle', () => {

    it('EnvManager → Bootstrapper → Registry → Shutdown full cycle', async () => {
        // Step 1: Load environment config
        const env = new EnvManager();
        env.define('PORT', 'number', false, 3000);
        env.define('NODE_ENV', 'string', false, 'production');
        env.define('API_KEY', 'string', true);
        const loadResult = env.load({ API_KEY: 'sk-prod-key', PORT: '4000' });
        expect(loadResult.valid).toBe(true);
        expect(env.get('PORT')).toBe(4000);

        // Step 2: Register services with dependencies
        const registry = new ServiceRegistry();
        registry.register('config', { port: env.get('PORT') });
        registry.register('security', { key: env.get('API_KEY') }, ['config']);
        registry.register('api', {}, ['config', 'security']);

        // Step 3: Boot in order
        const boot = new AppBootstrapper();
        boot.register({ name: 'config', order: 1, required: true, init: async () => { registry.start('config'); } });
        boot.register({ name: 'security', order: 2, required: true, init: async () => { registry.start('security'); } });
        boot.register({ name: 'api', order: 3, required: true, init: async () => { registry.start('api'); } });

        const bootResult = await boot.boot();
        expect(bootResult.success).toBe(true);
        expect(bootResult.phases.every(p => p.status === 'ok')).toBe(true);

        // Step 4: Verify all services running
        const health = registry.getHealth();
        expect(health.every(h => h.status === 'started')).toBe(true);

        // Step 5: Graceful shutdown
        const shutdown = new GracefulShutdown();
        shutdown.register({ name: 'api', order: 1, handler: async () => { registry.stop('api'); } });
        shutdown.register({ name: 'security', order: 2, handler: async () => { registry.stop('security'); } });
        shutdown.register({ name: 'config', order: 3, handler: async () => { registry.stop('config'); } });

        const shutdownResult = await shutdown.shutdown();
        expect(shutdownResult.completed).toEqual(['api', 'security', 'config']);

        // Step 6: Verify clean state
        const postHealth = registry.getHealth();
        expect(postHealth.every(h => h.status === 'stopped')).toBe(true);
    });

    it('CoreBlowServer full lifecycle: start → status → stop → status', async () => {
        const server = new CoreBlowServer({ port: 9000 });

        // Start
        const startResult = await server.start();
        expect(startResult.success).toBe(true);
        expect(startResult.port).toBe(9000);

        // Running status
        const runningStatus = server.getStatus();
        expect(runningStatus.running).toBe(true);
        expect(runningStatus.services).toBe(6);
        expect(runningStatus.uptime).toBeGreaterThanOrEqual(0);

        // Stop
        await server.stop();

        // Stopped status
        const stoppedStatus = server.getStatus();
        expect(stoppedStatus.running).toBe(false);
    });

    it('multiple servers with different configs — isolated registries', async () => {
        const server1 = new CoreBlowServer({ port: 3001 });
        const server2 = new CoreBlowServer({ port: 3002 });

        await server1.start();
        await server2.start();

        // Each has independent registry
        expect(server1.getRegistry().count()).toBe(6);
        expect(server2.getRegistry().count()).toBe(6);
        expect(server1.getStatus().port).toBe(3001);
        expect(server2.getStatus().port).toBe(3002);

        // Stop one — other still running
        await server1.stop();
        expect(server1.getStatus().running).toBe(false);
        expect(server2.getStatus().running).toBe(true);

        await server2.stop();
    });
});
