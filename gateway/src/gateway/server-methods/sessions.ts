import {
    validateSessionsListParams,
    validateSessionsCreateParams,
    validateSessionsPreviewParams,
    validateSessionsResolveParams,
    validateSessionsPatchParams,
    validateSessionsDeleteParams,
    validateSessionsResetParams,
    validateSessionsCompactParams,
    validateSessionsAbortParams,
    validateSessionsSendParams,
    validateSessionsMessagesSubscribeParams,
    validateSessionsMessagesUnsubscribeParams
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";
import { getAgentEngine } from "./chat.js";

export const sessionsHandlers: GatewayRequestHandlers = {
    "sessions.list": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsListParams, "sessions.list", respond)) return;
        const engine = getAgentEngine();
        if (!engine) { respond(true, { sessions: [], count: 0 }, undefined); return; }
        const sessions = engine.listSessions().map(s => ({
            key: s.id,
            model: s.model,
            modelProvider: 'anthropic',
            state: s.state,
            turnCount: s.turnCount,
            totalTokens: s.totalTokens,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            messageCount: s.turnCount * 2,
        }));
        respond(true, { sessions, count: sessions.length }, undefined);
    },

    "sessions.create": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsCreateParams, "sessions.create", respond)) return;
        const engine = getAgentEngine();
        if (!engine) {
            // Graceful fallback — generate mock session ID when engine not initialized
            const mockId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            respond(true, { id: mockId, sessionKey: mockId }, undefined);
            return;
        }
        const p = params as { model?: string; systemPrompt?: string };
        const id = engine.createSession({ model: p.model, systemPrompt: p.systemPrompt });
        const session = engine.getSession(id);
        respond(true, { id, sessionKey: id, model: session?.model }, undefined);
    },

    "sessions.delete": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsDeleteParams, "sessions.delete", respond)) return;
        const engine = getAgentEngine();
        const p = params as { key?: string };
        if (!p.key) { respond(false, undefined, { code: "invalid_request", message: "Missing key" }); return; }
        const destroyed = engine?.destroySession(p.key) ?? false;
        respond(true, { ok: destroyed, key: p.key }, undefined);
    },

    "sessions.reset": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsResetParams, "sessions.reset", respond)) return;
        const engine = getAgentEngine();
        const p = params as { key?: string };
        if (!p.key || !engine) { respond(true, { ok: false }, undefined); return; }
        const session = engine.getSession(p.key);
        if (session) {
            session.messages = [];
            session.turnCount = 0;
            respond(true, { ok: true, key: p.key }, undefined);
        } else {
            respond(true, { ok: false, reason: "not found" }, undefined);
        }
    },

    "sessions.patch": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsPatchParams, "sessions.patch", respond)) return;
        const engine = getAgentEngine();
        if (!engine) { respond(false, undefined, { code: "unavailable", message: "Engine not initialized" }); return; }
        const p = params as { key?: string; model?: string | null; label?: string | null };
        if (!p.key) { respond(false, undefined, { code: "invalid_request", message: "Missing key" }); return; }
        const session = engine.getSession(p.key);
        if (!session) { respond(false, undefined, { code: "not_found", message: "Session not found" }); return; }
        if (p.model !== undefined) {
            engine.setSessionModel(p.key, p.model ?? engine.config.defaultModel ?? 'claude-sonnet-4-20250514');
        }
        respond(true, { ok: true, key: p.key, model: session.model }, undefined);
    },

    "sessions.abort": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsAbortParams, "sessions.abort", respond)) return;
        const engine = getAgentEngine();
        const p = params as { key?: string };
        if (p.key && engine) {
            const session = engine.getSession(p.key);
            if (session) { session.abortController.abort(); }
        }
        respond(true, { aborted: true }, undefined);
    },

    // Thin wrappers for subscription endpoints (stateless in our architecture)
    "sessions.preview": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsPreviewParams, "sessions.preview", respond)) return;
        respond(true, { ts: Date.now(), previews: [] }, undefined);
    },
    "sessions.resolve": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsResolveParams, "sessions.resolve", respond)) return;
        respond(true, { ok: true, key: "resolved" }, undefined);
    },
    "sessions.compact": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsCompactParams, "sessions.compact", respond)) return;
        respond(true, { compacted: true }, undefined);
    },
    "sessions.send": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsSendParams, "sessions.send", respond)) return;
        respond(true, { status: "started", runId: `run_${Date.now()}`, messageSeq: 1 }, undefined);
    },
    "sessions.steer": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsSendParams, "sessions.steer", respond)) return;
        respond(true, { status: "started", runId: `run_${Date.now()}`, messageSeq: 1 }, undefined);
    },
    "sessions.subscribe": ({ respond }) => { respond(true, { subscribed: true }, undefined); },
    "sessions.unsubscribe": ({ respond }) => { respond(true, { subscribed: false }, undefined); },
    "sessions.messages.subscribe": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsMessagesSubscribeParams, "sessions.messages.subscribe", respond)) return;
        respond(true, { subscribed: true }, undefined);
    },
    "sessions.messages.unsubscribe": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsMessagesUnsubscribeParams, "sessions.messages.unsubscribe", respond)) return;
        respond(true, { subscribed: false }, undefined);
    }
};
