import { ErrorCodes, errorShape, validateToolsEffectiveParams } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

export const toolsEffectiveHandlers: GatewayRequestHandlers = {
    "tools.effective": ({ params, respond }) => {
        if (!validateToolsEffectiveParams(params)) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "invalid params"));
            return;
        }

        // Mock response for effective tools for a session
        respond(true, {
            inventory: [
                { id: "read_file", enabled: true },
                { id: "write_file", enabled: true }
            ]
        }, undefined);
    }
};
