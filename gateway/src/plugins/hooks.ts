/**
 * plugins/hooks.ts
 *
 * Plugin Hook Runner — executes plugin lifecycle hooks with proper
 * error handling, priority ordering, and async support.
 *
 * Following CoreBlow's hooks.ts (1,039 LOC) pattern with three execution modes:
 * - Void hooks: fire-and-forget, parallel execution
 * - Modifying hooks: sequential, results are merged
 * - Claiming hooks: sequential, first { handled: true } wins
 *
 * CoreBlow OOP equivalent of CoreBlow's createHookRunner() factory.
 */

import { createChildLogger } from '../utils/logger.js';
import type { PluginRegistry } from './registry.js';
import type {
    PluginHookName,
    PluginHookRegistration,
    PluginLogger,
} from './types.js';

const log = createChildLogger('plugin:hooks');

// ─── Types ───────────────────────────────────────────────────────

export interface HookRunnerOptions {
    logger?: PluginLogger;
    /** If true, errors in hooks will be caught and logged instead of thrown */
    catchErrors?: boolean;
}

/** Policy for modifying hooks — how to merge results and when to stop */
export type ModifyingHookPolicy<TResult> = {
    mergeResults?: (accumulated: TResult | undefined, next: TResult) => TResult;
    shouldStop?: (result: TResult) => boolean;
    terminalLabel?: string;
};

/** Outcome of a targeted claim for a specific plugin */
export type TargetedClaimOutcome<TResult> =
    | { status: 'handled'; result: TResult }
    | { status: 'missing_plugin' }
    | { status: 'no_handler' }
    | { status: 'declined' }
    | { status: 'error'; error: string };

// ─── Hook Runner ─────────────────────────────────────────────────

/**
 * CoreBlow Hook Runner
 *
 * Provides structured hook execution for the plugin system.
 * OOP equivalent of CoreBlow's createHookRunner() factory.
 */
export class HookRunner {
    private registry: PluginRegistry;
    private logger: PluginLogger;
    private catchErrors: boolean;

    constructor(registry: PluginRegistry, options: HookRunnerOptions = {}) {
        this.registry = registry;
        this.logger = options.logger ?? {
            info: (msg) => log.info(msg),
            warn: (msg) => log.warn(msg),
            error: (msg) => log.error(msg),
            debug: (msg) => log.debug(msg),
        };
        this.catchErrors = options.catchErrors ?? true;
    }

    // ─── Core Execution Patterns ─────────────────────────────────

    /**
     * Run a void hook (fire-and-forget).
     * All handlers are executed in parallel for performance.
     */
    async runVoidHook<K extends PluginHookName>(
        hookName: K,
        event: unknown,
        ctx: Record<string, unknown>,
    ): Promise<void> {
        const hooks = this.getHooksForName(hookName);
        if (hooks.length === 0) return;

        this.logger.debug?.(`[hooks] running ${hookName} (${hooks.length} handlers)`);

        const promises = hooks.map(async (hook) => {
            try {
                await hook.handler(event, ctx);
            } catch (err) {
                this.handleHookError(hookName, hook.pluginId, err);
            }
        });

        await Promise.all(promises);
    }

    /**
     * Run a modifying hook.
     * Handlers are executed sequentially in priority order, results are merged.
     */
    async runModifyingHook<K extends PluginHookName, TResult>(
        hookName: K,
        event: unknown,
        ctx: Record<string, unknown>,
        policy: ModifyingHookPolicy<TResult> = {},
    ): Promise<TResult | undefined> {
        const hooks = this.getHooksForName(hookName);
        if (hooks.length === 0) return undefined;

        this.logger.debug?.(`[hooks] running ${hookName} (${hooks.length} handlers, sequential)`);

        let result: TResult | undefined;

        for (const hook of hooks) {
            try {
                const handlerResult = await hook.handler(event, ctx) as TResult;

                if (handlerResult !== undefined && handlerResult !== null) {
                    if (policy.mergeResults) {
                        result = policy.mergeResults(result, handlerResult);
                    } else {
                        result = handlerResult;
                    }

                    if (result && policy.shouldStop?.(result)) {
                        const label = policy.terminalLabel ? ` ${policy.terminalLabel}` : '';
                        this.logger.debug?.(
                            `[hooks] ${hookName}${label} decided by ${hook.pluginId}; skipping remaining`,
                        );
                        break;
                    }
                }
            } catch (err) {
                this.handleHookError(hookName, hook.pluginId, err);
            }
        }

        return result;
    }

