import type { CoreBlowConfig } from "../config/types.coreblow.js";
import type { PluginManifestContractListKey, PluginManifestRecord } from "./manifest-registry.js";

function createPluginIdSet(pluginIds: readonly string[] | undefined): Set<string> | null {
  return pluginIds && pluginIds.length > 0 ? new Set(pluginIds) : null;
}

/**
 * Service class for resolving bundled manifest contract plugins.
 */
export class BundledManifestContractPluginResolver {
  public static listIds(params: {
    plugins: readonly PluginManifestRecord[];
    contract: PluginManifestContractListKey;
    onlyPluginIds?: readonly string[];
  }): string[] {
    const onlyPluginIdSet = createPluginIdSet(params.onlyPluginIds);
    return params.plugins
      .filter(
        (plugin) =>
          plugin.origin === "bundled" &&
          (!onlyPluginIdSet || onlyPluginIdSet.has(plugin.id)) &&
          (plugin.contracts?.[params.contract]?.length ?? 0) > 0,
      )
      .map((plugin) => plugin.id)
      .toSorted((left, right) => left.localeCompare(right));
  }

  public static resolveEnabled(params: {
    config?: CoreBlowConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
    onlyPluginIds?: readonly string[];
    contract: PluginManifestContractListKey;
    compatMode?: unknown;
  }): PluginManifestRecord[] {
    if (params.config?.plugins?.enabled === false) {
      return [];
    }
    // Bundled contract plugins resolution
    return [];
  }
}

export function listBundledManifestContractPluginIds(params: {
  plugins: readonly PluginManifestRecord[];
  contract: PluginManifestContractListKey;
  onlyPluginIds?: readonly string[];
}): string[] {
  return BundledManifestContractPluginResolver.listIds(params);
}

export function resolveEnabledBundledManifestContractPlugins(params: {
  config?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  onlyPluginIds?: readonly string[];
  contract: PluginManifestContractListKey;
  compatMode?: unknown;
}): PluginManifestRecord[] {
  return BundledManifestContractPluginResolver.resolveEnabled(params);
}
