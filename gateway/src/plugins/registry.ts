/**
 * plugins/registry.ts
 *
 * Central plugin registration hub — manages all plugin registrations
 * (tools, hooks, channels, providers, services, commands, HTTP routes).
 *
 * Following CoreBlow's registry.ts (1,124 LOC) pattern but using CoreBlow's
 * OOP class-based architecture instead of CoreBlow's functional factory.
 */

import { createChildLogger } from '../utils/logger.js';
import type {
    PluginRecord,
    PluginDiagnostic,
    PluginLogger,
    PluginRegistryData,
    PluginToolRegistration,
    PluginLegacyHookRegistration,
    PluginHookRegistration,
    PluginHookName,
    PluginChannelRegistration,
    PluginProviderRegistration,
    PluginServiceRegistration,
    PluginCommandRegistration,
    PluginHttpRouteRegistration,
    PluginCommand,
    PluginTool,
} from './types.js';
import { createEmptyPluginRegistryData, isPluginHookName } from './types.js';

const log = createChildLogger('plugin:registry');

// ─── Registration Params ─────────────────────────────────────────

export interface PluginRegistryParams {
    logger?: PluginLogger;
    suppressGlobalCommands?: boolean;
}

// ─── PluginRegistry ──────────────────────────────────────────────

/**
 * CoreBlow Plugin Registry
 *
 * Central hub for all plugin registrations. Provides typed registration
 * methods with deduplication, validation, and diagnostic reporting.
 * OOP equivalent of CoreBlow's `createPluginRegistry()` factory.
 */
export class PluginRegistry {
    private data: PluginRegistryData;
    private logger: PluginLogger;
    private suppressGlobalCommands: boolean;

    constructor(params: PluginRegistryParams = {}) {
        this.data = createEmptyPluginRegistryData();
        this.logger = params.logger ?? {
            info: (msg) => log.info(msg),
            warn: (msg) => log.warn(msg),
            error: (msg) => log.error(msg),
            debug: (msg) => log.debug(msg),
        };
        this.suppressGlobalCommands = params.suppressGlobalCommands ?? false;
    }

    // ─── Diagnostics ─────────────────────────────────────────────

    pushDiagnostic(diag: PluginDiagnostic): void {
        this.data.diagnostics.push(diag);
    }

    getDiagnostics(): PluginDiagnostic[] {
        return [...this.data.diagnostics];
    }

    // ─── Plugin Records ──────────────────────────────────────────

    addPlugin(record: PluginRecord): void {
        this.data.plugins.push(record);
    }

    getPlugin(id: string): PluginRecord | undefined {
        return this.data.plugins.find((p) => p.id === id);
    }

    getPlugins(): PluginRecord[] {
        return [...this.data.plugins];
    }

    getLoadedPlugins(): PluginRecord[] {
        return this.data.plugins.filter((p) => p.status === 'loaded');
    }

    // ─── Tool Registration ───────────────────────────────────────

    registerTool(
        record: PluginRecord,
        tool: PluginTool,
        opts?: { name?: string; names?: string[]; optional?: boolean },
    ): void {
        const names = opts?.names ?? (opts?.name ? [opts.name] : []);
        const optional = opts?.optional === true;

        names.push(tool.name);
        const normalized = [...new Set(names.map((n) => n.trim()).filter(Boolean))];

        if (normalized.length > 0) {
            record.toolNames.push(...normalized);
        }

        this.data.tools.push({
            pluginId: record.id,
            pluginName: record.name,
            tool,
            names: normalized,
            optional,
            source: record.source,
            rootDir: record.rootDir,
        });
    }

    getTools(): PluginToolRegistration[] {
        return [...this.data.tools];
    }

    // ─── Hook Registration ───────────────────────────────────────

