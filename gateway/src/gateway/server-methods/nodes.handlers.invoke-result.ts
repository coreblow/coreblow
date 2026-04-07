import type { GatewayRequestHandlers } from "./types.js";

export const nodesInvokeResultHandlers: GatewayRequestHandlers = {
    "node.invoke.result": async ({ params, respond }) => {
        respond(true, { ok: true });
    }
};
