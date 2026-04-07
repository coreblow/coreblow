/**
 * CoreBlow Phase 32 — Config→Registry→Boot Pipeline Chain Tests
 *
 * Layer 2 (Pipeline):
 *   EnvManager.parseEnvFile → EnvManager.load → ServiceRegistry.register
 *   → AppBootstrapper.boot → health verification
 */
import { describe, it, expect } from 'vitest';
import { EnvManager } from '../../src/config/env-manager.js';
import { ServiceRegistry } from '../../src/gateway/service-registry.js';
import { AppBootstrapper } from '../../src/gateway/app-bootstrapper.js';
import { EventStore } from '../../src/infra/event-sourcing.js';

describe('Phase32 Chain: Config→Registry→Boot Pipeline', () => {

    it('parse env file → load → register services → boot with health checks', async () => {
        const env = new EnvManager();
        env.define('PORT', 'number', true);
        env.define('DB_HOST', 'string', true);
        env.define('ENABLE_CACHE', 'boolean', false, true);

        // Step 1: Parse .env content
        const envContent = 'PORT=8080\nDB_HOST="db.internal"\nENABLE_CACHE=true';
        const parsed = env.parseEnvFile(envContent);

        // Step 2: Load parsed values
        const loadResult = env.load(parsed);
        expect(loadResult.valid).toBe(true);
        expect(env.get('PORT')).toBe(8080);
        expect(env.get('DB_HOST')).toBe('db.internal');

        // Step 3: Register services using config
        const registry = new ServiceRegistry();
        registry.register('database', { host: env.get('DB_HOST') });
        registry.register('cache', { enabled: env.get('ENABLE_CACHE') }, ['database']);
        registry.register('api', { port: env.get('PORT') }, ['database', 'cache']);

        // Step 4: Boot with health checks
        const boot = new AppBootstrapper();
        boot.register({
            name: 'database', order: 1, required: true,
            init: async () => { registry.start('database'); },
            healthCheck: async () => registry.resolve('database') !== null,
        });
        boot.register({
            name: 'cache', order: 2, required: false,
            init: async () => { registry.start('cache'); },
        });
        boot.register({
            name: 'api', order: 3, required: true,
            init: async () => { registry.start('api'); },
        });

        const bootResult = await boot.boot();
        expect(bootResult.success).toBe(true);

        // Verify
        expect(registry.getHealth().filter(h => h.status === 'started')).toHaveLength(3);
    });

    it('boot with audit trail — EventStore records each phase', async () => {
        const audit = new EventStore();
        const registry = new ServiceRegistry();
        const boot = new AppBootstrapper();

        registry.register('config', {});
        registry.register('agents', {}, ['config']);

        boot.register({
            name: 'config', order: 1, required: true,
            init: async () => {
                registry.start('config');
                audit.append('boot:phase', 'server', { phase: 'config', status: 'ok' });
            },
        });
        boot.register({
            name: 'agents', order: 2, required: true,
            init: async () => {
                registry.start('agents');
                audit.append('boot:phase', 'server', { phase: 'agents', status: 'ok' });
            },
        });

        await boot.boot();

        // Audit trail captures boot sequence
        const events = audit.getEvents('server');
        expect(events).toHaveLength(2);
        expect(events[0]!.payload.phase).toBe('config');
        expect(events[1]!.payload.phase).toBe('agents');
    });

    it('env validation failure → boot aborted → services not started', async () => {
        const env = new EnvManager();
        env.define('API_KEY', 'string', true); // Required, no default

        // Load without required var
        const loadResult = env.load({});
        expect(loadResult.valid).toBe(false);

        // If config validation fails, boot should be aborted
        const registry = new ServiceRegistry();
        registry.register('api', {});
        const boot = new AppBootstrapper();

        if (!loadResult.valid) {
            boot.register({
                name: 'config', order: 1, required: true,
                init: async () => { throw new Error(`Config invalid: ${loadResult.errors.join(', ')}`); },
            });
        }

        const bootResult = await boot.boot();
        expect(bootResult.success).toBe(false);
        expect(bootResult.phases[0]?.error).toContain('API_KEY');

        // Service should NOT be started
        const health = registry.getHealth();
        expect(health.every(h => h.status === 'registered')).toBe(true);
    });
});