    registerHook(
        record: PluginRecord,
        events: string | string[],
        handler: (event: unknown, ctx: Record<string, unknown>) => unknown | Promise<unknown>,
        opts?: { name?: string; description?: string; priority?: number },
    ): void {
        const eventList = Array.isArray(events) ? events : [events];
        const normalizedEvents = eventList.map((e) => e.trim()).filter(Boolean);
        const name = opts?.name?.trim() ?? normalizedEvents[0];

        if (!name) {
            this.pushDiagnostic({
                level: 'warn',
                pluginId: record.id,
                source: record.source,
                message: 'hook registration missing name',
            });
            return;
        }

        // Check for duplicate hook names
        const existing = this.data.hooks.find((h) =>
            h.events.some((e) => normalizedEvents.includes(e)),
        );
        if (existing) {
            this.pushDiagnostic({
                level: 'error',
                pluginId: record.id,
                source: record.source,
                message: `hook event already registered: ${normalizedEvents[0]} (${existing.pluginId})`,
            });
            return;
        }

        record.hookNames.push(name);
        record.hookCount++;

        // Legacy hook registration
        this.data.hooks.push({
            pluginId: record.id,
            events: normalizedEvents,
            source: record.source,
            rootDir: record.rootDir,
        });

        // Typed hook registration
        for (const event of normalizedEvents) {
            if (isPluginHookName(event)) {
                this.data.typedHooks.push({
                    hookName: event,
                    pluginId: record.id,
                    handler,
                    priority: opts?.priority ?? 0,
                    source: record.source,
                });
            }
        }
    }

    getHooks(): PluginLegacyHookRegistration[] {
        return [...this.data.hooks];
    }

    getTypedHooks<K extends PluginHookName>(hookName?: K): PluginHookRegistration<K>[] {
        const hooks = this.data.typedHooks as PluginHookRegistration<K>[];
        if (hookName) {
            return hooks
                .filter((h) => h.hookName === hookName)
                .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        }
        return [...hooks];
    }

    /**
     * Register a typed hook directly without a PluginRecord.
     * Convenience method for programmatic hook registration and testing.
     */
    registerTypedHook<K extends PluginHookName>(params: {
        hookName: K;
        pluginId: string;
        handler: (event: unknown, ctx: Record<string, unknown>) => unknown | Promise<unknown>;
        priority?: number;
        source?: string;
    }): void {
        this.data.typedHooks.push({
            hookName: params.hookName,
            pluginId: params.pluginId,
            handler: params.handler,
            priority: params.priority ?? 0,
            source: params.source ?? 'programmatic',
        });
    }

    // ─── Channel Registration ────────────────────────────────────

    registerChannel(
        record: PluginRecord,
        plugin: { id: string; name: string; [key: string]: unknown },
    ): void {
        const id = typeof plugin?.id === 'string' ? plugin.id.trim() : '';
        if (!id) {
            this.pushDiagnostic({
                level: 'error',
                pluginId: record.id,
                source: record.source,
                message: 'channel registration missing id',
            });
            return;
        }

        const existing = this.data.channels.find((c) => c.plugin.id === id);
        if (existing) {
            this.pushDiagnostic({
                level: 'error',
                pluginId: record.id,
                source: record.source,
                message: `channel already registered: ${id} (${existing.pluginId})`,
            });
            return;
        }

        record.channelIds.push(id);
        this.data.channels.push({
            pluginId: record.id,
            pluginName: record.name,
            plugin,
            source: record.source,
            rootDir: record.rootDir,
        });
    }

    getChannels(): PluginChannelRegistration[] {
        return [...this.data.channels];
    }

    // ─── Provider Registration ───────────────────────────────────

    registerProvider(
        record: PluginRecord,
        provider: { id: string; name: string; [key: string]: unknown },
    ): void {
        const id = provider.id.trim();
        if (!id) {
            this.pushDiagnostic({
                level: 'error',
                pluginId: record.id,
                source: record.source,
                message: 'provider registration missing id',
            });
            return;
        }

        const existing = this.data.providers.find((p) => p.provider.id === id);
        if (existing) {
            this.pushDiagnostic({
                level: 'error',
                pluginId: record.id,
                source: record.source,
                message: `provider already registered: ${id} (${existing.pluginId})`,
            });
            return;
        }

        record.providerIds.push(id);
        this.data.providers.push({
            pluginId: record.id,
            pluginName: record.name,
            provider,
            source: record.source,
            rootDir: record.rootDir,
        });
    }

    getProviders(): PluginProviderRegistration[] {
        return [...this.data.providers];
    }

    // ─── Service Registration ────────────────────────────────────

