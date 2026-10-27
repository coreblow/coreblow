import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import {
  hasMeaningfulChannelConfig,
  listExplicitlyDisabledChannelIdsForConfig,
  listPotentialConfiguredChannelPresenceSignals,
  type ChannelPresenceSignalSource,
} from "../channels/config-presence.js";
import type { CoreBlowConfig } from "../config/config.js";
import { isSafeChannelEnvVarTriggerName } from "../secrets/channel-env-var-names.js";
import { normalizeOptionalLowercaseString } from "../shared/string-coerce.js";
import { resolveManifestActivationPluginIds } from "./activation-planner.js";
import {
  createPluginActivationSource,
  normalizePluginsConfig,
  resolveEffectivePluginActivationState,
  type NormalizedPluginsConfig,
  type PluginActivationConfigSource,
} from "./config-state.js";
import { isPluginEnabledByDefaultForPlatform } from "./default-enablement.js";
import {
  hasExplicitManifestOwnerTrust,
  isActivatedManifestOwner,
  isBundledManifestOwner,
  passesManifestOwnerBasePolicy,
  resolveManifestOwnerBasePolicyBlock,
} from "./manifest-owner-policy.js";
import {
  loadPluginManifestRegistry,
  type PluginManifestRecord,
} from "./manifest-registry.js";

const IGNORED_CHANNEL_CONFIG_KEYS = new Set(["defaults", "modelByChannel"]);

export type ConfiguredChannelPresenceSource =
  | "explicit-config"
  | Exclude<ChannelPresenceSignalSource, "config">
  | "manifest-env";

export type ConfiguredChannelBlockedReason =
  | "plugins-disabled"
  | "blocked-by-denylist"
  | "plugin-disabled"
  | "not-in-allowlist"
  | "workspace-disabled-by-default"
  | "bundled-disabled-by-default"
  | "untrusted-plugin"
  | "no-channel-owner"
  | "not-activated";

export type ConfiguredChannelPresencePolicyEntry = {
  channelId: string;
  sources: ConfiguredChannelPresenceSource[];
  effective: boolean;
  pluginIds: string[];
  blockedReasons: ConfiguredChannelBlockedReason[];
};

function dedupeSortedPluginIds(values: Iterable<string>): string[] {
  return [...new Set(values)].toSorted((left, right) => left.localeCompare(right));
}

function normalizeChannelIds(channelIds: Iterable<string>): string[] {
  return Array.from(
    new Set(
      [...channelIds]
        .map((channelId) => normalizeOptionalLowercaseString(channelId))
        .filter((channelId): channelId is string => Boolean(channelId)),
    ),
  ).toSorted((left, right) => left.localeCompare(right));
}

function hasNonEmptyEnvValue(env: NodeJS.ProcessEnv, key: string): boolean {
  if (!isSafeChannelEnvVarTriggerName(key)) {
    return false;
  }
  const trimmed = key.trim();
  const value = env[trimmed] ?? env[trimmed.toUpperCase()];
  return typeof value === "string" && value.trim().length > 0;
}

export function hasExplicitChannelConfig(params: {
  config: CoreBlowConfig;
  channelId: string;
}): boolean {
  const channels = params.config.channels;
  if (!channels || typeof channels !== "object" || Array.isArray(channels)) {
    return false;
  }
  const entry = (channels as Record<string, unknown>)[params.channelId];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return false;
  }
  const enabled = (entry as { enabled?: unknown }).enabled;
  if (enabled === false) {
    return false;
  }
  return enabled === true || hasMeaningfulChannelConfig(entry);
}

export function listExplicitConfiguredChannelIdsForConfig(config: CoreBlowConfig): string[] {
  const channels = config.channels;
  if (!channels || typeof channels !== "object" || Array.isArray(channels)) {
    return [];
  }
  return Object.keys(channels)
    .filter(
      (channelId) =>
        !IGNORED_CHANNEL_CONFIG_KEYS.has(channelId) &&
        hasExplicitChannelConfig({ config, channelId }),
    )
    .toSorted((left, right) => left.localeCompare(right));
}

