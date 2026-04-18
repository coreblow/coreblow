/**
 * Wave 27: Plugin Lifecycle Coverage
 *
 * Following CoreBlow's discovery.ts (946 LOC) + config-state.ts (341 LOC) +
 * dependency-graph.ts (780 LOC) + runtime lifecycle patterns.
 *
 * Tests PluginRuntime, PluginDiscovery, PluginConfigState, DependencyGraph,
 * and semver utilities.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PluginRuntime } from '../../src/plugins/runtime.js';
import { PluginDiscovery, type DiscoveryOptions } from '../../src/plugins/discovery.js';
import { PluginConfigState, type NormalizedPluginsConfig } from '../../src/plugins/config-state.js';
import {
    DependencyGraph,
    parseSemver,
    compareSemver,
    satisfiesConstraint,
} from '../../src/plugins/dependency-graph.js';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function createTmpPluginDir(baseDir: string, name: string, manifest?: Record<string, unknown>): string {
    const dir = path.join(baseDir, name);
    fs.mkdirSync(dir, { recursive: true });
    // PluginRuntime uses manifest.json; PluginDiscovery uses plugin.json
    const mfData = { id: name, name, version: '1.0.0', main: 'index.js', ...manifest };
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(mfData));
    fs.writeFileSync(path.join(dir, 'plugin.json'), JSON.stringify(mfData));
    fs.writeFileSync(path.join(dir, 'index.js'), 'module.exports = { activate: async () => {} };');
    return dir;
}

// ═══════════════════════════════════════════════════════════════════
// PluginRuntime
// ═══════════════════════════════════════════════════════════════════

describe('PluginRuntime', () => {
    let tmpDir: string;
    let pluginsDir: string;
    let runtime: PluginRuntime;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w27-runtime-'));
        pluginsDir = path.join(tmpDir, 'plugins');
        fs.mkdirSync(pluginsDir);
        runtime = new PluginRuntime();
    });

    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('discovers plugins in directory', async () => {
        createTmpPluginDir(pluginsDir, 'alpha');
        createTmpPluginDir(pluginsDir, 'beta');
        const ids = await runtime.discover(pluginsDir);
        expect(ids).toHaveLength(2);
        expect(ids).toContain('alpha');
        expect(ids).toContain('beta');
    });

    it('loads a plugin', async () => {
        createTmpPluginDir(pluginsDir, 'test-load');
        await runtime.discover(pluginsDir);
        const ok = await runtime.load('test-load');
        expect(ok).toBe(true);
        const state = runtime.getPlugin('test-load');
        expect(state).not.toBeNull();
        expect(state!.loaded).toBe(true);
    });

    it('unloads a plugin', async () => {
        createTmpPluginDir(pluginsDir, 'test-unload');
        await runtime.discover(pluginsDir);
        await runtime.load('test-unload');
        const ok = await runtime.unload('test-unload');
        expect(ok).toBe(true);
        const state = runtime.getPlugin('test-unload');
        expect(state!.loaded).toBe(false);
    });

    it('loadAll loads all discovered', async () => {
        createTmpPluginDir(pluginsDir, 'a');
        createTmpPluginDir(pluginsDir, 'b');
        createTmpPluginDir(pluginsDir, 'c');
        await runtime.discover(pluginsDir);
        const result = await runtime.loadAll();
        expect(result.loaded).toBe(3);
        expect(result.failed).toBe(0);
    });

    it('unloadAll unloads all', async () => {
        createTmpPluginDir(pluginsDir, 'x');
        await runtime.discover(pluginsDir);
        await runtime.loadAll();
        await runtime.unloadAll();
        const plugins = runtime.listPlugins();
        expect(plugins.every(p => !p.loaded)).toBe(true);
    });

    it('setEnabled toggles plugin state', async () => {
        createTmpPluginDir(pluginsDir, 'toggle');
        await runtime.discover(pluginsDir);
        runtime.setEnabled('toggle', false);
        expect(runtime.getPlugin('toggle')!.enabled).toBe(false);
        runtime.setEnabled('toggle', true);
        expect(runtime.getPlugin('toggle')!.enabled).toBe(true);
    });

    it('listPlugins returns all', async () => {
        createTmpPluginDir(pluginsDir, 'p1');
        createTmpPluginDir(pluginsDir, 'p2');
        await runtime.discover(pluginsDir);
        expect(runtime.listPlugins()).toHaveLength(2);
    });

    it('getPlugin returns null for unknown', () => {
        expect(runtime.getPlugin('nonexistent')).toBeNull();
    });

    it('setConfig updates plugin config', async () => {
        createTmpPluginDir(pluginsDir, 'configurable');
        await runtime.discover(pluginsDir);
        runtime.setConfig('configurable', { apiKey: 'test123' });
        // No error thrown
    });

    it('handles invalid plugin directory', async () => {
        // Empty dir — no manifests
        const emptyDir = path.join(tmpDir, 'empty');
        fs.mkdirSync(emptyDir);
        const ids = await runtime.discover(emptyDir);
        expect(ids).toHaveLength(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// PluginDiscovery
// ═══════════════════════════════════════════════════════════════════

describe('PluginDiscovery', () => {
    let tmpDir: string;
    let disc: PluginDiscovery;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'w27-disc-'));
        disc = new PluginDiscovery();
    });

    afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

    it('discovers from bundled directory', () => {
        const bundled = path.join(tmpDir, 'bundled');
        fs.mkdirSync(bundled);
        createTmpPluginDir(bundled, 'built-in');

        const result = disc.discover({ bundledDir: bundled });
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0].origin).toBe('bundled');
        expect(result.candidates[0].id).toBe('built-in');
    });

    it('discovers from global directory', () => {
        const globalDir = path.join(tmpDir, 'global');
        fs.mkdirSync(globalDir);
        createTmpPluginDir(globalDir, 'global-plugin');

        const result = disc.discover({ globalDir });
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0].origin).toBe('global');
    });

    it('discovers from workspace directory', () => {
        const ws = path.join(tmpDir, 'workspace');
        const wsPlugins = path.join(ws, '.coreblow', 'plugins');
        fs.mkdirSync(wsPlugins, { recursive: true });
        createTmpPluginDir(wsPlugins, 'ws-plugin');

        const result = disc.discover({ workspaceDir: ws });
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0].origin).toBe('workspace');
    });

    it('discovers from loadPaths', () => {
        const custom = path.join(tmpDir, 'custom');
        fs.mkdirSync(custom);
        createTmpPluginDir(custom, 'custom-plugin');

        const result = disc.discover({ loadPaths: [custom] });
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0].origin).toBe('config');
    });

    it('deduplicates by ID', () => {
        const dir1 = path.join(tmpDir, 'dir1');
        const dir2 = path.join(tmpDir, 'dir2');
        fs.mkdirSync(dir1); fs.mkdirSync(dir2);
        createTmpPluginDir(dir1, 'same-plugin');
        createTmpPluginDir(dir2, 'same-plugin');

        const result = disc.discover({ bundledDir: dir1, loadPaths: [dir2] });
        expect(result.candidates).toHaveLength(1); // deduplicated
    });

    it('filters by onlyPluginIds', () => {
        const dir = path.join(tmpDir, 'filter');
        fs.mkdirSync(dir);
        createTmpPluginDir(dir, 'wanted');
        createTmpPluginDir(dir, 'unwanted');

        const result = disc.discover({ bundledDir: dir, onlyPluginIds: ['wanted'] });
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0].id).toBe('wanted');
    });

    it('reports manifest parse errors', () => {
        const dir = path.join(tmpDir, 'bad');
        fs.mkdirSync(dir);
        const pluginDir = path.join(dir, 'broken');
        fs.mkdirSync(pluginDir);
        fs.writeFileSync(path.join(pluginDir, 'plugin.json'), '{invalid json');

        const result = disc.discover({ bundledDir: dir });
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].error).toContain('Invalid manifest');
    });

    it('reads package.json as fallback', () => {
        const dir = path.join(tmpDir, 'npm');
        fs.mkdirSync(dir);
        const pluginDir = path.join(dir, 'npm-plugin');
        fs.mkdirSync(pluginDir);
        fs.writeFileSync(path.join(pluginDir, 'package.json'), JSON.stringify({ name: 'npm-plugin', version: '2.0.0' }));

        const result = disc.discover({ bundledDir: dir });
        expect(result.candidates).toHaveLength(1);
        expect(result.candidates[0].version).toBe('2.0.0');
    });

    it('scanTime is measured', () => {
        const result = disc.discover({});
        expect(result.scanTime).toBeGreaterThanOrEqual(0);
    });
});

// ═══════════════════════════════════════════════════════════════════
// PluginConfigState
// ═══════════════════════════════════════════════════════════════════

describe('PluginConfigState', () => {
    let state: PluginConfigState;

    beforeEach(() => { state = new PluginConfigState(); });

    describe('normalize', () => {
        it('returns defaults for undefined input', () => {
            const result = state.normalize();
            expect(result.enabled).toBe(true);
            expect(result.allow).toEqual([]);
            expect(result.deny).toEqual([]);
        });

        it('normalizes raw config', () => {
            const result = state.normalize({
                enabled: false,
                allow: ['plugin-a'],
                deny: ['plugin-b'],
                loadPaths: ['/custom/path'],
                configs: { 'plugin-a': { key: 'value' } },
                enable: { 'plugin-c': true },
            });
            expect(result.enabled).toBe(false);
            expect(result.allow).toEqual(['plugin-a']);
            expect(result.deny).toEqual(['plugin-b']);
            expect(result.loadPaths).toEqual(['/custom/path']);
            expect(result.pluginConfigs['plugin-a']).toEqual({ key: 'value' });
            expect(result.enableOverrides['plugin-c']).toBe(true);
        });

        it('filters non-string array items', () => {
            const result = state.normalize({ allow: [1, 'valid', null, 'ok'] });
            expect(result.allow).toEqual(['valid', 'ok']);
        });
    });

    describe('resolveEnableState', () => {
        it('returns global enabled when no overrides', () => {
            const config = state.normalize({ enabled: true });
            expect(state.resolveEnableState('any-plugin', config)).toEqual({ enabled: true, reason: 'global-enabled' });
        });

        it('respects per-plugin enable override', () => {
            const config = state.normalize({ enabled: false, enable: { special: true } });
            expect(state.resolveEnableState('special', config).enabled).toBe(true);
            expect(state.resolveEnableState('special', config).reason).toBe('enable-override');
        });

        it('deny list blocks plugin', () => {
            const config = state.normalize({ deny: ['blocked'] });
            expect(state.resolveEnableState('blocked', config).enabled).toBe(false);
            expect(state.resolveEnableState('blocked', config).reason).toBe('deny-list');
        });

        it('allow list restricts to listed plugins', () => {
            const config = state.normalize({ allow: ['allowed'] });
            expect(state.resolveEnableState('allowed', config).enabled).toBe(true);
            expect(state.resolveEnableState('not-listed', config).enabled).toBe(false);
            expect(state.resolveEnableState('not-listed', config).reason).toBe('not-in-allow-list');
        });

        it('per-plugin override takes priority over deny', () => {
            const config = state.normalize({ deny: ['plugin'], enable: { plugin: true } });
            expect(state.resolveEnableState('plugin', config).enabled).toBe(true);
        });
    });

    describe('validateConfig', () => {
        it('passes through without schema', () => {
            const result = state.validateConfig(undefined, { key: 'val' });
            expect(result.ok).toBe(true);
        });

        it('validates with safeParse schema', () => {
            const schema = {
                safeParse: (v: unknown) => ({ success: true, data: v }),
            };
            expect(state.validateConfig(schema as any, { x: 1 }).ok).toBe(true);
        });

        it('rejects invalid with safeParse', () => {
            const schema = {
                safeParse: () => ({
                    success: false,
                    error: { issues: [{ path: ['key'], message: 'required' }] },
                }),
            };
            const result = state.validateConfig(schema as any, {});
            expect(result.ok).toBe(false);
            expect(result.errors![0]).toContain('required');
        });

        it('validates with validate method', () => {
            const schema = { validate: (v: unknown) => ({ ok: true, value: v }) };
            expect(state.validateConfig(schema as any, { a: 1 }).ok).toBe(true);
        });
    });

    describe('getPluginConfig', () => {
        it('returns empty for unconfigured plugin', () => {
            const config = state.normalize();
            expect(state.getPluginConfig('unknown', config)).toEqual({});
        });

        it('merges defaults with overrides', () => {
            const config = state.normalize({ configs: { p: { key: 'override' } } });
            const result = state.getPluginConfig('p', config, { key: 'default', extra: true });
            expect(result.key).toBe('override');
            expect(result.extra).toBe(true);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// Semver Utilities
// ═══════════════════════════════════════════════════════════════════

describe('Semver Utilities', () => {
    it('parseSemver parses valid versions', () => {
        expect(parseSemver('1.2.3')).toEqual([1, 2, 3]);
        expect(parseSemver('v0.1.0')).toEqual([0, 1, 0]);
    });

    it('parseSemver returns null for invalid', () => {
        expect(parseSemver('invalid')).toBeNull();
        expect(parseSemver('')).toBeNull();
    });

    it('compareSemver compares', () => {
        expect(compareSemver([1, 0, 0], [2, 0, 0])).toBe(-1);
        expect(compareSemver([1, 0, 0], [1, 0, 0])).toBe(0);
        expect(compareSemver([2, 0, 0], [1, 0, 0])).toBe(1);
        expect(compareSemver([1, 2, 0], [1, 1, 0])).toBe(1);
    });

    it('satisfiesConstraint — exact', () => {
        expect(satisfiesConstraint('1.0.0', '1.0.0')).toBe(true);
        expect(satisfiesConstraint('1.0.1', '1.0.0')).toBe(false);
    });

    it('satisfiesConstraint — >= and >', () => {
        expect(satisfiesConstraint('2.0.0', '>=1.0.0')).toBe(true);
        expect(satisfiesConstraint('1.0.0', '>=1.0.0')).toBe(true);
        expect(satisfiesConstraint('0.9.0', '>=1.0.0')).toBe(false);
        expect(satisfiesConstraint('2.0.0', '>1.0.0')).toBe(true);
        expect(satisfiesConstraint('1.0.0', '>1.0.0')).toBe(false);
    });

    it('satisfiesConstraint — ^caret', () => {
        expect(satisfiesConstraint('1.5.0', '^1.0.0')).toBe(true);
        expect(satisfiesConstraint('2.0.0', '^1.0.0')).toBe(false);
        expect(satisfiesConstraint('0.9.0', '^1.0.0')).toBe(false);
    });

    it('satisfiesConstraint — ~tilde', () => {
        expect(satisfiesConstraint('1.2.5', '~1.2.0')).toBe(true);
        expect(satisfiesConstraint('1.3.0', '~1.2.0')).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════
// DependencyGraph
// ═══════════════════════════════════════════════════════════════════

describe('DependencyGraph', () => {
    let graph: DependencyGraph;

    beforeEach(() => { graph = new DependencyGraph(); });

    it('addPlugin and getNode', () => {
        graph.addPlugin('core', '1.0.0');
        expect(graph.getNode('core')).toBeDefined();
        expect(graph.getNode('core')!.version).toBe('1.0.0');
        expect(graph.size()).toBe(1);
    });

    it('removePlugin', () => {
        graph.addPlugin('temp', '1.0.0');
        graph.removePlugin('temp');
        expect(graph.getNode('temp')).toBeUndefined();
        expect(graph.size()).toBe(0);
    });

    it('getDependencies and getDependents', () => {
        graph.addPlugin('core', '1.0.0');
        graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);

        expect(graph.getDependencies('auth')).toHaveLength(1);
        expect(graph.getDependents('core')).toContain('auth');
    });

    it('getTransitiveDependencies', () => {
        graph.addPlugin('base', '1.0.0');
        graph.addPlugin('mid', '1.0.0', [{ pluginId: 'base' }]);
        graph.addPlugin('top', '1.0.0', [{ pluginId: 'mid' }]);

        const transitive = graph.getTransitiveDependencies('top');
        expect(transitive).toContain('mid');
        expect(transitive).toContain('base');
    });

    it('resolveLoadOrder — correct topological order', () => {
        graph.addPlugin('core', '1.0.0');
        graph.addPlugin('auth', '1.0.0', [{ pluginId: 'core' }]);
        graph.addPlugin('api', '1.0.0', [{ pluginId: 'core' }, { pluginId: 'auth' }]);

        const result = graph.resolveLoadOrder();
        expect(result.valid).toBe(true);
        expect(result.order.indexOf('core')).toBeLessThan(result.order.indexOf('auth'));
        expect(result.order.indexOf('auth')).toBeLessThan(result.order.indexOf('api'));
    });

    it('resolveLoadOrder — detects cycles', () => {
        graph.addPlugin('a', '1.0.0', [{ pluginId: 'b' }]);
        graph.addPlugin('b', '1.0.0', [{ pluginId: 'a' }]);

        const result = graph.resolveLoadOrder();
        expect(result.valid).toBe(false);
        expect(result.cycles.length).toBeGreaterThan(0);
    });

    it('resolveLoadOrder — detects missing deps', () => {
        graph.addPlugin('lonely', '1.0.0', [{ pluginId: 'nonexistent' }]);

        const result = graph.resolveLoadOrder();
        expect(result.valid).toBe(false);
        expect(result.missing).toHaveLength(1);
        expect(result.missing[0].pluginId).toBe('nonexistent');
    });

    it('resolveLoadOrder — optional missing is OK', () => {
        graph.addPlugin('soft', '1.0.0', [{ pluginId: 'optional-dep', optional: true }]);

        const result = graph.resolveLoadOrder();
        expect(result.valid).toBe(true);
        expect(result.optionalMissing).toHaveLength(1);
    });

    it('resolveLoadOrder — version mismatch warning', () => {
        graph.addPlugin('dep', '1.0.0');
        graph.addPlugin('consumer', '1.0.0', [{ pluginId: 'dep', versionConstraint: '>=2.0.0' }]);

        const result = graph.resolveLoadOrder();
        expect(result.warnings.length).toBeGreaterThan(0);
        expect(result.warnings[0]).toContain('>=2.0.0');
    });

    it('canUnload — safe when no dependents', () => {
        graph.addPlugin('standalone', '1.0.0');
        expect(graph.canUnload('standalone').safe).toBe(true);
    });

    it('canUnload — blocked when has dependents', () => {
        graph.addPlugin('core', '1.0.0');
        graph.addPlugin('child', '1.0.0', [{ pluginId: 'core' }]);
        const result = graph.canUnload('core');
        expect(result.safe).toBe(false);
        expect(result.blockedBy).toContain('child');
    });

    it('getUnloadOrder returns reverse topological', () => {
        graph.addPlugin('core', '1.0.0');
        graph.addPlugin('mid', '1.0.0', [{ pluginId: 'core' }]);
        graph.addPlugin('top', '1.0.0', [{ pluginId: 'mid' }]);

        const order = graph.getUnloadOrder('core');
        expect(order.indexOf('top')).toBeLessThan(order.indexOf('mid'));
        expect(order.indexOf('mid')).toBeLessThan(order.indexOf('core'));
    });

    it('clear empties the graph', () => {
        graph.addPlugin('a'); graph.addPlugin('b');
        graph.clear();
        expect(graph.size()).toBe(0);
    });
});
