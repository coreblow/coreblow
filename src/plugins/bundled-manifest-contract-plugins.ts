import type { CoreBlowConfig } from "../config/types.coreblow.js";
import {
  resolveBundledPluginCompatibleLoadValues,
  type PluginActivationBundledCompatMode,
} from "./activation-context.js";
import {
  createPluginActivationSource,
  normalizePluginsConfig,
  resolveEffectivePluginActivationState,
} from "./config-state.js";
import { isPluginEnabledByDefaultForPlatform } from "./default-enablement.js";
import { loadManifestContractSnapshot } from "./manifest-contract-eligibility.js";
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
    compatMode: PluginActivationBundledCompatMode;
  }): PluginManifestRecord[] {
    if (params.config?.plugins?.enabled === false) {
      return [];
    }
    let manifestRecords: readonly PluginManifestRecord[] | undefined;
    const loadManifestRecords = (config?: CoreBlowConfig) => {
      manifestRecords ??= loadManifestContractSnapshot({
        config,
        workspaceDir: params.workspaceDir,
        env: params.env,
      }).plugins;
      return manifestRecords;
    };

    const activation = resolveBundledPluginCompatibleLoadValues({
      rawConfig: params.config,
      env: params.env,
      workspaceDir: params.workspaceDir,
      onlyPluginIds: params.onlyPluginIds,
      applyAutoEnable: true,
      compatMode: params.compatMode,
      resolveCompatPluginIds: (compatParams) =>
        this.listIds({
          plugins: loadManifestRecords(compatParams.config),
          contract: params.contract,
          onlyPluginIds: compatParams.onlyPluginIds,
        }),
    });
    const normalizedPlugins = normalizePluginsConfig(activation.config?.plugins);
    const activationSource = createPluginActivationSource({
      config: activation.activationSourceConfig,
    });
    const onlyPluginIdSet = createPluginIdSet(params.onlyPluginIds);
    return loadManifestRecords(activation.config).filter((plugin) => {
      if (
        plugin.origin !== "bundled" ||
        (onlyPluginIdSet && !onlyPluginIdSet.has(plugin.id)) ||
        (plugin.contracts?.[params.contract]?.length ?? 0) === 0
      ) {
        return false;
      }
      return resolveEffectivePluginActivationState({
        id: plugin.id,
        origin: plugin.origin,
        config: normalizedPlugins,
        rootConfig: activation.config,
        enabledByDefault: isPluginEnabledByDefaultForPlatform(plugin),
        activationSource,
      }).enabled;
    });
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
  compatMode: PluginActivationBundledCompatMode;
}): PluginManifestRecord[] {
  return BundledManifestContractPluginResolver.resolveEnabled(params);
}
