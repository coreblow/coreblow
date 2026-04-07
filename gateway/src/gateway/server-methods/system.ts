import {
    validateSetHeartbeatsParams,
    validateSystemEventParams
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const systemHandlers: GatewayRequestHandlers = {
    "gateway.identity.get": ({ respond }) => {
        respond(true, { deviceId: "coreblow_dev_node", publicKey: "mocked_key" }, undefined);
    },
    "last-heartbeat": ({ respond }) => {
        respond(true, { ts: Date.now() }, undefined);
    },
    "set-heartbeats": ({ params, respond }) => {
        if (!assertValidParams(params, validateSetHeartbeatsParams, "set-heartbeats", respond)) return;
        const p = params as { enabled: boolean };
        respond(true, { ok: true, enabled: p.enabled }, undefined);
    },
    "system-presence": ({ respond }) => {
        respond(true, { nodes: [] }, undefined);
    },
    "system-event": ({ params, respond }) => {
        if (!assertValidParams(params, validateSystemEventParams, "system-event", respond)) return;
        respond(true, { ok: true }, undefined);
    }
};
