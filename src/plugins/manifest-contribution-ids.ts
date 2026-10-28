import {
  listPluginContributionIds,
  loadPluginRegistrySnapshot,
  type LoadPluginRegistryParams,
  type PluginRegistryContributionKey,
  type PluginRegistrySnapshot,
} from "./plugin-registry.js";

export type ListManifestContributionIdsParams = LoadPluginRegistryParams & {
  contribution: PluginRegistryContributionKey;
  index?: PluginRegistrySnapshot;
  includeDisabled?: boolean;
};

/**
 * Service providing typed lookups for manifest contribution ids.
 */
export class ManifestContributionIdsResolver {
  public static list(params: ListManifestContributionIdsParams): readonly string[] {
    const env = params.env ?? process.env;
    const index =
      params.index ??
      loadPluginRegistrySnapshot({
        config: params.config,
        workspaceDir: params.workspaceDir,
        env,
        candidates: params.candidates,
        preferPersisted: params.preferPersisted,
      });
    return listPluginContributionIds({
      index,
      contribution: params.contribution,
      config: params.config,
      workspaceDir: params.workspaceDir,
      env,
      includeDisabled: params.includeDisabled,
    });
  }

  public static listChannels(
    params: Omit<ListManifestContributionIdsParams, "contribution"> = {},
  ): readonly string[] {
    return this.list({
      ...params,
      contribution: "channels",
    });
  }

  public static listProviders(
    params: Omit<ListManifestContributionIdsParams, "contribution"> = {},
  ): readonly string[] {
    return this.list({
      ...params,
      contribution: "providers",
    });
  }
}

export function listManifestContributionIds(
  params: ListManifestContributionIdsParams,
): readonly string[] {
  return ManifestContributionIdsResolver.list(params);
}

export function listManifestChannelContributionIds(
  params: Omit<ListManifestContributionIdsParams, "contribution"> = {},
): readonly string[] {
  return ManifestContributionIdsResolver.listChannels(params);
}

export function listManifestProviderContributionIds(
  params: Omit<ListManifestContributionIdsParams, "contribution"> = {},
): readonly string[] {
  return ManifestContributionIdsResolver.listProviders(params);
}
