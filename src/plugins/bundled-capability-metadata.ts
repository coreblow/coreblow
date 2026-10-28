import {
  BUNDLED_AUTO_ENABLE_PROVIDER_PLUGIN_IDS,
  BUNDLED_LEGACY_PLUGIN_ID_ALIASES,
  BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS,
  type BundledPluginContractSnapshot,
} from "./contracts/inventory/bundled-capability-metadata.js";

export {
  BUNDLED_AUTO_ENABLE_PROVIDER_PLUGIN_IDS,
  BUNDLED_LEGACY_PLUGIN_ID_ALIASES,
  BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS,
  type BundledPluginContractSnapshot,
};

function collectPluginIds(
  pick: (entry: BundledPluginContractSnapshot) => readonly string[],
): readonly string[] {
  return BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS.filter((entry) => pick(entry).length > 0)
    .map((entry) => entry.pluginId)
    .toSorted((left, right) => left.localeCompare(right));
}

export const BUNDLED_PROVIDER_PLUGIN_IDS = collectPluginIds((entry) => entry.providerIds);

export const BUNDLED_SPEECH_PLUGIN_IDS = collectPluginIds((entry) => entry.speechProviderIds);

export const BUNDLED_MEDIA_UNDERSTANDING_PLUGIN_IDS = collectPluginIds(
  (entry) => entry.mediaUnderstandingProviderIds,
);

export const BUNDLED_IMAGE_GENERATION_PLUGIN_IDS = collectPluginIds(
  (entry) => entry.imageGenerationProviderIds,
);

export const BUNDLED_VIDEO_GENERATION_PLUGIN_IDS = collectPluginIds(
  (entry) => entry.videoGenerationProviderIds,
);

export const BUNDLED_MUSIC_GENERATION_PLUGIN_IDS = collectPluginIds(
  (entry) => entry.musicGenerationProviderIds,
);

export const BUNDLED_RUNTIME_CONTRACT_PLUGIN_IDS = [
  ...new Set(
    BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS.filter(
      (entry) =>
        entry.providerIds.length > 0 ||
        entry.speechProviderIds.length > 0 ||
        entry.mediaUnderstandingProviderIds.length > 0 ||
        entry.imageGenerationProviderIds.length > 0 ||
        entry.videoGenerationProviderIds.length > 0 ||
        entry.musicGenerationProviderIds.length > 0 ||
        entry.webSearchProviderIds.length > 0,
    ).map((entry) => entry.pluginId),
  ),
].toSorted((left, right) => left.localeCompare(right));

export const BUNDLED_WEB_SEARCH_PLUGIN_IDS = collectPluginIds(
  (entry) => entry.webSearchProviderIds,
);

export const BUNDLED_WEB_SEARCH_PROVIDER_PLUGIN_IDS = Object.fromEntries(
  BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS.flatMap((entry) =>
    entry.webSearchProviderIds.map((providerId) => [providerId, entry.pluginId] as const),
  ).toSorted(([left], [right]) => left.localeCompare(right)),
) as Readonly<Record<string, string>>;

export const BUNDLED_PROVIDER_PLUGIN_ID_ALIASES = Object.fromEntries(
  BUNDLED_PLUGIN_CONTRACT_SNAPSHOTS.flatMap((entry) =>
    entry.providerIds
      .filter((providerId) => providerId !== entry.pluginId)
      .map((providerId) => [providerId, entry.pluginId] as const),
  ).toSorted(([left], [right]) => left.localeCompare(right)),
) as Readonly<Record<string, string>>;
