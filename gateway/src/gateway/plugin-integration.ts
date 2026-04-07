/**
 * gateway/plugin-integration.ts
 *
 * Gateway Plugin Integration — wires the PluginLoader and HookRunner
 * into the gateway lifecycle so plugins are loaded at boot and hooks
 * fire during message processing.
 *
 * Following CoreBlow's bootstrap/plugin-init.ts (~250 LOC) +
 * bootstrap/plugin-shutdown.ts (~150 LOC) pattern, unified into a single
 * OOP integration class with lifecycle management.
 *
 * This is the glue layer between:
 *   - PluginLoader (discover → load → activate)
 *   - HookRunner (hook execution engine)
 *   - PluginMessageBridge (message pipeline hooks)
 *   - Gateway (startup/shutdown)
 */

import { createChildLogger } from '../utils/logger.js';
import { PluginLoader, type PluginLoadOptions, type PluginLoadResult } from '../plugins/plugin-loader.js';
import { HookRunner } from '../plugins/hooks.js';
import { PluginMessageBridge, type PipelineMessage, type PipelineResult, type MessageHandler } from '../plugins/message-bridge.js';
import { PluginExecutor } from '../plugins/executor.js';

const log = createChildLogger('gateway:plugins');

// ─── Types ──────────────────────────────────────────────────────

export interface GatewayPluginConfig {
    /** Enable the plugin system */
    enabled: boolean;
    /** Plugin loader options */
    loaderOptions?: PluginLoadOptions;
    /** Whether to fire gateway_start/stop hooks */
    lifecycleHooks?: boolean;
}

export interface GatewayPluginState {
    initialized: boolean;
    loader: PluginLoader | null;
    hookRunner: HookRunner | null;
    bridge: PluginMessageBridge | null;
    executor: PluginExecutor | null;
    loadResult: PluginLoadResult | null;
}

// ─── Integration ────────────────────────────────────────────────

/**
 * GatewayPluginIntegration
 *
 * Manages the full plugin lifecycle within the gateway:
 *   1. initPlugins() — boots plugin system at gateway start
 *   2. processMessage() — runs messages through plugin-augmented pipeline
 *   3. shutdownPlugins() — graceful shutdown at gateway stop
 */
export class GatewayPluginIntegration {
    private config: GatewayPluginConfig;
    private state: GatewayPluginState = {
        initialized: false,
        loader: null,
        hookRunner: null,
        bridge: null,
        executor: null,
        loadResult: null,
    };

    constructor(config: GatewayPluginConfig) {
        this.config = config;
    }

    // ─── Lifecycle ──────────────────────────────────────────────

    /**
     * Initialize the plugin system.
     * Called during gateway boot — discovers, loads, and activates plugins.
     */
    async initPlugins(): Promise<PluginLoadResult | null> {
        if (!this.config.enabled) {
            log.info('Plugin system disabled');
            return null;
        }

        if (this.state.initialized) {
            log.warn('Plugin system already initialized');
            return this.state.loadResult;
        }

        log.info('Initializing plugin system...');

        try {
            // Create and run the plugin loader
            const loader = new PluginLoader(this.config.loaderOptions ?? {});
            const loadResult = await loader.loadAll();

            // Get the hook runner from the loader
            const hookRunner = loader.getHookRunner();

            // Create the message bridge and executor
            const bridge = new PluginMessageBridge(hookRunner);
            const executor = new PluginExecutor(hookRunner);

            // Store state
            this.state = {
                initialized: true,
                loader,
                hookRunner,
                bridge,
                executor,
                loadResult,
            };

            // Fire gateway_start hook
            if (this.config.lifecycleHooks !== false) {
                await hookRunner.runGatewayStart(
                    { timestamp: Date.now() },
                    { pluginCount: loadResult.loaded },
                );
            }

            log.info({
                loaded: loadResult.loaded,
                failed: loadResult.failed,
                skipped: loadResult.skipped,
                hooks: loadResult.loadOrder.length,
                duration: loadResult.duration,
            }, 'Plugin system initialized');

            return loadResult;
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            log.error({ err: errMsg }, 'Plugin system initialization failed');
            throw err;
        }
    }

