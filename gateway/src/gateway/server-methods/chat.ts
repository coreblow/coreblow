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

// Shared engine instance — bootstrapped by server startup
let engine: AgentEngine | null = null;
let streamBridge: AgentStreamBridge | null = null;

export function setAgentEngine(e: AgentEngine): void { engine = e; }
export function setStreamBridge(b: AgentStreamBridge): void { streamBridge = b; }
export function getAgentEngine(): AgentEngine | null { return engine; }

export const chatHandlers: GatewayRequestHandlers = {
    "chat.send": async ({ params, respond }) => {
        if (!assertValidParams(params, validateChatSendParams, "chat.send", respond)) return;
        const p = params as { sessionKey: string; message: string };
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
            sessionId = engine.createSession({ model: engine.config.defaultModel });
        }

        const onChunk = streamBridge
            ? streamBridge.createStreamHandler(sessionId)
            : undefined;

        // Start the turn asynchronously
        const runId = `run_${Date.now()}`;
        respond(true, { status: "started", runId, sessionId }, undefined);

        try {
            const result = await engine.runTurn(sessionId, p.message, onChunk);
            // Final result broadcast (for non-streaming clients)
            if (streamBridge) {
                const payload = JSON.stringify({
                    event: 'chat.completed',
                    sessionId,
                    runId,
                    result: {
                        text: result.responseText,
                        usage: result.usage,
                        toolCalls: result.toolCalls.length,
                        turnNumber: result.turnNumber,
                        durationMs: result.durationMs,
                    },
                });
                // The bridge will handle delivery
            }
        } catch (err) {
            // Error already handled in engine, but log for gateway
        }
    },

    "chat.abort": ({ params, respond }) => {
        if (!assertValidParams(params, validateChatAbortParams, "chat.abort", respond)) return;
        const p = params as { sessionKey: string };
        if (engine) {
            const session = engine.getSession(p.sessionKey);
            if (session) {
                session.abortController.abort();
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
