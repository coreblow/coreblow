import { getBundledChannelPlugin } from "../../bundled.js";
import { listBundledChannelPluginIds as listCatalogBundledChannelPluginIds } from "../../bundled-ids.js";
import type { ChannelId, ChannelPlugin } from "../../types.js";

export function listBundledChannelPluginIds(): readonly ChannelId[] {
  return listCatalogBundledChannelPluginIds() as ChannelId[];
}

export async function getBundledChannelPluginAsync(
  id: ChannelId,
): Promise<ChannelPlugin | undefined> {
  return getBundledChannelPlugin(id);
}
