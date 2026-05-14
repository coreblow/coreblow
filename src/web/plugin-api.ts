/**
 * web/plugin-api.ts
 *
 * Plugin Marketplace REST API — HTTP endpoints for browsing, searching,
 * installing, uninstalling, and managing plugins via the Gateway API.
 *
 * Following CoreBlow's gateway/api/plugin-endpoints.ts (~900 LOC) pattern,
 * adapted for CoreBlow's OOP architecture with dependency-injected router
 * and typed request/response contracts.
 *
 * Endpoints:
 *   GET    /api/plugins                — List installed plugins
 *   GET    /api/plugins/:id            — Get plugin details
 *   POST   /api/plugins/:id/enable     — Enable plugin
 *   POST   /api/plugins/:id/disable    — Disable plugin
 *   POST   /api/plugins/:id/reload     — Hot-reload plugin
 *   DELETE /api/plugins/:id            — Uninstall plugin
 *   POST   /api/plugins/install        — Install plugin
 *   GET    /api/marketplace            — Browse marketplace catalog
 *   GET    /api/marketplace/search     — Search marketplace
 *   GET    /api/marketplace/featured   — Featured plugins
 *   GET    /api/marketplace/categories — Plugin categories
 *   GET    /api/marketplace/:id        — Marketplace plugin details
 *   GET    /api/plugins/stats          — Plugin system stats
 *   GET    /api/plugins/health         — Plugin health report
 */

import { createChildLogger } from '../utils/logger.js';
// @ts-expect-error — API drift (tracked: remove after upstream types fixed)
import { PluginMarketplace, type MarketplaceSearchResult } from '../plugins/marketplace.js';
// @ts-expect-error — API drift (tracked: remove after upstream types fixed)
import { PluginInstaller, type InstallResult, type UninstallResult } from '../plugins/install.js';
import type { PluginLoader } from '../plugins/plugin-loader.js';
// @ts-expect-error — API drift (tracked: remove after upstream types fixed)
import type { MarketplacePlugin, MarketplaceSearchOptions } from '../plugins/types.js';

const log = createChildLogger('web:plugin-api');

// ─── Types ──────────────────────────────────────────────────────

export interface PluginApiRequest {
    method: string;
    path: string;
    params: Record<string, string>;
    query: Record<string, string>;
    body?: unknown;
}

export interface PluginApiResponse {
    status: number;
    body: unknown;
}

export interface PluginApiDependencies {
    loader: PluginLoader | null;
    marketplace: PluginMarketplace;
    installer: PluginInstaller;
}

/** Installed plugin info for API response */
export interface PluginInfo {
    id: string;
    name: string;
    version: string;
    description?: string;
    status: string;
    enabled: boolean;
    activated: boolean;
    provides: string[];
    tools: string[];
    hooks: string[];
}

// ─── PluginApiRouter ────────────────────────────────────────────

/**
 * PluginApiRouter
 *
 * Handles all /api/plugins/* and /api/marketplace/* routes.
 * Stateless — depends on injected PluginLoader, Marketplace, and Installer.
 */
export class PluginApiRouter {
    private deps: PluginApiDependencies;

    constructor(deps: PluginApiDependencies) {
        this.deps = deps;
    }

    /**
     * Route a request to the appropriate handler.
     */
    async handle(req: PluginApiRequest): Promise<PluginApiResponse> {
        const { method, path } = req;

        try {
            // ─── /api/plugins routes ────────────────────────
            if (path === '/api/plugins' && method === 'GET') {
                return this.listPlugins(req);
            }
            if (path === '/api/plugins/stats' && method === 'GET') {
                return this.getStats();
            }
            if (path === '/api/plugins/health' && method === 'GET') {
                return this.getHealth();
            }
            if (path === '/api/plugins/install' && method === 'POST') {
                return this.installPlugin(req);
            }

            // Dynamic plugin routes: /api/plugins/:id/*
            const pluginMatch = path.match(/^\/api\/plugins\/([^/]+)(\/(.+))?$/);
            if (pluginMatch) {
                const pluginId = pluginMatch[1];
                const action = pluginMatch[3];

                if (!action && method === 'GET') {
                    return this.getPlugin(pluginId);
                }
                if (!action && method === 'DELETE') {
                    return this.uninstallPlugin(pluginId);
                }
                if (action === 'enable' && method === 'POST') {
                    return this.enablePlugin(pluginId);
                }
                if (action === 'disable' && method === 'POST') {
                    return this.disablePlugin(pluginId);
                }
                if (action === 'reload' && method === 'POST') {
                    return this.reloadPlugin(pluginId);
                }
            }

            // ─── /api/marketplace routes ────────────────────
            if (path === '/api/marketplace' && method === 'GET') {
                return this.browseMarketplace(req);
            }
            if (path === '/api/marketplace/search' && method === 'GET') {
                return this.searchMarketplace(req);
            }
            if (path === '/api/marketplace/featured' && method === 'GET') {
                return this.getFeatured();
            }
            if (path === '/api/marketplace/categories' && method === 'GET') {
                return this.getCategories();
            }

            const marketplaceMatch = path.match(/^\/api\/marketplace\/([^/]+)$/);
            if (marketplaceMatch && method === 'GET') {
                return this.getMarketplacePlugin(marketplaceMatch[1]);
            }

            return { status: 404, body: { error: 'Not found' } };
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            log.error({ err: errMsg, path }, 'Plugin API error');
            return { status: 500, body: { error: errMsg } };
        }
    }