    /**
     * Run a claiming hook (first-claim-wins).
     * Handlers are executed sequentially, stops when one returns { handled: true }.
     */
    async runClaimingHook<K extends PluginHookName, TResult extends { handled: boolean }>(
        hookName: K,
        event: unknown,
        ctx: Record<string, unknown>,
    ): Promise<TResult | undefined> {
        const hooks = this.getHooksForName(hookName);
        if (hooks.length === 0) return undefined;

        this.logger.debug?.(`[hooks] running ${hookName} (${hooks.length} handlers, first-claim wins)`);

        for (const hook of hooks) {
            try {
                const result = await hook.handler(event, ctx) as TResult | void;
                if (result?.handled) {
                    return result;
                }
            } catch (err) {
                this.handleHookError(hookName, hook.pluginId, err);
            }
        }

        return undefined;
    }

    /**
     * Run a claiming hook for a specific plugin, with outcome tracking.
     */
    async runClaimingHookForPlugin<K extends PluginHookName, TResult extends { handled: boolean }>(
        hookName: K,
        pluginId: string,
        event: unknown,
        ctx: Record<string, unknown>,
    ): Promise<TargetedClaimOutcome<TResult>> {
        const pluginLoaded = this.registry.getPlugins().some(
            (p) => p.id === pluginId && p.status === 'loaded',
        );
        if (!pluginLoaded) {
            return { status: 'missing_plugin' };
        }

        const hooks = this.getHooksForName(hookName).filter((h) => h.pluginId === pluginId);
        if (hooks.length === 0) {
            return { status: 'no_handler' };
        }

        let firstError: string | null = null;
        for (const hook of hooks) {
            try {
                const result = await hook.handler(event, ctx) as TResult | void;
                if (result?.handled) {
                    return { status: 'handled', result };
                }
            } catch (err) {
                firstError ??= this.sanitizeError(err);
                this.handleHookError(hookName, hook.pluginId, err);
            }
        }

        if (firstError) {
            return { status: 'error', error: firstError };
        }
        return { status: 'declined' };
    }

    // ─── Convenience Methods (Named Hooks) ───────────────────────

    /** before_agent_start — modifying, merges model/prompt overrides */
    async runBeforeAgentStart(event: unknown, ctx: Record<string, unknown>) {
        return this.runModifyingHook<'before_agent_start', Record<string, unknown>>('before_agent_start', event, ctx, {
            mergeResults: (acc, next) => ({ ...(acc ?? {}), ...next }),
        });
    }

    /** agent_end — void, parallel */
    async runAgentEnd(event: unknown, ctx: Record<string, unknown>) {
        return this.runVoidHook('agent_end', event, ctx);
    }

    /** before_model_resolve — modifying */
    async runBeforeModelResolve(event: unknown, ctx: Record<string, unknown>) {
        return this.runModifyingHook('before_model_resolve', event, ctx, {
            mergeResults: (acc: { modelOverride: unknown; providerOverride: unknown } | undefined, next: { modelOverride: unknown; providerOverride: unknown }) => ({
                modelOverride: acc?.modelOverride ?? next?.modelOverride,
                providerOverride: acc?.providerOverride ?? next?.providerOverride,
            }),
        });
    }

    /** llm_input — void, parallel */
    async runLlmInput(event: unknown, ctx: Record<string, unknown>) {
        return this.runVoidHook('llm_input', event, ctx);
    }

    /** llm_output — void, parallel */
    async runLlmOutput(event: unknown, ctx: Record<string, unknown>) {
        return this.runVoidHook('llm_output', event, ctx);
    }

    /** message_received — void, parallel */
    async runMessageReceived(event: unknown, ctx: Record<string, unknown>) {
        return this.runVoidHook('message_received', event, ctx);
    }

    /** message_sending — modifying, supports cancel */
    async runMessageSending(event: unknown, ctx: Record<string, unknown>) {
        return this.runModifyingHook<'message_sending', { content?: string; cancel?: boolean }>(
            'message_sending', event, ctx,
            {
                mergeResults: (acc, next) => {
                    if (acc?.cancel === true) return acc;
                    return {
                        content: next.content ?? acc?.content,
                        cancel: acc?.cancel || next.cancel,
                    };
                },
                shouldStop: (result) => result.cancel === true,
                terminalLabel: 'cancel=true',
            },
        );
    }

