/**
 * CoreBlow Phase 32 — Integration & Final Assembly Tests
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { AppBootstrapper } from '../../src/gateway/app-bootstrapper.js';
import { GracefulShutdown } from '../../src/gateway/graceful-shutdown.js';
import { EnvManager } from '../../src/config/env-manager.js';
import { ServiceRegistry } from '../../src/gateway/service-registry.js';
import { CoreBlowServer } from '../../src/gateway/server.js';

// ================================================================
describe('AppBootstrapper', () => {
    let boot: AppBootstrapper;
    beforeEach(() => { boot = new AppBootstrapper(); });

    it('should register phases', () => {
        boot.register({ name: 'config', order: 1, required: true, init: async () => {} });
        expect(boot.count()).toBe(1);
    });

    it('should boot in order', async () => {
        const order: string[] = [];
        boot.register({ name: 'b', order: 2, required: true, init: async () => { order.push('b'); } });
        boot.register({ name: 'a', order: 1, required: true, init: async () => { order.push('a'); } });
        await boot.boot();
        expect(order).toEqual(['a', 'b']);
    });

    it('should fail on required phase error', async () => {
        boot.register({ name: 'fail', order: 1, required: true, init: async () => { throw new Error('boom'); } });
        const result = await boot.boot();
        expect(result.success).toBe(false);
    });

    it('should skip optional phase error', async () => {
        boot.register({ name: 'optional', order: 1, required: false, init: async () => { throw new Error('ok'); } });
        boot.register({ name: 'next', order: 2, required: true, init: async () => {} });
        const result = await boot.boot();
        expect(result.success).toBe(true);
    });

    it('should run health checks', async () => {
        boot.register({ name: 'db', order: 1, required: true, init: async () => {}, healthCheck: async () => true });
        const result = await boot.boot();
        expect(result.phases[0]?.status).toBe('ok');
    });
});

// ================================================================
describe('GracefulShutdown', () => {
    let gs: GracefulShutdown;
    beforeEach(() => { gs = new GracefulShutdown(); });

    it('should register hooks', () => {
        gs.register({ name: 'db', order: 1, handler: async () => {} });
        expect(gs.count()).toBe(1);
    });

    it('should execute in order', async () => {
        const order: string[] = [];
        gs.register({ name: 'b', order: 2, handler: async () => { order.push('b'); } });
        gs.register({ name: 'a', order: 1, handler: async () => { order.push('a'); } });
        await gs.shutdown();
        expect(order).toEqual(['a', 'b']);
    });

    it('should handle failures', async () => {
        gs.register({ name: 'fail', order: 1, handler: async () => { throw new Error('oops'); } });
        const result = await gs.shutdown();
        expect(result.failed).toHaveLength(1);
    });

    it('should handle timeouts', async () => {
        gs.register({ name: 'slow', order: 1, timeoutMs: 50, handler: async () => { await new Promise((r) => setTimeout(r, 200)); } });
        const result = await gs.shutdown();
        expect(result.timedOut).toContain('slow');
    });
});

// ================================================================
describe('EnvManager', () => {
    let env: EnvManager;
    beforeEach(() => {
        env = new EnvManager();
        env.define('PORT', 'number', false, 3000);
        env.define('API_KEY', 'string', true);
        env.define('DEBUG', 'boolean', false, false);
    });

    it('should load with defaults', () => {
        const result = env.load({ API_KEY: 'sk-123' });
        expect(result.valid).toBe(true);
        expect(env.get('PORT')).toBe(3000);
    });

    it('should coerce types', () => {
        env.load({ PORT: '8080', API_KEY: 'key', DEBUG: 'true' });
        expect(env.get('PORT')).toBe(8080);
        expect(env.get('DEBUG')).toBe(true);
    });

    it('should catch missing required', () => {
        const result = env.load({});
        expect(result.valid).toBe(false);
    });

    it('should parse env files', () => {
        const parsed = env.parseEnvFile('PORT=3000\nAPI_KEY="secret"\n# comment\nDEBUG=true');
        expect(parsed.PORT).toBe('3000');
        expect(parsed.API_KEY).toBe('secret');
    });

    it('should set values', () => {
        env.set('CUSTOM', 'value');
        expect(env.get('CUSTOM')).toBe('value');
    });
});

// ================================================================
describe('ServiceRegistry', () => {
    let reg: ServiceRegistry;
    beforeEach(() => { reg = new ServiceRegistry(); });

    it('should register services', () => {
        reg.register('config', { loaded: true });
        expect(reg.count()).toBe(1);
    });

    it('should resolve services', () => {
        reg.register('db', { connected: true });
        expect(reg.resolve('db')).toEqual({ connected: true });
    });

    it('should start services', () => {
        reg.register('a', {});
        expect(reg.start('a')).toBe(true);
    });

    it('should enforce dependencies', () => {
        reg.register('a', {}, ['b']);
        reg.register('b', {});
        expect(reg.start('a')).toBe(false); // b not started
        reg.start('b');
        expect(reg.start('a')).toBe(true);
    });

    it('should start all in order', () => {
        reg.register('gateway', {}, ['agents']);
        reg.register('agents', {}, ['config']);
        reg.register('config', {});
        const result = reg.startAll();
        expect(result.started).toEqual(['config', 'agents', 'gateway']);
    });

    it('should get health', () => {
        reg.register('a', {});
        reg.start('a');
        const health = reg.getHealth();
        expect(health[0]?.status).toBe('started');
    });
});

// ================================================================
describe('CoreBlowServer', () => {
    let server: CoreBlowServer;
    beforeEach(() => { server = new CoreBlowServer({ port: 4000 }); });

    it('should start successfully', async () => {
        const result = await server.start();
        expect(result.success).toBe(true);
        expect(result.port).toBe(4000);
    });

    it('should report status', async () => {
        await server.start();
        const status = server.getStatus();
        expect(status.running).toBe(true);
        expect(status.services).toBe(6);
    });

    it('should stop gracefully', async () => {
        await server.start();
        await server.stop();
        expect(server.getStatus().running).toBe(false);
    });

    it('should expose registry', async () => {
        await server.start();
        expect(server.getRegistry().count()).toBe(6);
    });
});