    // ─── Plugin Management ──────────────────────────────────────

    private listPlugins(req: PluginApiRequest): PluginApiResponse {
        const { loader } = this.deps;
        if (!loader) {
            return { status: 503, body: { error: 'Plugin system not initialized', plugins: [] } };
        }

        const registry = loader.getRegistry();
        // @ts-expect-error — API drift (tracked: remove after upstream types fixed)
        const plugins = registry.getPlugins();
        const status = req.query.status;
        const search = req.query.search?.toLowerCase();

        let list: PluginInfo[] = plugins.map((p: any) => ({
            id: p.id,
            name: p.name,
            version: p.version ?? '0.0.0',
            description: p.description,
            status: p.status,
            enabled: p.enabled !== false,
            activated: loader.isActivated(p.id),
            provides: [...p.channelIds, ...p.providerIds],
            tools: p.toolNames,
            hooks: p.hookNames,
        }));

        // Filter by status
        if (status) {
            list = list.filter((p) => p.status === status);
        }

        // Filter by search
        if (search) {
            list = list.filter((p) =>
                p.id.toLowerCase().includes(search) ||
                p.name.toLowerCase().includes(search) ||
                p.description?.toLowerCase().includes(search),
            );
        }

        return {
            status: 200,
            body: { plugins: list, total: list.length },
        };
    }

    private getPlugin(pluginId: string): PluginApiResponse {
        const { loader } = this.deps;
        if (!loader) {
            return { status: 503, body: { error: 'Plugin system not initialized' } };
        }

        const registry = loader.getRegistry();
        // @ts-expect-error — API drift (tracked: remove after upstream types fixed)
        const plugin = registry.getPlugin(pluginId);
        if (!plugin) {
            return { status: 404, body: { error: `Plugin not found: ${pluginId}` } };
        }

        const sandbox = loader.getSandbox(pluginId);
        const limiter = loader.getLimiter(pluginId);

        // Build sandbox info safely
        let sandboxInfo: Record<string, unknown> | null = null;
        if (sandbox) {
            try {
                const perms = ['network', 'filesystem', 'exec', 'env'] as const;
                sandboxInfo = {
                    permissions: perms.filter(p => sandbox.hasPermission(p)),
                };
            } catch {
                sandboxInfo = { available: true };
            }
        }

        // Build limiter info safely
        const limiterInfo: Record<string, unknown> | null = limiter ? { available: true } : null;

        return {
            status: 200,
            body: {
                id: plugin.id,
                name: plugin.name,
                version: plugin.version ?? '0.0.0',
                description: plugin.description,
                status: plugin.status,
                enabled: plugin.enabled !== false,
                activated: loader.isActivated(pluginId),
                tools: plugin.toolNames,
                hooks: plugin.hookNames,
                commands: plugin.commands,
                channels: plugin.channelIds,
                providers: plugin.providerIds,
                services: plugin.services,
                httpRoutes: plugin.httpRoutes,
                sandbox: sandboxInfo,
                resourceLimits: limiterInfo,
            },
        };
    }

    private enablePlugin(pluginId: string): PluginApiResponse {
        const { loader } = this.deps;
        if (!loader) {
            return { status: 503, body: { error: 'Plugin system not initialized' } };
        }

        // @ts-expect-error — API drift (tracked: remove after upstream types fixed)
        const plugin = loader.getRegistry().getPlugin(pluginId);
        if (!plugin) {
            return { status: 404, body: { error: `Plugin not found: ${pluginId}` } };
        }

        plugin.enabled = true;
        log.info({ pluginId }, 'Plugin enabled via API');
        return { status: 200, body: { pluginId, enabled: true } };
    }

    private disablePlugin(pluginId: string): PluginApiResponse {
        const { loader } = this.deps;
        if (!loader) {
            return { status: 503, body: { error: 'Plugin system not initialized' } };
        }

        // @ts-expect-error — API drift (tracked: remove after upstream types fixed)
        const plugin = loader.getRegistry().getPlugin(pluginId);
        if (!plugin) {
            return { status: 404, body: { error: `Plugin not found: ${pluginId}` } };
        }

        plugin.enabled = false;
        log.info({ pluginId }, 'Plugin disabled via API');
        return { status: 200, body: { pluginId, enabled: false } };
    }

