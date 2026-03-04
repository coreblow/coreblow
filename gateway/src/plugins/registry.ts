/**
 * src/plugins/registry.ts
 * Extension registry — manages loaded extensions, their tools, channels, and hooks
 */

import { createChildLogger } from '../utils/logger.js';
import type { CoreBlowExtension, ExtensionHooks, LoadedExtension } from './sdk.js';
import type { ToolHandler } from '../tools/types.js';

const log = createChildLogger('plugin:registry');

export class ExtensionRegistry {
    private extensions: Map<string, LoadedExtension> = new Map();
    private allTools: ToolHandler[] = [];
    private hookChain: ExtensionHooks[] = [];

    /**
     * Register a loaded extension
     */
    register(loaded: LoadedExtension) {
        this.extensions.set(loaded.extension.meta.name, loaded);

        // Collect tools
        if (loaded.extension.tools) {
            for (const tool of loaded.extension.tools) {
                this.allTools.push(tool);
                log.debug({ ext: loaded.extension.meta.name, tool: tool.name }, 'Tool registered');
            }
        }

        // Collect hooks
        if (loaded.extension.hooks) {
            this.hookChain.push(loaded.extension.hooks);
        }
    }

    /**
     * Get all tools from extensions
     */
    getTools(): ToolHandler[] {
        return this.allTools;
    }

    /**
     * Get a specific extension
     */
    get(name: string): CoreBlowExtension | undefined {
        return this.extensions.get(name)?.extension;
    }

    /**
     * List all registered extensions
     */
    list(): Array<{ name: string; version: string; enabled: boolean; hasChannel: boolean; toolCount: number }> {
        return Array.from(this.extensions.values()).map(e => ({
            name: e.extension.meta.name,
            version: e.extension.meta.version,
            enabled: e.enabled,
            hasChannel: !!e.extension.channel,
            toolCount: e.extension.tools?.length || 0,
        }));
    }

    /**
     * Run hook chain: onMessage
     */
    async runOnMessage(message: any): Promise<void> {
        for (const hooks of this.hookChain) {
            if (hooks.onMessage) await hooks.onMessage(message);
        }
    }

    /**
     * Run hook chain: onResponse
     */
    async runOnResponse(response: any): Promise<void> {
        for (const hooks of this.hookChain) {
            if (hooks.onResponse) await hooks.onResponse(response);
        }
    }

    /**
     * Run hook chain: onToolCall
     */
    async runOnToolCall(toolName: string, args: any): Promise<any> {
        for (const hooks of this.hookChain) {
            if (hooks.onToolCall) {
                const result = await hooks.onToolCall(toolName, args);
                if (result !== undefined) return result;
            }
        }
        return undefined;
    }

    /**
     * Stop all extensions
     */
    async stopAll(): Promise<void> {
        for (const { extension } of this.extensions.values()) {
            try {
                if (extension.stop) await extension.stop();
            } catch (err: any) {
                log.error({ name: extension.meta.name, err: err.message }, 'Extension stop failed');
            }
        }
    }

    /**
     * Health check all extensions
     */
    async healthCheckAll(): Promise<Record<string, { ok: boolean; details?: string }>> {
        const results: Record<string, { ok: boolean; details?: string }> = {};
        for (const { extension } of this.extensions.values()) {
            try {
                if (extension.healthCheck) {
                    results[extension.meta.name] = await extension.healthCheck();
                } else {
                    results[extension.meta.name] = { ok: true };
                }
            } catch (err: any) {
                results[extension.meta.name] = { ok: false, details: err.message };
            }
        }
        return results;
    }
}
