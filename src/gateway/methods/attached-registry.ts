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

export type AttachedGatewayMethodRegistryRuntime = {
  extraHandlers: GatewayRequestHandlers;
  gatewayMethods: string[];
  getMethodRegistry: () => GatewayMethodRegistry;
  replacePluginRegistry: (
    pluginRegistry: PluginRegistry,
    params?: { channelMethods?: readonly string[] },
  ) => void;
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

export function createAttachedGatewayMethodRegistryRuntime(params: {
  coreGatewayHandlers: GatewayRequestHandlers;
  pluginRegistry: PluginRegistry;
  extraHandlers: GatewayRequestHandlers;
  channelMethods?: readonly string[];
}): AttachedGatewayMethodRegistryRuntime {
  let pluginRegistry = params.pluginRegistry;
  let channelMethods = params.channelMethods ?? [];
  let pluginGatewayHandlerKeys = new Set(Object.keys(pluginRegistry.gatewayHandlers));
  const extraHandlers: GatewayRequestHandlers = {
    ...pluginRegistry.gatewayHandlers,
    ...params.extraHandlers,
  };
  let snapshot = createAttachedGatewayMethodRegistrySnapshot({
    coreGatewayHandlers: params.coreGatewayHandlers,
    pluginRegistry,
    extraHandlers,
    channelMethods,
  });
  const gatewayMethods = [...snapshot.gatewayMethods];

  const rebuildSnapshot = () => {
    snapshot = createAttachedGatewayMethodRegistrySnapshot({
      coreGatewayHandlers: params.coreGatewayHandlers,
      pluginRegistry,
      extraHandlers,
      channelMethods,
    });
    gatewayMethods.splice(0, gatewayMethods.length, ...snapshot.gatewayMethods);
  };

  return {
    extraHandlers,
    gatewayMethods,
    getMethodRegistry: () => snapshot.methodRegistry,
    replacePluginRegistry(nextPluginRegistry, nextParams) {
      for (const key of pluginGatewayHandlerKeys) {
        delete extraHandlers[key];
      }
      pluginRegistry = nextPluginRegistry;
      Object.assign(extraHandlers, pluginRegistry.gatewayHandlers);
      pluginGatewayHandlerKeys = new Set(Object.keys(pluginRegistry.gatewayHandlers));
      channelMethods = nextParams?.channelMethods ?? channelMethods;
      rebuildSnapshot();
    },
  };
}
