/**
 * gateway/server-methods/config.ts — Config RPC Handlers
 */

import { validateConfigGetParams, validateConfigSetParams, ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

// Mock implementation to satisfy interface parity. 
// A real implementation would wire into `config-loader.ts` and `config-exporter.ts`

export const configHandlers: GatewayRequestHandlers = {
    "config.get": ({ params, respond }) => {
        if (!assertValidParams(params, validateConfigGetParams, "config.get", respond)) return;
        
        try {
            respond(true, { config: { mock: true } }, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },

    "config.set": ({ params, respond }) => {
        if (!assertValidParams(params, validateConfigSetParams, "config.set", respond)) return;

        try {
            // Write to config logic goes here
            respond(true, { ok: true }, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },
};
