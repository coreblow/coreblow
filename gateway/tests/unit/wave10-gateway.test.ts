/**
 * Wave 10 — Gateway Integration Tests
 *
 * Tests for: PluginLoader (production-grade integration of all subsystems)
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PluginLoader, PluginLoadFailureError } from '../../src/plugins/plugin-loader.js';
import { PluginRegistry } from '../../src/plugins/registry.js';
import { HookRunner } from '../../src/plugins/hooks.js';
import { DependencyGraph } from '../../src/plugins/dependency-graph.js';
import { VersionManager } from '../../src/plugins/version-manager.js';
import { AuditLog } from '../../src/plugins/audit-log.js';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function createPluginDir(baseDir: string, name: string, manifest: Record<string, unknown> = {}): string {
    const pluginDir = path.join(baseDir, name);
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify({
            name,
            version: '1.0.0',
            description: `Test plugin: ${name}`,
            permissions: ['network', 'filesystem'],
            ...manifest,
        }),
    );
    fs.writeFileSync(
        path.join(pluginDir, 'src', 'index.ts'),
        `export default { activate: async () => {} };`,
    );
    return pluginDir;
}

// ═══════════════════════════════════════════════════════════════════
// PluginLoader — Lifecycle
// ═══════════════════════════════════════════════════════════════════

describe('PluginLoader', () => {
    let tmpDir: string;
    let pluginsDir: string;
    let loader: PluginLoader;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'loader-'));
        pluginsDir = path.join(tmpDir, 'plugins');
        fs.mkdirSync(pluginsDir, { recursive: true });
        PluginLoader.clearCache();
    });

    afterEach(async () => {
        if (loader) {
            try { await loader.shutdown(); } catch { /* ignore */ }
        }
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    describe('construction', () => {
        it('should create with defaults', () => {
            loader = new PluginLoader();
            expect(loader.getState()).toBe('idle');
            expect(loader.getPluginCount()).toBe(0);
        });

        it('should accept options', () => {
            loader = new PluginLoader({
                workspaceDir: tmpDir,
                hostVersion: '2.0.0',
                resourceProfile: 'strict',
            });
            expect(loader.getState()).toBe('idle');
        });
    });

    describe('discovery + loading', () => {
        it('should discover and load plugins from directory', async () => {
            createPluginDir(pluginsDir, 'weather');
            createPluginDir(pluginsDir, 'calendar');

            loader = new PluginLoader({
                pluginPaths: [pluginsDir],
            });

            const result = await loader.loadAll();
            expect(result.loaded).toBe(2);
            expect(result.failed).toBe(0);
            expect(result.loadOrder).toHaveLength(2);
            expect(loader.getState()).toBe('loaded');
            expect(loader.getPluginCount()).toBe(2);
        });

        it('should discover from workspace/plugins path', async () => {
            createPluginDir(pluginsDir, 'test-plugin');

            loader = new PluginLoader({
                workspaceDir: tmpDir,
            });

            const result = await loader.loadAll();
            expect(result.loaded).toBe(1);
        });

        it('should skip non-existent paths gracefully', async () => {
            loader = new PluginLoader({
                pluginPaths: ['/nonexistent/path'],
            });

            const result = await loader.loadAll();
            expect(result.loaded).toBe(0);
        });

        it('should skip invalid manifests', async () => {
            const badDir = path.join(pluginsDir, 'bad-plugin');
            fs.mkdirSync(badDir, { recursive: true });
            fs.writeFileSync(path.join(badDir, 'plugin.json'), 'not json');

            loader = new PluginLoader({ pluginPaths: [pluginsDir] });
            const result = await loader.loadAll();
            expect(result.loaded).toBe(0);
            expect(result.diagnostics.some((d) => d.level === 'warn')).toBe(true);
        });
    });

    describe('config + enable state', () => {
        it('should respect plugin enable state from config', async () => {
            createPluginDir(pluginsDir, 'enabled-plugin');
            createPluginDir(pluginsDir, 'disabled-plugin');

            loader = new PluginLoader({
                pluginPaths: [pluginsDir],
                pluginsConfig: {
                    enabled: true,
                    deny: ['disabled-plugin'],
                },
            });

            const result = await loader.loadAll();
            expect(result.loaded).toBe(1);
            expect(loader.isLoaded('enabled-plugin')).toBe(true);
            expect(loader.isLoaded('disabled-plugin')).toBe(false);
        });

        it('should filter by onlyPluginIds', async () => {
            createPluginDir(pluginsDir, 'alpha');
            createPluginDir(pluginsDir, 'beta');
            createPluginDir(pluginsDir, 'gamma');

            loader = new PluginLoader({
                pluginPaths: [pluginsDir],
                onlyPluginIds: ['alpha', 'beta'],
            });

            const result = await loader.loadAll();
            expect(result.loaded).toBe(2);
            expect(loader.isLoaded('gamma')).toBe(false);
        });
    });

    describe('dependency resolution', () => {
        it('should resolve load order with dependencies', async () => {
            createPluginDir(pluginsDir, 'core', { version: '1.0.0' });
            createPluginDir(pluginsDir, 'database', {
                version: '1.0.0',
                dependencies: ['core'],
            });
            createPluginDir(pluginsDir, 'api', {
                version: '1.0.0',
                dependencies: ['database'],
            });

            loader = new PluginLoader({ pluginPaths: [pluginsDir] });
            const result = await loader.loadAll();

            expect(result.loaded).toBe(3);
            const coreIdx = result.loadOrder.indexOf('core');
            const dbIdx = result.loadOrder.indexOf('database');
            const apiIdx = result.loadOrder.indexOf('api');
            expect(coreIdx).toBeLessThan(dbIdx);
            expect(dbIdx).toBeLessThan(apiIdx);
        });
    });

    describe('sandbox + security', () => {
        it('should create sandbox for each plugin', async () => {
            createPluginDir(pluginsDir, 'sandboxed');

            loader = new PluginLoader({ pluginPaths: [pluginsDir] });
            await loader.loadAll();

            const sandbox = loader.getSandbox('sandboxed');
            expect(sandbox).toBeDefined();
            expect(sandbox!.hasPermission('network')).toBe(true);
        });

        it('should create resource limiter for each plugin', async () => {
            createPluginDir(pluginsDir, 'limited');

            loader = new PluginLoader({
                pluginPaths: [pluginsDir],
                resourceProfile: 'strict',
            });
            await loader.loadAll();

            const limiter = loader.getLimiter('limited');
            expect(limiter).toBeDefined();
        });

        it('should create path jail for each plugin', async () => {
            createPluginDir(pluginsDir, 'jailed');

            loader = new PluginLoader({ pluginPaths: [pluginsDir] });
            await loader.loadAll();

            const jail = loader.getJail('jailed');
            expect(jail).toBeDefined();
        });
    });

    describe('audit trail', () => {
        it('should record lifecycle events', async () => {
            createPluginDir(pluginsDir, 'audited');

            loader = new PluginLoader({ pluginPaths: [pluginsDir] });
            await loader.loadAll();

            const auditLog = loader.getAuditLog();
            expect(auditLog.count()).toBeGreaterThan(0);
            const events = auditLog.forPlugin('audited');
            expect(events.length).toBeGreaterThan(0);
        });
    });

    describe('caching', () => {
        it('should cache and reuse registry', async () => {
            createPluginDir(pluginsDir, 'cached-plugin');

            loader = new PluginLoader({
                pluginPaths: [pluginsDir],
                cache: true,
            });

            const result1 = await loader.loadAll();
            expect(result1.loaded).toBe(1);

            // Second load should hit cache
            const loader2 = new PluginLoader({
                pluginPaths: [pluginsDir],
                cache: true,
            });
            const result2 = await loader2.loadAll();
            expect(result2.diagnostics.some((d) => d.message.includes('Cache hit'))).toBe(true);
        });

        it('should clear cache', () => {
            PluginLoader.clearCache();
            expect(PluginLoader.getCacheSize()).toBe(0);
        });
    });

    describe('reload', () => {
        it('should reload a plugin', async () => {
            createPluginDir(pluginsDir, 'reloadable');

            loader = new PluginLoader({ pluginPaths: [pluginsDir] });
            await loader.loadAll();

            await loader.reloadPlugin('reloadable');
            expect(loader.isLoaded('reloadable')).toBe(true);
            expect(loader.isActivated('reloadable')).toBe(true);
        });

        it('should throw on reload of unknown plugin', async () => {
            loader = new PluginLoader();
            await loader.loadAll();

            await expect(loader.reloadPlugin('nonexistent')).rejects.toThrow('not loaded');
        });
    });

    describe('shutdown', () => {
        it('should gracefully shutdown', async () => {
            createPluginDir(pluginsDir, 'shutdown-test');

            loader = new PluginLoader({ pluginPaths: [pluginsDir] });
            await loader.loadAll();

            await loader.shutdown();
            expect(loader.getState()).toBe('stopped');
        });
    });

    describe('health report', () => {
        it('should generate health report', async () => {
            createPluginDir(pluginsDir, 'health-test');

            loader = new PluginLoader({ pluginPaths: [pluginsDir] });
            await loader.loadAll();

            const health = loader.getHealth();
            expect(health.state).toBe('loaded');
            expect(health.plugins).toBe(1);
            expect(health.activated).toBe(1);
            expect(health.auditEvents).toBeGreaterThan(0);
        });
    });

    describe('diagnostics', () => {
        it('should collect diagnostics throughout pipeline', async () => {
            createPluginDir(pluginsDir, 'diag-test');

            loader = new PluginLoader({ pluginPaths: [pluginsDir] });
            const result = await loader.loadAll();

            expect(result.diagnostics.length).toBeGreaterThan(0);
            expect(result.diagnostics.every((d) => d.timestamp > 0)).toBe(true);
        });

        it('should report duration', async () => {
            loader = new PluginLoader({ pluginPaths: [pluginsDir] });
            const result = await loader.loadAll();
            expect(result.duration).toBeGreaterThanOrEqual(0);
        });
    });

    describe('accessors', () => {
        it('should expose all subsystems', async () => {
            loader = new PluginLoader();
            await loader.loadAll();

            expect(loader.getRegistry()).toBeInstanceOf(PluginRegistry);
            expect(loader.getHookRunner()).toBeInstanceOf(HookRunner);
            expect(loader.getAuditLog()).toBeInstanceOf(AuditLog);
            expect(loader.getDependencyGraph()).toBeInstanceOf(DependencyGraph);
            expect(loader.getVersionManager()).toBeInstanceOf(VersionManager);
            expect(loader.getHotReload()).toBeNull(); // not enabled
        });
    });

    describe('PluginLoadFailureError', () => {
        it('should construct with registry and failed IDs', () => {
            const registry = new PluginRegistry();
            const err = new PluginLoadFailureError(registry, ['bad-plugin']);
            expect(err.name).toBe('PluginLoadFailureError');
            expect(err.pluginIds).toEqual(['bad-plugin']);
            expect(err.registry).toBe(registry);
            expect(err.message).toContain('bad-plugin');
        });
    });
});

