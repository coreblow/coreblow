/**
 * gateway/server-methods/models.ts — Model RPC Handlers
 */

import { validateModelsListParams, validateModelsCatalogParams, ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";

export const modelHandlers: GatewayRequestHandlers = {
    "models.list": ({ params, respond }) => {
        if (!assertValidParams(params, validateModelsListParams, "models.list", respond)) return;

        try {
            respond(true, { models: [] }, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },

    "models.catalog": ({ params, respond }) => {
        if (!assertValidParams(params, validateModelsCatalogParams, "models.catalog", respond)) return;

        try {
            respond(true, { catalog: [] }, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },
};
