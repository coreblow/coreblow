/**
 * Wave 14: Plugin Marketplace API Tests
 *
 * Tests all REST endpoints: plugin CRUD, marketplace browse/search,
 * install/uninstall, enable/disable, reload, stats, health.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PluginApiRouter, type PluginApiRequest } from '../../src/web/plugin-api.js';
import { PluginMarketplace } from '../../src/plugins/marketplace.js';
import { PluginInstaller } from '../../src/plugins/install.js';
import { PluginLoader } from '../../src/plugins/plugin-loader.js';
import type { MarketplacePlugin } from '../../src/plugins/types.js';

// ═══════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════

function createPluginDir(baseDir: string, name: string, manifest: Record<string, unknown> = {}): string {
    const pluginDir = path.join(baseDir, name);
    fs.mkdirSync(pluginDir, { recursive: true });
    fs.mkdirSync(path.join(pluginDir, 'src'), { recursive: true });
    fs.writeFileSync(
        path.join(pluginDir, 'plugin.json'),
        JSON.stringify({ name, version: '1.0.0', description: `Test: ${name}`, ...manifest }),
    );
    fs.writeFileSync(path.join(pluginDir, 'src', 'index.ts'), `export default { activate: async () => {} };`);
    return pluginDir;
}

function req(method: string, pathStr: string, query: Record<string, string> = {}, body?: unknown): PluginApiRequest {
    return { method, path: pathStr, params: {}, query, body };
}

function sampleMarketplacePlugin(id: string, overrides: Partial<MarketplacePlugin> = {}): MarketplacePlugin {
    return {
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1),
        version: '1.0.0',
        description: `A ${id} plugin`,
        author: 'CoreBlow',
        tags: ['utility'],
        downloads: 100,
        rating: 4.5,
        verified: true,
        ...overrides,
    } as MarketplacePlugin;
}

// ═══════════════════════════════════════════════════════════════════
// Plugin API — with PluginLoader
// ═══════════════════════════════════════════════════════════════════

describe('PluginApiRouter — with Loader', () => {
    let tmpDir: string;
    let pluginsDir: string;
    let loader: PluginLoader;
    let router: PluginApiRouter;
    let marketplace: PluginMarketplace;
    let installer: PluginInstaller;

    beforeEach(async () => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-'));
        pluginsDir = path.join(tmpDir, 'plugins');
        fs.mkdirSync(pluginsDir, { recursive: true });
        PluginLoader.clearCache();

        createPluginDir(pluginsDir, 'weather', { description: 'Weather plugin', permissions: ['network'] });
        createPluginDir(pluginsDir, 'calendar', { description: 'Calendar plugin' });

        loader = new PluginLoader({ pluginPaths: [pluginsDir] });
        await loader.loadAll();

        marketplace = new PluginMarketplace();
        installer = new PluginInstaller();

        router = new PluginApiRouter({ loader, marketplace, installer });
    });

    afterEach(async () => {
        await loader.shutdown();
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    // --- List Plugins ---

    it('GET /api/plugins — lists installed plugins', async () => {
        const res = await router.handle(req('GET', '/api/plugins'));
        expect(res.status).toBe(200);

        const body = res.body as { plugins: unknown[]; total: number };
        expect(body.total).toBe(2);
        expect(body.plugins).toHaveLength(2);
    });

    it('GET /api/plugins — filters by search', async () => {
        const res = await router.handle(req('GET', '/api/plugins', { search: 'weather' }));
        expect(res.status).toBe(200);

        const body = res.body as { plugins: unknown[]; total: number };
        expect(body.total).toBe(1);
    });

    // --- Get Plugin ---

    it('GET /api/plugins/:id — returns plugin details', async () => {
        const res = await router.handle(req('GET', '/api/plugins/weather'));
        expect(res.status).toBe(200);

        const body = res.body as Record<string, unknown>;
        expect(body.id).toBe('weather');
        expect(body.name).toBe('weather');
    });

    it('GET /api/plugins/:id — 404 for unknown', async () => {
        const res = await router.handle(req('GET', '/api/plugins/nonexistent'));
        expect(res.status).toBe(404);
    });

    // --- Enable/Disable ---

    it('POST /api/plugins/:id/enable — enables plugin', async () => {
        const res = await router.handle(req('POST', '/api/plugins/weather/enable'));
        expect(res.status).toBe(200);
        const body = res.body as { pluginId: string; enabled: boolean };
        expect(body.enabled).toBe(true);
    });

    it('POST /api/plugins/:id/disable — disables plugin', async () => {
        const res = await router.handle(req('POST', '/api/plugins/weather/disable'));
        expect(res.status).toBe(200);
        const body = res.body as { pluginId: string; enabled: boolean };
        expect(body.enabled).toBe(false);
    });

    it('POST /api/plugins/:id/enable — 404 for unknown', async () => {
        const res = await router.handle(req('POST', '/api/plugins/nope/enable'));
        expect(res.status).toBe(404);
    });

    // --- Reload ---

    it('POST /api/plugins/:id/reload — reloads plugin', async () => {
        const res = await router.handle(req('POST', '/api/plugins/weather/reload'));
        expect(res.status).toBe(200);
        const body = res.body as { reloaded: boolean };
        expect(body.reloaded).toBe(true);
    });

    it('POST /api/plugins/:id/reload — 400 for unknown', async () => {
        const res = await router.handle(req('POST', '/api/plugins/nonexistent/reload'));
        expect(res.status).toBe(400);
    });

    // --- Stats ---

    it('GET /api/plugins/stats — returns system stats', async () => {
        const res = await router.handle(req('GET', '/api/plugins/stats'));
        expect(res.status).toBe(200);

        const body = res.body as Record<string, unknown>;
        expect(body.plugins).toBe(2);
        expect(body.state).toBe('loaded');
    });

    // --- Health ---

    it('GET /api/plugins/health — returns health report', async () => {
        const res = await router.handle(req('GET', '/api/plugins/health'));
        expect(res.status).toBe(200);

        const body = res.body as Record<string, unknown>;
        expect(body.healthy).toBe(true);
    });

    // --- 404 ---

    it('returns 404 for unknown routes', async () => {
        const res = await router.handle(req('GET', '/api/nope'));
        expect(res.status).toBe(404);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Plugin API — without Loader (503 responses)
// ═══════════════════════════════════════════════════════════════════

describe('PluginApiRouter — without Loader', () => {
    let router: PluginApiRouter;

    beforeEach(() => {
        router = new PluginApiRouter({
            loader: null,
            marketplace: new PluginMarketplace(),
            installer: new PluginInstaller(),
        });
    });

    it('returns 503 for plugin list when not initialized', async () => {
        const res = await router.handle(req('GET', '/api/plugins'));
        expect(res.status).toBe(503);
    });

    it('returns 503 for plugin details when not initialized', async () => {
        const res = await router.handle(req('GET', '/api/plugins/test'));
        expect(res.status).toBe(503);
    });

    it('returns 503 for stats when not initialized', async () => {
        const res = await router.handle(req('GET', '/api/plugins/stats'));
        expect(res.status).toBe(503);
    });

    it('returns 503 for health when not initialized', async () => {
        const res = await router.handle(req('GET', '/api/plugins/health'));
        expect(res.status).toBe(503);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Marketplace API
// ═══════════════════════════════════════════════════════════════════

describe('PluginApiRouter — Marketplace', () => {
    let marketplace: PluginMarketplace;
    let router: PluginApiRouter;

    beforeEach(() => {
        marketplace = new PluginMarketplace();
        marketplace.loadCatalog([
            sampleMarketplacePlugin('discord-bot', { tags: ['channel', 'discord'], downloads: 500 }),
            sampleMarketplacePlugin('weather-tool', { tags: ['tool', 'api'], downloads: 300 }),
            sampleMarketplacePlugin('analytics', { tags: ['tool', 'analytics'], downloads: 200, author: 'TeamX' }),
            sampleMarketplacePlugin('timer', { tags: ['utility'], downloads: 50 }),
        ]);
        marketplace.setFeatured(['discord-bot', 'analytics']);

        router = new PluginApiRouter({
            loader: null,
            marketplace,
            installer: new PluginInstaller(),
        });
    });

    it('GET /api/marketplace — lists all plugins', async () => {
        const res = await router.handle(req('GET', '/api/marketplace'));
        expect(res.status).toBe(200);

        const body = res.body as { plugins: unknown[]; total: number };
        expect(body.total).toBe(4);
    });

    it('GET /api/marketplace — respects pagination', async () => {
        const res = await router.handle(req('GET', '/api/marketplace', { limit: '2', offset: '0' }));
        expect(res.status).toBe(200);

        const body = res.body as { plugins: unknown[]; total: number; pageSize: number };
        expect(body.plugins).toHaveLength(2);
        expect(body.pageSize).toBe(2);
    });

    it('GET /api/marketplace/search — searches by query', async () => {
        const res = await router.handle(req('GET', '/api/marketplace/search', { q: 'weather' }));
        expect(res.status).toBe(200);

        const body = res.body as { plugins: MarketplacePlugin[]; total: number };
        expect(body.total).toBe(1);
        expect(body.plugins[0].id).toBe('weather-tool');
    });

    it('GET /api/marketplace/search — filters by tags', async () => {
        const res = await router.handle(req('GET', '/api/marketplace/search', { tags: 'channel' }));
        expect(res.status).toBe(200);

        const body = res.body as { plugins: MarketplacePlugin[]; total: number };
        expect(body.total).toBe(1);
        expect(body.plugins[0].id).toBe('discord-bot');
    });

    it('GET /api/marketplace/search — filters by author', async () => {
        const res = await router.handle(req('GET', '/api/marketplace/search', { author: 'TeamX' }));
        expect(res.status).toBe(200);

        const body = res.body as { plugins: MarketplacePlugin[]; total: number };
        expect(body.total).toBe(1);
        expect(body.plugins[0].id).toBe('analytics');
    });

    it('GET /api/marketplace/search — sorts by downloads', async () => {
        const res = await router.handle(req('GET', '/api/marketplace/search', { sort: 'downloads' }));
        expect(res.status).toBe(200);

        const body = res.body as { plugins: MarketplacePlugin[] };
        expect(body.plugins[0].id).toBe('discord-bot');
    });

    it('GET /api/marketplace/featured — returns featured plugins', async () => {
        const res = await router.handle(req('GET', '/api/marketplace/featured'));
        expect(res.status).toBe(200);

        const body = res.body as { featured: MarketplacePlugin[] };
        expect(body.featured).toHaveLength(2);
    });

    it('GET /api/marketplace/categories — returns categories', async () => {
        const res = await router.handle(req('GET', '/api/marketplace/categories'));
        expect(res.status).toBe(200);

        const body = res.body as { categories: { id: string; count: number }[] };
        expect(body.categories.length).toBeGreaterThan(0);
        expect(body.categories.find(c => c.id === 'tool')?.count).toBe(2);
    });

    it('GET /api/marketplace/:id — returns plugin details', async () => {
        const res = await router.handle(req('GET', '/api/marketplace/discord-bot'));
        expect(res.status).toBe(200);

        const body = res.body as MarketplacePlugin;
        expect(body.id).toBe('discord-bot');
    });

    it('GET /api/marketplace/:id — 404 for unknown', async () => {
        const res = await router.handle(req('GET', '/api/marketplace/nonexistent'));
        expect(res.status).toBe(404);
    });
});

// ═══════════════════════════════════════════════════════════════════
// Install/Uninstall API
// ═══════════════════════════════════════════════════════════════════

describe('PluginApiRouter — Install/Uninstall', () => {
    let tmpDir: string;
    let router: PluginApiRouter;
    let installer: PluginInstaller;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'api-inst-'));
        installer = new PluginInstaller();
        router = new PluginApiRouter({
            loader: null,
            marketplace: new PluginMarketplace(),
            installer,
        });
    });

    afterEach(() => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('POST /api/plugins/install — installs from local path', async () => {
        const sourceDir = path.join(tmpDir, 'my-plugin');
        fs.mkdirSync(sourceDir, { recursive: true });
        fs.writeFileSync(path.join(sourceDir, 'plugin.json'), JSON.stringify({
            name: 'my-plugin', version: '1.0.0',
        }));

        const targetDir = path.join(tmpDir, 'installed');
        const res = await router.handle(req('POST', '/api/plugins/install', {}, {
            source: sourceDir,
            targetDir,
            sourceType: 'local',
        }));

        expect(res.status).toBe(201);
        const body = res.body as { success: boolean; pluginId: string };
        expect(body.success).toBe(true);
        expect(body.pluginId).toBe('my-plugin');
    });

    it('POST /api/plugins/install — 400 for missing fields', async () => {
        const res = await router.handle(req('POST', '/api/plugins/install', {}, {}));
        expect(res.status).toBe(400);
    });

    it('DELETE /api/plugins/:id — uninstalls plugin', async () => {
        // First install
        const sourceDir = path.join(tmpDir, 'removable');
        fs.mkdirSync(sourceDir, { recursive: true });
        fs.writeFileSync(path.join(sourceDir, 'plugin.json'), JSON.stringify({ name: 'removable', version: '1.0.0' }));
        const targetDir = path.join(tmpDir, 'installed');
        await installer.installFromLocal(sourceDir, targetDir);

        // Then uninstall via API
        const res = await router.handle(req('DELETE', '/api/plugins/removable'));
        expect(res.status).toBe(200);
        const body = res.body as { success: boolean; pluginId: string };
        expect(body.success).toBe(true);
    });

    it('DELETE /api/plugins/:id — 400 for not installed', async () => {
        const res = await router.handle(req('DELETE', '/api/plugins/nonexistent'));
        expect(res.status).toBe(400);
    });
});
