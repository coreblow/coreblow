// @ts-nocheck
/**
 * plugins/marketplace-api.ts
 *
 * Plugin Marketplace API — REST-style controller for plugin lifecycle
 * management: search, install, update, uninstall, enable/disable.
 *
 * Following CoreBlow's marketplace.ts (910 LOC) + install.ts (793 LOC)
 * pattern, upgraded to CoreBlow OOP with unified API surface.
 *
 * This is NOT an HTTP server — it's a controller class exposing
 * typed methods that can be mounted on any HTTP framework (Express,
 * Fastify, Hono, etc.) or called directly from gateway internals.
 *
 * Responsibilities:
 *   - Plugin search/browse/featured/categories
 *   - Plugin install from npm/git/local/marketplace
 *   - Plugin update with version diff
 *   - Plugin uninstall with cleanup
 *   - Plugin enable/disable toggling
 *   - Plugin detail with full metadata + permissions + status
 *   - Batch operations for admin dashboard
 *   - Action audit trail
 */

import { createChildLogger } from '../utils/logger.js';
import { PluginMarketplace, type MarketplaceSearchResult, type MarketplaceCategory } from './marketplace.js';
import { PluginInstaller, type InstallResult, type UninstallResult, type UpdateResult } from './install.js';
import { PermissionManager, type PluginPermissionSummary } from './permission-manager.js';
import type { MarketplacePlugin, MarketplaceSearchOptions } from './types.js';

const log = createChildLogger('plugin:marketplace-api');

// ─── Types ───────────────────────────────────────────────────────

/** API response wrapper */
export interface ApiResponse<T = unknown> {
    ok: boolean;
    data?: T;
    error?: string;
    timestamp: number;
}

/** Plugin detail — full metadata + runtime status */
export interface PluginDetail {
    plugin: MarketplacePlugin;
    installed: boolean;
    enabled: boolean;
    installedVersion?: string;
    latestVersion?: string;
    hasUpdate: boolean;
    permissions: PluginPermissionSummary | null;
    installPath?: string;
    installedAt?: number;
}

/** Install request */
export interface InstallRequest {
    pluginId: string;
    source: string;
    sourceType: 'npm' | 'git' | 'local' | 'marketplace';
    targetDir: string;
    autoEnable?: boolean;
    grantPermissions?: boolean;
}

/** Batch action result */
export interface BatchResult {
    total: number;
    succeeded: number;
    failed: number;
    results: Array<{ pluginId: string; success: boolean; error?: string }>;
}

/** API action log entry */
export interface ApiActionLog {
    action: string;
    pluginId?: string;
    timestamp: number;
    success: boolean;
    detail?: string;
}

/** Marketplace API stats */
export interface MarketplaceApiStats {
    catalogSize: number;
    installedCount: number;
    enabledCount: number;
    totalActions: number;
    pendingPermissions: number;
}

// ─── MarketplaceApi ──────────────────────────────────────────────

/**
 * CoreBlow Plugin Marketplace API
 *
 * Unified REST-style controller for the full plugin lifecycle.
 * Orchestrates marketplace (search/browse), installer (install/update/uninstall),
 * and permission manager (grant/revoke on install).
 */
export class MarketplaceApi {
    private marketplace: PluginMarketplace;
    private installer: PluginInstaller;
    private permissions: PermissionManager;
    private enabledPlugins = new Set<string>();
    private actionLog: ApiActionLog[] = [];
    private maxLogEntries = 500;

    constructor(options?: {
        marketplace?: PluginMarketplace;
        installer?: PluginInstaller;
        permissions?: PermissionManager;
    }) {
        this.marketplace = options?.marketplace ?? new PluginMarketplace();
        this.installer = options?.installer ?? new PluginInstaller();
        this.permissions = options?.permissions ?? new PermissionManager();
    }

    // ─── Search & Browse ─────────────────────────────────────────

    /**
     * Search plugins in the marketplace catalog.
     */
    search(options?: MarketplaceSearchOptions): ApiResponse<MarketplaceSearchResult> {
        try {
            const result = this.marketplace.search(options ?? {});
            return this.ok(result);
        } catch (err) {
            return this.fail('Search failed', err);
        }
    }

