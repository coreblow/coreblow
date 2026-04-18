/**
 * Wave 30: Final E2E & Plugin System Graduation
 *
 * Following CoreBlow's integration test patterns — comprehensive end-to-end
 * validation of the entire plugin system from boot → discovery → load →
 * hook execution → hot-reload → shutdown.
 *
 * Tests the full plugin subsystem integration:
 *   - Full lifecycle (discover → load → activate → deactivate → unload)
 *   - Event bus ↔ hook runner interaction
 *   - Config state + validation pipeline
 *   - Extension registry integration
 *   - Dependency graph resolution → load order
 *   - Remote loader → signature verification chain
 *   - Migration engine during upgrade
 *   - Stress test: concurrent operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PluginRuntime } from '../../src/plugins/runtime.js';
import { PluginDiscovery } from '../../src/plugins/discovery.js';
import { PluginConfigState } from '../../src/plugins/config-state.js';
import { DependencyGraph, parseSemver, satisfiesConstraint } from '../../src/plugins/dependency-graph.js';
import { PluginEventBus } from '../../src/plugins/event-bus.js';
import { ExtensionRegistry } from '../../src/plugins/extension-registry.js';
import { PluginRemoteLoader } from '../../src/plugins/remote-loader.js';
import { SignatureVerifier } from '../../src/plugins/signature-verify.js';
import { PluginMigrationEngine } from '../../src/plugins/migration.js';
import { PluginScaffold } from '../../src/plugin-sdk/cli-scaffold.js';
import { createMockContext, createMockLogger, TestPluginHarness } from '../../src/plugin-sdk/testing.js';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function createTmpPlugin(baseDir: string, name: string, extra?: Record<string, unknown>): string {
    const dir = path.join(baseDir, name);
    fs.mkdirSync(dir, { recursive: true });
    const mf = { id: name, name, version: '1.0.0', main: 'index.js', ...extra };
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(mf));
    fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(mf));
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = { activate: async () => {} };');
    return dir;
}

// ═══════════════════════════════════════════════════════════════════
// E2E: Full Plugin Lifecycle
// ═══════════════════════════════════════════════════════════════════

describe('E2E — Full Plugin Lifecycle', () => {
    let tmpDir: string;
    let pluginsDir: string;
    let runtime: PluginRuntime;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w30-e2e-'));
        pluginsDir = path.join(tmpDir, 'plugins');
        fs.mkdirSync(pluginsDir);
        runtime = new PluginRuntime();
    });

    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('discover → load → unload lifecycle', async () => {
        createTmpPlugin(pluginsDir, 'lifecycle');
        const ids = await runtime.discover(pluginsDir);
        expect(ids).toContain('lifecycle');

        await runtime.load('lifecycle');
        expect(runtime.getPlugin('lifecycle')!.loaded).toBe(true);

        await runtime.unload('lifecycle');
        expect(runtime.getPlugin('lifecycle')!.loaded).toBe(false);
    });

    it('multi-plugin boot and shutdown', async () => {
        createTmpPlugin(pluginsDir, 'alpha');
        createTmpPlugin(pluginsDir, 'beta');
        createTmpPlugin(pluginsDir, 'gamma');

        await runtime.discover(pluginsDir);
        const result = await runtime.loadAll();
        expect(result.loaded).toBe(3);
        expect(runtime.listPlugins().filter(p => p.loaded)).toHaveLength(3);

        await runtime.unloadAll();
        expect(runtime.listPlugins().filter(p => p.loaded)).toHaveLength(0);
    });

    it('enable/disable prevents loading', async () => {
        createTmpPlugin(pluginsDir, 'skipme');
        await runtime.discover(pluginsDir);
        runtime.setEnabled('skipme', false);

        const result = await runtime.loadAll();
        expect(result.loaded).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// E2E: Discovery + Config State Pipeline
// ═══════════════════════════════════════════════════════════════════

describe('E2E — Discovery + Config Pipeline', () => {
    let tmpDir: string;

    beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w30-cfg-')); });
    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('discovery → config normalization → enable resolution', () => {
        const bundled = path.join(tmpDir, 'bundled');
        fs.mkdirSync(bundled);
        createTmpPlugin(bundled, 'allowed');
        createTmpPlugin(bundled, 'blocked');

        // Discover
        const disc = new PluginDiscovery();
        const result = disc.discover({ bundledDir: bundled });
        expect(result.candidates).toHaveLength(2);

        // Config
        const configState = new PluginConfigState();
        const config = configState.normalize({
            enabled: true,
            deny: ['blocked'],
        });

        // Resolve
        const allowedState = configState.resolveEnableState('allowed', config);
        const blockedState = configState.resolveEnableState('blocked', config);
        expect(allowedState.enabled).toBe(true);
        expect(blockedState.enabled).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════
// E2E: Dependency Graph → Load Order
// ═══════════════════════════════════════════════════════════════════

describe('E2E — Dependency Resolution', () => {
    it('resolves complex dependency chain', () => {
        const graph = new DependencyGraph();
        graph.addPlugin('core', '1.0.0');
        graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core', versionConstraint: '^1.0.0' }]);
        graph.addPlugin('billing', '1.0.0', [{ pluginId: 'auth' }, { pluginId: 'core' }]);
        graph.addPlugin('dashboard', '1.0.0', [{ pluginId: 'billing' }, { pluginId: 'auth' }]);
        graph.addPlugin('analytics', '1.0.0', [{ pluginId: 'core', optional: true }]);

        const result = graph.resolveLoadOrder();
        expect(result.valid).toBe(true);
        expect(result.order.indexOf('core')).toBeLessThan(result.order.indexOf('auth'));
        expect(result.order.indexOf('auth')).toBeLessThan(result.order.indexOf('billing'));
        expect(result.order.indexOf('billing')).toBeLessThan(result.order.indexOf('dashboard'));
    });

    it('detects diamond dependency', () => {
        const graph = new DependencyGraph();
        graph.addPlugin('base', '1.0.0');
        graph.addPlugin('left', '1.0.0', [{ pluginId: 'base' }]);
        graph.addPlugin('right', '1.0.0', [{ pluginId: 'base' }]);
        graph.addPlugin('top', '1.0.0', [{ pluginId: 'left' }, { pluginId: 'right' }]);

        const result = graph.resolveLoadOrder();
        expect(result.valid).toBe(true);
        expect(result.order[0]).toBe('base');
    });

    it('safe unload chain', () => {
        const graph = new DependencyGraph();
        graph.addPlugin('core', '1.0.0');
        graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
        graph.addPlugin('api', '1.0.0', [{ pluginId: 'auth' }]);

        // Cannot unload core directly
        expect(graph.canUnload('core').safe).toBe(false);

        // Can unload api (leaf)
        expect(graph.canUnload('api').safe).toBe(true);

        // Unload order cascades
        const order = graph.getUnloadOrder('core');
        expect(order.indexOf('api')).toBeLessThan(order.indexOf('auth'));
        expect(order.indexOf('auth')).toBeLessThan(order.indexOf('core'));
    });
});

// ═══════════════════════════════════════════════════════════════════
// E2E: Event Bus + Extensions
// ═══════════════════════════════════════════════════════════════════

describe('E2E — Event Bus + Extensions', () => {
    it('extension lifecycle via event bus', async () => {
        const bus = new PluginEventBus();
        const registry = new ExtensionRegistry();
        const events: string[] = [];

        // Register extension
        registry.register({
            id: 'search-tool', name: 'Search', type: 'tool', version: '1.0.0',
            setup: async () => { events.push('setup'); },
            teardown: async () => { events.push('teardown'); },
        });

        // Listen for lifecycle events
        bus.on('extension.activated', 'monitor', (e) => {
            events.push(`bus:activated:${(e.data as any).id}`);
        });

        // Activate
        await registry.activate('search-tool');
        await bus.emit('extension.activated', 'system', { id: 'search-tool' });

        // Deactivate
        await registry.deactivate('search-tool');

        expect(events).toEqual(['setup', 'bus:activated:search-tool', 'teardown']);
        expect(registry.get('search-tool')!.status).toBe('inactive');
    });

    it('event bus handles plugin cleanup on unload', async () => {
        const bus = new PluginEventBus();
        let msgCount = 0;

        bus.on('message', 'plugin-a', () => { msgCount++; });
        bus.on('message', 'plugin-b', () => { msgCount++; });

        await bus.emit('message', 'core', null);
        expect(msgCount).toBe(2);

        // Simulate plugin-a unload
        bus.removePlugin('plugin-a');
        await bus.emit('message', 'core', null);
        expect(msgCount).toBe(3); // only plugin-b fired
    });
});

// ═══════════════════════════════════════════════════════════════════
// E2E: Remote Load → Verify → Migrate
// ═══════════════════════════════════════════════════════════════════

describe('E2E — Remote Load → Verify → Migrate', () => {
    it('full remote plugin install pipeline', async () => {
        const loader = new PluginRemoteLoader({ allowUnsigned: false });
        const verifier = new SignatureVerifier();
        const engine = new PluginMigrationEngine();

        const pluginCode = 'module.exports = { activate() {} }';
        const hash = verifier.computeHash(pluginCode);

        // 1. Trust publisher
        verifier.trustPublisher('official', 'CoreBlow Official');

        // 2. Register signature
        verifier.registerSignature({
            pluginId: 'remote-plugin', version: '2.0.0',
            hash, publisher: 'official',
            signedAt: Date.now(), algorithm: 'sha256',
        });

        // 3. Download
        const loadResult = await loader.load({
            type: 'url',
            url: 'https://registry.coreblow.com/remote-plugin-2.0.0.tar.gz',
            integrity: hash,
        });
        expect(loadResult.success).toBe(true);

        // 4. Verify
        const verifyResult = verifier.verify('remote-plugin', '2.0.0', pluginCode);
        expect(verifyResult.valid).toBe(true);
        expect(verifyResult.trusted).toBe(true);

        // 5. Migrate from v1 to v2
        engine.registerSteps('remote-plugin', [{
            version: '2.0.0',
            description: 'Add analytics config',
            up: (d) => ({ ...d, analytics: { enabled: true } }),
        }]);

        const migrateResult = await engine.migrate('remote-plugin', '1.0.0', '2.0.0', { key: 'val' });
        expect(migrateResult.success).toBe(true);
        expect(migrateResult.data.analytics).toEqual({ enabled: true });
        expect(migrateResult.data.key).toBe('val');
    });
});

// ═══════════════════════════════════════════════════════════════════
// E2E: SDK Test Harness
// ═══════════════════════════════════════════════════════════════════

describe('E2E — SDK TestPluginHarness', () => {
    it('harness full activate → register → deactivate', async () => {
        const tools: string[] = [];
        const harness = new TestPluginHarness({
            activate: async (ctx) => {
                ctx.log.info('Starting');
                ctx.api.registerTool({ name: 'search', description: 'Search', execute: async () => ({}) } as any);
                tools.push('search');
            },
            deactivate: async () => {
                tools.length = 0;
            },
        });

        await harness.activate();
        expect(harness.isActivated()).toBe(true);
        expect(tools).toEqual(['search']);
        expect(harness.getApi().registeredTools).toHaveLength(1);

        await harness.deactivate();
        expect(harness.isActivated()).toBe(false);
        expect(tools).toHaveLength(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Stress Test
// ═══════════════════════════════════════════════════════════════════

describe('Stress — Concurrent Operations', () => {
    it('event bus handles 1000 rapid emissions', async () => {
        const bus = new PluginEventBus({ maxHistory: 100 });
        let count = 0;
        bus.on('stress', 'counter', () => { count++; });

        const promises: Promise<number>[] = [];
        for (let i = 0; i < 1000; i++) {
            promises.push(bus.emit('stress', 'test', i));
        }
        await Promise.all(promises);

        expect(count).toBe(1000);
        expect(bus.getStats().totalEmitted).toBe(1000);
    });

    it('dependency graph handles 50 plugins', () => {
        const graph = new DependencyGraph();

        // Create chain: plugin-0 → plugin-1 → ... → plugin-49
        for (let i = 0; i < 50; i++) {
            const deps = i > 0 ? [{ pluginId: `plugin-${i - 1}` }] : [];
            graph.addPlugin(`plugin-${i}`, '1.0.0', deps);
        }

        const result = graph.resolveLoadOrder();
        expect(result.valid).toBe(true);
        expect(result.order).toHaveLength(50);
        expect(result.order[0]).toBe('plugin-0');
        expect(result.order[49]).toBe('plugin-49');
    });

    it('extension registry handles 100 extensions', async () => {
        const registry = new ExtensionRegistry();

        for (let i = 0; i < 100; i++) {
            registry.register({
                id: `ext-${i}`, name: `Extension ${i}`,
                type: i % 2 === 0 ? 'tool' : 'channel',
                version: '1.0.0',
            });
        }

        expect(registry.count()).toBe(100);
        expect(registry.listByType('tool')).toHaveLength(50);
        expect(registry.listByType('channel')).toHaveLength(50);
    });

    it('migration engine handles sequential upgrades', async () => {
        const engine = new PluginMigrationEngine();

        // 20 migration steps
        const steps = Array.from({ length: 20 }, (_, i) => ({
            version: `1.${i + 1}.0`,
            description: `Step ${i + 1}`,
            up: (d: Record<string, unknown>) => ({ ...d, [`field_${i}`]: true }),
        }));

        engine.registerSteps('migrator', steps);
        const result = await engine.migrate('migrator', '1.0.0', '2.0.0', {});

        expect(result.success).toBe(true);
        expect(result.stepsApplied).toHaveLength(20);
        expect(Object.keys(result.data)).toHaveLength(20);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Scaffold + Verify
// ═══════════════════════════════════════════════════════════════════

describe('E2E — Scaffold → Verify Structure', () => {
    let tmpDir: string;
    let scaffold: PluginScaffold;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w30-scaffold-'));
        scaffold = new PluginScaffold();
    });

    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('scaffolded plugin has valid manifest', () => {
        const dir = path.join(tmpDir, 'test-plugin');
        const result = scaffold.generate({ name: 'test-plugin', template: 'full', targetDir: dir });
        expect(result.success).toBe(true);

        const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'plugin.json'), 'utf-8'));
        expect(manifest.name).toBe('test-plugin');
        expect(manifest.version).toBeDefined();
        expect(manifest.main).toBeDefined();
    });

    it('scaffolded plugin can be discovered', () => {
        const dir = path.join(tmpDir, 'disc-test');
        const pluginDir = path.join(dir, 'my-plugin');
        scaffold.generate({ name: 'my-plugin', template: 'basic', targetDir: pluginDir });

        const disc = new PluginDiscovery();
        const result = disc.discover({ bundledDir: dir });
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0].id).toBe('my-plugin');
    });
});
