import { validatePushRegisterParams, validatePushUnregisterParams } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const pushHandlers: GatewayRequestHandlers = {
    "push.register": ({ params, respond }) => {
        if (!assertValidParams(params, validatePushRegisterParams, "push.register", respond)) return;
        respond(false, undefined, { code: "unavailable", message: "Push is disabled." });
    },
    "push.unregister": ({ params, respond }) => {
        if (!assertValidParams(params, validatePushUnregisterParams, "push.unregister", respond)) return;
        respond(true, { ok: true }, undefined);
    }
};