    /**
     * Get a specific plugin's detail with install/permission status.
     */
    getPluginDetail(pluginId: string): ApiResponse<PluginDetail> {
        try {
            const plugin = this.marketplace.getPlugin(pluginId);
            if (!plugin) {
                return this.fail(`Plugin not found: ${pluginId}`);
            }

            const installRecord = this.installer.getInstall(pluginId);
            const installed = !!installRecord;
            const enabled = this.enabledPlugins.has(pluginId);
            const permSummary = this.permissions.getTrackedPlugins().includes(pluginId)
                ? this.permissions.getPluginSummary(pluginId)
                : null;

            const detail: PluginDetail = {
                plugin,
                installed,
                enabled,
                installedVersion: installRecord?.version,
                latestVersion: plugin.version,
                hasUpdate: installed && installRecord?.version !== plugin.version,
                permissions: permSummary,
                installPath: installRecord?.installPath,
                installedAt: installRecord?.installedAt,
            };

            return this.ok(detail);
        } catch (err) {
            return this.fail('Failed to get plugin detail', err);
        }
    }

    /**
     * Get featured plugins.
     */
    getFeatured(): ApiResponse<MarketplacePlugin[]> {
        try {
            return this.ok(this.marketplace.getFeatured());
        } catch (err) {
            return this.fail('Failed to get featured', err);
        }
    }

    /**
     * Get marketplace categories.
     */
    getCategories(): ApiResponse<MarketplaceCategory[]> {
        try {
            return this.ok(this.marketplace.getCategories());
        } catch (err) {
            return this.fail('Failed to get categories', err);
        }
    }

    /**
     * Get verified plugins only.
     */
    getVerified(): ApiResponse<MarketplacePlugin[]> {
        try {
            return this.ok(this.marketplace.getVerified());
        } catch (err) {
            return this.fail('Failed to get verified', err);
        }
    }

    // ─── Install / Uninstall / Update ────────────────────────────

    /**
     * Install a plugin.
     */
    async install(request: InstallRequest): Promise<ApiResponse<InstallResult>> {
        try {
            let result: InstallResult;

            switch (request.sourceType) {
                case 'local':
                    result = await this.installer.installFromLocal(request.source, request.targetDir);
                    break;
                case 'npm':
                    result = await this.installer.installFromNpm(request.source, request.targetDir);
                    break;
                default:
                    // Git and marketplace sources also use npm-based install
                    result = await this.installer.installFromNpm(request.source, request.targetDir);
                    break;
            }

            if (result.success) {
                const pid = result.pluginId ?? request.pluginId;

                // Auto-enable
                if (request.autoEnable !== false) {
                    this.enabledPlugins.add(pid);
                }

                // Auto-grant manifest permissions
                if (request.grantPermissions) {
                    const plugin = this.marketplace.getPlugin(pid);
                    if (plugin?.permissions) {
                        this.permissions.grantManifestPermissions(pid, plugin.permissions as unknown as import('./sandbox.js').Permission[]);
                    }
                }

                this.logAction('install', pid, true, `Installed from ${request.sourceType}`);
                log.info(`Plugin installed: ${pid}`);
            } else {
                this.logAction('install', request.pluginId, false, result.error);
            }

            return this.ok(result);
        } catch (err) {
            this.logAction('install', request.pluginId, false, String(err));
            return this.fail('Install failed', err);
        }
    }

    /**
     * Uninstall a plugin.
     */
    async uninstall(pluginId: string): Promise<ApiResponse<UninstallResult>> {
        try {
            const result = await this.installer.uninstall(pluginId);

            if (result.success) {
                this.enabledPlugins.delete(pluginId);
                this.permissions.removePlugin(pluginId);
                this.logAction('uninstall', pluginId, true);
                log.info(`Plugin uninstalled: ${pluginId}`);
            } else {
                this.logAction('uninstall', pluginId, false, result.error);
            }

            return this.ok(result);
        } catch (err) {
            this.logAction('uninstall', pluginId, false, String(err));
            return this.fail('Uninstall failed', err);
        }
    }

    /**
     * Check for plugin updates.
     */
    async checkUpdate(pluginId: string): Promise<ApiResponse<UpdateResult>> {
        try {
            const result = await this.installer.checkUpdate(pluginId);
            this.logAction('check-update', pluginId, result.success);
            return this.ok(result);
        } catch (err) {
            return this.fail('Update check failed', err);
        }
    }

    // ─── Enable / Disable ────────────────────────────────────────

    /**
     * Enable a plugin.
     */
    enable(pluginId: string): ApiResponse<{ pluginId: string; enabled: boolean }> {
        this.enabledPlugins.add(pluginId);
        this.logAction('enable', pluginId, true);
        return this.ok({ pluginId, enabled: true });
    }