// ═══════════════════════════════════════════════════════════════════
// Full System — End-to-End Scenario
// ═══════════════════════════════════════════════════════════════════

describe('Full System E2E', () => {
    let tmpDir: string;
    let pluginsDir: string;
    let loader: PluginLoader;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-'));
        pluginsDir = path.join(tmpDir, 'plugins');
        fs.mkdirSync(pluginsDir, { recursive: true });
        PluginLoader.clearCache();
    });

    afterEach(async () => {
        if (loader) {
            try { await loader.shutdown(); } catch { /* ignore */ }
        }
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('should run a multi-plugin scenario with deps + security + reload', async () => {
        // Setup: 3 plugins with dependency chain
        createPluginDir(pluginsDir, 'auth', { version: '2.0.0' });
        createPluginDir(pluginsDir, 'database', {
            version: '1.0.0',
            dependencies: ['auth'],
        });
        createPluginDir(pluginsDir, 'api-server', {
            version: '1.0.0',
            dependencies: ['database', 'auth'],
        });

        // Load with all features
        loader = new PluginLoader({
            pluginPaths: [pluginsDir],
            hostVersion: '3.0.0',
            resourceProfile: 'standard',
            cache: true,
        });

        const result = await loader.loadAll();

        // Verify load
        expect(result.loaded).toBe(3);
        expect(result.failed).toBe(0);
        expect(loader.getState()).toBe('loaded');

        // Verify dependency order
        const authIdx = result.loadOrder.indexOf('auth');
        const dbIdx = result.loadOrder.indexOf('database');
        const apiIdx = result.loadOrder.indexOf('api-server');
        expect(authIdx).toBeLessThan(dbIdx);
        expect(authIdx).toBeLessThan(apiIdx);

        // Verify security per plugin
        for (const pluginId of ['auth', 'database', 'api-server']) {
            expect(loader.getSandbox(pluginId)).toBeDefined();
            expect(loader.getLimiter(pluginId)).toBeDefined();
            expect(loader.getJail(pluginId)).toBeDefined();
        }

        // Verify audit trail
        const auditLog = loader.getAuditLog();
        expect(auditLog.count()).toBeGreaterThanOrEqual(6); // at least loading+loaded for 3 plugins

        // Verify health
        const health = loader.getHealth();
        expect(health.plugins).toBe(3);
        expect(health.activated).toBe(3);

        // Reload a plugin
        await loader.reloadPlugin('database');
        expect(loader.isActivated('database')).toBe(true);

        // Shutdown
        await loader.shutdown();
        expect(loader.getState()).toBe('stopped');
    });
});
