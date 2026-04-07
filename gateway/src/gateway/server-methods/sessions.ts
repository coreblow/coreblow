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
import { SessionManager } from '../session-manager.js';

// Minimal in-memory tracker for mocked session endpoints
const sessionManager = new SessionManager();

export const sessionsHandlers: GatewayRequestHandlers = {
    "sessions.list": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsListParams, "sessions.list", respond)) return;
        respond(true, { sessions: [], count: sessionManager.getStats().activeSessions }, undefined);
    },
    "sessions.create": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsCreateParams, "sessions.create", respond)) return;
        const id = sessionManager.create("user", "web", "web").id;
        respond(true, { id, sessionKey: id }, undefined);
    },
    "sessions.preview": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsPreviewParams, "sessions.preview", respond)) return;
        respond(true, { ts: Date.now(), previews: [] }, undefined);
    },
    "sessions.resolve": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsResolveParams, "sessions.resolve", respond)) return;
        respond(true, { ok: true, key: "mocked" }, undefined);
    },
    "sessions.patch": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsPatchParams, "sessions.patch", respond)) return;
        respond(true, { ok: true }, undefined);
    },
    "sessions.delete": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsDeleteParams, "sessions.delete", respond)) return;
        respond(true, { ok: true }, undefined);
    },
    "sessions.reset": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsResetParams, "sessions.reset", respond)) return;
        respond(true, { ok: true }, undefined);
    },
    "sessions.compact": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsCompactParams, "sessions.compact", respond)) return;
        respond(true, { compacted: true }, undefined);
    },
    "sessions.abort": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsAbortParams, "sessions.abort", respond)) return;
        respond(true, { aborted: true }, undefined);
    },
    "sessions.send": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsSendParams, "sessions.send", respond)) return;
        // As decided, this is a thin wrapper mockup that just returns "started"
        respond(true, { status: "started", runId: "mock-run-id", messageSeq: 1 }, undefined);
    },
    "sessions.steer": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsSendParams, "sessions.steer", respond)) return;
        respond(true, { status: "started", runId: "mock-run-id", messageSeq: 1 }, undefined);
    },
    "sessions.subscribe": ({ respond }) => {
        respond(true, { subscribed: true }, undefined);
    },
    "sessions.unsubscribe": ({ respond }) => {
        respond(true, { subscribed: false }, undefined);
    },
    "sessions.messages.subscribe": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsMessagesSubscribeParams, "sessions.messages.subscribe", respond)) return;
        respond(true, { subscribed: true }, undefined);
    },
    "sessions.messages.unsubscribe": ({ params, respond }) => {
        if (!assertValidParams(params, validateSessionsMessagesUnsubscribeParams, "sessions.messages.unsubscribe", respond)) return;
        respond(true, { subscribed: false }, undefined);
    }
};
