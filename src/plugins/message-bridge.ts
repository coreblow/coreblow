// @ts-nocheck
/**
 * plugins/message-bridge.ts
 *
 * Plugin Message Bridge — connects the HookRunner into the Gateway
 * message pipeline so plugin hooks fire at every stage of message processing.
 *
 * Following CoreBlow's hook-pipeline.ts (~450 LOC) + chat/pipeline.ts (~350 LOC)
 * pattern, adapted for CoreBlow's OOP architecture with stage-based
 * hook orchestration and per-stage error isolation.
 *
 * Flow:
 *   Inbound → message_received → before_dispatch → [LLM] → message_sending → Send → message_sent
 *
 * This is the core integration layer that makes plugins "live" in the
 * gateway. Without this bridge, hooks are registered but never called.
 */

import { createChildLogger } from '../utils/logger.js';
import type { HookRunner } from './hooks.js';

const log = createChildLogger('plugin:message-bridge');

// ─── Types ──────────────────────────────────────────────────────

/** Inbound message entering the pipeline */
export interface PipelineMessage {
    /** Unique message ID */
    id: string;
    /** Session/conversation key */
    sessionKey: string;
    /** Channel source (discord, telegram, ws, etc.) */
    channel: string;
    /** Raw message content */
    content: string;
    /** Sender info */
    sender: {
        id: string;
        name?: string;
        role?: 'user' | 'admin' | 'system';
    };
    /** Message metadata */
    metadata?: Record<string, unknown>;
    /** Timestamp */
    timestamp: number;
}

/** Outbound message leaving the pipeline */
export interface PipelineResponse {
    /** Original message ID this responds to */
    inReplyTo: string;
    /** Session key */
    sessionKey: string;
    /** Response content */
    content: string;
    /** Whether this was cancelled by a plugin */
    cancelled: boolean;
    /** Metadata from plugin hooks */
    metadata?: Record<string, unknown>;
}

/** Pipeline stage outcome */
export interface PipelineStageResult<T = unknown> {
    stage: string;
    success: boolean;
    duration: number;
    result?: T;
    error?: string;
}

/** Full pipeline result */
export interface PipelineResult {
    message: PipelineMessage;
    response: PipelineResponse | null;
    stages: PipelineStageResult[];
    totalDuration: number;
    claimedBy?: string;
}

/** Message handler — the actual processing function (LLM, commands, etc.) */
export type MessageHandler = (
    message: PipelineMessage,
    ctx: PipelineContext,
) => Promise<string>;

/** Pipeline context passed through all stages */
export interface PipelineContext {
    sessionKey: string;
    channel: string;
    model?: string;
    provider?: string;
    /** Cumulative metadata from hooks */
    hookData: Record<string, unknown>;
    /** Response override from hooks */
    responseOverride?: string;
    /** Whether pipeline was cancelled */
    cancelled: boolean;
    /** Which plugin claimed the message (if any) */
    claimedBy?: string;
}

// ─── Bridge ─────────────────────────────────────────────────────

/**
 * PluginMessageBridge
 *
 * Integrates the HookRunner into the message processing pipeline.
 * Each message passes through:
 *   1. message_received (void — observe inbound)
 *   2. before_dispatch (claiming — plugin can take over)
 *   3. before_model_resolve (modifying — plugin can override model)
 *   4. [MessageHandler execution]
 *   5. message_sending (modifying — plugin can modify/cancel response)
 *   6. [Send response]
 *   7. message_sent (void — observe outbound)
 */
export class PluginMessageBridge {
    private hookRunner: HookRunner;
    private handler: MessageHandler | null = null;
    private stats = {
        messagesProcessed: 0,
        hooksFired: 0,
        pluginClaims: 0,
        pluginCancels: 0,
        errors: 0,
    };

    constructor(hookRunner: HookRunner) {
        this.hookRunner = hookRunner;
    }

    /**
     * Set the message handler (LLM/command processor).
     * This is called between the inbound and outbound hook stages.
     */
    setHandler(handler: MessageHandler): void {
        this.handler = handler;
    }

