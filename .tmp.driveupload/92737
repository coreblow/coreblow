/**
 * plugin-sdk/testing.ts
 *
 * Test utilities for plugin authors — mock contexts, harnesses,
 * and assertion helpers for unit-testing plugins.
 *
 * Following CoreBlow's plugin-sdk testing patterns.
 */

import type {
    PluginContext,
    PluginContextLogger,
    PluginEventBus,
    PluginApiSurface,
    PluginTool,
    PluginCommand,
    PluginHook,
    PluginProvider,
} from '../plugins/types.js';

// ─── Mock Factories ──────────────────────────────────────────────

/**
 * Create a mock PluginContext for testing.
 */
export function createMockContext(overrides?: Partial<PluginContext>): PluginContext {
    return {
        pluginId: overrides?.pluginId ?? 'test-plugin',
        pluginDir: overrides?.pluginDir ?? '/tmp/test-plugin',
        config: overrides?.config ?? {},
        log: overrides?.log ?? createMockLogger(),
        events: overrides?.events ?? createMockEventBus(),
        api: overrides?.api ?? createMockApi(),
    };
}

/**
 * Create a mock PluginLogger that records all calls.
 */
export function createMockLogger(): PluginContextLogger & { calls: Array<{ level: string; msg: string; args: unknown[] }> } {
    const calls: Array<{ level: string; msg: string; args: unknown[] }> = [];
    return {
        calls,
        info: (msg: string, ...args: unknown[]) => calls.push({ level: 'info', msg, args }),
        warn: (msg: string, ...args: unknown[]) => calls.push({ level: 'warn', msg, args }),
        error: (msg: string, ...args: unknown[]) => calls.push({ level: 'error', msg, args }),
        debug: (msg: string, ...args: unknown[]) => calls.push({ level: 'debug', msg, args }),
    };
}

/**
 * Create a mock PluginEventBus that records emissions.
 */
export function createMockEventBus(): PluginEventBus & {
    emitted: Array<{ event: string; data: unknown }>;
    handlers: Map<string, Array<(data: unknown) => void>>;
} {
    const emitted: Array<{ event: string; data: unknown }> = [];
    const handlers = new Map<string, Array<(data: unknown) => void>>();

    return {
        emitted,
        handlers,
        emit: (event: string, data?: unknown) => {
            emitted.push({ event, data });
            const eventHandlers = handlers.get(event);
            if (eventHandlers) {
                for (const handler of eventHandlers) {
                    handler(data);
                }
            }
        },
        on: (event: string, handler: (data: unknown) => void) => {
            const existing = handlers.get(event) ?? [];
            existing.push(handler);
            handlers.set(event, existing);
        },
        off: (event: string, handler: (data: unknown) => void) => {
            const existing = handlers.get(event) ?? [];
            handlers.set(event, existing.filter((h) => h !== handler));
        },
    };
}

/**
 * Create a mock PluginApiSurface that records registrations.
 */
export function createMockApi(): PluginApiSurface & {
    registeredTools: PluginTool[];
    registeredCommands: PluginCommand[];
    registeredHooks: PluginHook[];
    registeredProviders: PluginProvider[];
} {
    const registeredTools: PluginTool[] = [];
    const registeredCommands: PluginCommand[] = [];
    const registeredHooks: PluginHook[] = [];
    const registeredProviders: PluginProvider[] = [];

    return {
        registeredTools,
        registeredCommands,
        registeredHooks,
        registeredProviders,
        registerTool: (tool: PluginTool) => registeredTools.push(tool),
        registerCommand: (command: PluginCommand) => registeredCommands.push(command),
        registerHook: (hook: PluginHook) => registeredHooks.push(hook),
        registerProvider: (provider: PluginProvider) => registeredProviders.push(provider),
    };
}

// ─── Test Plugin Harness ─────────────────────────────────────────

/**
 * TestPluginHarness — wraps a plugin for full lifecycle testing.
 */
export class TestPluginHarness {
    private context: PluginContext;
    private activated = false;
    private activateFn?: (ctx: PluginContext) => Promise<void>;
    private deactivateFn?: () => Promise<void>;

    constructor(options?: {
        activate?: (ctx: PluginContext) => Promise<void>;
        deactivate?: () => Promise<void>;
        config?: Record<string, unknown>;
    }) {
        this.activateFn = options?.activate;
        this.deactivateFn = options?.deactivate;
        this.context = createMockContext({
            config: options?.config,
        });
    }

    /**
     * Activate the plugin.
     */
    async activate(): Promise<void> {
        if (this.activateFn) {
            await this.activateFn(this.context);
        }
        this.activated = true;
    }

    /**
     * Deactivate the plugin.
     */
    async deactivate(): Promise<void> {
        if (this.deactivateFn) {
            await this.deactivateFn();
        }
        this.activated = false;
    }

    /**
     * Check if the plugin is activated.
     */
    isActivated(): boolean {
        return this.activated;
    }

    /**
     * Get the mock context.
     */
    getContext(): PluginContext {
        return this.context;
    }

    /**
     * Get the mock logger.
     */
    getLogger(): ReturnType<typeof createMockLogger> {
        return this.context.log as ReturnType<typeof createMockLogger>;
    }

    /**
     * Get the mock event bus.
     */
    getEventBus(): ReturnType<typeof createMockEventBus> {
        return this.context.events as ReturnType<typeof createMockEventBus>;
    }

    /**
     * Get the mock API.
     */
    getApi(): ReturnType<typeof createMockApi> {
        return this.context.api as ReturnType<typeof createMockApi>;
    }
}
