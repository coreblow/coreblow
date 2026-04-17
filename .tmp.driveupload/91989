import { ErrorCodes, errorShape, validateExecApprovalsGetParams, validateExecApprovalsSetParams, validateExecApprovalsNodeGetParams, validateExecApprovalsNodeSetParams } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

// Mock bulk approvals for CoreBlow
const globalRules: unknown[] = [];
const nodeRules = new Map<string, any[]>();

export const execApprovalsHandlers: GatewayRequestHandlers = {
    "exec.approvals.get": ({ params, respond }) => {
        if (!validateExecApprovalsGetParams(params)) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Invalid params"));
            return;
        }
        respond(true, { rules: globalRules }, undefined);
    },
    "exec.approvals.set": ({ params, respond }) => {
        if (!validateExecApprovalsSetParams(params)) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Invalid params"));
            return;
        }
        const p = params as any;
        globalRules.splice(0, globalRules.length, ...p.rules);
        respond(true, { ok: true }, undefined);
    },
    "exec.approvals.node.get": ({ params, respond }) => {
        if (!validateExecApprovalsNodeGetParams(params)) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Invalid params"));
            return;
        }
        const p = params as any;
        respond(true, { rules: nodeRules.get(p.nodeId) || [] }, undefined);
    },
    "exec.approvals.node.set": ({ params, respond }) => {
        if (!validateExecApprovalsNodeSetParams(params)) {
            respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Invalid params"));
            return;
        }
        const p = params as any;
        nodeRules.set(p.nodeId, p.rules);
        respond(true, { ok: true }, undefined);
    }
};