function recordDeclaresChannel(record: PluginManifestRecord, channelId: string): boolean {
  const normalizedChannelId = normalizeOptionalLowercaseString(channelId) ?? "";
  if (!normalizedChannelId) {
    return false;
  }
  return record.channels.some(
    (ownedChannelId) =>
      (normalizeOptionalLowercaseString(ownedChannelId) ?? "") === normalizedChannelId,
  );
}

function listManifestEnvConfiguredChannelSignals(params: {
  records: readonly PluginManifestRecord[];
  activationSourceConfig?: CoreBlowConfig;
  config: CoreBlowConfig;
  env: NodeJS.ProcessEnv;
}): Array<{ channelId: string; source: "manifest-env" }> {
  const signals: Array<{ channelId: string; source: "manifest-env" }> = [];
  const seen = new Set<string>();
  const trustConfig = params.activationSourceConfig ?? params.config;
  const normalizedConfig = normalizePluginsConfig(trustConfig.plugins);
  for (const record of params.records) {
    if (
      !isChannelPluginEligibleForScopedOwnership({
        plugin: record,
        normalizedConfig,
        rootConfig: trustConfig,
      })
    ) {
      continue;
    }
    for (const channelId of record.channels) {
      const envVars: string[] = record.channelEnvVars?.[channelId] ?? [];
      if (!envVars.some((envVar: string) => hasNonEmptyEnvValue(params.env, envVar))) {
        continue;
      }
      if (seen.has(channelId)) {
        continue;
      }
      seen.add(channelId);
      signals.push({ channelId, source: "manifest-env" });
    }
  }
  return signals.toSorted((left, right) => left.channelId.localeCompare(right.channelId));
}

function normalizeActivationBlockedReason(reason?: string): ConfiguredChannelBlockedReason {
  switch (reason) {
    case "plugins disabled":
      return "plugins-disabled";
    case "blocked by denylist":
      return "blocked-by-denylist";
    case "disabled in config":
      return "plugin-disabled";
    case "not in allowlist":
      return "not-in-allowlist";
    case "workspace plugin (disabled by default)":
      return "workspace-disabled-by-default";
    case "bundled (disabled by default)":
      return "bundled-disabled-by-default";
    default:
      return "not-activated";
  }
}

function resolveBasePolicyBlockedReason(params: {
  plugin: Pick<PluginManifestRecord, "id">;
  normalizedConfig: NormalizedPluginsConfig;
  allowRestrictiveAllowlistBypass?: boolean;
}): ConfiguredChannelBlockedReason | null {
  return resolveManifestOwnerBasePolicyBlock(params) as ConfiguredChannelBlockedReason | null;
}

function isChannelPluginEligibleForScopedOwnership(params: {
  plugin: PluginManifestRecord;
  normalizedConfig: NormalizedPluginsConfig;
  rootConfig: CoreBlowConfig;
  channelId?: string;
}): boolean {
  const allowRestrictiveAllowlistBypass =
    params.channelId !== undefined &&
    isBundledManifestOwner(params.plugin) &&
    hasExplicitChannelConfig({
      config: params.rootConfig,
      channelId: params.channelId,
    });
  if (
    !passesManifestOwnerBasePolicy({
      plugin: params.plugin,
      normalizedConfig: params.normalizedConfig,
      allowRestrictiveAllowlistBypass,
    })
  ) {
    return false;
  }
  if (isBundledManifestOwner(params.plugin)) {
    return true;
  }
  if (params.plugin.origin === "global" || params.plugin.origin === "config") {
    return hasExplicitManifestOwnerTrust({
      plugin: params.plugin,
      normalizedConfig: params.normalizedConfig,
    });
  }
  return isActivatedManifestOwner({
    plugin: params.plugin,
    normalizedConfig: params.normalizedConfig,
    rootConfig: params.rootConfig,
  });
}

