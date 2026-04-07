import { validateWebStatusParams } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const webHandlers: GatewayRequestHandlers = {
    "web.status": ({ params, respond }) => {
        if (!assertValidParams(params, validateWebStatusParams, "web.status", respond)) return;
        respond(true, { online: true }, undefined);
    }
};
