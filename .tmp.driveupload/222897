// @ts-nocheck
/**
 * plugin-sdk/hooks-api.ts
 *
 * Public hooks API for plugin authors — typed hook registration
 * and hook chain composition utilities.
 */

import type {
    PluginHookName,
    PluginHook,
    PluginContext,
} from '../plugins/types.js';

// ─── Types ───────────────────────────────────────────────────────

/** Hook registration options */
export interface HookRegistrationOptions {
    name?: string;
    description?: string;
    priority?: number;
}

/** Hook pair — before/after hook combination */
export interface HookPair {
    before: PluginHook;
    after: PluginHook;
}

// ─── HooksAPI ────────────────────────────────────────────────────

/**
 * CoreBlow Plugin Hooks API
 *
 * Provides a typed, fluent API for plugin authors to register hooks
 * with priority management and chain composition.
 */
export class HooksAPI {
    private hooks: PluginHook[] = [];

    /**
     * Register a hook for a specific event.
     */
    on(
        event: string,
        handler: (...args: unknown[]) => Promise<unknown>,
        options?: HookRegistrationOptions,
    ): this {
        this.hooks.push({
            event,
            handler,
            priority: options?.priority ?? 50,
        });
        return this;
    }

    /**
     * Register a before/after hook pair.
     */
    wrap(
        beforeEvent: string,
        afterEvent: string,
        handlers: {
            before: (...args: unknown[]) => Promise<unknown>;
            after: (...args: unknown[]) => Promise<unknown>;
        },
        priority?: number,
    ): HookPair {
        const before: PluginHook = {
            event: beforeEvent,
            handler: handlers.before,
            priority: priority ?? 50,
        };
        const after: PluginHook = {
            event: afterEvent,
            handler: handlers.after,
            priority: priority ?? 50,
        };
        this.hooks.push(before, after);
        return { before, after };
    }

    /**
     * Register a message_received hook.
     */
    onMessageReceived(
        handler: (event: unknown, ctx: unknown) => Promise<void>,
        priority?: number,
    ): this {
        return this.on('message_received', handler, { priority });
    }

    /**
     * Register a message_sending hook (can modify or cancel).
     */
    onMessageSending(
        handler: (event: unknown, ctx: unknown) => Promise<{ content?: string; cancel?: boolean } | void>,
        priority?: number,
    ): this {
        return this.on('message_sending', handler, { priority });
    }

    /**
     * Register a before_tool_call hook (can modify params or block).
     */
    onBeforeToolCall(
        handler: (event: unknown, ctx: unknown) => Promise<{ params?: unknown; block?: boolean; blockReason?: string } | void>,
        priority?: number,
    ): this {
        return this.on('before_tool_call', handler, { priority });
    }

    /**
     * Register a session_start hook.
     */
    onSessionStart(
        handler: (event: unknown, ctx: unknown) => Promise<void>,
        priority?: number,
    ): this {
        return this.on('session_start', handler, { priority });
    }

    /**
     * Register a session_end hook.
     */
    onSessionEnd(
        handler: (event: unknown, ctx: unknown) => Promise<void>,
        priority?: number,
    ): this {
        return this.on('session_end', handler, { priority });
    }

    /**
     * Register an llm_input hook (observe LLM input).
     */
    onLlmInput(
        handler: (event: unknown, ctx: unknown) => Promise<void>,
        priority?: number,
    ): this {
        return this.on('llm_input', handler, { priority });
    }

    /**
     * Register an llm_output hook (observe LLM output).
     */
    onLlmOutput(
        handler: (event: unknown, ctx: unknown) => Promise<void>,
        priority?: number,
    ): this {
        return this.on('llm_output', handler, { priority });
    }

    /**
     * Get all registered hooks.
     */
    getHooks(): PluginHook[] {
        return [...this.hooks];
    }

    /**
     * Get hooks sorted by priority (highest first).
     */
    getSortedHooks(): PluginHook[] {
        return [...this.hooks].sort((a, b) => b.priority - a.priority);
    }

    /**
     * Clear all registered hooks.
     */
    clear(): void {
        this.hooks = [];
    }

    /**
     * Count registered hooks.
     */
    count(): number {
        return this.hooks.length;
    }
}