function evaluateEffectiveChannelPlugin(params: {
  plugin: PluginManifestRecord;
  channelId: string;
  normalizedConfig: NormalizedPluginsConfig;
  config: CoreBlowConfig;
  activationSource: PluginActivationConfigSource;
}): { effective: boolean; pluginId: string; blockedReason?: ConfiguredChannelBlockedReason } {
  const explicitBundledChannelConfig =
    isBundledManifestOwner(params.plugin) &&
    hasExplicitChannelConfig({
      config: params.activationSource.rootConfig ?? params.config,
      channelId: params.channelId,
    });
  const baseBlockedReason = resolveBasePolicyBlockedReason({
    plugin: params.plugin,
    normalizedConfig: params.normalizedConfig,
    allowRestrictiveAllowlistBypass: explicitBundledChannelConfig,
  });
  if (baseBlockedReason) {
    return {
      effective: false,
      pluginId: params.plugin.id,
      blockedReason: baseBlockedReason,
    };
  }

  if (!isBundledManifestOwner(params.plugin)) {
    if (params.plugin.origin === "global" || params.plugin.origin === "config") {
      const trusted = hasExplicitManifestOwnerTrust({
        plugin: params.plugin,
        normalizedConfig: params.normalizedConfig,
      });
      return trusted
        ? { effective: true, pluginId: params.plugin.id }
        : {
            effective: false,
            pluginId: params.plugin.id,
            blockedReason: "untrusted-plugin",
          };
    }
    const activated = isActivatedManifestOwner({
      plugin: params.plugin,
      normalizedConfig: params.normalizedConfig,
      rootConfig: params.activationSource.rootConfig,
    });
    return activated
      ? { effective: true, pluginId: params.plugin.id }
      : {
          effective: false,
          pluginId: params.plugin.id,
          blockedReason: "untrusted-plugin",
        };
  }

  if (explicitBundledChannelConfig) {
    return { effective: true, pluginId: params.plugin.id };
  }

  const activationState = resolveEffectivePluginActivationState({
    id: params.plugin.id,
    origin: params.plugin.origin,
    config: params.normalizedConfig,
    rootConfig: params.config,
    enabledByDefault: isPluginEnabledByDefaultForPlatform(params.plugin),
    activationSource: params.activationSource,
  });
  return activationState.enabled
    ? { effective: true, pluginId: params.plugin.id }
    : {
        effective: false,
        pluginId: params.plugin.id,
        blockedReason: normalizeActivationBlockedReason(activationState.reason),
      };
}

function addPolicySignal(
  entries: Map<string, Set<ConfiguredChannelPresenceSource>>,
  channelId: string,
  source: ConfiguredChannelPresenceSource,
) {
  const normalized = normalizeOptionalLowercaseString(channelId);
  if (!normalized) {
    return;
  }
  let sources = entries.get(normalized);
  if (!sources) {
    sources = new Set();
    entries.set(normalized, sources);
  }
  sources.add(source);
}

function loadInstalledChannelManifestRecords(params: {
  config: CoreBlowConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
}): readonly PluginManifestRecord[] {
  return loadPluginManifestRegistry({
    config: params.config,
    workspaceDir: params.workspaceDir,
    env: params.env,
  }).plugins;
}

export type ResolveConfiguredChannelPresencePolicyParams = {
  config: CoreBlowConfig;
  activationSourceConfig?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
  includePersistedAuthState?: boolean;
  manifestRecords?: readonly PluginManifestRecord[];
};