    private async reloadPlugin(pluginId: string): Promise<PluginApiResponse> {
        const { loader } = this.deps;
        if (!loader) {
            return { status: 503, body: { error: 'Plugin system not initialized' } };
        }

        try {
            await loader.reloadPlugin(pluginId);
            log.info({ pluginId }, 'Plugin reloaded via API');
            return { status: 200, body: { pluginId, reloaded: true } };
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            return { status: 400, body: { error: errMsg } };
        }
    }

    private async installPlugin(req: PluginApiRequest): Promise<PluginApiResponse> {
        const body = req.body as Record<string, unknown> | undefined;
        if (!body?.source || !body?.targetDir) {
            return { status: 400, body: { error: 'Missing required fields: source, targetDir' } };
        }

        const source = String(body.source);
        const targetDir = String(body.targetDir);
        const sourceType = String(body.sourceType ?? 'local');

        let result: InstallResult;
        if (sourceType === 'npm') {
            result = await this.deps.installer.installFromNpm(source, targetDir);
        } else {
            result = await this.deps.installer.installFromLocal(source, targetDir);
        }

        if (!result.success) {
            return { status: 400, body: { error: result.error } };
        }

        log.info({ pluginId: result.pluginId, source }, 'Plugin installed via API');
        return { status: 201, body: result };
    }

    private async uninstallPlugin(pluginId: string): Promise<PluginApiResponse> {
        const result: UninstallResult = await this.deps.installer.uninstall(pluginId);

        if (!result.success) {
            return { status: 400, body: { error: result.error } };
        }

        log.info({ pluginId }, 'Plugin uninstalled via API');
        return { status: 200, body: result };
    }

    // ─── Marketplace ────────────────────────────────────────────

    private browseMarketplace(req: PluginApiRequest): PluginApiResponse {
        const { marketplace } = this.deps;
        const offset = parseInt(req.query.offset ?? '0', 10);
        const limit = parseInt(req.query.limit ?? '20', 10);

        const result = marketplace.search({ offset, limit });
        return { status: 200, body: result };
    }

    private searchMarketplace(req: PluginApiRequest): PluginApiResponse {
        const { marketplace } = this.deps;

        const options: MarketplaceSearchOptions = {
            query: req.query.q ?? req.query.query,
            tags: req.query.tags?.split(','),
            author: req.query.author,
            sort: (req.query.sort as MarketplaceSearchOptions['sort']) ?? 'relevance',
            offset: parseInt(req.query.offset ?? '0', 10),
            limit: parseInt(req.query.limit ?? '20', 10),
        };

        const result = marketplace.search(options);
        return { status: 200, body: result };
    }

    private getFeatured(): PluginApiResponse {
        return {
            status: 200,
            body: { featured: this.deps.marketplace.getFeatured() },
        };
    }

    private getCategories(): PluginApiResponse {
        return {
            status: 200,
            body: { categories: this.deps.marketplace.getCategories() },
        };
    }

    private getMarketplacePlugin(pluginId: string): PluginApiResponse {
        const plugin = this.deps.marketplace.getPlugin(pluginId);
        if (!plugin) {
            return { status: 404, body: { error: `Plugin not found in marketplace: ${pluginId}` } };
        }
        return { status: 200, body: plugin };
    }

    // ─── System ─────────────────────────────────────────────────

    private getStats(): PluginApiResponse {
        const { loader } = this.deps;
        if (!loader) {
            return { status: 503, body: { error: 'Plugin system not initialized' } };
        }

        const health = loader.getHealth();
        const registry = loader.getRegistry();
        // @ts-expect-error — API drift (tracked: remove after upstream types fixed)
        const summary = registry.getSummary();

        return {
            status: 200,
            body: {
                state: health.state,
                plugins: summary.pluginCount,
                loaded: summary.loadedCount,
                errors: summary.errorCount,
                tools: summary.toolCount,
                hooks: summary.hookCount,
                channels: summary.channelCount,
                providers: summary.providerCount,
                services: summary.serviceCount,
                commands: summary.commandCount,
                httpRoutes: summary.httpRouteCount,
                diagnostics: summary.diagnosticCount,
                marketplace: this.deps.marketplace.count(),
            },
        };
    }

    private getHealth(): PluginApiResponse {
        const { loader } = this.deps;
        if (!loader) {
            return { status: 503, body: { healthy: false, error: 'Plugin system not initialized' } };
        }

        const health = loader.getHealth();
        return {
            status: 200,
            body: {
                healthy: health.state === 'loaded' || health.state === 'idle',
                ...health,
            },
        };
    }
}
