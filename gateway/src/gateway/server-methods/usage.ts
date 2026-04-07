import { validateUsageSessionsParams } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const usageHandlers: GatewayRequestHandlers = {
    "usage.sessions": ({ params, respond }) => {
        if (!assertValidParams(params, validateUsageSessionsParams, "usage.sessions", respond)) return;
        respond(true, { total: 0, active: 0, time_series: [] }, undefined);
    }
};