    /**
     * Disable a plugin.
     */
    disable(pluginId: string): ApiResponse<{ pluginId: string; enabled: boolean }> {
        this.enabledPlugins.delete(pluginId);
        this.logAction('disable', pluginId, true);
        return this.ok({ pluginId, enabled: false });
    }

    /**
     * Check if a plugin is enabled.
     */
    isEnabled(pluginId: string): boolean {
        return this.enabledPlugins.has(pluginId);
    }

    // ─── Batch Operations ────────────────────────────────────────

    /**
     * Batch install multiple plugins.
     */
    async batchInstall(requests: InstallRequest[]): Promise<ApiResponse<BatchResult>> {
        const results: BatchResult['results'] = [];
        let succeeded = 0;
        let failed = 0;

        for (const req of requests) {
            const response = await this.install(req);
            if (response.ok && response.data?.success) {
                results.push({ pluginId: req.pluginId, success: true });
                succeeded++;
            } else {
                results.push({ pluginId: req.pluginId, success: false, error: response.error ?? response.data?.error });
                failed++;
            }
        }

        return this.ok({ total: requests.length, succeeded, failed, results });
    }

    /**
     * Batch uninstall multiple plugins.
     */
    async batchUninstall(pluginIds: string[]): Promise<ApiResponse<BatchResult>> {
        const results: BatchResult['results'] = [];
        let succeeded = 0;
        let failed = 0;

        for (const id of pluginIds) {
            const response = await this.uninstall(id);
            if (response.ok && response.data?.success) {
                results.push({ pluginId: id, success: true });
                succeeded++;
            } else {
                results.push({ pluginId: id, success: false, error: response.error });
                failed++;
            }
        }

        return this.ok({ total: pluginIds.length, succeeded, failed, results });
    }

    /**
     * Batch enable/disable.
     */
    batchSetEnabled(pluginIds: string[], enabled: boolean): ApiResponse<BatchResult> {
        const results: BatchResult['results'] = [];

        for (const id of pluginIds) {
            if (enabled) {
                this.enabledPlugins.add(id);
            } else {
                this.enabledPlugins.delete(id);
            }
            results.push({ pluginId: id, success: true });
        }

        return this.ok({ total: pluginIds.length, succeeded: pluginIds.length, failed: 0, results });
    }

    // ─── Stats & Logs ────────────────────────────────────────────

    /**
     * Get marketplace API statistics.
     */
    getStats(): ApiResponse<MarketplaceApiStats> {
        return this.ok({
            catalogSize: this.marketplace.count(),
            installedCount: this.installer.getInstalls().size,
            enabledCount: this.enabledPlugins.size,
            totalActions: this.actionLog.length,
            pendingPermissions: this.permissions.getPendingRequests().length,
        });
    }

    /**
     * Get action log.
     */
    getActionLog(limit = 50): ApiResponse<ApiActionLog[]> {
        return this.ok(this.actionLog.slice(-limit));
    }

    /**
     * Get all installed plugins with their status.
     */
    getInstalled(): ApiResponse<Array<{ pluginId: string; version?: string; enabled: boolean; installPath?: string }>> {
        const installs = this.installer.getInstalls();
        const result = Array.from(installs.entries()).map(([id, record]) => ({
            pluginId: id,
            version: record.version,
            enabled: this.enabledPlugins.has(id),
            installPath: record.installPath,
        }));
        return this.ok(result);
    }

    /**
     * Get enabled plugin IDs.
     */
    getEnabledPlugins(): string[] {
        return Array.from(this.enabledPlugins);
    }

    // ─── Accessors ───────────────────────────────────────────────

    getMarketplace(): PluginMarketplace { return this.marketplace; }
    getInstaller(): PluginInstaller { return this.installer; }
    getPermissions(): PermissionManager { return this.permissions; }

    // ─── Private ─────────────────────────────────────────────────

    private ok<T>(data: T): ApiResponse<T> {
        return { ok: true, data, timestamp: Date.now() };
    }

    private fail(message: string, err?: unknown): ApiResponse<never> {
        const error = err instanceof Error ? `${message}: ${err.message}` : message;
        return { ok: false, error, timestamp: Date.now() };
    }

    private logAction(action: string, pluginId: string | undefined, success: boolean, detail?: string): void {
        this.actionLog.push({ action, pluginId, timestamp: Date.now(), success, detail });
        if (this.actionLog.length > this.maxLogEntries) {
            this.actionLog = this.actionLog.slice(-this.maxLogEntries);
        }
    }
}
