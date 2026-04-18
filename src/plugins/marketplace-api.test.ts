/**
 * plugins/marketplace-api.test.ts
 *
 * Comprehensive test suite for MarketplaceApi.
 * Tests search, install, uninstall, update, enable/disable,
 * batch operations, stats, and edge cases.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { MarketplaceApi, type InstallRequest } from './marketplace-api.js';
import { PluginMarketplace } from './marketplace.js';
import { PluginInstaller } from './install.js';
import { PermissionManager } from './permission-manager.js';
import type { MarketplacePlugin } from './types.js';

// ─── Helpers ─────────────────────────────────────────────────────

function makeSamplePlugins(): MarketplacePlugin[] {
    return [
        {
            id: 'weather-plugin',
            name: 'Weather Plugin',
            version: '1.2.0',
            description: 'Real-time weather data integration',
            author: 'coreblow-team',
            tags: ['weather', 'api', 'data'],
            provides: ['tool'],
            downloads: 5000,
            rating: 4.5,
            verified: true,
        },
        {
            id: 'analytics-plugin',
            name: 'Analytics Plugin',
            version: '2.0.0',
            description: 'Usage analytics and tracking',
            author: 'analytics-co',
            tags: ['analytics', 'tracking'],
            provides: ['hook', 'middleware'],
            downloads: 12000,
            rating: 4.8,
            verified: true,
        },
        {
            id: 'theme-dark',
            name: 'Dark Theme',
            version: '0.5.0',
            description: 'Dark theme for the UI',
            author: 'design-guild',
            tags: ['theme', 'ui'],
            provides: ['channel'],
            downloads: 800,
            rating: 3.5,
            verified: false,
        },
    ];
}

function createApi(): { api: MarketplaceApi; marketplace: PluginMarketplace; installer: PluginInstaller; permissions: PermissionManager } {
    const marketplace = new PluginMarketplace();
    const installer = new PluginInstaller();
    const permissions = new PermissionManager();
    const api = new MarketplaceApi({ marketplace, installer, permissions });

    // Load sample catalog
    marketplace.loadCatalog(makeSamplePlugins());
    marketplace.setFeatured(['weather-plugin', 'analytics-plugin']);

    return { api, marketplace, installer, permissions };
}

// ─── Test Suite ──────────────────────────────────────────────────

describe('MarketplaceApi', () => {
    let api: MarketplaceApi;
    let marketplace: PluginMarketplace;

    beforeEach(() => {
        const ctx = createApi();
        api = ctx.api;
        marketplace = ctx.marketplace;
    });

    // ════════════════════════════════════════════════════════════
    // Search & Browse (8 tests)
    // ════════════════════════════════════════════════════════════

    describe('search and browse', () => {
        it('should search all plugins', () => {
            const result = api.search();
            expect(result.ok).toBe(true);
            expect(result.data!.total).toBe(3);
        });

        it('should search by query', () => {
            const result = api.search({ query: 'weather' });
            expect(result.ok).toBe(true);
            expect(result.data!.total).toBe(1);
            expect(result.data!.plugins[0].id).toBe('weather-plugin');
        });

        it('should search by tags', () => {
            const result = api.search({ tags: ['analytics'] });
            expect(result.ok).toBe(true);
            expect(result.data!.total).toBe(1);
        });

        it('should search by author', () => {
            const result = api.search({ author: 'coreblow-team' });
            expect(result.ok).toBe(true);
            expect(result.data!.total).toBe(1);
        });

        it('should get plugin detail', () => {
            const result = api.getPluginDetail('weather-plugin');
            expect(result.ok).toBe(true);
            expect(result.data!.plugin.id).toBe('weather-plugin');
            expect(result.data!.installed).toBe(false);
        });

        it('should return error for unknown plugin', () => {
            const result = api.getPluginDetail('nonexistent');
            expect(result.ok).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should get featured plugins', () => {
            const result = api.getFeatured();
            expect(result.ok).toBe(true);
            expect(result.data!).toHaveLength(2);
        });

        it('should get categories', () => {
            const result = api.getCategories();
            expect(result.ok).toBe(true);
            expect(result.data!.length).toBeGreaterThan(0);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Install (5 tests)
    // ════════════════════════════════════════════════════════════

    describe('install', () => {
        it('should install from npm', async () => {
            const result = await api.install({
                pluginId: 'weather-plugin',
                source: 'weather-plugin',
                sourceType: 'npm',
                targetDir: '/tmp/test-plugins',
            });
            expect(result.ok).toBe(true);
            expect(result.data!.success).toBe(true);
        });

        it('should auto-enable on install', async () => {
            await api.install({
                pluginId: 'weather-plugin',
                source: 'weather-plugin',
                sourceType: 'npm',
                targetDir: '/tmp/test-plugins',
            });
            expect(api.isEnabled('weather-plugin')).toBe(true);
        });

        it('should not auto-enable when autoEnable=false', async () => {
            await api.install({
                pluginId: 'weather-plugin',
                source: 'weather-plugin',
                sourceType: 'npm',
                targetDir: '/tmp/test-plugins',
                autoEnable: false,
            });
            expect(api.isEnabled('weather-plugin')).toBe(false);
        });

        it('should record install in action log', async () => {
            await api.install({
                pluginId: 'weather-plugin',
                source: 'weather-plugin',
                sourceType: 'npm',
                targetDir: '/tmp/test-plugins',
            });
            const logResult = api.getActionLog();
            expect(logResult.ok).toBe(true);
            expect(logResult.data!.some((l) => l.action === 'install')).toBe(true);
        });

        it('should show installed status in detail', async () => {
            await api.install({
                pluginId: 'weather-plugin',
                source: 'weather-plugin',
                sourceType: 'npm',
                targetDir: '/tmp/test-plugins',
            });
            const detail = api.getPluginDetail('weather-plugin');
            expect(detail.data!.installed).toBe(true);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Uninstall (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('uninstall', () => {
        it('should uninstall installed plugin', async () => {
            await api.install({
                pluginId: 'weather-plugin',
                source: 'weather-plugin',
                sourceType: 'npm',
                targetDir: '/tmp/test-plugins',
            });
            const result = await api.uninstall('weather-plugin');
            expect(result.ok).toBe(true);
            expect(result.data!.success).toBe(true);
        });

        it('should disable on uninstall', async () => {
            await api.install({
                pluginId: 'weather-plugin',
                source: 'weather-plugin',
                sourceType: 'npm',
                targetDir: '/tmp/test-plugins',
            });
            await api.uninstall('weather-plugin');
            expect(api.isEnabled('weather-plugin')).toBe(false);
        });

        it('should remove permissions on uninstall', async () => {
            const ctx = createApi();
            ctx.permissions.grant('weather-plugin', 'network');
            await ctx.api.install({
                pluginId: 'weather-plugin',
                source: 'weather-plugin',
                sourceType: 'npm',
                targetDir: '/tmp/test-plugins',
            });
            await ctx.api.uninstall('weather-plugin');
            expect(ctx.permissions.getPluginPermissions('weather-plugin')).toHaveLength(0);
        });

        it('should handle uninstall of not-installed plugin', async () => {
            const result = await api.uninstall('nonexistent');
            expect(result.ok).toBe(true);
            expect(result.data!.success).toBe(false);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Enable / Disable (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('enable and disable', () => {
        it('should enable plugin', () => {
            const result = api.enable('weather-plugin');
            expect(result.ok).toBe(true);
            expect(result.data!.enabled).toBe(true);
            expect(api.isEnabled('weather-plugin')).toBe(true);
        });

        it('should disable plugin', () => {
            api.enable('weather-plugin');
            const result = api.disable('weather-plugin');
            expect(result.ok).toBe(true);
            expect(result.data!.enabled).toBe(false);
            expect(api.isEnabled('weather-plugin')).toBe(false);
        });

        it('should return false for non-enabled plugin', () => {
            expect(api.isEnabled('unknown')).toBe(false);
        });

        it('should get enabled plugins list', () => {
            api.enable('a');
            api.enable('b');
            expect(api.getEnabledPlugins()).toHaveLength(2);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Batch Operations (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('batch operations', () => {
        it('should batch install', async () => {
            const requests: InstallRequest[] = [
                { pluginId: 'plugin-a', source: 'plugin-a', sourceType: 'npm', targetDir: '/tmp/test-plugins' },
                { pluginId: 'plugin-b', source: 'plugin-b', sourceType: 'npm', targetDir: '/tmp/test-plugins' },
            ];
            const result = await api.batchInstall(requests);
            expect(result.ok).toBe(true);
            expect(result.data!.succeeded).toBe(2);
        });

        it('should batch uninstall', async () => {
            await api.install({ pluginId: 'a', source: 'a', sourceType: 'npm', targetDir: '/tmp/test-plugins' });
            await api.install({ pluginId: 'b', source: 'b', sourceType: 'npm', targetDir: '/tmp/test-plugins' });
            const result = await api.batchUninstall(['a', 'b']);
            expect(result.ok).toBe(true);
            expect(result.data!.succeeded).toBe(2);
        });

        it('should batch enable', () => {
            const result = api.batchSetEnabled(['a', 'b', 'c'], true);
            expect(result.ok).toBe(true);
            expect(result.data!.succeeded).toBe(3);
            expect(api.isEnabled('a')).toBe(true);
        });

        it('should batch disable', () => {
            api.batchSetEnabled(['a', 'b'], true);
            const result = api.batchSetEnabled(['a', 'b'], false);
            expect(result.data!.succeeded).toBe(2);
            expect(api.isEnabled('a')).toBe(false);
        });
    });

    // ════════════════════════════════════════════════════════════
    // Stats & Logs (4 tests)
    // ════════════════════════════════════════════════════════════

    describe('stats and logs', () => {
        it('should get marketplace stats', () => {
            const result = api.getStats();
            expect(result.ok).toBe(true);
            expect(result.data!.catalogSize).toBe(3);
        });

        it('should get action log', async () => {
            api.enable('a');
            api.disable('a');
            const result = api.getActionLog();
            expect(result.ok).toBe(true);
            expect(result.data!).toHaveLength(2);
        });

        it('should get installed plugins', async () => {
            await api.install({ pluginId: 'test', source: 'test', sourceType: 'npm', targetDir: '/tmp/test-plugins' });
            const result = api.getInstalled();
            expect(result.ok).toBe(true);
            expect(result.data!.length).toBeGreaterThanOrEqual(1);
        });

        it('should get verified plugins', () => {
            const result = api.getVerified();
            expect(result.ok).toBe(true);
            expect(result.data!).toHaveLength(2); // weather + analytics are verified
        });
    });

    // ════════════════════════════════════════════════════════════
    // Accessors (3 tests)
    // ════════════════════════════════════════════════════════════

    describe('accessors', () => {
        it('should expose marketplace', () => {
            expect(api.getMarketplace()).toBeInstanceOf(PluginMarketplace);
        });

        it('should expose installer', () => {
            expect(api.getInstaller()).toBeInstanceOf(PluginInstaller);
        });

        it('should expose permissions', () => {
            expect(api.getPermissions()).toBeInstanceOf(PermissionManager);
        });
    });
});

// ─── PluginMarketplace Unit Tests ────────────────────────────────

describe('PluginMarketplace', () => {
    let marketplace: PluginMarketplace;

    beforeEach(() => {
        marketplace = new PluginMarketplace();
        marketplace.loadCatalog(makeSamplePlugins());
    });

    describe('catalog', () => {
        it('should load catalog', () => {
            expect(marketplace.count()).toBe(3);
        });

        it('should list all plugins', () => {
            expect(marketplace.list()).toHaveLength(3);
        });

        it('should get plugin by ID', () => {
            const plugin = marketplace.getPlugin('weather-plugin');
            expect(plugin).toBeDefined();
            expect(plugin!.name).toBe('Weather Plugin');
        });

        it('should return undefined for unknown plugin', () => {
            expect(marketplace.getPlugin('unknown')).toBeUndefined();
        });

        it('should register a single plugin', () => {
            marketplace.register({ id: 'new', name: 'New', version: '1.0.0', description: 'New plugin' });
            expect(marketplace.count()).toBe(4);
        });
    });

    describe('search', () => {
        it('should search by name query', () => {
            const result = marketplace.search({ query: 'analytics' });
            expect(result.total).toBe(1);
        });

        it('should search by tag query', () => {
            const result = marketplace.search({ query: 'theme' });
            expect(result.total).toBe(1);
        });

        it('should sort by downloads', () => {
            const result = marketplace.search({ sort: 'downloads' });
            expect(result.plugins[0].id).toBe('analytics-plugin');
        });

        it('should sort by rating', () => {
            const result = marketplace.search({ sort: 'rating' });
            expect(result.plugins[0].id).toBe('analytics-plugin');
        });

        it('should paginate results', () => {
            const result = marketplace.search({ limit: 2, offset: 0 });
            expect(result.plugins).toHaveLength(2);
            expect(result.pageSize).toBe(2);
        });

        it('should filter by provides', () => {
            const result = marketplace.search({ provides: ['tool'] });
            expect(result.total).toBe(1);
            expect(result.plugins[0].id).toBe('weather-plugin');
        });
    });

    describe('featured and categories', () => {
        it('should get featured plugins', () => {
            marketplace.setFeatured(['weather-plugin']);
            const featured = marketplace.getFeatured();
            expect(featured).toHaveLength(1);
            expect(featured[0].id).toBe('weather-plugin');
        });

        it('should get categories', () => {
            const categories = marketplace.getCategories();
            expect(categories.length).toBeGreaterThan(0);
            expect(categories.some((c) => c.id === 'api')).toBe(true);
        });

        it('should get verified plugins', () => {
            expect(marketplace.getVerified()).toHaveLength(2);
        });

        it('should get by provider type', () => {
            const tools = marketplace.getByProvider('tool');
            expect(tools).toHaveLength(1);
        });
    });
});
