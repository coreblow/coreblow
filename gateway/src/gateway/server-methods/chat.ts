import {
    validateChatSendParams,
    validateChatAbortParams,
    validateChatHistoryParams,
    validateChatInjectParams
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";
import { sanitizeChatSendMessageInput } from "./chat-sanitize.js";

export const chatHandlers: GatewayRequestHandlers = {
    "chat.send": ({ params, respond }) => {
        if (!assertValidParams(params, validateChatSendParams, "chat.send", respond)) return;
        const p = params as { sessionKey: string; message: string };
        const sanitation = sanitizeChatSendMessageInput(p.message);
        if (!sanitation.ok) {
            respond(false, undefined, { code: "invalid_request", message: sanitation.error! });
            return;
        }
        // As per Q1, this is a thin wrapper mockup that just returns "started"
        respond(true, { status: "started", runId: "mock-run-id", messageSeq: 1 }, undefined);
    },
    "chat.abort": ({ params, respond }) => {
        if (!assertValidParams(params, validateChatAbortParams, "chat.abort", respond)) return;
        respond(true, { aborted: true }, undefined);
    },
    "chat.history": ({ params, respond }) => {
        if (!assertValidParams(params, validateChatHistoryParams, "chat.history", respond)) return;
        // Mocking an empty transcript for now
        respond(true, { messages: [] }, undefined);
    },
    "chat.inject": ({ params, respond }) => {
        if (!assertValidParams(params, validateChatInjectParams, "chat.inject", respond)) return;
        respond(true, { ok: true }, undefined);
    }
};
