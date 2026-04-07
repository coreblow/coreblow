/**
 * gateway/server-methods/config.ts — Config RPC Handlers
 * Wired to AgentEngine for real config data.
 */
import { validateConfigGetParams, validateConfigSetParams, ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";
import { getAgentEngine } from "./chat.js";

export const configHandlers: GatewayRequestHandlers = {
    "config.get": ({ params, respond }) => {
        if (!assertValidParams(params, validateConfigGetParams, "config.get", respond)) return;
        try {
            const engine = getAgentEngine();
            const config = engine ? {
                defaultModel: engine.config.defaultModel,
                defaultProvider: engine.config.defaultProvider,
                maxConcurrentSessions: engine.config.maxConcurrentSessions,
                maxTurnsPerRun: engine.config.maxTurnsPerSession,
                maxOutputTokens: engine.config.maxOutputTokens,
                contextWindow: engine.config.maxContextTokens,
                sandboxBaseDir: engine.config.sandboxBaseDir,
                toolApproval: {
                    autoApprove: engine.config.toolApproval.autoApproveTools,
                    requireApproval: engine.config.toolApproval.requireApprovalTools,
                    deny: engine.config.toolApproval.denyTools,
                },
                providers: engine.config.defaultProvider ? [engine.config.defaultProvider] : [],
                activeSessions: engine.listSessions().length,
                registeredTools: engine.getToolCatalog().list().map(t => t.name),
            } : { status: "engine_not_initialized" };
            respond(true, { config }, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },

    "config.set": ({ params, respond }) => {
        if (!assertValidParams(params, validateConfigSetParams, "config.set", respond)) return;
        try {
            const engine = getAgentEngine();
            if (!engine) { respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "Engine not initialized")); return; }
            const p = params as { path?: string; value?: unknown };
            if (p.path === "defaultModel" && typeof p.value === "string") {
                (engine.config as { defaultModel: string }).defaultModel = p.value;
            } else if (p.path === "defaultProvider" && typeof p.value === "string") {
                engine.config.defaultProvider = p.value;
            }
            respond(true, { ok: true, path: p.path }, undefined);
        } catch (err) {
            respond(false, undefined, errorShape(ErrorCodes.INTERNAL_ERROR, String(err)));
        }
    },
};
