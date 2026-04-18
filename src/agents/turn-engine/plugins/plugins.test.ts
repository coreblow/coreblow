/**
 * tests/unit/plugins.test.ts
 * Tests for the plugin SDK and registry
 */
import { describe, it, expect } from 'vitest';
import { defineExtension, type CoreBlowExtension, type LoadedExtension } from '../../../plugins/sdk.js';
import { ExtensionRegistry } from '../../../plugins/registry.js';

function createMockExtension(overrides: Partial<CoreBlowExtension> = {}): CoreBlowExtension {
    return defineExtension({
        meta: {
            name: overrides.meta?.name || 'test-extension',
            version: '1.0.0',
            description: 'Test extension',
        },
        async init() { },
        ...overrides,
    });
}

describe('defineExtension', () => {
    it('should return the extension as-is', () => {
        const ext = createMockExtension();
        expect(ext.meta.name).toBe('test-extension');
    });

    it('should preserve all fields', () => {
        const ext = defineExtension({
            meta: { name: 'full', version: '2.0.0', description: 'Full ext', author: 'Test', tags: ['ai'] },
            tools: [{ name: 'tool1', description: 'Test', parameters: {}, execute: async () => 'ok' }],
            hooks: { onMessage: async () => { } },
            async init() { },
            async start() { },
            async stop() { },
            async healthCheck() { return { ok: true }; },
        });
        expect(ext.meta.author).toBe('Test');
        expect(ext.tools?.length).toBe(1);
        expect(ext.hooks?.onMessage).toBeDefined();
    });
});

describe('ExtensionRegistry', () => {
    it('should register extensions', () => {
        const reg = new ExtensionRegistry();
        const ext = createMockExtension({ meta: { name: 'ext1', version: '1.0.0', description: '' } });
        reg.register({ extension: ext, enabled: true, dataDir: '/tmp' });
        expect(reg.list().length).toBe(1);
    });

    it('should collect tools from extensions', () => {
        const reg = new ExtensionRegistry();
        const ext = createMockExtension({
            tools: [
                { name: 'tool_a', description: 'A', parameters: {}, execute: async () => 'a' },
                { name: 'tool_b', description: 'B', parameters: {}, execute: async () => 'b' },
            ],
        });
        reg.register({ extension: ext, enabled: true, dataDir: '/tmp' });
        expect(reg.getTools().length).toBe(2);
    });

    it('should get extension by name', () => {
        const reg = new ExtensionRegistry();
        const ext = createMockExtension({ meta: { name: 'my-ext', version: '1.0.0', description: 'test' } });
        reg.register({ extension: ext, enabled: true, dataDir: '/tmp' });
        expect(reg.get('my-ext')).toBeDefined();
        expect(reg.get('non-existent')).toBeUndefined();
    });

    it('should list extensions with metadata', () => {
        const reg = new ExtensionRegistry();
        reg.register({
            extension: createMockExtension({
                meta: { name: 'ext1', version: '1.0.0', description: '' },
                tools: [{ name: 't', description: '', parameters: {}, execute: async () => '' }],
            }),
            enabled: true,
            dataDir: '/tmp',
        });

        const list = reg.list();
        expect(list[0].name).toBe('ext1');
        expect(list[0].enabled).toBe(true);
        expect(list[0].toolCount).toBe(1);
    });

    it('should run onMessage hooks', async () => {
        const reg = new ExtensionRegistry();
        let hookCalled = false;
        const ext = createMockExtension({
            hooks: { onMessage: async () => { hookCalled = true; } },
        });
        reg.register({ extension: ext, enabled: true, dataDir: '/tmp' });
        await reg.runOnMessage({ text: 'test' });
        expect(hookCalled).toBe(true);
    });

    it('should run onResponse hooks', async () => {
        const reg = new ExtensionRegistry();
        let called = false;
        const ext = createMockExtension({
            hooks: { onResponse: async () => { called = true; } },
        });
        reg.register({ extension: ext, enabled: true, dataDir: '/tmp' });
        await reg.runOnResponse({ text: 'response' });
        expect(called).toBe(true);
    });

    it('should run onToolCall hooks and return result', async () => {
        const reg = new ExtensionRegistry();
        const ext = createMockExtension({
            hooks: { onToolCall: async (name, args) => `intercepted:${name}` },
        });
        reg.register({ extension: ext, enabled: true, dataDir: '/tmp' });
        const result = await reg.runOnToolCall('web_fetch', {});
        expect(result).toBe('intercepted:web_fetch');
    });

    it('should stop all extensions', async () => {
        const reg = new ExtensionRegistry();
        let stopped = false;
        const ext = createMockExtension({
            async stop() { stopped = true; },
        });
        reg.register({ extension: ext, enabled: true, dataDir: '/tmp' });
        await reg.stopAll();
        expect(stopped).toBe(true);
    });

    it('should health check all extensions', async () => {
        const reg = new ExtensionRegistry();
        reg.register({
            extension: createMockExtension({
                meta: { name: 'healthy', version: '1.0.0', description: '' },
                async healthCheck() { return { ok: true, details: 'All good' }; },
            }),
            enabled: true,
            dataDir: '/tmp',
        });
        const results = await reg.healthCheckAll();
        expect(results['healthy'].ok).toBe(true);
    });
});