export class ChannelPresencePolicyManager {
  public static resolvePolicy(
    params: ResolveConfiguredChannelPresencePolicyParams,
  ): ConfiguredChannelPresencePolicyEntry[] {
    const env = params.env ?? process.env;
    const workspaceDir =
      params.workspaceDir ??
      resolveAgentWorkspaceDir(params.config, resolveDefaultAgentId(params.config));
    const records =
      params.manifestRecords ??
      loadInstalledChannelManifestRecords({
        config: params.config,
        workspaceDir,
        env,
      });

    const disabledChannelIds = new Set(listExplicitlyDisabledChannelIdsForConfig(params.config));
    const entrySources = new Map<string, Set<ConfiguredChannelPresenceSource>>();
    for (const channelId of listExplicitConfiguredChannelIdsForConfig(params.config)) {
      addPolicySignal(entrySources, channelId, "explicit-config");
    }
    for (const signal of listPotentialConfiguredChannelPresenceSignals(params.config, env, {
      includePersistedAuthState: params.includePersistedAuthState,
    })) {
      if (signal.source === "config") {
        continue;
      }
      addPolicySignal(entrySources, signal.channelId, signal.source);
    }
    for (const signal of listManifestEnvConfiguredChannelSignals({
      records,
      config: params.config,
      activationSourceConfig: params.activationSourceConfig,
      env,
    })) {
      addPolicySignal(entrySources, signal.channelId, signal.source);
    }
    for (const channelId of disabledChannelIds) {
      entrySources.delete(channelId);
    }

    const activationSource = createPluginActivationSource({
      config: params.activationSourceConfig ?? params.config,
    });
    const normalizedConfig = activationSource.plugins;
    const entries: ConfiguredChannelPresencePolicyEntry[] = [];
    for (const channelId of normalizeChannelIds(entrySources.keys())) {
      const owningRecords = records.filter((record) => recordDeclaresChannel(record, channelId));
      const evaluations = owningRecords.map((plugin) =>
        evaluateEffectiveChannelPlugin({
          plugin,
          channelId,
          normalizedConfig,
          config: params.config,
          activationSource,
        }),
      );
      const effectivePluginIds = evaluations
        .filter((entry) => entry.effective)
        .map((entry) => entry.pluginId);
      const blockedReasons =
        owningRecords.length === 0
          ? (["no-channel-owner"] as ConfiguredChannelBlockedReason[])
          : [
              ...new Set(
                evaluations
                  .map((entry) => entry.blockedReason)
                  .filter((reason): reason is ConfiguredChannelBlockedReason => Boolean(reason)),
              ),
            ].toSorted((left, right) => left.localeCompare(right));
      entries.push({
        channelId,
        sources: [...(entrySources.get(channelId) ?? [])].toSorted((left, right) =>
          left.localeCompare(right),
        ),
        effective: effectivePluginIds.length > 0,
        pluginIds: dedupeSortedPluginIds(effectivePluginIds),
        blockedReasons,
      });
    }
    return entries;
  }

  public static listReadOnlyScopeChannelIds(
    params: ResolveConfiguredChannelPresencePolicyParams,
  ): string[] {
    return this.resolvePolicy(params)
      .filter((entry) => entry.effective)
      .map((entry) => entry.channelId);
  }

  public static hasReadOnlyScopeChannels(
    params: ResolveConfiguredChannelPresencePolicyParams,
  ): boolean {
    return this.listReadOnlyScopeChannelIds(params).length > 0;
  }

  public static listAnnounceChannelIds(params: {
    config: CoreBlowConfig;
    activationSourceConfig?: CoreBlowConfig;
    workspaceDir?: string;
    env?: NodeJS.ProcessEnv;
  }): string[] {
    const disabledChannelIds = new Set(listExplicitlyDisabledChannelIdsForConfig(params.config));
    return normalizeChannelIds([
      ...listExplicitConfiguredChannelIdsForConfig(params.config),
      ...this.listReadOnlyScopeChannelIds({
        config: params.config,
        activationSourceConfig: params.activationSourceConfig,
        workspaceDir: params.workspaceDir,
        env: params.env,
        includePersistedAuthState: false,
      }),
    ]).filter((channelId) => !disabledChannelIds.has(channelId));
  }

