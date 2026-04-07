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

// Mocking agent filesystem and registry
let mockAgents = [{ id: "builtin_agent", name: "Builtin Agent", workspace: "/tmp/builtin" }];

export const agentsHandlers: GatewayRequestHandlers = {
    "agents.list": ({ params, respond }) => {
        if (!assertValidParams(params, validateAgentsListParams, "agents.list", respond)) return;
        respond(true, mockAgents, undefined);
    },
    "agents.create": ({ params, respond }) => {
        if (!assertValidParams(params, validateAgentsCreateParams, "agents.create", respond)) return;
        const p = params as { name: string; workspace?: string };
        const agentId = p.name.toLowerCase().replace(/\\s+/g, '_');
        const newAgent = { id: agentId, name: p.name, workspace: p.workspace || '/tmp/' + agentId };
        mockAgents.push(newAgent);
        respond(true, { ok: true, agentId, name: p.name, workspace: newAgent.workspace }, undefined);
    },
    "agents.update": ({ params, respond }) => {
        if (!assertValidParams(params, validateAgentsUpdateParams, "agents.update", respond)) return;
        const p = params as { agentId: string; name?: string };
        const agent = mockAgents.find(a => a.id === p.agentId);
        if (agent && p.name) agent.name = p.name;
        respond(true, { ok: true, agentId: p.agentId }, undefined);
    },
    "agents.delete": ({ params, respond }) => {
        if (!assertValidParams(params, validateAgentsDeleteParams, "agents.delete", respond)) return;
        const p = params as { agentId: string };
        mockAgents = mockAgents.filter(a => a.id !== p.agentId);
        respond(true, { ok: true, agentId: p.agentId, removedBindings: [] }, undefined);
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
