import { validateUpdateCheckParams, validateUpdateApplyParams } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const updateHandlers: GatewayRequestHandlers = {
    "update.check": ({ params, respond }) => {
        if (!assertValidParams(params, validateUpdateCheckParams, "update.check", respond)) return;
        respond(true, { hasUpdate: false }, undefined);
    },
    "update.apply": ({ params, respond }) => {
        if (!assertValidParams(params, validateUpdateApplyParams, "update.apply", respond)) return;
        respond(false, undefined, { code: "unavailable", message: "OTA updates are disabled." });
    }
};
