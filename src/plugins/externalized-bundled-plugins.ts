export type ExternalizedBundledPluginPreferredSource = "npm" | "corehub";

export type ExternalizedBundledPluginBridge = {
  /** Plugin id used while the plugin was bundled in core. */
  bundledPluginId: string;
  /** Plugin id declared by the external package. Defaults to bundledPluginId. */
  pluginId?: string;
  /** Preferred external source when migrating the bundled plugin out. Defaults to npm. */
  preferredSource?: ExternalizedBundledPluginPreferredSource;
  /** npm spec CoreBlow can install when migrating the bundled plugin out. */
  npmSpec?: string;
  /** CoreHub spec CoreBlow can install when migrating the bundled plugin out. */
  corehubSpec?: string;
  /** Optional CoreHub base URL for non-default registries. */
  corehubUrl?: string;
  /** Bundled directory name, when it differs from bundledPluginId. */
  bundledDirName?: string;
  /** Previous bundled manifest default enablement from the persisted registry. */
  enabledByDefault?: boolean;
  /** Legacy ids that should be treated as this plugin during enablement checks. */
  legacyPluginIds?: readonly string[];
  /** Channel ids that imply this plugin is enabled when configured. */
  channelIds?: readonly string[];
  /** Plugin ids this external package supersedes for channel selection. */
  preferOver?: readonly string[];
};

function normalizePluginId(value: string | undefined): string {
  return value?.trim() ?? "";
}

function normalizeOptionalSpec(value: string | undefined): string {
  return value?.trim() ?? "";
}

export function getExternalizedBundledPluginPreferredSource(
  bridge: ExternalizedBundledPluginBridge,
): ExternalizedBundledPluginPreferredSource {
  if (bridge.preferredSource === "corehub") {
    return "corehub";
  }
  if (bridge.preferredSource === "npm") {
    return "npm";
  }
  return normalizeOptionalSpec(bridge.corehubSpec) && !normalizeOptionalSpec(bridge.npmSpec)
    ? "corehub"
    : "npm";
}

export function getExternalizedBundledPluginNpmSpec(
  bridge: ExternalizedBundledPluginBridge,
): string {
  return normalizeOptionalSpec(bridge.npmSpec);
}

export function getExternalizedBundledPluginCoreHubSpec(
  bridge: ExternalizedBundledPluginBridge,
): string {
  return normalizeOptionalSpec(bridge.corehubSpec);
}

export function getExternalizedBundledPluginTargetId(
  bridge: ExternalizedBundledPluginBridge,
): string {
  return normalizePluginId(bridge.pluginId) || normalizePluginId(bridge.bundledPluginId);
}

export function getExternalizedBundledPluginLookupIds(
  bridge: ExternalizedBundledPluginBridge,
): readonly string[] {
  return Array.from(
    new Set(
      [
        bridge.bundledPluginId,
        bridge.pluginId,
        ...(bridge.legacyPluginIds ?? []),
        ...(bridge.channelIds ?? []),
      ]
        .map(normalizePluginId)
        .filter(Boolean),
    ),
  );
}

export function getExternalizedBundledPluginLegacyPathSuffix(
  bridge: ExternalizedBundledPluginBridge,
): string {
  const bundledDirName = bridge.bundledDirName ?? bridge.bundledPluginId;
  return ["extensions", bundledDirName].join("/");
}
