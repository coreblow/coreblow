import {
    validateChatSendParams,
    validateChatAbortParams,
    validateChatHistoryParams,
    validateChatInjectParams
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";
import { sanitizeChatSendMessageInput } from "./chat-sanitize.js";
import { AgentEngine } from "../../agents/agent-engine.js";
import { AgentStreamBridge } from "../../agents/agent-stream-bridge.js";
import type { StreamChunk } from "../../agents/provider-stream.js";

// ─── Shared Engine + Broadcast ───────────────────────────────────

let engine: AgentEngine | null = null;
let streamBridge: AgentStreamBridge | null = null;
let broadcastFn: ((event: string, data: unknown) => void) | null = null;

export function setAgentEngine(e: AgentEngine): void { engine = e; }
export function setStreamBridge(b: AgentStreamBridge): void { streamBridge = b; }
export function setBroadcast(fn: (event: string, data: unknown) => void): void { broadcastFn = fn; }
export function getAgentEngine(): AgentEngine | null { return engine; }

// ─── Handlers ────────────────────────────────────────────────────

export const chatHandlers: GatewayRequestHandlers = {
    "chat.send": async ({ params, respond }) => {
        if (!assertValidParams(params, validateChatSendParams, "chat.send", respond)) return;
        const p = params as { sessionKey: string; message: string; model?: string };
        const sanitation = sanitizeChatSendMessageInput(p.message);
        if (!sanitation.ok) {
            respond(false, undefined, { code: "invalid_request", message: sanitation.error! });
            return;
        }

        if (!engine) {
            respond(false, undefined, { code: "unavailable", message: "Agent engine not initialized" });
            return;
        }

        // Create or resume session
        let sessionId = p.sessionKey;
        if (!engine.getSession(sessionId)) {
            sessionId = engine.createSession({ model: p.model ?? engine.config.defaultModel });
        }

        const runId = `run_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        let streamedText = '';

        // Stream handler: broadcasts CoreBlow-compatible events
        const onChunk = (chunk: StreamChunk) => {
            if (!broadcastFn) return;

            if (chunk.type === 'text') {
                streamedText += chunk.content ?? '';
                broadcastFn('chat', {
                    state: 'delta',
                    sessionKey: sessionId,
                    runId,
                    message: { text: streamedText },
                    ts: Date.now(),
                });
            } else if (chunk.type === 'tool_use') {
                broadcastFn('agent', {
                    stream: 'tool',
                    sessionKey: sessionId,
                    runId,
                    ts: Date.now(),
                    data: {
                        toolCallId: chunk.toolUse?.id ?? `tc_${Date.now()}`,
                        name: chunk.toolUse?.name ?? 'unknown',
                        phase: 'start',
                        args: chunk.toolUse?.input,
                    },
                });
            } else if (chunk.type === 'error') {
                broadcastFn('chat', {
                    state: 'error',
                    sessionKey: sessionId,
                    runId,
                    message: { text: chunk.content ?? 'Unknown error' },
                    ts: Date.now(),
                });
            }
            // Also forward to stream bridge subscribers
            if (streamBridge) {
                const bridgeHandler = streamBridge.createStreamHandler(sessionId);
                bridgeHandler(chunk);
            }
        };

        // Respond immediately with started status
        respond(true, { status: "started", runId, sessionId }, undefined);

        try {
            const result = await engine.runTurn(sessionId, p.message, onChunk);

            // Broadcast tool results
            if (broadcastFn) {
                for (const tc of result.toolCalls) {
                    broadcastFn('agent', {
                        stream: 'tool',
                        sessionKey: sessionId,
                        runId,
                        ts: Date.now(),
                        data: {
                            toolCallId: tc.id,
                            name: tc.name,
                            phase: 'result',
                            result: tc.output,
                            durationMs: tc.durationMs,
                        },
                    });
                }

                // Broadcast final
                broadcastFn('chat', {
                    state: 'final',
                    sessionKey: sessionId,
                    runId,
                    ts: Date.now(),
                    message: {
                        role: 'assistant',
                        content: [{ type: 'text', text: result.responseText }],
                        timestamp: Date.now(),
                    },
                    usage: result.usage,
                    turnNumber: result.turnNumber,
                    durationMs: result.durationMs,
                });
            }
        } catch (err) {
            if (broadcastFn) {
                broadcastFn('chat', {
                    state: 'error',
                    sessionKey: sessionId,
                    runId,
                    ts: Date.now(),
                    message: { text: err instanceof Error ? err.message : String(err) },
                });
            }
        }
    },

    "chat.abort": ({ params, respond }) => {
        if (!assertValidParams(params, validateChatAbortParams, "chat.abort", respond)) return;
        const p = params as { sessionKey: string };
        if (engine) {
            const session = engine.getSession(p.sessionKey);
            if (session) {
                session.abortController.abort();
                if (broadcastFn) {
                    broadcastFn('chat', {
                        state: 'aborted',
                        sessionKey: p.sessionKey,
                        ts: Date.now(),
                    });
                }
                respond(true, { aborted: true, sessionId: p.sessionKey }, undefined);
                return;
            }
        }
        respond(true, { aborted: false, reason: "session not found" }, undefined);
    },

    "chat.history": ({ params, respond }) => {
        if (!assertValidParams(params, validateChatHistoryParams, "chat.history", respond)) return;
        const p = params as { sessionKey: string };
        if (engine) {
            const session = engine.getSession(p.sessionKey);
            if (session) {
                const messages = session.messages.map(m => ({
                    role: m.role,
                    content: m.content,
                    timestamp: m.timestamp,
                }));
                respond(true, { sessionId: p.sessionKey, messages }, undefined);
                return;
            }
        }
        respond(true, { messages: [] }, undefined);
    },

    "chat.inject": ({ params, respond }) => {
        if (!assertValidParams(params, validateChatInjectParams, "chat.inject", respond)) return;
        const p = params as { sessionKey: string; role?: string; content: string };
        if (engine) {
            const session = engine.getSession(p.sessionKey);
            if (session) {
                session.messages.push({
                    role: (p.role as 'system' | 'user') ?? 'system',
                    content: p.content,
                    timestamp: Date.now(),
                });
                respond(true, { ok: true, messageCount: session.messages.length }, undefined);
                return;
            }
        }
        respond(true, { ok: false, reason: "session not found" }, undefined);
    }
};