    /**
     * Process a message through the full plugin-augmented pipeline.
     */
    async processMessage(message: PipelineMessage): Promise<PipelineResult> {
        const startTime = Date.now();
        const stages: PipelineStageResult[] = [];
        const ctx: PipelineContext = {
            sessionKey: message.sessionKey,
            channel: message.channel,
            hookData: {},
            cancelled: false,
        };

        try {
            // ── Stage 1: message_received (void — observe) ──
            const s1 = await this.runStage('message_received', async () => {
                await this.hookRunner.runMessageReceived(
                    { message, content: message.content },
                    { sessionKey: message.sessionKey, channel: message.channel },
                );
            });
            stages.push(s1);

            // ── Stage 2: before_dispatch (claiming — plugin can handle) ──
            const s2 = await this.runStage('before_dispatch', async () => {
                const claim = await this.hookRunner.runBeforeDispatch(
                    { message, content: message.content },
                    { sessionKey: message.sessionKey },
                );
                if (claim?.handled) {
                    ctx.claimedBy = 'plugin';
                    ctx.responseOverride = (claim as Record<string, unknown>).response as string | undefined;
                    this.stats.pluginClaims++;
                }
                return claim;
            });
            stages.push(s2);

            // If claimed by plugin, skip normal processing
            if (ctx.claimedBy) {
                const response: PipelineResponse = {
                    inReplyTo: message.id,
                    sessionKey: message.sessionKey,
                    content: ctx.responseOverride ?? '',
                    cancelled: false,
                };
                this.stats.messagesProcessed++;
                return {
                    message,
                    response,
                    stages,
                    totalDuration: Date.now() - startTime,
                    claimedBy: ctx.claimedBy,
                };
            }

            // ── Stage 3: before_model_resolve (modifying — override model) ──
            const s3 = await this.runStage('before_model_resolve', async () => {
                const resolve = await this.hookRunner.runBeforeModelResolve(
                    { model: ctx.model },
                    { sessionKey: message.sessionKey },
                );
                if (resolve) {
                    const r = resolve as { modelOverride?: string; providerOverride?: string };
                    if (r.modelOverride) ctx.model = r.modelOverride;
                    if (r.providerOverride) ctx.provider = r.providerOverride;
                }
                return resolve;
            });
            stages.push(s3);

            // ── Stage 4: llm_input (void — observe) ──
            const s4 = await this.runStage('llm_input', async () => {
                await this.hookRunner.runLlmInput(
                    { content: message.content, model: ctx.model },
                    { sessionKey: message.sessionKey },
                );
            });
            stages.push(s4);

            // ── Stage 5: Execute handler (LLM/command processing) ──
            let responseContent = '';
            const s5 = await this.runStage('handler', async () => {
                if (this.handler) {
                    responseContent = await this.handler(message, ctx);
                } else {
                    responseContent = '[No handler configured]';
                }
                return responseContent;
            });
            stages.push(s5);

            // ── Stage 6: llm_output (void — observe) ──
            const s6 = await this.runStage('llm_output', async () => {
                await this.hookRunner.runLlmOutput(
                    { content: responseContent, model: ctx.model },
                    { sessionKey: message.sessionKey },
                );
            });
            stages.push(s6);

            // ── Stage 7: message_sending (modifying — can modify/cancel) ──
            const s7 = await this.runStage('message_sending', async () => {
                const sending = await this.hookRunner.runMessageSending(
                    { content: responseContent, sessionKey: message.sessionKey },
                    { channel: message.channel },
                );
                if (sending) {
                    if (sending.cancel) {
                        ctx.cancelled = true;
                        this.stats.pluginCancels++;
                    }
                    if (sending.content) {
                        responseContent = sending.content;
                    }
                }
                return sending;
            });
            stages.push(s7);

            // Build response
            const response: PipelineResponse = {
                inReplyTo: message.id,
                sessionKey: message.sessionKey,
                content: responseContent,
                cancelled: ctx.cancelled,
                metadata: ctx.hookData,
            };

            // ── Stage 8: message_sent (void — observe outbound) ──
            if (!ctx.cancelled) {
                const s8 = await this.runStage('message_sent', async () => {
                    await this.hookRunner.runMessageSent(
                        { content: responseContent, sessionKey: message.sessionKey },
                        { channel: message.channel },
                    );
                });
                stages.push(s8);
            }

            this.stats.messagesProcessed++;

            return {
                message,
                response: ctx.cancelled ? null : response,
                stages,
                totalDuration: Date.now() - startTime,
            };
        } catch (err) {
            this.stats.errors++;
            const errorMsg = err instanceof Error ? err.message : String(err);
            log.error({ err: errorMsg }, 'Pipeline error');

            return {
                message,
                response: null,
                stages,
                totalDuration: Date.now() - startTime,
            };
        }
    }

    /**
     * Run a named pipeline stage with timing and error handling.
     */
    private async runStage<T>(
        name: string,
        fn: () => Promise<T>,
    ): Promise<PipelineStageResult<T>> {
        const start = Date.now();
        try {
            const result = await fn();
            this.stats.hooksFired++;
            return { stage: name, success: true, duration: Date.now() - start, result };
        } catch (err) {
            this.stats.errors++;
            const errorMsg = err instanceof Error ? err.message : String(err);
            log.warn({ stage: name, err: errorMsg }, 'Hook stage error');
            return { stage: name, success: false, duration: Date.now() - start, error: errorMsg };
        }
    }

    /**
     * Get pipeline statistics.
     */
    getStats() {
        return { ...this.stats };
    }

    /**
     * Reset statistics.
     */
    resetStats(): void {
        this.stats = {
            messagesProcessed: 0,
            hooksFired: 0,
            pluginClaims: 0,
            pluginCancels: 0,
            errors: 0,
        };
    }
}
