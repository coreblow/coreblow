import type { PluginLoadOptions } from "./loader.js";
import type { PluginWebFetchProviderEntry } from "./types.js";

function compareWebFetchProvidersAlphabetically(
  left: Pick<PluginWebFetchProviderEntry, "id" | "pluginId">,
  right: Pick<PluginWebFetchProviderEntry, "id" | "pluginId">,
): number {
  return left.id.localeCompare(right.id) || left.pluginId.localeCompare(right.pluginId);
}

/**
 * Service class for sorting and resolving web fetch providers.
 */
export class WebFetchProviderSorter {
  public static sort(
    providers: PluginWebFetchProviderEntry[],
  ): PluginWebFetchProviderEntry[] {
    return providers.toSorted(compareWebFetchProvidersAlphabetically);
  }

  public static sortForAutoDetect(
    providers: PluginWebFetchProviderEntry[],
  ): PluginWebFetchProviderEntry[] {
    return providers.toSorted((left, right) => {
      const leftOrder = left.autoDetectOrder ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = right.autoDetectOrder ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }
      return compareWebFetchProvidersAlphabetically(left, right);
    });
  }

  public static resolveResolutionConfig(params: {
    config?: PluginLoadOptions["config"];
    workspaceDir?: string;
    env?: PluginLoadOptions["env"];
    bundledAllowlistCompat?: boolean;
  }): {
    config: PluginLoadOptions["config"];
    activationSourceConfig?: PluginLoadOptions["config"];
    autoEnabledReasons: Record<string, string[]>;
  } {
    return {
      config: params.config,
      activationSourceConfig: params.config,
      autoEnabledReasons: {},
    };
  }
}

export function sortWebFetchProviders(
  providers: PluginWebFetchProviderEntry[],
): PluginWebFetchProviderEntry[] {
  return WebFetchProviderSorter.sort(providers);
}

export function sortWebFetchProvidersForAutoDetect(
  providers: PluginWebFetchProviderEntry[],
): PluginWebFetchProviderEntry[] {
  return WebFetchProviderSorter.sortForAutoDetect(providers);
}

export function resolveBundledWebFetchResolutionConfig(params: {
  config?: PluginLoadOptions["config"];
  workspaceDir?: string;
  env?: PluginLoadOptions["env"];
  bundledAllowlistCompat?: boolean;
}): {
  config: PluginLoadOptions["config"];
  activationSourceConfig?: PluginLoadOptions["config"];
  autoEnabledReasons: Record<string, string[]>;
} {
  return WebFetchProviderSorter.resolveResolutionConfig(params);
}
