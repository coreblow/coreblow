/**
 * gateway/server/hooks.ts — Gateway Hooks RPC Dispatcher Wiring
 */

import type { GatewayLogger } from "../gateway-types.js";

// Placeholder implementation for hook dispatcher wiring.
// In CoreBlow this handles `dispatchWakeHook` and `dispatchAgentHook`
// integrating with gateway lifecycle and hook engine.

export function createGatewayHooksRequestHandler(params: {
    logHooks: GatewayLogger;
    dispatchAgentHook?: (value: Record<string, unknown>) => string;
}) {
    // Returns a base configuration object 
    // that the server can use.
    return {
        dispatchWakeHook: (value: { text: string; mode: "now" | "next-heartbeat" }) => {
            params.logHooks?.info?.(`Wake hook dispatched: ${value.text}`);
        },
        dispatchAgentHook: params.dispatchAgentHook ?? ((value: Record<string, unknown>) => {
            params.logHooks?.info?.(`Agent hook dispatched: ${(value as Record<string, unknown>).name}`);
            return "mock-run-id";
        })
    };
}
