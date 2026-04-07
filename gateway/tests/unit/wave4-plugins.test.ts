/**
 * Wave 4 — Plugin System Core Tests
 *
 * Tests for: types.ts, registry.ts (PluginRegistry), hooks.ts (HookRunner),
 * plugin-loader.ts, discovery.ts, types.base.ts
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PluginRegistry } from '../../src/plugins/registry.js';
import { HookRunner } from '../../src/plugins/hooks.js';
import { PluginDiscovery } from '../../src/plugins/discovery.js';
import { PluginConfigState } from '../../src/plugins/config-state.js';
import { PluginStatusReporter } from '../../src/plugins/status.js';
import { PluginServiceManager } from '../../src/plugins/services.js';
import { PluginInstaller } from '../../src/plugins/install.js';
import { PluginMarketplace } from '../../src/plugins/marketplace.js';
import {
    createPluginRecord,
    toPluginId,
    isPluginHookName,
    createEmptyPluginRegistryData,
} from '../../src/plugins/types.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ═══════════════════════════════════════════════════════════════════
// types.ts + types.base.ts
// ═══════════════════════════════════════════════════════════════════

describe('Plugin Types', () => {
    describe('toPluginId', () => {
        it('should create a branded PluginId', () => {
            const id = toPluginId('@coreblow/weather');
            expect(id).toBe('@coreblow/weather');
        });
    });

    describe('isPluginHookName', () => {
        it('should recognize valid hook names', () => {
            expect(isPluginHookName('before_agent_start')).toBe(true);
            expect(isPluginHookName('message_received')).toBe(true);
            expect(isPluginHookName('before_tool_call')).toBe(true);
            expect(isPluginHookName('gateway_start')).toBe(true);
        });

        it('should reject invalid hook names', () => {
            expect(isPluginHookName('invalid_hook')).toBe(false);
            expect(isPluginHookName('')).toBe(false);
            expect(isPluginHookName('random')).toBe(false);
        });
    });

    describe('createPluginRecord', () => {
        it('should create a record with defaults', () => {
            const record = createPluginRecord({
                id: 'test-plugin',
                source: '/tmp/test',
                origin: 'workspace',
                enabled: true,
            });
            expect(record.id).toBe('test-plugin');
            expect(record.name).toBe('test-plugin');
            expect(record.status).toBe('loaded');
            expect(record.toolNames).toEqual([]);
            expect(record.hookNames).toEqual([]);
        });

        it('should set status to disabled when not enabled', () => {
            const record = createPluginRecord({
                id: 'disabled',
                source: '/tmp/test',
                origin: 'bundled',
                enabled: false,
            });
            expect(record.status).toBe('disabled');
        });

        it('should preserve provided name', () => {
            const record = createPluginRecord({
                id: 'id',
                name: 'My Plugin',
                source: '/tmp',
                origin: 'npm',
                enabled: true,
            });
            expect(record.name).toBe('My Plugin');
        });
    });

    describe('createEmptyPluginRegistryData', () => {
        it('should return all empty arrays', () => {
            const data = createEmptyPluginRegistryData();
            expect(data.plugins).toEqual([]);
            expect(data.tools).toEqual([]);
            expect(data.hooks).toEqual([]);
            expect(data.typedHooks).toEqual([]);
            expect(data.channels).toEqual([]);
            expect(data.providers).toEqual([]);
            expect(data.services).toEqual([]);
            expect(data.commands).toEqual([]);
            expect(data.httpRoutes).toEqual([]);
            expect(data.diagnostics).toEqual([]);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// PluginRegistry
// ═══════════════════════════════════════════════════════════════════

describe('PluginRegistry', () => {
    let registry: PluginRegistry;

    beforeEach(() => {
        registry = new PluginRegistry();
    });

    describe('plugin records', () => {
        it('should add and retrieve plugins', () => {
            const record = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            registry.addPlugin(record);
            expect(registry.getPlugin('p1')).toBeDefined();
            expect(registry.getPlugins()).toHaveLength(1);
        });

        it('should filter loaded plugins', () => {
            registry.addPlugin(createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true }));
            registry.addPlugin(createPluginRecord({ id: 'p2', source: '/tmp', origin: 'bundled', enabled: false }));
            expect(registry.getLoadedPlugins()).toHaveLength(1);
        });
    });

    describe('tool registration', () => {
        it('should register tools', () => {
            const record = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            registry.registerTool(record, { name: 'web_search', description: '', parameters: {}, execute: async () => '' });
            expect(registry.getTools()).toHaveLength(1);
            expect(record.toolNames).toContain('web_search');
        });
    });

    describe('hook registration', () => {
        it('should register typed hooks', () => {
            const record = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            registry.registerHook(record, 'message_received', async () => {}, { name: 'test-hook' });
            expect(registry.getHooks()).toHaveLength(1);
            expect(registry.getTypedHooks('message_received')).toHaveLength(1);
        });

        it('should reject duplicate hook events', () => {
            const r1 = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            const r2 = createPluginRecord({ id: 'p2', source: '/tmp', origin: 'workspace', enabled: true });
            registry.registerHook(r1, 'message_received', async () => {}, { name: 'hook1' });
            registry.registerHook(r2, 'message_received', async () => {}, { name: 'hook2' });
            expect(registry.getDiagnostics().some(d => d.level === 'error')).toBe(true);
        });

        it('should sort hooks by priority', () => {
            const record = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            registry.registerHook(record, 'before_tool_call', async () => 'low', { name: 'low', priority: 10 });
            const r2 = createPluginRecord({ id: 'p2', source: '/tmp', origin: 'bundled', enabled: true });
            registry.registerHook(r2, 'after_tool_call', async () => 'high', { name: 'high', priority: 100 });
            const hooks = registry.getTypedHooks();
            expect(hooks).toHaveLength(2);
        });
    });

    describe('channel registration', () => {
        it('should register channels', () => {
            const record = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            registry.registerChannel(record, { id: 'discord', name: 'Discord' });
            expect(registry.getChannels()).toHaveLength(1);
            expect(record.channelIds).toContain('discord');
        });

        it('should reject duplicate channels', () => {
            const r1 = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            const r2 = createPluginRecord({ id: 'p2', source: '/tmp', origin: 'workspace', enabled: true });
            registry.registerChannel(r1, { id: 'discord', name: 'Discord' });
            registry.registerChannel(r2, { id: 'discord', name: 'Discord' });
            expect(registry.getDiagnostics().some(d => d.level === 'error')).toBe(true);
        });
    });

    describe('provider registration', () => {
        it('should register providers', () => {
            const record = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            registry.registerProvider(record, { id: 'openai', name: 'OpenAI' });
            expect(registry.getProviders()).toHaveLength(1);
        });
    });

    describe('service registration', () => {
        it('should register services', () => {
            const record = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            registry.registerService(record, {
                id: 'bg-worker',
                start: async () => {},
                stop: async () => {},
            });
            expect(registry.getServices()).toHaveLength(1);
        });
    });

    describe('command registration', () => {
        it('should register commands', () => {
            const record = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            registry.registerCommand(record, { name: '/weather', description: 'Get weather', handler: async () => 'sunny' });
            expect(registry.getCommands()).toHaveLength(1);
        });

        it('should reject duplicate commands', () => {
            const r1 = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            const r2 = createPluginRecord({ id: 'p2', source: '/tmp', origin: 'workspace', enabled: true });
            registry.registerCommand(r1, { name: '/weather', description: 'W1', handler: async () => '' });
            registry.registerCommand(r2, { name: '/weather', description: 'W2', handler: async () => '' });
            expect(registry.getDiagnostics().some(d => d.level === 'error')).toBe(true);
        });
    });

    describe('HTTP route registration', () => {
        it('should register routes', () => {
            const record = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            registry.registerHttpRoute(record, { path: '/api/weather', handler: () => {}, auth: 'gateway' });
            expect(registry.getHttpRoutes()).toHaveLength(1);
            expect(record.httpRoutes).toBe(1);
        });

        it('should normalize path with leading slash', () => {
            const record = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            registry.registerHttpRoute(record, { path: 'api/test', handler: () => {}, auth: 'plugin' });
            expect(registry.getHttpRoutes()[0]!.path).toBe('/api/test');
        });
    });

    describe('summary', () => {
        it('should return accurate counts', () => {
            const record = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            registry.addPlugin(record);
            registry.registerTool(record, { name: 't1', description: '', parameters: {}, execute: async () => '' });
            const summary = registry.getSummary();
            expect(summary.pluginCount).toBe(1);
            expect(summary.loadedCount).toBe(1);
            expect(summary.toolCount).toBe(1);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// HookRunner
// ═══════════════════════════════════════════════════════════════════

describe('HookRunner', () => {
    let registry: PluginRegistry;
    let runner: HookRunner;

    beforeEach(() => {
        registry = new PluginRegistry();
        runner = new HookRunner(registry);
    });

    describe('void hooks', () => {
        it('should execute void hooks in parallel', async () => {
            const record = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            let called = false;
            registry.registerHook(record, 'message_received', async () => { called = true; }, { name: 'h1' });
            await runner.runVoidHook('message_received', {}, {});
            expect(called).toBe(true);
        });

        it('should catch errors when catchErrors is true', async () => {
            const record = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            registry.registerHook(record, 'session_start', async () => { throw new Error('boom'); }, { name: 'h1' });
            await expect(runner.runVoidHook('session_start', {}, {})).resolves.toBeUndefined();
        });
    });

    describe('modifying hooks', () => {
        it('should merge results from multiple handlers', async () => {
            const r1 = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            registry.registerHook(r1, 'before_model_resolve', async () => ({ modelOverride: 'gpt-4' }), { name: 'h1', priority: 100 });
            const result = await runner.runModifyingHook<'before_model_resolve', Record<string, unknown>>(
                'before_model_resolve', {}, {},
            );
            expect(result).toEqual({ modelOverride: 'gpt-4' });
        });
    });

    describe('claiming hooks', () => {
        it('should stop at first handled result', async () => {
            const r1 = createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true });
            registry.registerHook(r1, 'before_dispatch', async () => ({ handled: true, response: 'claimed!' }), { name: 'h1' });
            const result = await runner.runClaimingHook<'before_dispatch', { handled: boolean; response?: string }>(
                'before_dispatch', {}, {},
            );
            expect(result?.handled).toBe(true);
            expect(result?.response).toBe('claimed!');
        });

        it('should return undefined when no handler claims', async () => {
            const result = await runner.runClaimingHook<'before_dispatch', { handled: boolean }>(
                'before_dispatch', {}, {},
            );
            expect(result).toBeUndefined();
        });
    });

    describe('targeted plugin hooks', () => {
        it('should return missing_plugin when plugin not loaded', async () => {
            const result = await runner.runClaimingHookForPlugin<'inbound_claim', { handled: boolean }>(
                'inbound_claim', 'nonexistent', {}, {},
            );
            expect(result.status).toBe('missing_plugin');
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// PluginDiscovery
// ═══════════════════════════════════════════════════════════════════

describe('PluginDiscovery', () => {
    let tmpDir: string;
    let discovery: PluginDiscovery;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-discovery-'));
        discovery = new PluginDiscovery();
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should discover plugins from directory', () => {
        const pluginDir = path.join(tmpDir, 'my-plugin');
        fs.mkdirSync(pluginDir);
        fs.writeFileSync(path.join(pluginDir, 'plugin.json'), JSON.stringify({
            name: 'my-plugin', version: '1.0.0', main: 'index.js',
        }));

        const result = discovery.discover({ bundledDir: tmpDir });
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0]!.id).toBe('my-plugin');
        expect(result.candidates[0]!.origin).toBe('bundled');
    });

    it('should skip duplicate plugin IDs', () => {
        const p1 = path.join(tmpDir, 'plugin-a');
        const p2 = path.join(tmpDir, 'plugin-b');
        fs.mkdirSync(p1); fs.mkdirSync(p2);
        fs.writeFileSync(path.join(p1, 'plugin.json'), JSON.stringify({ name: 'same-id', version: '1.0.0' }));
        fs.writeFileSync(path.join(p2, 'plugin.json'), JSON.stringify({ name: 'same-id', version: '2.0.0' }));

        const result = discovery.discover({ bundledDir: tmpDir });
        expect(result.candidates).toHaveLength(1);
    });

    it('should handle missing directories gracefully', () => {
        const result = discovery.discover({ bundledDir: '/nonexistent/path' });
        expect(result.candidates).toHaveLength(0);
        expect(result.errors).toHaveLength(0);
    });

    it('should filter by onlyPluginIds', () => {
        const p1 = path.join(tmpDir, 'plugin-a');
        const p2 = path.join(tmpDir, 'plugin-b');
        fs.mkdirSync(p1); fs.mkdirSync(p2);
        fs.writeFileSync(path.join(p1, 'plugin.json'), JSON.stringify({ name: 'plugin-a', version: '1.0.0' }));
        fs.writeFileSync(path.join(p2, 'plugin.json'), JSON.stringify({ name: 'plugin-b', version: '1.0.0' }));

        const result = discovery.discover({ bundledDir: tmpDir, onlyPluginIds: ['plugin-a'] });
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0]!.id).toBe('plugin-a');
    });
});

// ═══════════════════════════════════════════════════════════════════
// PluginConfigState
// ═══════════════════════════════════════════════════════════════════

describe('PluginConfigState', () => {
    let configState: PluginConfigState;

    beforeEach(() => {
        configState = new PluginConfigState();
    });

    describe('normalize', () => {
        it('should return defaults for empty config', () => {
            const result = configState.normalize();
            expect(result.enabled).toBe(true);
            expect(result.allow).toEqual([]);
            expect(result.deny).toEqual([]);
        });

        it('should parse allow/deny lists', () => {
            const result = configState.normalize({
                allow: ['plugin-a', 'plugin-b'],
                deny: ['plugin-c'],
            });
            expect(result.allow).toEqual(['plugin-a', 'plugin-b']);
            expect(result.deny).toEqual(['plugin-c']);
        });
    });

    describe('resolveEnableState', () => {
        it('should respect explicit overrides', () => {
            const config = configState.normalize({ enable: { 'my-plugin': false } });
            expect(configState.resolveEnableState('my-plugin', config).enabled).toBe(false);
            expect(configState.resolveEnableState('my-plugin', config).reason).toBe('disable-override');
        });

        it('should block deny-listed plugins', () => {
            const config = configState.normalize({ deny: ['bad-plugin'] });
            expect(configState.resolveEnableState('bad-plugin', config).enabled).toBe(false);
        });

        it('should block plugins not in allow-list', () => {
            const config = configState.normalize({ allow: ['good-plugin'] });
            expect(configState.resolveEnableState('other', config).enabled).toBe(false);
            expect(configState.resolveEnableState('good-plugin', config).enabled).toBe(true);
        });
    });

    describe('validateConfig', () => {
        it('should pass with no schema', () => {
            const result = configState.validateConfig(undefined, { key: 'value' });
            expect(result.ok).toBe(true);
        });

        it('should use validate() method', () => {
            const schema = { validate: (v: unknown) => ({ ok: true as const, value: v }) };
            expect(configState.validateConfig(schema, {}).ok).toBe(true);
        });

        it('should report validation errors', () => {
            const schema = { validate: () => ({ ok: false as const, errors: ['missing field'] }) };
            const result = configState.validateConfig(schema, {});
            expect(result.ok).toBe(false);
            expect(result.errors).toContain('missing field');
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// PluginStatusReporter
// ═══════════════════════════════════════════════════════════════════

describe('PluginStatusReporter', () => {
    let reporter: PluginStatusReporter;

    beforeEach(() => {
        reporter = new PluginStatusReporter();
    });

    it('should summarize registry data', () => {
        const data = createEmptyPluginRegistryData();
        data.plugins.push(createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true }));
        const summary = reporter.summarize(data);
        expect(summary.total).toBe(1);
        expect(summary.loaded).toBe(1);
    });

    it('should generate CLI output', () => {
        const data = createEmptyPluginRegistryData();
        data.plugins.push(createPluginRecord({ id: 'p1', source: '/tmp', origin: 'bundled', enabled: true }));
        const output = reporter.formatForCli(data);
        expect(output).toContain('Plugin Status');
        expect(output).toContain('p1');
    });

    it('should format for API', () => {
        const data = createEmptyPluginRegistryData();
        const apiResult = reporter.formatForApi(data);
        expect(apiResult.summary).toBeDefined();
        expect(apiResult.plugins).toBeDefined();
        expect(apiResult.diagnostics).toBeDefined();
    });

    it('should report healthy when no errors', () => {
        const data = createEmptyPluginRegistryData();
        expect(reporter.isHealthy(data)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════
// PluginServiceManager
// ═══════════════════════════════════════════════════════════════════

describe('PluginServiceManager', () => {
    let manager: PluginServiceManager;

    beforeEach(() => {
        manager = new PluginServiceManager();
    });

    it('should start and stop services', async () => {
        let started = false;
        let stopped = false;
        manager.register({
            pluginId: 'p1', pluginName: 'P1', source: '/tmp',
            service: {
                id: 'bg', start: async () => { started = true; }, stop: async () => { stopped = true; },
            },
        });

        await manager.startAll();
        expect(started).toBe(true);
        expect(manager.isRunning('p1', 'bg')).toBe(true);

        await manager.stopAll();
        expect(stopped).toBe(true);
        expect(manager.isRunning('p1', 'bg')).toBe(false);
    });

    it('should health check services', async () => {
        manager.register({
            pluginId: 'p1', source: '/tmp',
            service: {
                id: 'svc1',
                healthCheck: async () => ({ healthy: true }),
            },
        });
        const results = await manager.healthCheckAll();
        expect(results).toHaveLength(1);
        expect(results[0]!.healthy).toBe(true);
    });

    it('should track stats', () => {
        manager.register({
            pluginId: 'p1', source: '/tmp',
            service: { id: 'svc1' },
        });
        const stats = manager.getStats();
        expect(stats.total).toBe(1);
        expect(stats.running).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// PluginInstaller
// ═══════════════════════════════════════════════════════════════════

describe('PluginInstaller', () => {
    let installer: PluginInstaller;
    let tmpDir: string;
    let sourceDir: string;

    beforeEach(() => {
        installer = new PluginInstaller();
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'installer-'));
        sourceDir = path.join(tmpDir, 'source-plugin');
        fs.mkdirSync(sourceDir);
        fs.writeFileSync(path.join(sourceDir, 'plugin.json'), JSON.stringify({
            name: 'test-plugin', version: '1.0.0',
        }));
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should install from local path', async () => {
        const targetDir = path.join(tmpDir, 'installed');
        const result = await installer.installFromLocal(sourceDir, targetDir);
        expect(result.success).toBe(true);
        expect(result.pluginId).toBe('test-plugin');
    });

    it('should fail for nonexistent paths', async () => {
        const result = await installer.installFromLocal('/nonexistent', '/tmp');
        expect(result.success).toBe(false);
    });

    it('should uninstall plugins', async () => {
        const targetDir = path.join(tmpDir, 'installed');
        await installer.installFromLocal(sourceDir, targetDir);
        const result = await installer.uninstall('test-plugin');
        expect(result.success).toBe(true);
    });

    it('should track installs', async () => {
        const targetDir = path.join(tmpDir, 'installed');
        await installer.installFromLocal(sourceDir, targetDir);
        expect(installer.getInstall('test-plugin')).toBeDefined();
        expect(installer.getInstalls().size).toBe(1);
    });
});

// ═══════════════════════════════════════════════════════════════════
// PluginMarketplace
// ═══════════════════════════════════════════════════════════════════

describe('PluginMarketplace', () => {
    let marketplace: PluginMarketplace;

    beforeEach(() => {
        marketplace = new PluginMarketplace();
        marketplace.loadCatalog([
            { id: 'weather', name: 'Weather', version: '1.0.0', description: 'Weather data', tags: ['weather', 'api'], downloads: 1000, verified: true },
            { id: 'translate', name: 'Translate', version: '2.0.0', description: 'Translation', tags: ['i18n'], downloads: 500, author: 'core-team' },
            { id: 'image-gen', name: 'Image Gen', version: '1.0.0', description: 'Image generation', tags: ['ai', 'image'], provides: ['image-generation'], downloads: 2000 },
        ]);
    });

    it('should search by query', () => {
        const result = marketplace.search({ query: 'weather' });
        expect(result.plugins).toHaveLength(1);
        expect(result.plugins[0]!.id).toBe('weather');
    });

    it('should search by tags', () => {
        const result = marketplace.search({ tags: ['ai'] });
        expect(result.plugins).toHaveLength(1);
    });

    it('should search by author', () => {
        const result = marketplace.search({ author: 'core-team' });
        expect(result.plugins).toHaveLength(1);
    });

    it('should sort by downloads', () => {
        const result = marketplace.search({ sort: 'downloads' });
        expect(result.plugins[0]!.id).toBe('image-gen');
    });

    it('should paginate results', () => {
        const result = marketplace.search({ limit: 2, offset: 0 });
        expect(result.plugins).toHaveLength(2);
        expect(result.total).toBe(3);
    });

    it('should get categories', () => {
        const cats = marketplace.getCategories();
        expect(cats.length).toBeGreaterThan(0);
    });

    it('should get verified plugins', () => {
        const verified = marketplace.getVerified();
        expect(verified).toHaveLength(1);
        expect(verified[0]!.id).toBe('weather');
    });

    it('should get by provider capability', () => {
        const result = marketplace.getByProvider('image-generation');
        expect(result).toHaveLength(1);
    });

    it('should count plugins', () => {
        expect(marketplace.count()).toBe(3);
    });
});