  public static resolveScopedChannelOwnerPluginIds(params: {
    config: CoreBlowConfig;
    activationSourceConfig?: CoreBlowConfig;
    channelIds: readonly string[];
    workspaceDir?: string;
    env: NodeJS.ProcessEnv;
    manifestRecords?: readonly PluginManifestRecord[];
  }): string[] {
    const channelIds = normalizeChannelIds(params.channelIds);
    if (channelIds.length === 0) {
      return [];
    }
    const records =
      params.manifestRecords ??
      loadInstalledChannelManifestRecords({
        config: params.config,
        workspaceDir: params.workspaceDir,
        env: params.env,
      });
    const trustConfig = params.activationSourceConfig ?? params.config;
    const normalizedConfig = normalizePluginsConfig(trustConfig.plugins);
    const candidateIds = dedupeSortedPluginIds(
      channelIds.flatMap((channelId) => {
        return resolveManifestActivationPluginIds({
          trigger: {
            kind: "channel",
            channel: channelId,
          },
          config: params.config,
          workspaceDir: params.workspaceDir,
          env: params.env,
          manifestRecords: records,
          allowRestrictiveAllowlistBypass: hasExplicitChannelConfig({
            config: trustConfig,
            channelId,
          }),
        });
      }),
    );
    if (candidateIds.length === 0) {
      return [];
    }
    const candidateIdSet = new Set(candidateIds);
    return records
      .filter((plugin) => {
        if (!candidateIdSet.has(plugin.id)) {
          return false;
        }
        return isChannelPluginEligibleForScopedOwnership({
          plugin,
          normalizedConfig,
          rootConfig: trustConfig,
          channelId: channelIds.find((channelId) => recordDeclaresChannel(plugin, channelId)),
        });
      })
      .map((plugin) => plugin.id)
      .toSorted((left, right) => left.localeCompare(right));
  }
}

export function resolveConfiguredChannelPresencePolicy(
  params: ResolveConfiguredChannelPresencePolicyParams,
): ConfiguredChannelPresencePolicyEntry[] {
  return ChannelPresencePolicyManager.resolvePolicy(params);
}

export function listConfiguredChannelIdsForReadOnlyScope(
  params: ResolveConfiguredChannelPresencePolicyParams,
): string[] {
  return ChannelPresencePolicyManager.listReadOnlyScopeChannelIds(params);
}

export function hasConfiguredChannelsForReadOnlyScope(
  params: ResolveConfiguredChannelPresencePolicyParams,
): boolean {
  return ChannelPresencePolicyManager.hasReadOnlyScopeChannels(params);
}

export function listConfiguredAnnounceChannelIdsForConfig(params: {
  config: CoreBlowConfig;
  activationSourceConfig?: CoreBlowConfig;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
}): string[] {
  return ChannelPresencePolicyManager.listAnnounceChannelIds(params);
}

export function resolveDiscoverableScopedChannelPluginIds(params: {
  config: CoreBlowConfig;
  activationSourceConfig?: CoreBlowConfig;
  channelIds: readonly string[];
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
  manifestRecords?: readonly PluginManifestRecord[];
}): string[] {
  return ChannelPresencePolicyManager.resolveScopedChannelOwnerPluginIds(params);
}

export function resolveConfiguredChannelPluginIds(params: {
  config: CoreBlowConfig;
  activationSourceConfig?: CoreBlowConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
}): string[] {
  const configuredChannelIds = normalizeChannelIds([
    ...listConfiguredChannelIdsForReadOnlyScope({
      config: params.config,
      activationSourceConfig: params.activationSourceConfig,
      workspaceDir: params.workspaceDir,
      env: params.env,
    }),
    ...listExplicitConfiguredChannelIdsForConfig(params.activationSourceConfig ?? params.config),
  ]);
  if (configuredChannelIds.length === 0) {
    return [];
  }
  return ChannelPresencePolicyManager.resolveScopedChannelOwnerPluginIds({
    ...params,
    channelIds: configuredChannelIds,
  });
}
