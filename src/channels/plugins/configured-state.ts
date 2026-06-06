import type { CoreBlowConfig } from "../../config/config.js";
import {
  hasBundledChannelPackageState,
  listBundledChannelIdsForPackageState,
  type ChannelPackageStateCatalogEntry,
} from "./package-state-probes.js";

export function listBundledChannelIdsWithConfiguredState(
  catalogEntries?: readonly ChannelPackageStateCatalogEntry[],
): string[] {
  return listBundledChannelIdsForPackageState("configuredState", catalogEntries);
}

export function hasBundledChannelConfiguredState(params: {
  channelId: string;
  cfg: CoreBlowConfig;
  env?: NodeJS.ProcessEnv;
  catalogEntries?: readonly ChannelPackageStateCatalogEntry[];
}): boolean {
  return hasBundledChannelPackageState({
    metadataKey: "configuredState",
    channelId: params.channelId,
    cfg: params.cfg,
    env: params.env,
    catalogEntries: params.catalogEntries,
  });
}
