/**
 * plugins/marketplace.ts
 *
 * Plugin marketplace client — search, browse, and get metadata for
 * plugins from the CoreBlow plugin registry.
 *
 * Following CoreBlow's marketplace.ts (910 LOC) pattern, adapted
 * for CoreBlow's OOP architecture.
 */

import { createChildLogger } from '../utils/logger.js';
import type {
    MarketplacePlugin,
    MarketplaceSearchOptions,
    PluginLogger,
} from './types.js';

const log = createChildLogger('plugin:marketplace');

// ─── Types ───────────────────────────────────────────────────────

export interface MarketplaceSearchResult {
    plugins: MarketplacePlugin[];
    total: number;
    page: number;
    pageSize: number;
    query?: string;
}

export interface MarketplaceCategory {
    id: string;
    name: string;
    description: string;
    count: number;
}

// ─── PluginMarketplace ───────────────────────────────────────────

/**
 * CoreBlow Plugin Marketplace
 *
 * Client for browsing, searching, and getting metadata from the
 * CoreBlow plugin marketplace. Supports both remote API and
 * local/offline plugin catalogs.
 */
export class PluginMarketplace {
    private logger: PluginLogger;
    private registryUrl: string;
    private catalog = new Map<string, MarketplacePlugin>();
    private featured: string[] = [];

    constructor(options?: { registryUrl?: string; logger?: PluginLogger }) {
        this.registryUrl = options?.registryUrl ?? 'https://plugins.coreblow.com/api/v1';
        this.logger = options?.logger ?? {
            info: (msg) => log.info(msg),
            warn: (msg) => log.warn(msg),
            error: (msg) => log.error(msg),
            debug: (msg) => log.debug(msg),
        };
    }

    /**
     * Search plugins in the marketplace.
     */
    search(options: MarketplaceSearchOptions = {}): MarketplaceSearchResult {
        let results = [...this.catalog.values()];

        // Filter by query (search name, description, tags)
        if (options.query) {
            const query = options.query.toLowerCase();
            results = results.filter((p) =>
                p.name.toLowerCase().includes(query) ||
                p.description.toLowerCase().includes(query) ||
                p.tags?.some((t) => t.toLowerCase().includes(query)),
            );
        }

        // Filter by tags
        if (options.tags && options.tags.length > 0) {
            results = results.filter((p) =>
                options.tags!.some((tag) => p.tags?.includes(tag)),
            );
        }

        // Filter by author
        if (options.author) {
            results = results.filter((p) => p.author === options.author);
        }

        // Filter by provides
        if (options.provides && options.provides.length > 0) {
            results = results.filter((p) =>
                options.provides!.some((prov) => p.provides?.includes(prov)),
            );
        }

        // Sort
        switch (options.sort) {
            case 'downloads':
                results.sort((a, b) => (b.downloads ?? 0) - (a.downloads ?? 0));
                break;
            case 'newest':
                results.sort((a, b) => a.name.localeCompare(b.name));
                break;
            case 'rating':
                results.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
                break;
            case 'relevance':
            default:
                // Keep original order for relevance
                break;
        }

        // Pagination
        const offset = options.offset ?? 0;
        const limit = options.limit ?? 20;
        const total = results.length;
        const paged = results.slice(offset, offset + limit);

        return {
            plugins: paged,
            total,
            page: Math.floor(offset / limit) + 1,
            pageSize: limit,
            query: options.query,
        };
    }

    /**
     * Get a specific plugin by ID.
     */
    getPlugin(id: string): MarketplacePlugin | undefined {
        return this.catalog.get(id);
    }

    /**
     * Get featured plugins.
     */
    getFeatured(): MarketplacePlugin[] {
        return this.featured
            .map((id) => this.catalog.get(id))
            .filter((p): p is MarketplacePlugin => p !== undefined);
    }

    /**
     * Get categories with plugin counts.
     */
    getCategories(): MarketplaceCategory[] {
        const tagCounts = new Map<string, number>();
        for (const plugin of this.catalog.values()) {
            for (const tag of plugin.tags ?? []) {
                tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
            }
        }

        return [...tagCounts.entries()]
            .map(([tag, count]) => ({
                id: tag,
                name: tag.charAt(0).toUpperCase() + tag.slice(1),
                description: `Plugins tagged with ${tag}`,
                count,
            }))
            .sort((a, b) => b.count - a.count);
    }

    /**
     * Get plugins by a specific provider capability.
     */
    getByProvider(providerType: string): MarketplacePlugin[] {
        return [...this.catalog.values()].filter((p) =>
            p.provides?.includes(providerType),
        );
    }

    /**
     * Load catalog from a local JSON array (offline mode).
     */
    loadCatalog(plugins: MarketplacePlugin[]): void {
        this.catalog.clear();
        for (const plugin of plugins) {
            this.catalog.set(plugin.id, plugin);
        }
        this.logger.info(`[marketplace] Loaded ${plugins.length} plugins into catalog`);
    }

    /**
     * Register a plugin in the local catalog.
     */
    register(plugin: MarketplacePlugin): void {
        this.catalog.set(plugin.id, plugin);
    }

    /**
     * Set featured plugin IDs.
     */
    setFeatured(ids: string[]): void {
        this.featured = ids;
    }

    /**
     * Get the total number of plugins in the catalog.
     */
    count(): number {
        return this.catalog.size;
    }

    /**
     * List all plugins (unfiltered).
     */
    list(): MarketplacePlugin[] {
        return [...this.catalog.values()];
    }

    /**
     * Get verified plugins only.
     */
    getVerified(): MarketplacePlugin[] {
        return [...this.catalog.values()].filter((p) => p.verified === true);
    }

    /**
     * Fetch remote catalog from the plugin registry API.
     * Uses native fetch() with timeout and error handling.
     * Falls back gracefully if the registry is unreachable.
     */
    async fetchRemoteCatalog(): Promise<{ success: boolean; count: number; error?: string }> {
        const url = `${this.registryUrl}/plugins`;
        this.logger.info(`[marketplace] Fetching catalog from ${url}`);

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10_000);

            const response = await fetch(url, {
                method: 'GET',
                headers: { 'Accept': 'application/json', 'User-Agent': 'CoreBlow-Gateway/1.0' },
                signal: controller.signal,
            });
            clearTimeout(timeout);

            if (!response.ok) {
                return { success: false, count: 0, error: `Registry returned HTTP ${response.status}` };
            }

            const data = await response.json() as { plugins?: MarketplacePlugin[] };
            if (!data.plugins || !Array.isArray(data.plugins)) {
                return { success: false, count: 0, error: 'Invalid catalog format: missing plugins array' };
            }

            this.loadCatalog(data.plugins);
            this.logger.info(`[marketplace] Fetched ${data.plugins.length} plugins from registry`);
            return { success: true, count: data.plugins.length };
        } catch (err) {
            const error = err instanceof Error ? err.message : String(err);
            const isOffline = error.includes('fetch') || error.includes('abort') || error.includes('ECONNREFUSED');
            this.logger.warn(`[marketplace] Registry unreachable (${isOffline ? 'offline' : error}), using local catalog`);
            return { success: false, count: this.catalog.size, error };
        }
    }
}