    /**
     * Shutdown the plugin system.
     * Called during gateway shutdown — deactivates plugins, stops services.
     */
    async shutdownPlugins(): Promise<void> {
        if (!this.state.initialized || !this.state.loader) return;

        log.info('Shutting down plugin system...');

        try {
            // Fire gateway_stop hook
            if (this.config.lifecycleHooks !== false && this.state.hookRunner) {
                await this.state.hookRunner.runGatewayStop(
                    { timestamp: Date.now() },
                    {},
                );
            }

            // Shutdown loader (deactivates plugins, stops services)
            await this.state.loader.shutdown();

            this.state = {
                initialized: false,
                loader: null,
                hookRunner: null,
                bridge: null,
                executor: null,
                loadResult: null,
            };

            log.info('Plugin system shutdown complete');
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : String(err);
            log.error({ err: errMsg }, 'Plugin shutdown error');
        }
    }

    // ─── Message Pipeline ───────────────────────────────────────

    /**
     * Set the message handler (LLM/command processor).
     */
    setMessageHandler(handler: MessageHandler): void {
        if (this.state.bridge) {
            this.state.bridge.setHandler(handler);
        }
    }

    /**
     * Process a message through the plugin-augmented pipeline.
     */
    async processMessage(message: PipelineMessage): Promise<PipelineResult> {
        if (!this.state.bridge) {
            // Plugin system disabled — pass through directly
            return {
                message,
                response: {
                    inReplyTo: message.id,
                    sessionKey: message.sessionKey,
                    content: '[Plugin system not initialized]',
                    cancelled: false,
                },
                stages: [],
                totalDuration: 0,
            };
        }

        return this.state.bridge.processMessage(message);
    }

    // ─── Session Hooks ──────────────────────────────────────────

    /**
     * Fire session_start hooks when a new session begins.
     */
    async onSessionStart(sessionKey: string, channel: string): Promise<void> {
        if (!this.state.hookRunner) return;
        await this.state.hookRunner.runSessionStart(
            { sessionKey, channel, timestamp: Date.now() },
            { sessionKey, channel },
        );
    }

    /**
     * Fire session_end hooks when a session ends.
     */
    async onSessionEnd(sessionKey: string, reason: string): Promise<void> {
        if (!this.state.hookRunner) return;
        await this.state.hookRunner.runSessionEnd(
            { sessionKey, reason, timestamp: Date.now() },
            { sessionKey },
        );
    }

    // ─── Tool Hooks ─────────────────────────────────────────────

    /**
     * Fire before_tool_call hooks. Returns block decision.
     */
    async onBeforeToolCall(
        toolName: string,
        params: Record<string, unknown>,
        sessionKey: string,
    ): Promise<{ blocked: boolean; reason?: string; modifiedParams?: Record<string, unknown> }> {
        if (!this.state.executor) return { blocked: false };
        return this.state.executor.beforeToolCall(toolName, params, sessionKey);
    }

    /**
     * Fire after_tool_call hooks.
     */
    async onAfterToolCall(
        toolName: string,
        result: unknown,
        sessionKey: string,
    ): Promise<void> {
        if (!this.state.executor) return;
        await this.state.executor.afterToolCall(toolName, result, sessionKey);
    }

    // ─── Accessors ──────────────────────────────────────────────

    isInitialized(): boolean { return this.state.initialized; }
    getLoader(): PluginLoader | null { return this.state.loader; }
    getHookRunner(): HookRunner | null { return this.state.hookRunner; }
    getBridge(): PluginMessageBridge | null { return this.state.bridge; }
    getExecutor(): PluginExecutor | null { return this.state.executor; }
    getLoadResult(): PluginLoadResult | null { return this.state.loadResult; }

    getStats() {
        return {
            initialized: this.state.initialized,
            pluginsLoaded: this.state.loadResult?.loaded ?? 0,
            pluginsFailed: this.state.loadResult?.failed ?? 0,
            bridgeStats: this.state.bridge?.getStats() ?? null,
            executorStats: this.state.executor?.getStats() ?? null,
        };
    }
}
