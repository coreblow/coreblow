/**
 * Wave 7 — Hot-Reload + Dependency Graph + Version Manager Tests
 *
 * Tests for: dependency-graph.ts, hot-reload.ts, version-manager.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    DependencyGraph,
    parseSemver,
    compareSemver,
    satisfiesConstraint,
} from '../../src/plugins/dependency-graph.js';
import { PluginHotReload } from '../../src/plugins/hot-reload.js';
import { VersionManager } from '../../src/plugins/version-manager.js';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// ═══════════════════════════════════════════════════════════════════
// Semver Utilities
// ═══════════════════════════════════════════════════════════════════

describe('Semver Utilities', () => {
    describe('parseSemver', () => {
        it('should parse standard versions', () => {
            expect(parseSemver('1.2.3')).toEqual([1, 2, 3]);
            expect(parseSemver('0.0.1')).toEqual([0, 0, 1]);
        });

        it('should parse v-prefixed versions', () => {
            expect(parseSemver('v2.0.0')).toEqual([2, 0, 0]);
        });

        it('should return null for invalid versions', () => {
            expect(parseSemver('abc')).toBeNull();
            expect(parseSemver('')).toBeNull();
        });
    });

    describe('compareSemver', () => {
        it('should compare equal versions', () => {
            expect(compareSemver([1, 0, 0], [1, 0, 0])).toBe(0);
        });

        it('should compare by major', () => {
            expect(compareSemver([2, 0, 0], [1, 0, 0])).toBe(1);
            expect(compareSemver([1, 0, 0], [2, 0, 0])).toBe(-1);
        });

        it('should compare by minor', () => {
            expect(compareSemver([1, 2, 0], [1, 1, 0])).toBe(1);
        });

        it('should compare by patch', () => {
            expect(compareSemver([1, 0, 2], [1, 0, 1])).toBe(1);
        });
    });

    describe('satisfiesConstraint', () => {
        it('should check exact match', () => {
            expect(satisfiesConstraint('1.0.0', '1.0.0')).toBe(true);
            expect(satisfiesConstraint('1.0.1', '1.0.0')).toBe(false);
        });

        it('should check >= constraint', () => {
            expect(satisfiesConstraint('1.0.0', '>=1.0.0')).toBe(true);
            expect(satisfiesConstraint('2.0.0', '>=1.0.0')).toBe(true);
            expect(satisfiesConstraint('0.9.0', '>=1.0.0')).toBe(false);
        });

        it('should check > constraint', () => {
            expect(satisfiesConstraint('1.0.1', '>1.0.0')).toBe(true);
            expect(satisfiesConstraint('1.0.0', '>1.0.0')).toBe(false);
        });

        it('should check <= constraint', () => {
            expect(satisfiesConstraint('1.0.0', '<=1.0.0')).toBe(true);
            expect(satisfiesConstraint('0.9.0', '<=1.0.0')).toBe(true);
            expect(satisfiesConstraint('1.0.1', '<=1.0.0')).toBe(false);
        });

        it('should check < constraint', () => {
            expect(satisfiesConstraint('0.9.0', '<1.0.0')).toBe(true);
            expect(satisfiesConstraint('1.0.0', '<1.0.0')).toBe(false);
        });

        it('should check ^ constraint (same major)', () => {
            expect(satisfiesConstraint('1.2.3', '^1.0.0')).toBe(true);
            expect(satisfiesConstraint('1.0.0', '^1.0.0')).toBe(true);
            expect(satisfiesConstraint('2.0.0', '^1.0.0')).toBe(false);
            expect(satisfiesConstraint('0.9.0', '^1.0.0')).toBe(false);
        });

        it('should check ~ constraint (same major.minor)', () => {
            expect(satisfiesConstraint('1.2.5', '~1.2.0')).toBe(true);
            expect(satisfiesConstraint('1.2.0', '~1.2.0')).toBe(true);
            expect(satisfiesConstraint('1.3.0', '~1.2.0')).toBe(false);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// DependencyGraph
// ═══════════════════════════════════════════════════════════════════

describe('DependencyGraph', () => {
    let graph: DependencyGraph;

    beforeEach(() => {
        graph = new DependencyGraph();
    });

    describe('addPlugin / removePlugin', () => {
        it('should add plugins', () => {
            graph.addPlugin('a', '1.0.0');
            graph.addPlugin('b', '2.0.0');
            expect(graph.size()).toBe(2);
        });

        it('should remove plugins', () => {
            graph.addPlugin('a', '1.0.0');
            graph.removePlugin('a');
            expect(graph.size()).toBe(0);
        });

        it('should update existing plugins', () => {
            graph.addPlugin('a', '1.0.0');
            graph.addPlugin('a', '2.0.0');
            expect(graph.getNode('a')?.version).toBe('2.0.0');
        });
    });

    describe('dependencies', () => {
        it('should track direct dependencies', () => {
            graph.addPlugin('db', '1.0.0');
            graph.addPlugin('api', '1.0.0', [{ pluginId: 'db' }]);
            expect(graph.getDependencies('api')).toHaveLength(1);
            expect(graph.getDependencies('api')[0]!.pluginId).toBe('db');
        });

        it('should track dependents', () => {
            graph.addPlugin('db', '1.0.0');
            graph.addPlugin('api', '1.0.0', [{ pluginId: 'db' }]);
            expect(graph.getDependents('db')).toContain('api');
        });

        it('should compute transitive dependencies', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('db', '1.0.0', [{ pluginId: 'core' }]);
            graph.addPlugin('api', '1.0.0', [{ pluginId: 'db' }]);
            const transitive = graph.getTransitiveDependencies('api');
            expect(transitive).toContain('db');
            expect(transitive).toContain('core');
        });
    });

    describe('resolveLoadOrder', () => {
        it('should sort independent plugins', () => {
            graph.addPlugin('a', '1.0.0');
            graph.addPlugin('b', '1.0.0');
            const result = graph.resolveLoadOrder();
            expect(result.valid).toBe(true);
            expect(result.order).toHaveLength(2);
        });

        it('should sort dependent plugins correctly', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('db', '1.0.0', [{ pluginId: 'core' }]);
            graph.addPlugin('api', '1.0.0', [{ pluginId: 'db' }]);

            const result = graph.resolveLoadOrder();
            expect(result.valid).toBe(true);
            const coreIdx = result.order.indexOf('core');
            const dbIdx = result.order.indexOf('db');
            const apiIdx = result.order.indexOf('api');
            expect(coreIdx).toBeLessThan(dbIdx);
            expect(dbIdx).toBeLessThan(apiIdx);
        });

        it('should detect cycles', () => {
            graph.addPlugin('a', '1.0.0', [{ pluginId: 'b' }]);
            graph.addPlugin('b', '1.0.0', [{ pluginId: 'a' }]);
            const result = graph.resolveLoadOrder();
            expect(result.valid).toBe(false);
            expect(result.cycles.length).toBeGreaterThan(0);
        });

        it('should detect missing required dependencies', () => {
            graph.addPlugin('api', '1.0.0', [{ pluginId: 'missing-db' }]);
            const result = graph.resolveLoadOrder();
            expect(result.valid).toBe(false);
            expect(result.missing).toHaveLength(1);
            expect(result.missing[0]!.pluginId).toBe('missing-db');
        });

        it('should record optional missing dependencies', () => {
            graph.addPlugin('api', '1.0.0', [{ pluginId: 'cache', optional: true }]);
            const result = graph.resolveLoadOrder();
            expect(result.valid).toBe(true);
            expect(result.optionalMissing).toHaveLength(1);
        });

        it('should warn about version mismatches', () => {
            graph.addPlugin('db', '0.5.0');
            graph.addPlugin('api', '1.0.0', [{ pluginId: 'db', versionConstraint: '>=1.0.0' }]);
            const result = graph.resolveLoadOrder();
            expect(result.warnings.length).toBeGreaterThan(0);
        });
    });

    describe('canUnload', () => {
        it('should allow unload with no dependents', () => {
            graph.addPlugin('a', '1.0.0');
            expect(graph.canUnload('a').safe).toBe(true);
        });

        it('should block unload with active dependents', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('api', '1.0.0', [{ pluginId: 'core' }]);
            const result = graph.canUnload('core');
            expect(result.safe).toBe(false);
            expect(result.blockedBy).toContain('api');
        });
    });

    describe('getUnloadOrder', () => {
        it('should return reverse topological order', () => {
            graph.addPlugin('core', '1.0.0');
            graph.addPlugin('db', '1.0.0', [{ pluginId: 'core' }]);
            graph.addPlugin('api', '1.0.0', [{ pluginId: 'db' }]);
            const order = graph.getUnloadOrder('core');
            expect(order.indexOf('api')).toBeLessThan(order.indexOf('db'));
            expect(order.indexOf('db')).toBeLessThan(order.indexOf('core'));
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// PluginHotReload
// ═══════════════════════════════════════════════════════════════════

describe('PluginHotReload', () => {
    let tmpDir: string;
    let hotReload: PluginHotReload;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hot-reload-'));
        hotReload = new PluginHotReload({
            watchPaths: [tmpDir],
            debounceMs: 50,
            autoReload: false,
        });
    });

    afterEach(() => {
        hotReload.stop();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('lifecycle', () => {
        it('should start and stop', () => {
            hotReload.start();
            expect(hotReload.getState()).toBe('watching');
            hotReload.stop();
            expect(hotReload.getState()).toBe('stopped');
        });

        it('should track watched paths', () => {
            hotReload.start();
            expect(hotReload.getWatchedPaths()).toContain(tmpDir);
        });
    });

    describe('plugin registration', () => {
        it('should register plugins', () => {
            hotReload.registerPlugin('test-plugin', path.join(tmpDir, 'test'));
            expect(hotReload.getRegisteredPlugins().size).toBe(1);
        });
    });

    describe('manual reload', () => {
        it('should fail without handler', async () => {
            const result = await hotReload.triggerReload('test');
            expect(result.success).toBe(false);
            expect(result.error).toContain('No reload handler');
        });

        it('should execute handler on manual reload', async () => {
            hotReload.onReload(async (event) => ({
                pluginId: event.pluginId,
                success: true,
                duration: 10,
            }));
            const result = await hotReload.triggerReload('my-plugin');
            expect(result.success).toBe(true);
            expect(result.pluginId).toBe('my-plugin');
        });

        it('should track reload history', async () => {
            hotReload.onReload(async (event) => ({
                pluginId: event.pluginId,
                success: true,
                duration: 5,
            }));
            await hotReload.triggerReload('p1');
            await hotReload.triggerReload('p2');
            expect(hotReload.getReloadCount()).toBe(2);
            expect(hotReload.getSuccessRate()).toBe(1);
        });

        it('should handle reload errors', async () => {
            hotReload.onReload(async () => {
                throw new Error('Reload failed');
            });
            const result = await hotReload.triggerReload('fail-plugin');
            expect(result.success).toBe(false);
            expect(result.error).toContain('Reload failed');
        });
    });

    describe('event listeners', () => {
        it('should notify on reload', async () => {
            let received: unknown;
            hotReload.on((event, data) => { if (event === 'reload') received = data; });
            hotReload.onReload(async (event) => ({
                pluginId: event.pluginId,
                success: true,
                duration: 1,
            }));
            await hotReload.triggerReload('test');
            expect(received).toBeDefined();
        });

        it('should unsubscribe', async () => {
            let count = 0;
            const unsub = hotReload.on(() => { count++; });
            hotReload.onReload(async (event) => ({
                pluginId: event.pluginId,
                success: true,
                duration: 1,
            }));
            await hotReload.triggerReload('test');
            unsub();
            await hotReload.triggerReload('test');
            expect(count).toBe(1);
        });
    });

    describe('success rate', () => {
        it('should calculate mixed success rate', async () => {
            let shouldFail = false;
            hotReload.onReload(async (event) => ({
                pluginId: event.pluginId,
                success: !shouldFail,
                duration: 1,
            }));
            await hotReload.triggerReload('ok');
            shouldFail = true;
            await hotReload.triggerReload('fail');
            expect(hotReload.getSuccessRate()).toBe(0.5);
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// VersionManager
// ═══════════════════════════════════════════════════════════════════

describe('VersionManager', () => {
    let vm: VersionManager;

    beforeEach(() => {
        vm = new VersionManager('2.0.0');
    });

    describe('register / unregister', () => {
        it('should register plugins', () => {
            vm.register('weather', '1.0.0');
            expect(vm.getVersion('weather')).toBe('1.0.0');
            expect(vm.count()).toBe(1);
        });

        it('should track version updates', () => {
            vm.register('weather', '1.0.0');
            vm.register('weather', '1.1.0');
            expect(vm.getVersion('weather')).toBe('1.1.0');
            expect(vm.getUpgradePath('weather')).toEqual(['1.0.0', '1.1.0']);
        });

        it('should unregister plugins', () => {
            vm.register('weather', '1.0.0');
            expect(vm.unregister('weather')).toBe(true);
            expect(vm.count()).toBe(0);
        });
    });

    describe('host compatibility', () => {
        it('should pass when host meets requirement', () => {
            const result = vm.checkHostCompat('weather', '1.0.0');
            expect(result.compatible).toBe(true);
        });

        it('should fail when host is too old', () => {
            const result = vm.checkHostCompat('weather', '3.0.0');
            expect(result.compatible).toBe(false);
            expect(result.reason).toContain('3.0.0');
        });
    });

    describe('peer compatibility', () => {
        it('should pass when peer meets constraint', () => {
            vm.register('db', '2.0.0');
            const result = vm.checkPeerCompat('api', 'db', '>=1.0.0');
            expect(result.compatible).toBe(true);
        });

        it('should fail when peer is missing', () => {
            const result = vm.checkPeerCompat('api', 'missing', '>=1.0.0');
            expect(result.compatible).toBe(false);
            expect(result.reason).toContain('not installed');
        });

        it('should fail when peer version is incompatible', () => {
            vm.register('db', '0.5.0');
            const result = vm.checkPeerCompat('api', 'db', '>=1.0.0');
            expect(result.compatible).toBe(false);
        });
    });

    describe('checkCompatibility', () => {
        it('should run full compatibility check', () => {
            vm.register('db', '2.0.0');
            const report = vm.checkCompatibility({
                pluginId: 'api',
                minHostVersion: '1.0.0',
                peerDependencies: [{ peerId: 'db', version: '>=1.0.0' }],
            });
            expect(report.allCompatible).toBe(true);
            expect(report.errors).toHaveLength(0);
        });

        it('should report multiple errors', () => {
            const report = vm.checkCompatibility({
                pluginId: 'api',
                minHostVersion: '5.0.0',
                peerDependencies: [{ peerId: 'missing', version: '>=1.0.0' }],
            });
            expect(report.allCompatible).toBe(false);
            expect(report.errors).toHaveLength(2);
        });
    });

    describe('update detection', () => {
        it('should detect available update', () => {
            vm.register('weather', '1.0.0');
            const info = vm.checkUpdate('weather', '1.1.0');
            expect(info.updateAvailable).toBe(true);
            expect(info.breaking).toBe(false);
        });

        it('should detect breaking update', () => {
            vm.register('weather', '1.0.0');
            const info = vm.checkUpdate('weather', '2.0.0');
            expect(info.updateAvailable).toBe(true);
            expect(info.breaking).toBe(true);
        });

        it('should detect no update needed', () => {
            vm.register('weather', '1.0.0');
            const info = vm.checkUpdate('weather', '1.0.0');
            expect(info.updateAvailable).toBe(false);
        });

        it('should check all updates', () => {
            vm.register('a', '1.0.0');
            vm.register('b', '2.0.0');
            const updates = vm.checkAllUpdates({ a: '1.1.0', b: '2.0.0' });
            expect(updates).toHaveLength(2);
            expect(updates.find((u) => u.pluginId === 'a')?.updateAvailable).toBe(true);
            expect(updates.find((u) => u.pluginId === 'b')?.updateAvailable).toBe(false);
        });
    });

    describe('downgrade detection', () => {
        it('should detect downgrade', () => {
            vm.register('weather', '2.0.0');
            expect(vm.isDowngrade('weather', '1.0.0')).toBe(true);
        });

        it('should not flag equal version', () => {
            vm.register('weather', '1.0.0');
            expect(vm.isDowngrade('weather', '1.0.0')).toBe(false);
        });

        it('should not flag upgrade', () => {
            vm.register('weather', '1.0.0');
            expect(vm.isDowngrade('weather', '2.0.0')).toBe(false);
        });
    });
});
