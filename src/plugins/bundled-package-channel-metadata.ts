import { listChannelCatalogEntries } from "./channel-catalog-registry.js";
import type { PluginPackageChannel } from "./manifest.js";

/**
 * Service class for resolving bundled package channel metadata.
 */
export class BundledPackageChannelMetadataResolver {
  public static list(): readonly PluginPackageChannel[] {
    return listChannelCatalogEntries({ origin: "bundled" }).map((entry) => entry.channel);
  }

  public static find(channelId: string): PluginPackageChannel | undefined {
    return BundledPackageChannelMetadataResolver.list().find(
      (channel) => channel.id === channelId || channel.aliases?.includes(channelId),
    );
  }
}

export function listBundledPackageChannelMetadata(): readonly PluginPackageChannel[] {
  return BundledPackageChannelMetadataResolver.list();
}

export function findBundledPackageChannelMetadata(
  channelId: string,
): PluginPackageChannel | undefined {
  return BundledPackageChannelMetadataResolver.find(channelId);
}
