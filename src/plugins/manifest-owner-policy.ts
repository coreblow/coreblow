import type { CoreBlowConfig } from "../config/types.coreblow.js";
import { normalizePluginsConfig, resolveEffectiveEnableState } from "./config-state.js";
import { isPluginEnabledByDefaultForPlatform } from "./default-enablement.js";
import type { PluginManifestRecord } from "./manifest-registry.js";

type OwnerPlugin = Pick<
  PluginManifestRecord,
  "id" | "origin"
> & {
  enabledByDefault?: boolean;
  enabledByDefaultOnPlatforms?: readonly string[];
};

type NormalizedPluginsConfig = ReturnType<typeof normalizePluginsConfig>;

export type ManifestOwnerBasePolicyBlockReason =
  | "plugins-disabled"
  | "blocked-by-denylist"
  | "plugin-disabled"
  | "not-in-allowlist";

export function isBundledManifestOwner(plugin: Pick<PluginManifestRecord, "origin">): boolean {
  return plugin.origin === "bundled";
}

export function hasExplicitManifestOwnerTrust(params: {
  plugin: Pick<PluginManifestRecord, "id">;
  normalizedConfig: NormalizedPluginsConfig;
}): boolean {
  return (
    params.normalizedConfig.allow.includes(params.plugin.id) ||
    params.normalizedConfig.entries[params.plugin.id]?.enabled === true
  );
}

export function passesManifestOwnerBasePolicy(params: {
  plugin: Pick<PluginManifestRecord, "id">;
  normalizedConfig: NormalizedPluginsConfig;
  allowExplicitlyDisabled?: boolean;
  allowRestrictiveAllowlistBypass?: boolean;
}): boolean {
  return resolveManifestOwnerBasePolicyBlock(params) === null;
}

export function resolveManifestOwnerBasePolicyBlock(params: {
  plugin: Pick<PluginManifestRecord, "id">;
  normalizedConfig: NormalizedPluginsConfig;
  allowExplicitlyDisabled?: boolean;
  allowRestrictiveAllowlistBypass?: boolean;
}): ManifestOwnerBasePolicyBlockReason | null {
  if (!params.normalizedConfig.enabled) {
    return "plugins-disabled";
  }
  if (params.normalizedConfig.deny.includes(params.plugin.id)) {
    return "blocked-by-denylist";
  }
  if (
    params.normalizedConfig.entries[params.plugin.id]?.enabled === false &&
    params.allowExplicitlyDisabled !== true
  ) {
    return "plugin-disabled";
  }
  if (
    params.allowRestrictiveAllowlistBypass !== true &&
    params.normalizedConfig.allow.length > 0 &&
    !params.normalizedConfig.allow.includes(params.plugin.id)
  ) {
    return "not-in-allowlist";
  }
  return null;
}

export function isActivatedManifestOwner(params: {
  plugin: OwnerPlugin;
  normalizedConfig: NormalizedPluginsConfig;
  rootConfig?: CoreBlowConfig;
}): boolean {
  return resolveEffectiveEnableState({
    id: params.plugin.id,
    origin: params.plugin.origin,
    config: params.normalizedConfig,
    rootConfig: params.rootConfig,
    enabledByDefault: isPluginEnabledByDefaultForPlatform(params.plugin),
  }).enabled;
}
