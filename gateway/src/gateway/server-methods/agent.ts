import {
    validateAgentsListParams,
    validateAgentsCreateParams,
    validateAgentsUpdateParams,
    validateAgentsDeleteParams,
    validateAgentsFilesListParams,
    validateAgentsFilesGetParams,
    validateAgentsFilesSetParams
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";
import { assertValidParams } from "./validation.js";
import { getAgentEngine } from "./chat.js";

export const agentsHandlers: GatewayRequestHandlers = {
    "agents.list": ({ params, respond }) => {
        if (!assertValidParams(params, validateAgentsListParams, "agents.list", respond)) return;
        const engine = getAgentEngine();
        if (!engine) { respond(true, [], undefined); return; }
        const sessions = engine.listSessions().map(s => ({
            id: s.id, name: `Agent (${s.model})`, model: s.model,
            state: s.state, turnCount: s.turnCount, totalTokens: s.totalTokens,
        }));
        respond(true, sessions, undefined);
    },

    "agents.create": ({ params, respond }) => {
        if (!assertValidParams(params, validateAgentsCreateParams, "agents.create", respond)) return;
        const engine = getAgentEngine();
        if (!engine) { respond(false, undefined, { code: "unavailable", message: "Engine not initialized" }); return; }
        const p = params as { name: string; workspace?: string; model?: string; systemPrompt?: string };
        const sessionId = engine.createSession({
            model: p.model,
            systemPrompt: p.systemPrompt,
            sandboxDir: p.workspace,
        });
        respond(true, { ok: true, agentId: sessionId, name: p.name, model: engine.getSession(sessionId)?.model }, undefined);
    },

    "agents.update": ({ params, respond }) => {
        if (!assertValidParams(params, validateAgentsUpdateParams, "agents.update", respond)) return;
        const p = params as { agentId: string; name?: string };
        respond(true, { ok: true, agentId: p.agentId }, undefined);
    },

    "agents.delete": ({ params, respond }) => {
        if (!assertValidParams(params, validateAgentsDeleteParams, "agents.delete", respond)) return;
        const engine = getAgentEngine();
        const p = params as { agentId: string };
        const destroyed = engine?.destroySession(p.agentId) ?? false;
        respond(true, { ok: destroyed, agentId: p.agentId }, undefined);
    },

    "agents.files.list": ({ params, respond }) => {
        if (!assertValidParams(params, validateAgentsFilesListParams, "agents.files.list", respond)) return;
        const p = params as { agentId: string };
        respond(true, { agentId: p.agentId, workspace: "/tmp", files: [] }, undefined);
    },

    "agents.files.get": ({ params, respond }) => {
        if (!assertValidParams(params, validateAgentsFilesGetParams, "agents.files.get", respond)) return;
        const p = params as { agentId: string; name: string };
        respond(true, { agentId: p.agentId, file: { name: p.name, missing: true } }, undefined);
    },

    "agents.files.set": ({ params, respond }) => {
        if (!assertValidParams(params, validateAgentsFilesSetParams, "agents.files.set", respond)) return;
        const p = params as { agentId: string; name: string; content: string };
        respond(true, { agentId: p.agentId, file: { name: p.name } }, undefined);
    }
};
