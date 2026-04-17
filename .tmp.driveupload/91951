import type { GatewayRequestHandlers } from "./types.js";
import { drainNodePendingWork, enqueueNodePendingWork } from "../node-pending-work.js";

export const nodesPendingHandlers: GatewayRequestHandlers = {
    "node.pending.drain": async ({ params, respond, client }) => {
        const p = params as any;
        const nodeId = client?.connect?.device?.id || "mock-node";
        const drained = drainNodePendingWork(nodeId, { maxItems: p.maxItems });
        respond(true, { nodeId, ...drained });
    },
    "node.pending.enqueue": async ({ params, respond }) => {
        const p = params as any;
        const queued = enqueueNodePendingWork({ nodeId: p.nodeId, type: p.type, priority: p.priority, expiresInMs: p.expiresInMs });
        respond(true, { nodeId: p.nodeId, revision: queued.revision, queued: queued.item, wakeTriggered: false });
    }
};