    registerService(
        record: PluginRecord,
        service: PluginServiceRegistration['service'],
    ): void {
        const id = service.id.trim();
        if (!id) return;

        const existing = this.data.services.find((s) => s.service.id === id);
        if (existing) {
            this.pushDiagnostic({
                level: 'error',
                pluginId: record.id,
                source: record.source,
                message: `service already registered: ${id} (${existing.pluginId})`,
            });
            return;
        }

        record.services.push(id);
        this.data.services.push({
            pluginId: record.id,
            pluginName: record.name,
            service,
            source: record.source,
            rootDir: record.rootDir,
        });
    }

    getServices(): PluginServiceRegistration[] {
        return [...this.data.services];
    }

    // ─── Command Registration ────────────────────────────────────

    registerCommand(
        record: PluginRecord,
        command: PluginCommand,
    ): void {
        const name = command.name.trim();
        if (!name) {
            this.pushDiagnostic({
                level: 'warn',
                pluginId: record.id,
                source: record.source,
                message: 'command registration missing name',
            });
            return;
        }

        const existing = this.data.commands.find((c) => c.command.name === name);
        if (existing) {
            this.pushDiagnostic({
                level: 'error',
                pluginId: record.id,
                source: record.source,
                message: `command already registered: ${name} (${existing.pluginId})`,
            });
            return;
        }

        record.commands.push(name);
        this.data.commands.push({
            pluginId: record.id,
            pluginName: record.name,
            command,
            source: record.source,
            rootDir: record.rootDir,
        });
    }

    getCommands(): PluginCommandRegistration[] {
        return [...this.data.commands];
    }

    // ─── HTTP Route Registration ─────────────────────────────────

    registerHttpRoute(
        record: PluginRecord,
        params: {
            path: string;
            handler: (req: unknown, res: unknown) => void | Promise<void>;
            auth: 'gateway' | 'plugin';
            match?: 'exact' | 'prefix';
            replaceExisting?: boolean;
        },
    ): void {
        const normalizedPath = params.path.startsWith('/') ? params.path : `/${params.path}`;
        const match = params.match ?? 'exact';

        if (params.auth !== 'gateway' && params.auth !== 'plugin') {
            this.pushDiagnostic({
                level: 'error',
                pluginId: record.id,
                source: record.source,
                message: `http route invalid auth: ${normalizedPath}`,
            });
            return;
        }

        const existingIndex = this.data.httpRoutes.findIndex(
            (r) => r.path === normalizedPath && r.match === match,
        );

        if (existingIndex >= 0) {
            const existing = this.data.httpRoutes[existingIndex];
            if (!params.replaceExisting) {
                this.pushDiagnostic({
                    level: 'error',
                    pluginId: record.id,
                    source: record.source,
                    message: `http route already registered: ${normalizedPath} (${existing?.pluginId})`,
                });
                return;
            }
            // Replace
            this.data.httpRoutes[existingIndex] = {
                pluginId: record.id,
                path: normalizedPath,
                handler: params.handler,
                auth: params.auth,
                match,
                source: record.source,
            };
            return;
        }

        record.httpRoutes++;
        this.data.httpRoutes.push({
            pluginId: record.id,
            path: normalizedPath,
            handler: params.handler,
            auth: params.auth,
            match,
            source: record.source,
        });
    }

    getHttpRoutes(): PluginHttpRouteRegistration[] {
        return [...this.data.httpRoutes];
    }

    // ─── Registry Data Access ────────────────────────────────────

    getData(): PluginRegistryData {
        return this.data;
    }

    /**
     * Summary stats for the entire registry.
     */
    getSummary(): {
        pluginCount: number;
        loadedCount: number;
        errorCount: number;
        toolCount: number;
        hookCount: number;
        channelCount: number;
        providerCount: number;
        serviceCount: number;
        commandCount: number;
        httpRouteCount: number;
        diagnosticCount: number;
    } {
        return {
            pluginCount: this.data.plugins.length,
            loadedCount: this.data.plugins.filter((p) => p.status === 'loaded').length,
            errorCount: this.data.plugins.filter((p) => p.status === 'error').length,
            toolCount: this.data.tools.length,
            hookCount: this.data.typedHooks.length,
            channelCount: this.data.channels.length,
            providerCount: this.data.providers.length,
            serviceCount: this.data.services.length,
            commandCount: this.data.commands.length,
            httpRouteCount: this.data.httpRoutes.length,
            diagnosticCount: this.data.diagnostics.length,
        };
    }