    /** message_sent — void, parallel */
    async runMessageSent(event: unknown, ctx: Record<string, unknown>) {
        return this.runVoidHook('message_sent', event, ctx);
    }

    /** before_dispatch — claiming, first handler returning { handled: true } wins */
    async runBeforeDispatch(event: unknown, ctx: Record<string, unknown>) {
        return this.runClaimingHook<'before_dispatch', { handled: boolean; [key: string]: unknown }>(
            'before_dispatch', event, ctx,
        );
    }

    /** before_tool_call — modifying, supports block */
    async runBeforeToolCall(event: unknown, ctx: Record<string, unknown>) {
        return this.runModifyingHook<'before_tool_call', { block?: boolean; blockReason?: string; params?: unknown }>(
            'before_tool_call', event, ctx,
            {
                mergeResults: (acc, next) => {
                    if (acc?.block === true) return acc;
                    return {
                        params: next.params ?? acc?.params,
                        block: acc?.block || next.block,
                        blockReason: next.blockReason ?? acc?.blockReason,
                    };
                },
                shouldStop: (result) => result.block === true,
                terminalLabel: 'block=true',
            },
        );
    }

    /** after_tool_call — void, parallel */
    async runAfterToolCall(event: unknown, ctx: Record<string, unknown>) {
        return this.runVoidHook('after_tool_call', event, ctx);
    }

    /** session_start — void, parallel */
    async runSessionStart(event: unknown, ctx: Record<string, unknown>) {
        return this.runVoidHook('session_start', event, ctx);
    }

    /** session_end — void, parallel */
    async runSessionEnd(event: unknown, ctx: Record<string, unknown>) {
        return this.runVoidHook('session_end', event, ctx);
    }

    /** gateway_start — void, parallel */
    async runGatewayStart(event: unknown, ctx: Record<string, unknown>) {
        return this.runVoidHook('gateway_start', event, ctx);
    }

    /** gateway_stop — void, parallel */
    async runGatewayStop(event: unknown, ctx: Record<string, unknown>) {
        return this.runVoidHook('gateway_stop', event, ctx);
    }

    /** before_compaction — void, parallel */
    async runBeforeCompaction(event: unknown, ctx: Record<string, unknown>) {
        return this.runVoidHook('before_compaction', event, ctx);
    }

    /** after_compaction — void, parallel */
    async runAfterCompaction(event: unknown, ctx: Record<string, unknown>) {
        return this.runVoidHook('after_compaction', event, ctx);
    }

    /** before_reset — void, parallel */
    async runBeforeReset(event: unknown, ctx: Record<string, unknown>) {
        return this.runVoidHook('before_reset', event, ctx);
    }

    /** inbound_claim — claiming */
    async runInboundClaim(event: unknown, ctx: Record<string, unknown>) {
        return this.runClaimingHook<'inbound_claim', { handled: boolean; [key: string]: unknown }>(
            'inbound_claim', event, ctx,
        );
    }

    // ─── Private ─────────────────────────────────────────────────

    private getHooksForName<K extends PluginHookName>(hookName: K): PluginHookRegistration<K>[] {
        return this.registry.getTypedHooks(hookName);
    }

    private handleHookError(hookName: PluginHookName, pluginId: string, error: unknown): void {
        const msg = `[hooks] ${hookName} handler from ${pluginId} failed: ${String(error)}`;
        if (this.catchErrors) {
            this.logger.error(msg);
            return;
        }
        throw new Error(msg, { cause: error });
    }

    private sanitizeError(error: unknown): string {
        const raw = error instanceof Error ? error.message : String(error);
        const firstLine = raw.split('\n')[0]?.trim();
        return firstLine || 'unknown error';
    }
}

// ─── Backward Compat: PluginHooks ────────────────────────────────
// The old hooks.ts exported PluginHooks with register()/trigger().
// Keep it here for compat with hooks.test.ts.

export class PluginHooks {
    private handlers = new Map<string, Array<(ctx: unknown) => void>>();

    register(event: string, handler: (ctx: unknown) => void): void {
        const existing = this.handlers.get(event) ?? [];
        existing.push(handler);
        this.handlers.set(event, existing);
    }

    async trigger(event: string, ctx: unknown): Promise<void> {
        const handlers = this.handlers.get(event) ?? [];
        for (const handler of handlers) {
            await handler(ctx);
        }
    }
}
