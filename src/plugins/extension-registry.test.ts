import { describe, it, expect, beforeEach } from 'vitest';
import { ExtensionRegistry } from './extension-registry.js';

describe('Extension Registry — Phase 9', () => {
    let registry: ExtensionRegistry;

    beforeEach(() => {
        registry = new ExtensionRegistry();
    });

    it('registers an extension', () => {
        const ok = registry.register({
            id: 'ext-1', name: 'Test Tool', type: 'tool', version: '1.0.0',
            description: 'A test tool extension',
        });
        expect(ok).toBe(true);
        expect(registry.count()).toBe(1);
    });

    it('rejects duplicate registration', () => {
        registry.register({ id: 'ext-1', name: 'A', type: 'tool', version: '1.0' });
        expect(registry.register({ id: 'ext-1', name: 'B', type: 'tool', version: '2.0' })).toBe(false);
    });

    it('activates extension', async () => {
        let setupCalled = false;
        registry.register({
            id: 'ext-1', name: 'X', type: 'channel', version: '1.0',
            setup: async () => { setupCalled = true; },
        });
        const ok = await registry.activate('ext-1');
        expect(ok).toBe(true);
        expect(setupCalled).toBe(true);
        expect(registry.get('ext-1')!.status).toBe('active');
    });

    it('activate handles setup error', async () => {
        registry.register({
            id: 'broken', name: 'Broken', type: 'tool', version: '1.0',
            setup: async () => { throw new Error('setup failed'); },
        });
        const ok = await registry.activate('broken');
        expect(ok).toBe(false);
        expect(registry.get('broken')!.status).toBe('error');
        expect(registry.get('broken')!.error).toBe('setup failed');
    });

    it('deactivates extension', async () => {
        let teardownCalled = false;
        registry.register({
            id: 'ext-1', name: 'X', type: 'tool', version: '1.0',
            setup: async () => {},
            teardown: async () => { teardownCalled = true; },
        });
        await registry.activate('ext-1');
        const ok = await registry.deactivate('ext-1');
        expect(ok).toBe(true);
        expect(teardownCalled).toBe(true);
        expect(registry.get('ext-1')!.status).toBe('inactive');
    });

    it('get returns null for missing', () => {
        expect(registry.get('nope')).toBeNull();
    });

    it('unregisters extension', () => {
        registry.register({ id: 'x', name: 'X', type: 'tool', version: '1.0' });
        expect(registry.unregister('x')).toBe(true);
        expect(registry.count()).toBe(0);
    });

    it('listByType filters correctly', () => {
        registry.register({ id: 'a', name: 'A', type: 'tool', version: '1.0' });
        registry.register({ id: 'b', name: 'B', type: 'channel', version: '1.0' });
        registry.register({ id: 'c', name: 'C', type: 'tool', version: '1.0' });
        expect(registry.listByType('tool')).toHaveLength(2);
        expect(registry.listByType('channel')).toHaveLength(1);
        expect(registry.listByType()).toHaveLength(3); // all
    });

    it('getActive returns only active extensions', async () => {
        registry.register({ id: 'a', name: 'A', type: 'tool', version: '1.0' });
        registry.register({ id: 'b', name: 'B', type: 'tool', version: '1.0' });
        await registry.activate('a');
        const active = registry.getActive();
        expect(active).toHaveLength(1);
        expect(active[0]!.id).toBe('a');
    });

    it('passes config to setup', async () => {
        let receivedConfig: Record<string, unknown> = {};
        registry.register({
            id: 'cfg', name: 'Cfg', type: 'middleware', version: '1.0',
            setup: async (config) => { receivedConfig = config; },
        });
        await registry.activate('cfg', { port: 8080 });
        expect(receivedConfig.port).toBe(8080);
    });
});
