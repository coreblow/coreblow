import {
    validateSendParams,
    validatePollParams
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const sendHandlers: GatewayRequestHandlers = {
    "send": ({ params, respond }) => {
        if (!assertValidParams(params, validateSendParams, "send", respond)) return;
        respond(true, { ok: true, channel: "mocked" }, undefined);
    },
    "poll": ({ params, respond }) => {
        if (!assertValidParams(params, validatePollParams, "poll", respond)) return;
        respond(true, { ok: true, channel: "mocked", pollId: "mock-poll-id" }, undefined);
    }
};
