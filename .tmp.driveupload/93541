/**
 * CoreBlow Phase 32 — CoreBlowServer Lifecycle Extended Tests
 *
 * Layer 1 (Edge Cases):
 *   - Server start/stop lifecycle
 *   - Config defaults, custom ports
 *   - Registry and bootstrapper exposure
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { CoreBlowServer } from '../../src/gateway/server.js';

describe('CoreBlowServer — Extended', () => {
    it('should start with default options', async () => {
        const server = new CoreBlowServer();
        const result = await server.start();
        expect(result.success).toBe(true);
        expect(result.port).toBe(3000);
    });

    it('should start with custom port', async () => {
        const server = new CoreBlowServer({ port: 8080 });
        const result = await server.start();
        expect(result.port).toBe(8080);
    });

    it('should report running status after start', async () => {
        const server = new CoreBlowServer({ port: 5000 });
        await server.start();
        const status = server.getStatus();
        expect(status.running).toBe(true);
        expect(status.port).toBe(5000);
        expect(status.env).toBe('development');
        expect(status.services).toBe(6);
    });

    it('should stop gracefully', async () => {
        const server = new CoreBlowServer();
        await server.start();
        expect(server.getStatus().running).toBe(true);

        await server.stop();
        expect(server.getStatus().running).toBe(false);
    });

    it('should expose service registry with 6 core services', async () => {
        const server = new CoreBlowServer();
        await server.start();
        const reg = server.getRegistry();
        expect(reg.count()).toBe(6);

        const list = reg.list();
        const names = list.map(s => s.name);
        expect(names).toContain('config');
        expect(names).toContain('security');
        expect(names).toContain('providers');
        expect(names).toContain('agents');
        expect(names).toContain('channels');
        expect(names).toContain('gateway');
    });

    it('should expose bootstrapper with boot result', async () => {
        const server = new CoreBlowServer();
        await server.start();
        const bootResult = server.getBootstrapper().getBootResult();
        expect(bootResult?.success).toBe(true);
        expect(bootResult?.phases.length).toBe(6);
    });

    it('should track uptime after start', async () => {
        const server = new CoreBlowServer();
        await server.start();
        const status = server.getStatus();
        expect(status.uptime).toBeGreaterThanOrEqual(0);
        expect(status.startedAt).toBeDefined();
    });

    it('should report zero uptime before start', () => {
        const server = new CoreBlowServer();
        const status = server.getStatus();
        expect(status.running).toBe(false);
        expect(status.uptime).toBe(0);
    });
});
