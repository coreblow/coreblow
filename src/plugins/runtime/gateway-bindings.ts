import { resolveGlobalSingleton } from "../../shared/global-singleton.js";
import type { PluginRuntime } from "./types.js";

const GATEWAY_SUBAGENT_SYMBOL: unique symbol = Symbol.for(
  "coreblow.plugin.gatewaySubagentRuntime",
) as unknown as typeof GATEWAY_SUBAGENT_SYMBOL;

type GatewaySubagentState = {
  subagent: PluginRuntime["subagent"] | undefined;
  nodes: PluginRuntime["nodes"] | undefined;
};

export const gatewaySubagentState = resolveGlobalSingleton<GatewaySubagentState>(
  GATEWAY_SUBAGENT_SYMBOL,
  () => ({
    subagent: undefined,
    nodes: undefined,
  }),
);

/**
 * Enterprise service governing gateway subagent and nodes runtime bindings.
 */
export class GatewayBindingsService {
  public static setSubagent(subagent: PluginRuntime["subagent"]): void {
    gatewaySubagentState.subagent = subagent;
  }

  public static setNodes(nodes: PluginRuntime["nodes"]): void {
    gatewaySubagentState.nodes = nodes;
  }

  public static clear(): void {
    gatewaySubagentState.subagent = undefined;
    gatewaySubagentState.nodes = undefined;
  }
}

/**
 * Set the process-global gateway subagent runtime.
 * Called during gateway startup so that gateway-bindable plugin runtimes can
 * resolve subagent methods dynamically even when their registry was cached
 * before the gateway finished loading plugins.
 */
export function setGatewaySubagentRuntime(subagent: PluginRuntime["subagent"]): void {
  GatewayBindingsService.setSubagent(subagent);
}

export function setGatewayNodesRuntime(nodes: PluginRuntime["nodes"]): void {
  GatewayBindingsService.setNodes(nodes);
}

/**
 * Reset the process-global gateway subagent runtime.
 * Used by tests to avoid leaking gateway state across module reloads.
 */
export function clearGatewaySubagentRuntime(): void {
  GatewayBindingsService.clear();
}
