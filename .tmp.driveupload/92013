import { validateLogsTailParams } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const logsHandlers: GatewayRequestHandlers = {
    "logs.tail": ({ params, respond }) => {
        if (!assertValidParams(params, validateLogsTailParams, "logs.tail", respond)) return;
        respond(true, { file: "mock-log.log", lines: ["Mock log stream start"], cursor: 100, reset: false, truncated: false }, undefined);
    }
};
