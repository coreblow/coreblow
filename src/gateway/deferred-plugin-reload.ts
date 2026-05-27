import { listChannelPlugins } from "../channels/plugins/index.js";
import type { loadConfig } from "../config/config.js";
import type { PluginRegistry } from "../plugins/registry.js";
import {
  pinActivePluginChannelRegistry,
  pinActivePluginHttpRouteRegistry,
} from "../plugins/runtime.js";
import type { AttachedGatewayMethodRegistryRuntime } from "./methods/attached-registry.js";
import {
  reloadDeferredGatewayPlugins,
  type GatewayPluginBootstrapLog,
} from "./server-plugin-bootstrap.js";
import type { GatewayRequestHandler } from "./server-methods/types.js";

type ReloadDeferredGatewayPluginsFn = typeof reloadDeferredGatewayPlugins;

export function refreshDeferredGatewayPluginRuntime(params: {
  cfg: ReturnType<typeof loadConfig>;
  workspaceDir: string;
  log: GatewayPluginBootstrapLog;
  coreGatewayHandlers: Record<string, GatewayRequestHandler>;
  baseMethods: string[];
  attachedGatewayMethodRuntime: Pick<
    AttachedGatewayMethodRegistryRuntime,
    "replacePluginRegistry"
  >;
  reload?: ReloadDeferredGatewayPluginsFn;
  listChannelGatewayMethods?: () => string[];
  pinHttpRegistry?: (pluginRegistry: PluginRegistry) => void;
  pinChannelRegistry?: (pluginRegistry: PluginRegistry) => void;
}) {
  const reload = params.reload ?? reloadDeferredGatewayPlugins;
  const loaded = reload({
    cfg: params.cfg,
    workspaceDir: params.workspaceDir,
    log: params.log,
    coreGatewayHandlers: params.coreGatewayHandlers,
    baseMethods: params.baseMethods,
    logDiagnostics: false,
  });
  const channelMethods =
    params.listChannelGatewayMethods?.() ??
    listChannelPlugins().flatMap((plugin) => plugin.gatewayMethods ?? []);
  params.attachedGatewayMethodRuntime.replacePluginRegistry(loaded.pluginRegistry, {
    channelMethods,
  });
  (params.pinHttpRegistry ?? pinActivePluginHttpRouteRegistry)(loaded.pluginRegistry);
  (params.pinChannelRegistry ?? pinActivePluginChannelRegistry)(loaded.pluginRegistry);
  return loaded;
}
