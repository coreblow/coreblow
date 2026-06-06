import type { PluginPackageChannel } from "../plugins/manifest.js";
import { listChannelPluginCatalogEntries } from "./plugins/catalog.js";

export type BundledChannelCatalogEntry = {
  id: string;
  channel: PluginPackageChannel;
  aliases: readonly string[];
  order: number;
};

export function listBundledChannelCatalogEntries(): BundledChannelCatalogEntry[] {
  return listChannelPluginCatalogEntries()
    .map((entry): BundledChannelCatalogEntry => ({
      id: entry.id,
      channel: {
        id: entry.id,
        label: entry.meta.label,
        selectionLabel: entry.meta.selectionLabel,
        detailLabel: entry.meta.detailLabel,
        docsPath: entry.meta.docsPath,
        docsLabel: entry.meta.docsLabel,
        blurb: entry.meta.blurb,
        systemImage: entry.meta.systemImage,
        selectionDocsPrefix: entry.meta.selectionDocsPrefix,
        selectionDocsOmitLabel: entry.meta.selectionDocsOmitLabel,
        selectionExtras: entry.meta.selectionExtras,
      },
      aliases: [],
      order: Number.MAX_SAFE_INTEGER,
    }))
    .toSorted((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}
