
/**
 * plugins/executor.ts
 *
 * Plugin Executor — fires tool, session, and agent lifecycle hooks
 * through the HookRunner. Provides the runtime layer that connects
 * plugin-registered tools and hooks to actual execution.
 *
 * Following CoreBlow's tool-hooks.ts (~350 LOC) + session-hooks.ts (~250 LOC)
 * pattern, consolidated into a single OOP executor with typed hook dispatch.
 *
 * Handles:
 *   - before_tool_call / after_tool_call hooks
 *   - before_agent_start / agent_end hooks
 *   - before_compaction / after_compaction hooks
 *   - inbound_claim hooks (plugin routing)
 *   - Tool execution within sandbox constraints
 */

import { createChildLogger } from '../utils/logger.js';
import type { HookRunner } from './hooks.js';

const log = createChildLogger('plugin:executor');

// ─── Types ──────────────────────────────────────────────────────

/** Tool call metadata */
export interface ToolCallEvent {
    toolName: string;
    params: Record<string, unknown>;
    sessionKey: string;
    pluginId?: string;
    timestamp: number;
}

/** Tool call result */
export interface ToolCallResult {
    toolName: string;
    result: unknown;
    duration: number;
    sessionKey: string;
}

/** Before-tool-call outcome */
export interface BeforeToolOutcome {
    blocked: boolean;
    reason?: string;
    modifiedParams?: Record<string, unknown>;
}

/** Agent lifecycle event */
export interface AgentLifecycleEvent {
    sessionKey: string;
    model?: string;
    turnNumber?: number;
    timestamp: number;
}

// ─── Executor ───────────────────────────────────────────────────

/**
 * PluginExecutor
 *
 * Executes plugin hooks for tool calls, agent lifecycle, and
 * context management operations. Each hook point allows plugins
 * to observe, modify, or block actions.
 */
export class PluginExecutor {
    private hookRunner: HookRunner;
    private stats = {
        toolCallsProcessed: 0,
        toolCallsBlocked: 0,
        agentStartsFired: 0,
        agentEndsFired: 0,
        compactionsFired: 0,
        errors: 0,
    };

    constructor(hookRunner: HookRunner) {
        this.hookRunner = hookRunner;
    }

    // ─── Tool Hooks ─────────────────────────────────────────────

    /**
     * Fire before_tool_call hooks.
     * Plugins can modify params or block the tool call entirely.
     */
    async beforeToolCall(
        toolName: string,
        params: Record<string, unknown>,
        sessionKey: string,
    ): Promise<BeforeToolOutcome> {
        this.stats.toolCallsProcessed++;

        try {
            const result = await this.hookRunner.runBeforeToolCall(
                { toolName, params },
                { toolName, sessionKey },
            );

            if (result?.block) {
                this.stats.toolCallsBlocked++;
                log.info({ toolName, reason: result.blockReason }, 'Tool call blocked by plugin');
                return {
                    blocked: true,
                    reason: result.blockReason ?? 'Blocked by plugin',
                };
            }

            return {
                blocked: false,
                modifiedParams: result?.params as Record<string, unknown> | undefined,
            };
        } catch (err) {
            this.stats.errors++;
            const errMsg = err instanceof Error ? err.message : String(err);
            log.error({ toolName, err: errMsg }, 'before_tool_call hook error');
            return { blocked: false };
        }
    }

    /**
     * Fire after_tool_call hooks.
     * Plugins can observe tool results for logging, analytics, etc.
     */
    async afterToolCall(
        toolName: string,
        result: unknown,
        sessionKey: string,
    ): Promise<void> {
        try {
            await this.hookRunner.runAfterToolCall(
                { toolName, params: {}, result },
                { toolName, sessionKey },
            );
        } catch (err) {
            this.stats.errors++;
            const errMsg = err instanceof Error ? err.message : String(err);
            log.error({ toolName, err: errMsg }, 'after_tool_call hook error');
        }
    }

    // ─── Agent Lifecycle Hooks ───────────────────────────────────

    /**
     * Fire before_agent_start hooks.
     * Plugins can override model selection, modify system prompt, etc.
     */
    async beforeAgentStart(
        sessionKey: string,
        model?: string,
        turnNumber?: number,
    ): Promise<Record<string, unknown> | undefined> {
        this.stats.agentStartsFired++;

        try {
            const result = await this.hookRunner.runBeforeAgentStart(
                { prompt: '', messages: [] },
                { sessionKey },
            );
            return result as Record<string, unknown> | undefined;
        } catch (err) {
            this.stats.errors++;
            const errMsg = err instanceof Error ? err.message : String(err);
            log.error({ err: errMsg }, 'before_agent_start hook error');
            return undefined;
        }
    }

    /**
     * Fire agent_end hooks.
     */
    async agentEnd(
        sessionKey: string,
        model?: string,
        turnNumber?: number,
    ): Promise<void> {
        this.stats.agentEndsFired++;

        try {
            await this.hookRunner.runAgentEnd(
                { messages: [], success: true },
                { sessionKey },
            );
        } catch (err) {
            this.stats.errors++;
            const errMsg = err instanceof Error ? err.message : String(err);
            log.error({ err: errMsg }, 'agent_end hook error');
        }
    }

    // ─── Compaction Hooks ────────────────────────────────────────

    /**
     * Fire before_compaction hook.
     */
    async beforeCompaction(sessionKey: string): Promise<void> {
        this.stats.compactionsFired++;

        try {
            await this.hookRunner.runBeforeCompaction(
                { messageCount: 0 },
                { sessionKey },
            );
        } catch (err) {
            this.stats.errors++;
            const errMsg = err instanceof Error ? err.message : String(err);
            log.error({ err: errMsg }, 'before_compaction hook error');
        }
    }

    /**
     * Fire after_compaction hook.
     */
    async afterCompaction(sessionKey: string, stats?: Record<string, unknown>): Promise<void> {
        try {
            await this.hookRunner.runAfterCompaction(
                { messageCount: 0, compactedCount: 0 },
                { sessionKey },
            );
        } catch (err) {
            this.stats.errors++;
            const errMsg = err instanceof Error ? err.message : String(err);
            log.error({ err: errMsg }, 'after_compaction hook error');
        }
    }

    // ─── Inbound Claim ──────────────────────────────────────────

    /**
     * Run inbound_claim hooks — lets a plugin take over message routing.
     */
    async tryInboundClaim(
        content: string,
        sessionKey: string,
        channel: string,
    ): Promise<{ claimed: boolean; response?: string }> {
        try {
            const result = await this.hookRunner.runInboundClaim(
                { content, channel, isGroup: false },
                { channelId: channel },
            );

            if (result?.handled) {
                return {
                    claimed: true,
                    response: (result as Record<string, unknown>).response as string | undefined,
                };
            }

            return { claimed: false };
        } catch (err) {
            this.stats.errors++;
            return { claimed: false };
        }
    }

    // ─── Stats ──────────────────────────────────────────────────

    getStats() {
        return { ...this.stats };
    }

    resetStats(): void {
        this.stats = {
            toolCallsProcessed: 0,
            toolCallsBlocked: 0,
            agentStartsFired: 0,
            agentEndsFired: 0,
            compactionsFired: 0,
            errors: 0,
        };
    }
}
