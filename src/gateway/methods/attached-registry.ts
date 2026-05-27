import type { PluginRegistry } from "../../plugins/registry.js";
import { ADMIN_SCOPE } from "../method-scopes.js";
import type { GatewayRequestHandlers } from "../server-methods/types.js";
import {
  createCoreGatewayMethodDescriptors,
  createGatewayMethodDescriptorsFromHandlers,
  createGatewayMethodRegistry,
  createPluginGatewayMethodDescriptors,
  isCoreGatewayMethodClassified,
  type GatewayMethodRegistry,
} from "./registry.js";

export type AttachedGatewayMethodRegistrySnapshot = {
  methodRegistry: GatewayMethodRegistry;
  gatewayMethods: string[];
};

export function createAttachedGatewayMethodRegistrySnapshot(params: {
  coreGatewayHandlers: GatewayRequestHandlers;
  pluginRegistry: PluginRegistry;
  extraHandlers: GatewayRequestHandlers;
  channelMethods?: readonly string[];
}): AttachedGatewayMethodRegistrySnapshot {
  const coreDescriptorHandlers = { ...params.coreGatewayHandlers };
  const auxHandlers: GatewayRequestHandlers = {};
  for (const [method, handler] of Object.entries(params.extraHandlers)) {
    if (params.pluginRegistry.gatewayHandlers[method]) {
      continue;
    }
    if (isCoreGatewayMethodClassified(method)) {
      coreDescriptorHandlers[method] = handler;
    } else {
      auxHandlers[method] = handler;
    }
  }
  const methodRegistry = createGatewayMethodRegistry([
    ...createCoreGatewayMethodDescriptors(coreDescriptorHandlers),
    ...createPluginGatewayMethodDescriptors(params.pluginRegistry),
    ...createGatewayMethodDescriptorsFromHandlers({
      handlers: auxHandlers,
      owner: { kind: "aux", area: "gateway-extra" },
      defaultScope: ADMIN_SCOPE,
    }),
  ]);
  return {
    methodRegistry,
    gatewayMethods: Array.from(
      new Set([...methodRegistry.listAdvertisedMethods(), ...(params.channelMethods ?? [])]),
    ),
  };
}
