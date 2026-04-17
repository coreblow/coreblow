/**
 * gateway/server-methods/models.ts — Model RPC Handlers
 */

import { validateModelsListParams, validateModelsCatalogParams, ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";
import { getAgentEngine } from "./chat.js";

export type ModelCatalogRpcEntry = {
    id: string;
    name: string;
    provider: string;
    contextWindow?: number;
    reasoning?: boolean;
    input?: string[];
};

function buildModelEntries(): ModelCatalogRpcEntry[] {
    const engine = getAgentEngine();
    if (!engine) return [];
    const catalog = engine.getModelCatalog();
    return catalog.list().map(entry => ({
        id: entry.id,
        name: entry.displayName,
        provider: entry.provider,
        contextWindow: entry.contextWindow,
        reasoning: entry.supportsThinking ?? false,
        input: ['text', ...(entry.supportsVision ? ['image'] : [])],
    }));
}

export const modelHandlers: GatewayRequestHandlers = {
    "models.list": ({ params, respond }) => {
        if (!assertValidParams(params, validateModelsListParams, "models.list", respond)) return;
        try {
            const models = buildModelEntries();
            respond(true, { models }, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },

    "models.catalog": ({ params, respond }) => {
        if (!assertValidParams(params, validateModelsCatalogParams, "models.catalog", respond)) return;
        try {
            const models = buildModelEntries();
            respond(true, { catalog: models }, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },
};