    /**
     * Stop all registered services.
     */
    async stopAllServices(): Promise<void> {
        for (const { service, pluginId } of this.data.services) {
            try {
                if (service.stop) await service.stop();
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                this.logger.error(`[plugin:${pluginId}] service ${service.id} stop failed: ${msg}`);
            }
        }
    }

    /**
     * Health check all registered services.
     */
    async healthCheckAllServices(): Promise<Record<string, { healthy: boolean; error?: string }>> {
        const results: Record<string, { healthy: boolean; error?: string }> = {};
        for (const { service, pluginId } of this.data.services) {
            try {
                if (service.healthCheck) {
                    results[`${pluginId}:${service.id}`] = await service.healthCheck();
                } else {
                    results[`${pluginId}:${service.id}`] = { healthy: true };
                }
            } catch (err: unknown) {
                const msg = err instanceof Error ? err.message : String(err);
                results[`${pluginId}:${service.id}`] = { healthy: false, error: msg };
            }
        }
        return results;
    }
}

// ─── Backward Compat: ExtensionRegistry ──────────────────────────
// The old registry.ts exported ExtensionRegistry which is used by
// agents/turn-engine/plugins/plugins.test.ts. Keep it here for compat.

import type { CoreBlowExtension, ExtensionHooks, LoadedExtension } from './sdk.js';
import type { ToolHandler } from '../tools/types.js';

export class ExtensionRegistry {
    private extensions: Map<string, LoadedExtension> = new Map();
    private allTools: ToolHandler[] = [];
    private hookChain: ExtensionHooks[] = [];

    register(loaded: LoadedExtension) {
        this.extensions.set(loaded.extension.meta.name, loaded);
        if (loaded.extension.tools) {
            for (const tool of loaded.extension.tools) {
                this.allTools.push(tool);
            }
        }
        if (loaded.extension.hooks) {
            this.hookChain.push(loaded.extension.hooks);
        }
    }

    getTools(): ToolHandler[] { return this.allTools; }

    get(name: string): CoreBlowExtension | undefined {
        return this.extensions.get(name)?.extension;
    }

    list(): Array<{ name: string; version: string; enabled: boolean; hasChannel: boolean; toolCount: number }> {
        return Array.from(this.extensions.values()).map(e => ({
            name: e.extension.meta.name,
            version: e.extension.meta.version,
            enabled: e.enabled,
            hasChannel: !!e.extension.channel,
            toolCount: e.extension.tools?.length || 0,
        }));
    }

    async runOnMessage(message: unknown): Promise<void> {
        for (const hooks of this.hookChain) {
            if (hooks.onMessage) await hooks.onMessage(message);
        }
    }

    async runOnResponse(response: unknown): Promise<void> {
        for (const hooks of this.hookChain) {
            if (hooks.onResponse) await hooks.onResponse(response);
        }
    }

    async runOnToolCall(toolName: string, args: Record<string, unknown>): Promise<unknown> {
        for (const hooks of this.hookChain) {
            if (hooks.onToolCall) {
                const result = await hooks.onToolCall(toolName, args);
                if (result !== undefined) return result;
            }
        }
        return undefined;
    }

    async stopAll(): Promise<void> {
        for (const { extension } of this.extensions.values()) {
            try { if (extension.stop) await extension.stop(); } catch { /* skip */ }
        }
    }

    async healthCheckAll(): Promise<Record<string, { ok: boolean; details?: string }>> {
        const results: Record<string, { ok: boolean; details?: string }> = {};
        for (const { extension } of this.extensions.values()) {
            try {
                results[extension.meta.name] = extension.healthCheck
                    ? await extension.healthCheck()
                    : { ok: true };
            } catch (err: unknown) {
                results[extension.meta.name] = { ok: false, details: err instanceof Error ? err.message : String(err) };
            }
        }
        return results;
    }
}
