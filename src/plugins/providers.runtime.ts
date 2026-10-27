import { applyPluginAutoEnable } from "../config/plugin-auto-enable.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  withBundledPluginAllowlistCompat,
  withBundledPluginEnablementCompat,
} from "./bundled-compat.js";
import { loadCoreBlowPlugins, type PluginLoadOptions } from "./loader.js";
import { createPluginLoaderLogger } from "./logger.js";
import {
  resolveEnabledProviderPluginIds,
  resolveBundledProviderCompatPluginIds,
  withBundledProviderVitestCompat,
} from "./providers.js";
import type { ProviderPlugin } from "./types.js";

const log = createSubsystemLogger("plugins");

export type ResolvePluginProvidersParams = {
  config?: PluginLoadOptions["config"];
  workspaceDir?: string;
  /** Use an explicit env when plugin roots should resolve independently from process.env. */
  env?: PluginLoadOptions["env"];
  bundledProviderAllowlistCompat?: boolean;
  bundledProviderVitestCompat?: boolean;
  onlyPluginIds?: string[];
  providerRefs?: readonly string[];
  modelRefs?: readonly string[];
  activate?: boolean;
  cache?: boolean;
  applyAutoEnable?: boolean;
  pluginSdkResolution?: PluginLoadOptions["pluginSdkResolution"];
  mode?: "runtime" | "setup";
  includeUntrustedWorkspacePlugins?: boolean;
};

export function isPluginProvidersLoadInFlight(
  _params: ResolvePluginProvidersParams,
): boolean {
  return false;
}

export function resolvePluginProviders(params: ResolvePluginProvidersParams): ProviderPlugin[] {
  const env = params.env ?? process.env;
  const autoEnabledConfig =
    params.config !== undefined
      ? applyPluginAutoEnable({
          config: params.config,
          env,
        }).config
      : undefined;
  const bundledProviderCompatPluginIds =
    params.bundledProviderAllowlistCompat || params.bundledProviderVitestCompat
      ? resolveBundledProviderCompatPluginIds({
          config: autoEnabledConfig,
          workspaceDir: params.workspaceDir,
          env,
          onlyPluginIds: params.onlyPluginIds,
        })
      : [];
  const maybeAllowlistCompat = params.bundledProviderAllowlistCompat
    ? withBundledPluginAllowlistCompat({
        config: autoEnabledConfig,
        pluginIds: bundledProviderCompatPluginIds,
      })
    : autoEnabledConfig;
  const allowlistCompatConfig = params.bundledProviderAllowlistCompat
    ? withBundledPluginEnablementCompat({
        config: maybeAllowlistCompat,
        pluginIds: bundledProviderCompatPluginIds,
      })
    : maybeAllowlistCompat;
  const config = params.bundledProviderVitestCompat
    ? withBundledProviderVitestCompat({
        config: allowlistCompatConfig,
        pluginIds: bundledProviderCompatPluginIds,
        env,
      })
    : allowlistCompatConfig;
  const providerPluginIds = resolveEnabledProviderPluginIds({
    config,
    workspaceDir: params.workspaceDir,
    env,
    onlyPluginIds: params.onlyPluginIds,
  });
  const registry = loadCoreBlowPlugins({
    config,
    workspaceDir: params.workspaceDir,
    env,
    onlyPluginIds: providerPluginIds,
    pluginSdkResolution: params.pluginSdkResolution,
    cache: params.cache ?? false,
    activate: params.activate ?? false,
    logger: createPluginLoaderLogger(log),
  });

  return registry.providers.map((entry) => ({
    ...entry.provider,
    pluginId: entry.pluginId,
  }));
}
