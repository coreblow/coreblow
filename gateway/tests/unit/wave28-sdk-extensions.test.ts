/**
 * Wave 28: Plugin SDK & Extensions
 *
 * Following CoreBlow's plugin-sdk testing patterns + extension-registry.ts
 * + cli-scaffold.ts patterns, upgraded for CoreBlow OOP.
 *
 * Tests SDK mock factories, TestPluginHarness, ExtensionRegistry,
 * and PluginScaffold template generation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    createMockContext,
    createMockLogger,
    createMockEventBus,
    createMockApi,
    TestPluginHarness,
} from '../../src/plugin-sdk/testing.js';
import { ExtensionRegistry, type ExtensionType } from '../../src/plugins/extension-registry.js';
import { PluginScaffold, type ScaffoldTemplate } from '../../src/plugin-sdk/cli-scaffold.js';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ═══════════════════════════════════════════════════════════════════
// SDK Mock Factories
// ═══════════════════════════════════════════════════════════════════

describe('Plugin SDK — Mock Context', () => {
    it('createMockContext returns full context', () => {
        const ctx = createMockContext();
        expect(ctx.pluginId).toBe('test-plugin');
        expect(ctx.pluginDir).toBeDefined();
        expect(ctx.config).toBeDefined();
        expect(ctx.log).toBeDefined();
        expect(ctx.events).toBeDefined();
        expect(ctx.api).toBeDefined();
    });

    it('createMockContext accepts overrides', () => {
        const ctx = createMockContext({ pluginId: 'custom', config: { key: 'val' } });
        expect(ctx.pluginId).toBe('custom');
        expect(ctx.config).toEqual({ key: 'val' });
    });

    it('createMockLogger records calls', () => {
        const logger = createMockLogger();
        logger.info('hello', 'world');
        logger.warn('warning');
        logger.error('error');
        logger.debug('debug');

        expect(logger.calls).toHaveLength(4);
        expect(logger.calls[0]).toEqual({ level: 'info', msg: 'hello', args: ['world'] });
        expect(logger.calls[1].level).toBe('warn');
    });

    it('createMockEventBus emits and receives', () => {
        const bus = createMockEventBus();
        const events: unknown[] = [];
        bus.on('test', (data) => events.push(data));
        bus.emit('test', { msg: 'hi' });

        expect(bus.emitted).toHaveLength(1);
        expect(events).toHaveLength(1);
    });

    it('createMockApi provides tool/command registration', () => {
        const api = createMockApi();
        api.registerTool({ name: 'my_tool', description: 'test', execute: async () => ({}) } as any);
        api.registerCommand({ name: 'cmd', handler: async () => {} } as any);

        expect(api.registeredTools).toHaveLength(1);
        expect(api.registeredCommands).toHaveLength(1);
    });
});

// ═══════════════════════════════════════════════════════════════════
// TestPluginHarness
// ═══════════════════════════════════════════════════════════════════

describe('Plugin SDK — TestPluginHarness', () => {
    it('creates harness with defaults', () => {
        const harness = new TestPluginHarness();
        expect(harness.isActivated()).toBe(false);
        const ctx = harness.getContext();
        expect(ctx.pluginId).toBe('test-plugin');
    });

    it('activates a plugin', async () => {
        let activated = false;
        const harness = new TestPluginHarness({
            activate: async () => { activated = true; },
        });

        await harness.activate();
        expect(activated).toBe(true);
        expect(harness.isActivated()).toBe(true);
    });

    it('deactivates a plugin', async () => {
        let deactivated = false;
        const harness = new TestPluginHarness({
            activate: async () => {},
            deactivate: async () => { deactivated = true; },
        });

        await harness.activate();
        await harness.deactivate();
        expect(deactivated).toBe(true);
        expect(harness.isActivated()).toBe(false);
    });

    it('getLogger returns mock logger', () => {
        const harness = new TestPluginHarness();
        const logger = harness.getLogger();
        logger.info('test');
        expect(logger.calls).toHaveLength(1);
    });

    it('getEventBus returns mock bus', () => {
        const harness = new TestPluginHarness();
        const bus = harness.getEventBus();
        bus.emit('test', null);
        expect(bus.emitted).toHaveLength(1);
    });

    it('getApi returns mock api', () => {
        const harness = new TestPluginHarness();
        const api = harness.getApi();
        api.registerTool({ name: 't', description: 'd', execute: async () => ({}) } as any);
        expect(api.registeredTools).toHaveLength(1);
    });
});

// ═══════════════════════════════════════════════════════════════════
// ExtensionRegistry
// ═══════════════════════════════════════════════════════════════════

describe('ExtensionRegistry', () => {
    let registry: ExtensionRegistry;

    beforeEach(() => { registry = new ExtensionRegistry(); });

    it('registers an extension', () => {
        const ok = registry.register({ id: 'ext-1', name: 'Tool', type: 'tool', version: '1.0.0' });
        expect(ok).toBe(true);
        expect(registry.count()).toBe(1);
    });

    it('rejects duplicate registration', () => {
        registry.register({ id: 'dup', name: 'A', type: 'tool', version: '1.0.0' });
        const ok = registry.register({ id: 'dup', name: 'B', type: 'channel', version: '2.0.0' });
        expect(ok).toBe(false);
    });

    it('gets an extension', () => {
        registry.register({ id: 'get-test', name: 'G', type: 'provider', version: '1.0.0' });
        const ext = registry.get('get-test');
        expect(ext).not.toBeNull();
        expect(ext!.status).toBe('registered');
    });

    it('returns null for unknown', () => {
        expect(registry.get('nope')).toBeNull();
    });

    it('activates an extension', async () => {
        let setupCalled = false;
        registry.register({
            id: 'act', name: 'A', type: 'tool', version: '1.0.0',
            setup: async () => { setupCalled = true; },
        });

        const ok = await registry.activate('act');
        expect(ok).toBe(true);
        expect(setupCalled).toBe(true);
        expect(registry.get('act')!.status).toBe('active');
    });

    it('activate with config passes config to setup', async () => {
        let receivedConfig: Record<string, unknown> = {};
        registry.register({
            id: 'cfg', name: 'C', type: 'tool', version: '1.0.0',
            setup: async (config) => { receivedConfig = config; },
        });

        await registry.activate('cfg', { key: 'value' });
        expect(receivedConfig).toEqual({ key: 'value' });
    });

    it('handles setup error', async () => {
        registry.register({
            id: 'fail', name: 'F', type: 'tool', version: '1.0.0',
            setup: async () => { throw new Error('setup failed'); },
        });

        const ok = await registry.activate('fail');
        expect(ok).toBe(false);
        expect(registry.get('fail')!.status).toBe('error');
        expect(registry.get('fail')!.error).toContain('setup failed');
    });

    it('deactivates an extension', async () => {
        let tornDown = false;
        registry.register({
            id: 'deact', name: 'D', type: 'tool', version: '1.0.0',
            setup: async () => {},
            teardown: async () => { tornDown = true; },
        });

        await registry.activate('deact');
        const ok = await registry.deactivate('deact');
        expect(ok).toBe(true);
        expect(tornDown).toBe(true);
        expect(registry.get('deact')!.status).toBe('inactive');
    });

    it('cannot deactivate non-active', async () => {
        registry.register({ id: 'idle', name: 'I', type: 'tool', version: '1.0.0' });
        const ok = await registry.deactivate('idle');
        expect(ok).toBe(false);
    });

    it('unregisters an extension', () => {
        registry.register({ id: 'rm', name: 'R', type: 'tool', version: '1.0.0' });
        expect(registry.unregister('rm')).toBe(true);
        expect(registry.count()).toBe(0);
    });

    it('listByType filters correctly', () => {
        registry.register({ id: 't1', name: 'T1', type: 'tool', version: '1.0.0' });
        registry.register({ id: 'c1', name: 'C1', type: 'channel', version: '1.0.0' });
        registry.register({ id: 't2', name: 'T2', type: 'tool', version: '1.0.0' });

        expect(registry.listByType('tool')).toHaveLength(2);
        expect(registry.listByType('channel')).toHaveLength(1);
        expect(registry.listByType()).toHaveLength(3); // all
    });

    it('getActive returns only active', async () => {
        registry.register({ id: 'a', name: 'A', type: 'tool', version: '1.0.0' });
        registry.register({ id: 'b', name: 'B', type: 'tool', version: '1.0.0' });
        await registry.activate('a');

        expect(registry.getActive()).toHaveLength(1);
        expect(registry.getActive()[0].id).toBe('a');
    });
});

// ═══════════════════════════════════════════════════════════════════
// PluginScaffold
// ═══════════════════════════════════════════════════════════════════

describe('PluginScaffold', () => {
    let scaffold: PluginScaffold;
    let tmpDir: string;

    beforeEach(() => {
        scaffold = new PluginScaffold();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w28-scaffold-'));
    });

    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('generates basic template', () => {
        const result = scaffold.generate({
            name: 'my-plugin',
            template: 'basic',
            targetDir: path.join(tmpDir, 'my-plugin'),
        });

        expect(result.success).toBe(true);
        expect(result.filesCreated.length).toBeGreaterThan(0);
        expect(result.filesCreated.some(f => f.includes('plugin.json'))).toBe(true);
    });

    it('generates tool template', () => {
        const result = scaffold.generate({
            name: 'my-tool-plugin',
            template: 'tool',
            targetDir: path.join(tmpDir, 'my-tool-plugin'),
        });

        expect(result.success).toBe(true);
        expect(result.filesCreated.some(f => f.includes('tools.ts'))).toBe(true);
    });

    it('generates full template with all files', () => {
        const result = scaffold.generate({
            name: 'full-plugin',
            template: 'full',
            targetDir: path.join(tmpDir, 'full-plugin'),
        });

        expect(result.success).toBe(true);
        expect(result.filesCreated.length).toBeGreaterThanOrEqual(6);
        expect(result.filesCreated.some(f => f.includes('tools.ts'))).toBe(true);
        expect(result.filesCreated.some(f => f.includes('hooks.ts'))).toBe(true);
        expect(result.filesCreated.some(f => f.includes('commands.ts'))).toBe(true);
    });

    it('includes plugin name in generated manifest', () => {
        const dir = path.join(tmpDir, 'named-plugin');
        scaffold.generate({ name: 'named-plugin', template: 'basic', targetDir: dir });
        const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf-8'));
        expect(manifest.name).toBe('named-plugin');
    });

    it('listTemplates includes basic, tool, full', () => {
        const templates = scaffold.listTemplates();
        const names = templates.map(t => t.name);
        expect(names).toContain('basic');
        expect(names).toContain('tool');
        expect(names).toContain('full');
    });

    it('fails if directory exists without overwrite', () => {
        const dir = path.join(tmpDir, 'exists');
        fs.mkdirSync(dir);
        const result = scaffold.generate({ name: 'exists', targetDir: dir });
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validateName rejects invalid names', () => {
        expect(scaffold.validateName('').valid).toBe(false);
        expect(scaffold.validateName('X').valid).toBe(false);
        expect(scaffold.validateName('coreblow-x').valid).toBe(false);
        expect(scaffold.validateName('my-plugin').valid).toBe(true);
    });
});
