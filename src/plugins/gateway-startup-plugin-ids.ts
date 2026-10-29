import { collectConfiguredAgentHarnessRuntimes } from "../agents/harness-runtimes.js";
import {
  listExplicitlyDisabledChannelIdsForConfig,
  listPotentialConfiguredChannelIds,
} from "../channels/config-presence.js";
import type { CoreBlowConfig } from "../config/types.coreblow.js";
import {
  DEFAULT_MEMORY_DREAMING_PLUGIN_ID,
  resolveMemoryDreamingConfig,
  resolveMemoryDreamingPluginConfig,
  resolveMemoryDreamingPluginId,
} from "../memory-host-sdk/dreaming.js";
import { normalizeOptionalLowercaseString } from "../shared/string-coerce.js";
import { hasExplicitChannelConfig } from "./channel-presence-policy.js";
import { collectPluginConfigContractMatches } from "./config-contracts.js";
import { resolveEffectivePluginActivationState } from "./config-state.js";
import { isPluginEnabledByDefaultForPlatform } from "./default-enablement.js";
import {
  collectConfiguredSpeechProviderIds,
  normalizeConfiguredSpeechProviderIdForStartup,
} from "./gateway-startup-speech-providers.js";
import type { InstalledPluginIndexRecord } from "./installed-plugin-index-types.js";
import type { PluginManifestRecord, PluginManifestRegistry } from "./manifest-registry.js";
import {
  isPluginMetadataSnapshotCompatible,
  loadPluginMetadataSnapshot,
  type PluginMetadataSnapshot,
} from "./plugin-metadata-snapshot.js";
import {
  createPluginRegistryIdNormalizer,
  normalizePluginsConfigWithRegistry,
} from "./plugin-registry-contributions.js";
import type { PluginRegistrySnapshot } from "./plugin-registry-snapshot.js";

export type GatewayStartupPluginPlan = {
  channelPluginIds: readonly string[];
  configuredDeferredChannelPluginIds: readonly string[];
  pluginIds: readonly string[];
};

type NormalizedPluginsConfig = ReturnType<typeof normalizePluginsConfigWithRegistry>;
type GenerationProviderContractKey =
  | "imageGenerationProviders"
  | "videoGenerationProviders"
  | "musicGenerationProviders";
type ConfiguredGenerationProviderIds = Record<GenerationProviderContractKey, ReadonlySet<string>>;

type ManifestRegistryLookup = ReadonlyMap<string, PluginManifestRecord>;

function collectCandidatePlugins(
  index: PluginRegistrySnapshot,
  manifestRegistry: PluginManifestRegistry,
): readonly InstalledPluginIndexRecord[] {
  const indexPluginIds = new Set(index.plugins.map((p) => p.pluginId));
  const missingFromManifest = manifestRegistry.plugins
    .filter((m) => !indexPluginIds.has(m.id))
    .map(
      (m) =>
        ({
          pluginId: m.id,
          origin: m.origin,
          enabledByDefault: m.enabledByDefault,
          channels: m.channels,
          providers: m.providers,
          cliBackends: m.cliBackends,
          startup: {
            memory: false,
            deferConfiguredChannelFullLoadUntilAfterListen:
              m.startupDeferConfiguredChannelFullLoadUntilAfterListen ?? false,
          },
        }) as unknown as InstalledPluginIndexRecord,
    );
  return missingFromManifest.length > 0 ? [...index.plugins, ...missingFromManifest] : index.plugins;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isConfigActivationValueEnabled(value: unknown): boolean {
  if (value === false) {
    return false;
  }
  if (isRecord(value) && value.enabled === false) {
    return false;
  }
  return true;
}

function listPotentialEnabledChannelIds(config: CoreBlowConfig, env: NodeJS.ProcessEnv): string[] {
  const disabled = new Set(listExplicitlyDisabledChannelIdsForConfig(config));
  return listPotentialConfiguredChannelIds(config, env, { includePersistedAuthState: false })
    .map((id) => normalizeOptionalLowercaseString(id) ?? "")
    .filter((id) => id && !disabled.has(id));
}

function isGatewayStartupMemoryPlugin(plugin: InstalledPluginIndexRecord): boolean {
  return plugin.startup.memory;
}

function resolveGatewayStartupDreamingPluginIds(config: CoreBlowConfig): Set<string> {
  const dreamingConfig = resolveMemoryDreamingConfig({
    pluginConfig: resolveMemoryDreamingPluginConfig(config),
    cfg: config,
  });
  if (!dreamingConfig.enabled) {
    return new Set();
  }
  return new Set([DEFAULT_MEMORY_DREAMING_PLUGIN_ID, resolveMemoryDreamingPluginId(config)]);
}

function resolveMemorySlotStartupPluginId(params: {
  activationSourceConfig: CoreBlowConfig;
  activationSourcePlugins: ReturnType<typeof normalizePluginsConfigWithRegistry>;
  normalizePluginId: (pluginId: string) => string;
}): string | undefined {
  const { activationSourceConfig, activationSourcePlugins, normalizePluginId } = params;
  const configuredSlot = activationSourceConfig.plugins?.slots?.memory?.trim();
  if (configuredSlot?.toLowerCase() === "none") {
    return undefined;
  }
  if (!configuredSlot) {
    const defaultSlot = activationSourcePlugins.slots.memory;
    if (typeof defaultSlot !== "string") {
      return undefined;
    }
    if (
      activationSourcePlugins.allow.length > 0 &&
      !activationSourcePlugins.allow.includes(defaultSlot)
    ) {
      return undefined;
    }
    return defaultSlot;
  }
  return normalizePluginId(configuredSlot);
}

function resolveContextEngineSlotStartupPluginId(params: {
  activationSourceConfig: CoreBlowConfig;
  activationSourcePlugins: ReturnType<typeof normalizePluginsConfigWithRegistry>;
  normalizePluginId: (pluginId: string) => string;
}): string | undefined {
  const { activationSourceConfig, activationSourcePlugins, normalizePluginId } = params;
  const configuredSlot = activationSourceConfig.plugins?.slots?.contextEngine?.trim();
  if (!configuredSlot) {
    return undefined;
  }
  const normalized = normalizePluginId(configuredSlot);
  if (normalized === "legacy") {
    return undefined;
  }
  if (activationSourcePlugins.deny.includes(normalized)) {
    return undefined;
  }
  if (activationSourcePlugins.entries[normalized]?.enabled === false) {
    return undefined;
  }
  return normalized;
}

function shouldConsiderForGatewayStartup(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  startupDreamingPluginIds: ReadonlySet<string>;
  memorySlotStartupPluginId?: string;
  contextEngineSlotStartupPluginId?: string;
  pluginsConfig: NormalizedPluginsConfig;
}): boolean {
  if (params.plugin.origin !== "bundled") {
    return true;
  }
  if (params.manifest?.activation?.onStartup === true) {
    return true;
  }
  if (params.contextEngineSlotStartupPluginId === params.plugin.pluginId) {
    return true;
  }
  if (
    params.pluginsConfig.allow.includes(params.plugin.pluginId) ||
    params.pluginsConfig.entries[params.plugin.pluginId]?.enabled === true
  ) {
    return true;
  }
  if (!isGatewayStartupMemoryPlugin(params.plugin)) {
    return false;
  }
  if (params.startupDreamingPluginIds.has(params.plugin.pluginId)) {
    return true;
  }
  return params.memorySlotStartupPluginId === params.plugin.pluginId;
}

function createManifestRegistryLookup(
  manifestRegistry: PluginManifestRegistry,
): ManifestRegistryLookup {
  return new Map(manifestRegistry.plugins.map((plugin) => [plugin.id, plugin]));
}

function listManifestChannelIds(
  manifestLookup: ManifestRegistryLookup,
  pluginId: string,
): readonly string[] {
  return manifestLookup.get(pluginId)?.channels ?? [];
}

function findManifestPlugin(
  manifestLookup: ManifestRegistryLookup,
  pluginId: string,
): PluginManifestRecord | undefined {
  return manifestLookup.get(pluginId);
}

function hasConfiguredStartupChannel(params: {
  plugin: InstalledPluginIndexRecord;
  manifestLookup: ManifestRegistryLookup;
  configuredChannelIds: ReadonlySet<string>;
}): boolean {
  return listManifestChannelIds(params.manifestLookup, params.plugin.pluginId).some((channelId) =>
    params.configuredChannelIds.has(channelId),
  );
}

function hasConfiguredActivationPath(params: {
  manifest: PluginManifestRecord | undefined;
  config: CoreBlowConfig;
}): boolean {
  const paths = params.manifest?.activation?.onConfigPaths;
  if (!paths?.length) {
    return false;
  }
  return paths.some((pathPattern) =>
    collectPluginConfigContractMatches({
      root: params.config,
      pathPattern,
    }).some((match) => isConfigActivationValueEnabled(match.value)),
  );
}

function manifestOwnsConfiguredSpeechProvider(params: {
  manifest: PluginManifestRecord | undefined;
  configuredSpeechProviderIds: ReadonlySet<string>;
}): boolean {
  if (params.configuredSpeechProviderIds.size === 0) {
    return false;
  }
  return (params.manifest?.contracts?.speechProviders ?? []).some((providerId) => {
    const normalized = normalizeConfiguredSpeechProviderIdForStartup(providerId);
    return normalized ? params.configuredSpeechProviderIds.has(normalized) : false;
  });
}

function collectConfiguredWebSearchProviderIds(config: CoreBlowConfig): ReadonlySet<string> {
  const search = config.tools?.web?.search;
  if (search?.enabled === false || typeof search?.provider !== "string") {
    return new Set();
  }
  const providerId = normalizeOptionalLowercaseString(search.provider);
  return providerId ? new Set([providerId]) : new Set();
}

function manifestOwnsConfiguredWebSearchProvider(params: {
  manifest: PluginManifestRecord | undefined;
  configuredWebSearchProviderIds: ReadonlySet<string>;
}): boolean {
  if (params.configuredWebSearchProviderIds.size === 0) {
    return false;
  }
  return (params.manifest?.contracts?.webSearchProviders ?? []).some((providerId) => {
    const normalized = normalizeOptionalLowercaseString(providerId);
    return normalized ? params.configuredWebSearchProviderIds.has(normalized) : false;
  });
}

function listModelProviderRefs(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }
  if (!isRecord(value)) {
    return [];
  }
  const refs: string[] = [];
  if (typeof value.primary === "string") {
    refs.push(value.primary);
  }
  if (Array.isArray(value.fallbacks)) {
    for (const fallback of value.fallbacks) {
      if (typeof fallback === "string") {
        refs.push(fallback);
      }
    }
  }
  return refs;
}

function collectModelProviderIds(value: unknown): ReadonlySet<string> {
  return new Set(
    listModelProviderRefs(value)
      .map((ref) => {
        const slashIndex = ref.indexOf("/");
        return slashIndex > 0 ? normalizeOptionalLowercaseString(ref.slice(0, slashIndex)) : "";
      })
      .filter((providerId): providerId is string => Boolean(providerId)),
  );
}

function collectConfiguredGenerationProviderIds(
  config: CoreBlowConfig,
): ConfiguredGenerationProviderIds {
  const defaults = config.agents?.defaults;
  return {
    imageGenerationProviders: collectModelProviderIds(defaults?.imageGenerationModel),
    videoGenerationProviders: collectModelProviderIds(
      (defaults as { videoGenerationModel?: unknown })?.videoGenerationModel,
    ),
    musicGenerationProviders: collectModelProviderIds(
      (defaults as { musicGenerationModel?: unknown })?.musicGenerationModel,
    ),
  };
}

function manifestOwnsConfiguredGenerationProvider(params: {
  manifest: PluginManifestRecord | undefined;
  configuredGenerationProviderIds: ConfiguredGenerationProviderIds;
}): boolean {
  for (const contractKey of [
    "imageGenerationProviders",
    "videoGenerationProviders",
    "musicGenerationProviders",
  ] as const) {
    const configuredProviderIds = params.configuredGenerationProviderIds[contractKey];
    if (configuredProviderIds.size === 0) {
      continue;
    }
    if (
      (params.manifest?.contracts?.[contractKey] ?? []).some((providerId) => {
        const normalized = normalizeOptionalLowercaseString(providerId);
        return normalized ? configuredProviderIds.has(normalized) : false;
      })
    ) {
      return true;
    }
  }
  return false;
}

function collectConfiguredModelOrProviderIds(config: CoreBlowConfig): Set<string> {
  const ids = new Set<string>();
  const addRef = (raw?: string) => {
    if (!raw) return;
    const trimmed = raw.trim().toLowerCase();
    const slash = trimmed.indexOf("/");
    if (slash > 0) {
      ids.add(trimmed.slice(0, slash));
    } else {
      ids.add(trimmed);
    }
  };
  for (const p of Object.keys(config.models?.providers ?? {})) {
    ids.add(p.trim().toLowerCase());
  }
  for (const b of Object.keys(config.agents?.defaults?.cliBackends ?? {})) {
    ids.add(b.trim().toLowerCase());
  }
  for (const m of Object.keys(config.agents?.defaults?.models ?? {})) {
    addRef(m);
  }
  const defaultModel = config.agents?.defaults?.model;
  if (typeof defaultModel === "string") {
    addRef(defaultModel);
  } else if (defaultModel && typeof defaultModel === "object") {
    if (typeof (defaultModel as { primary?: string }).primary === "string") {
      addRef((defaultModel as { primary?: string }).primary);
    }
    if (Array.isArray((defaultModel as { fallbacks?: string[] }).fallbacks)) {
      for (const fb of (defaultModel as { fallbacks?: string[] }).fallbacks ?? []) {
        if (typeof fb === "string") addRef(fb);
      }
    }
  }
  return ids;
}

function canStartConfiguredProviderOrBackendPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  configuredActivationIds: ReadonlySet<string>;
  pluginsConfig: ReturnType<typeof normalizePluginsConfigWithRegistry>;
  activationSource: {
    plugins: ReturnType<typeof normalizePluginsConfigWithRegistry>;
    rootConfig?: CoreBlowConfig;
  };
}): boolean {
  if (params.configuredActivationIds.size === 0) {
    return false;
  }
  if (!params.pluginsConfig.enabled || !params.activationSource.plugins.enabled) {
    return false;
  }
  if (
    params.pluginsConfig.deny.includes(params.plugin.pluginId) ||
    params.activationSource.plugins.deny.includes(params.plugin.pluginId)
  ) {
    return false;
  }
  if (
    params.pluginsConfig.entries[params.plugin.pluginId]?.enabled === false ||
    params.activationSource.plugins.entries[params.plugin.pluginId]?.enabled === false
  ) {
    return false;
  }
  const pluginRecord = params.plugin as { providers?: string[]; cliBackends?: string[] };
  const providers = [
    ...(pluginRecord.providers ?? []),
    ...(params.manifest?.providers ?? []),
  ].map((p) => p.trim().toLowerCase());
  const cliBackends = [
    ...(pluginRecord.cliBackends ?? []),
    ...(params.manifest?.cliBackends ?? []),
  ].map((b) => b.trim().toLowerCase());

  return (
    providers.some((p) => params.configuredActivationIds.has(p)) ||
    cliBackends.some((b) => params.configuredActivationIds.has(b))
  );
}

function canStartConfiguredGenerationProviderPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  config: CoreBlowConfig;
  pluginsConfig: ReturnType<typeof normalizePluginsConfigWithRegistry>;
  activationSource: {
    plugins: ReturnType<typeof normalizePluginsConfigWithRegistry>;
    rootConfig?: CoreBlowConfig;
  };
  configuredGenerationProviderIds: ConfiguredGenerationProviderIds;
  platform?: NodeJS.Platform;
}): boolean {
  if (
    !manifestOwnsConfiguredGenerationProvider({
      manifest: params.manifest,
      configuredGenerationProviderIds: params.configuredGenerationProviderIds,
    })
  ) {
    return false;
  }
  if (!params.pluginsConfig.enabled || !params.activationSource.plugins.enabled) {
    return false;
  }
  if (
    params.pluginsConfig.deny.includes(params.plugin.pluginId) ||
    params.activationSource.plugins.deny.includes(params.plugin.pluginId)
  ) {
    return false;
  }
  if (
    params.pluginsConfig.entries[params.plugin.pluginId]?.enabled === false ||
    params.activationSource.plugins.entries[params.plugin.pluginId]?.enabled === false
  ) {
    return false;
  }
  const activationState = resolveEffectivePluginActivationState({
    id: params.plugin.pluginId,
    origin: params.plugin.origin,
    config: params.pluginsConfig,
    rootConfig: params.config,
    enabledByDefault: isPluginEnabledByDefaultForPlatform(params.plugin, params.platform),
    activationSource: params.activationSource,
  });
  return (
    activationState.enabled &&
    (params.plugin.origin === "bundled" || activationState.explicitlyEnabled)
  );
}

function canStartRequiredAgentHarnessPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  pluginsConfig: ReturnType<typeof normalizePluginsConfigWithRegistry>;
  activationSource: {
    plugins: ReturnType<typeof normalizePluginsConfigWithRegistry>;
    rootConfig?: CoreBlowConfig;
  };
  config: CoreBlowConfig;
  requiredAgentHarnessRuntimes: ReadonlySet<string>;
  platform?: NodeJS.Platform;
}): boolean {
  if (
    !params.plugin.startup.agentHarnesses.some((runtime) =>
      params.requiredAgentHarnessRuntimes.has(runtime),
    )
  ) {
    return false;
  }
  if (!params.pluginsConfig.enabled || !params.activationSource.plugins.enabled) {
    return false;
  }
  if (
    params.pluginsConfig.deny.includes(params.plugin.pluginId) ||
    params.activationSource.plugins.deny.includes(params.plugin.pluginId)
  ) {
    return false;
  }
  if (
    params.pluginsConfig.entries[params.plugin.pluginId]?.enabled === false ||
    params.activationSource.plugins.entries[params.plugin.pluginId]?.enabled === false
  ) {
    return false;
  }
  if (
    params.pluginsConfig.allow.length > 0 &&
    !params.pluginsConfig.allow.includes(params.plugin.pluginId)
  ) {
    return false;
  }
  if (
    params.activationSource.plugins.allow.length > 0 &&
    !params.activationSource.plugins.allow.includes(params.plugin.pluginId)
  ) {
    return false;
  }
  const activationState = resolveEffectivePluginActivationState({
    id: params.plugin.pluginId,
    origin: params.plugin.origin,
    config: params.pluginsConfig,
    rootConfig: params.config,
    enabledByDefault: isPluginEnabledByDefaultForPlatform(params.plugin, params.platform),
    activationSource: params.activationSource,
  });
  return activationState.enabled || params.plugin.origin === "bundled";
}

function canStartConfiguredSpeechProviderPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  config: CoreBlowConfig;
  pluginsConfig: ReturnType<typeof normalizePluginsConfigWithRegistry>;
  activationSource: {
    plugins: ReturnType<typeof normalizePluginsConfigWithRegistry>;
    rootConfig?: CoreBlowConfig;
  };
  configuredSpeechProviderIds: ReadonlySet<string>;
  platform?: NodeJS.Platform;
}): boolean {
  if (
    !manifestOwnsConfiguredSpeechProvider({
      manifest: params.manifest,
      configuredSpeechProviderIds: params.configuredSpeechProviderIds,
    })
  ) {
    return false;
  }
  if (
    params.pluginsConfig.deny.includes(params.plugin.pluginId) ||
    params.activationSource.plugins.deny.includes(params.plugin.pluginId)
  ) {
    return false;
  }
  if (
    params.pluginsConfig.entries[params.plugin.pluginId]?.enabled === false ||
    params.activationSource.plugins.entries[params.plugin.pluginId]?.enabled === false
  ) {
    return false;
  }
  if (params.plugin.origin === "bundled") {
    return true;
  }
  const activationState = resolveEffectivePluginActivationState({
    id: params.plugin.pluginId,
    origin: params.plugin.origin,
    config: params.pluginsConfig,
    rootConfig: params.config,
    enabledByDefault: isPluginEnabledByDefaultForPlatform(params.plugin, params.platform),
    activationSource: params.activationSource,
  });
  return activationState.enabled && activationState.explicitlyEnabled;
}

function canStartConfiguredWebSearchProviderPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  config: CoreBlowConfig;
  pluginsConfig: ReturnType<typeof normalizePluginsConfigWithRegistry>;
  activationSource: {
    plugins: ReturnType<typeof normalizePluginsConfigWithRegistry>;
    rootConfig?: CoreBlowConfig;
  };
  configuredWebSearchProviderIds: ReadonlySet<string>;
  platform?: NodeJS.Platform;
}): boolean {
  if (
    !manifestOwnsConfiguredWebSearchProvider({
      manifest: params.manifest,
      configuredWebSearchProviderIds: params.configuredWebSearchProviderIds,
    })
  ) {
    return false;
  }
  if (!params.pluginsConfig.enabled || !params.activationSource.plugins.enabled) {
    return false;
  }
  if (
    params.pluginsConfig.deny.includes(params.plugin.pluginId) ||
    params.activationSource.plugins.deny.includes(params.plugin.pluginId)
  ) {
    return false;
  }
  if (
    params.pluginsConfig.entries[params.plugin.pluginId]?.enabled === false ||
    params.activationSource.plugins.entries[params.plugin.pluginId]?.enabled === false
  ) {
    return false;
  }
  const activationState = resolveEffectivePluginActivationState({
    id: params.plugin.pluginId,
    origin: params.plugin.origin,
    config: params.pluginsConfig,
    rootConfig: params.config,
    enabledByDefault: isPluginEnabledByDefaultForPlatform(params.plugin, params.platform),
    activationSource: params.activationSource,
  });
  return activationState.enabled;
}

function canStartConfiguredRootPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  config: CoreBlowConfig;
  pluginsConfig: ReturnType<typeof normalizePluginsConfigWithRegistry>;
  activationSourcePlugins: ReturnType<typeof normalizePluginsConfigWithRegistry>;
}): boolean {
  if (params.plugin.origin !== "bundled") {
    return false;
  }
  if (!hasConfiguredActivationPath({ manifest: params.manifest, config: params.config })) {
    return false;
  }
  if (!params.pluginsConfig.enabled || !params.activationSourcePlugins.enabled) {
    return false;
  }
  if (
    params.pluginsConfig.deny.includes(params.plugin.pluginId) ||
    params.activationSourcePlugins.deny.includes(params.plugin.pluginId)
  ) {
    return false;
  }
  if (
    params.pluginsConfig.entries[params.plugin.pluginId]?.enabled === false ||
    params.activationSourcePlugins.entries[params.plugin.pluginId]?.enabled === false
  ) {
    return false;
  }
  return true;
}

function hasExplicitHookPolicyConfig(
  entry: NormalizedPluginsConfig["entries"][string] | undefined,
): boolean {
  return (
    entry?.hooks?.allowConversationAccess === true ||
    entry?.hooks?.allowPromptInjection === true ||
    entry?.hooks?.timeoutMs !== undefined ||
    (entry?.hooks?.timeouts !== undefined && Object.keys(entry.hooks.timeouts).length > 0)
  );
}

function hasHookRuntimeStartupIntent(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  activationSourcePlugins: NormalizedPluginsConfig;
}): boolean {
  if (params.manifest?.activation?.onCapabilities?.includes("hook")) {
    return true;
  }
  return hasExplicitHookPolicyConfig(
    params.activationSourcePlugins.entries[params.plugin.pluginId],
  );
}

function canStartExplicitHookPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  manifest: PluginManifestRecord | undefined;
  config: CoreBlowConfig;
  pluginsConfig: NormalizedPluginsConfig;
  activationSource: {
    plugins: NormalizedPluginsConfig;
    rootConfig?: CoreBlowConfig;
  };
  activationSourcePlugins: NormalizedPluginsConfig;
  platform?: NodeJS.Platform;
}): boolean {
  const hasHookPolicyIntent = hasExplicitHookPolicyConfig(
    params.activationSourcePlugins.entries[params.plugin.pluginId],
  );
  if (
    !hasHookRuntimeStartupIntent({
      plugin: params.plugin,
      manifest: params.manifest,
      activationSourcePlugins: params.activationSourcePlugins,
    })
  ) {
    return false;
  }
  if (!params.pluginsConfig.enabled || !params.activationSourcePlugins.enabled) {
    return false;
  }
  if (
    params.pluginsConfig.deny.includes(params.plugin.pluginId) ||
    params.activationSourcePlugins.deny.includes(params.plugin.pluginId)
  ) {
    return false;
  }
  if (
    params.pluginsConfig.entries[params.plugin.pluginId]?.enabled === false ||
    params.activationSourcePlugins.entries[params.plugin.pluginId]?.enabled === false
  ) {
    return false;
  }
  const activationState = resolveEffectivePluginActivationState({
    id: params.plugin.pluginId,
    origin: params.plugin.origin,
    config: params.pluginsConfig,
    rootConfig: params.config,
    enabledByDefault: isPluginEnabledByDefaultForPlatform(params.plugin, params.platform),
    activationSource: params.activationSource,
  });
  return activationState.enabled && (activationState.explicitlyEnabled || hasHookPolicyIntent);
}

function canStartConfiguredChannelPlugin(params: {
  plugin: InstalledPluginIndexRecord;
  config: CoreBlowConfig;
  pluginsConfig: ReturnType<typeof normalizePluginsConfigWithRegistry>;
  activationSource: {
    plugins: ReturnType<typeof normalizePluginsConfigWithRegistry>;
    rootConfig?: CoreBlowConfig;
  };
  manifestLookup: ManifestRegistryLookup;
  platform?: NodeJS.Platform;
}): boolean {
  if (!params.pluginsConfig.enabled) {
    return false;
  }
  if (params.pluginsConfig.deny.includes(params.plugin.pluginId)) {
    return false;
  }
  if (params.pluginsConfig.entries[params.plugin.pluginId]?.enabled === false) {
    return false;
  }
  const explicitBundledChannelConfig =
    params.plugin.origin === "bundled" &&
    listManifestChannelIds(params.manifestLookup, params.plugin.pluginId).some((channelId) =>
      hasExplicitChannelConfig({
        config: params.activationSource.rootConfig ?? params.config,
        channelId,
      }),
    );
  if (
    params.pluginsConfig.allow.length > 0 &&
    !params.pluginsConfig.allow.includes(params.plugin.pluginId) &&
    !explicitBundledChannelConfig
  ) {
    return false;
  }
  if (params.plugin.origin === "bundled") {
    return true;
  }
  const activationState = resolveEffectivePluginActivationState({
    id: params.plugin.pluginId,
    origin: params.plugin.origin,
    config: params.pluginsConfig,
    rootConfig: params.config,
    enabledByDefault: isPluginEnabledByDefaultForPlatform(params.plugin, params.platform),
    activationSource: params.activationSource,
  });
  return activationState.enabled && activationState.explicitlyEnabled;
}

export class GatewayStartupPluginResolver {
  public static resolveChannelPluginIds(params: {
    config: CoreBlowConfig;
    workspaceDir?: string;
    env: NodeJS.ProcessEnv;
  }): string[] {
    return [...GatewayStartupPluginResolver.loadGatewayStartupPluginPlan(params).channelPluginIds];
  }

  public static resolveChannelPluginIdsFromRegistry(params: {
    manifestRegistry: PluginManifestRegistry;
  }): string[] {
    return params.manifestRegistry.plugins
      .filter((plugin) => plugin.channels.length > 0)
      .map((plugin) => plugin.id);
  }

  public static resolveConfiguredDeferredChannelPluginIdsFromRegistry(params: {
    config: CoreBlowConfig;
    env: NodeJS.ProcessEnv;
    index: PluginRegistrySnapshot;
    manifestRegistry: PluginManifestRegistry;
  }): string[] {
    const configuredChannelIds = new Set(listPotentialEnabledChannelIds(params.config, params.env));
    if (configuredChannelIds.size === 0) {
      return [];
    }
    const pluginsConfig = normalizePluginsConfigWithRegistry(params.config.plugins, params.index, {
      manifestRegistry: params.manifestRegistry,
    });
    const activationSource = {
      plugins: pluginsConfig,
      rootConfig: params.config,
    };
    const manifestLookup = createManifestRegistryLookup(params.manifestRegistry);
    return collectCandidatePlugins(params.index, params.manifestRegistry)
      .filter(
        (plugin) =>
          hasConfiguredStartupChannel({
            plugin,
            manifestLookup,
            configuredChannelIds,
          }) &&
          plugin.startup.deferConfiguredChannelFullLoadUntilAfterListen &&
          canStartConfiguredChannelPlugin({
            plugin,
            config: params.config,
            pluginsConfig,
            activationSource,
            manifestLookup,
          }),
      )
      .map((plugin) => plugin.pluginId);
  }

  public static resolveConfiguredDeferredChannelPluginIds(params: {
    config: CoreBlowConfig;
    workspaceDir?: string;
    env: NodeJS.ProcessEnv;
  }): string[] {
    return [
      ...GatewayStartupPluginResolver.loadGatewayStartupPluginPlan(params)
        .configuredDeferredChannelPluginIds,
    ];
  }

  public static resolveGatewayStartupPluginPlanFromRegistry(params: {
    config: CoreBlowConfig;
    activationSourceConfig?: CoreBlowConfig;
    env: NodeJS.ProcessEnv;
    index: PluginRegistrySnapshot;
    manifestRegistry: PluginManifestRegistry;
    platform?: NodeJS.Platform;
  }): GatewayStartupPluginPlan {
    const channelPluginIds = GatewayStartupPluginResolver.resolveChannelPluginIdsFromRegistry({
      manifestRegistry: params.manifestRegistry,
    });
    const configuredDeferredChannelPluginIds =
      GatewayStartupPluginResolver.resolveConfiguredDeferredChannelPluginIdsFromRegistry({
        config: params.config,
        env: params.env,
        index: params.index,
        manifestRegistry: params.manifestRegistry,
      });
    const configuredChannelIds = new Set(listPotentialEnabledChannelIds(params.config, params.env));
    const pluginsConfig = normalizePluginsConfigWithRegistry(params.config.plugins, params.index, {
      manifestRegistry: params.manifestRegistry,
    });
    const activationSourceConfig = params.activationSourceConfig ?? params.config;
    const activationSourcePlugins = normalizePluginsConfigWithRegistry(
      activationSourceConfig.plugins,
      params.index,
      { manifestRegistry: params.manifestRegistry },
    );
    const activationSource = {
      plugins: activationSourcePlugins,
      rootConfig: activationSourceConfig,
    };
    const configuredActivationIds = collectConfiguredModelOrProviderIds(activationSourceConfig);
    const requiredAgentHarnessRuntimes = new Set(
      collectConfiguredAgentHarnessRuntimes(activationSourceConfig, params.env, {
        includeEnvRuntime: false,
        includeLegacyAgentRuntimes: false,
      }),
    );
    const startupDreamingPluginIds = resolveGatewayStartupDreamingPluginIds(params.config);
    const manifestLookup = createManifestRegistryLookup(params.manifestRegistry);
    const configuredSpeechProviderIds = collectConfiguredSpeechProviderIds(activationSourceConfig);
    const configuredWebSearchProviderIds =
      collectConfiguredWebSearchProviderIds(activationSourceConfig);
    const configuredGenerationProviderIds =
      collectConfiguredGenerationProviderIds(activationSourceConfig);
    const normalizePluginId = createPluginRegistryIdNormalizer(params.index, {
      manifestRegistry: params.manifestRegistry,
    });
    const memorySlotStartupPluginId = resolveMemorySlotStartupPluginId({
      activationSourceConfig,
      activationSourcePlugins,
      normalizePluginId,
    });
    const contextEngineSlotStartupPluginId = resolveContextEngineSlotStartupPluginId({
      activationSourceConfig,
      activationSourcePlugins,
      normalizePluginId,
    });
    const pluginIds = collectCandidatePlugins(params.index, params.manifestRegistry)
      .filter((plugin) => {
        const manifest = findManifestPlugin(manifestLookup, plugin.pluginId);
        if (
          hasConfiguredStartupChannel({
            plugin,
            manifestLookup,
            configuredChannelIds,
          })
        ) {
          return canStartConfiguredChannelPlugin({
            plugin,
            config: params.config,
            pluginsConfig,
            activationSource,
            manifestLookup,
            platform: params.platform,
          });
        }
        if (
          canStartRequiredAgentHarnessPlugin({
            plugin,
            pluginsConfig,
            activationSource,
            config: params.config,
            requiredAgentHarnessRuntimes,
            platform: params.platform,
          })
        ) {
          return true;
        }
        if (
          canStartConfiguredRootPlugin({
            plugin,
            manifest,
            config: activationSourceConfig,
            pluginsConfig,
            activationSourcePlugins,
          })
        ) {
          return true;
        }
        if (
          canStartConfiguredSpeechProviderPlugin({
            plugin,
            manifest,
            config: params.config,
            pluginsConfig,
            activationSource,
            configuredSpeechProviderIds,
            platform: params.platform,
          })
        ) {
          return true;
        }
        if (
          canStartConfiguredWebSearchProviderPlugin({
            plugin,
            manifest,
            config: params.config,
            pluginsConfig,
            activationSource,
            configuredWebSearchProviderIds,
            platform: params.platform,
          })
        ) {
          return true;
        }
        if (
          canStartConfiguredGenerationProviderPlugin({
            plugin,
            manifest,
            config: params.config,
            pluginsConfig,
            activationSource,
            configuredGenerationProviderIds,
            platform: params.platform,
          })
        ) {
          return true;
        }
        if (
          canStartExplicitHookPlugin({
            plugin,
            manifest,
            config: params.config,
            pluginsConfig,
            activationSource,
            activationSourcePlugins,
            platform: params.platform,
          })
        ) {
          return true;
        }
        if (
          canStartConfiguredProviderOrBackendPlugin({
            plugin,
            manifest,
            configuredActivationIds,
            pluginsConfig,
            activationSource,
          })
        ) {
          return true;
        }
        if (
          !shouldConsiderForGatewayStartup({
            plugin,
            manifest,
            startupDreamingPluginIds,
            memorySlotStartupPluginId,
            contextEngineSlotStartupPluginId,
            pluginsConfig,
          })
        ) {
          return false;
        }
        const activationState = resolveEffectivePluginActivationState({
          id: plugin.pluginId,
          origin: plugin.origin,
          config: pluginsConfig,
          rootConfig: params.config,
          enabledByDefault: isPluginEnabledByDefaultForPlatform(plugin, params.platform),
          activationSource,
        });
        if (!activationState.enabled) {
          return false;
        }
        if (plugin.origin !== "bundled") {
          return true;
        }
        return (
          activationState.source === "explicit" ||
          activationState.source === "default" ||
          pluginsConfig.allow.includes(plugin.pluginId) ||
          pluginsConfig.entries[plugin.pluginId]?.enabled === true
        );
      })
      .map((plugin) => plugin.pluginId);
    return {
      channelPluginIds,
      configuredDeferredChannelPluginIds,
      pluginIds,
    };
  }

  public static resolveGatewayStartupPluginIdsFromRegistry(params: {
    config: CoreBlowConfig;
    activationSourceConfig?: CoreBlowConfig;
    env: NodeJS.ProcessEnv;
    index: PluginRegistrySnapshot;
    manifestRegistry: PluginManifestRegistry;
    platform?: NodeJS.Platform;
  }): string[] {
    return [
      ...GatewayStartupPluginResolver.resolveGatewayStartupPluginPlanFromRegistry(params).pluginIds,
    ];
  }

  public static loadGatewayStartupPluginPlan(params: {
    config: CoreBlowConfig;
    activationSourceConfig?: CoreBlowConfig;
    workspaceDir?: string;
    env: NodeJS.ProcessEnv;
    index?: PluginRegistrySnapshot;
    metadataSnapshot?: PluginMetadataSnapshot;
    platform?: NodeJS.Platform;
  }): GatewayStartupPluginPlan {
    const snapshotConfig = params.activationSourceConfig ?? params.config;
    const metadataSnapshot =
      params.metadataSnapshot &&
      isPluginMetadataSnapshotCompatible({
        snapshot: params.metadataSnapshot,
        config: snapshotConfig,
        env: params.env,
        workspaceDir: params.workspaceDir,
        index: params.index,
      })
        ? params.metadataSnapshot
        : loadPluginMetadataSnapshot({
            config: snapshotConfig,
            workspaceDir: params.workspaceDir,
            env: params.env,
            ...(params.index ? { index: params.index } : {}),
          });
    return GatewayStartupPluginResolver.resolveGatewayStartupPluginPlanFromRegistry({
      config: params.config,
      ...(params.activationSourceConfig !== undefined
        ? { activationSourceConfig: params.activationSourceConfig }
        : {}),
      env: params.env,
      index: metadataSnapshot.index,
      manifestRegistry: metadataSnapshot.manifestRegistry,
      platform: params.platform,
    });
  }

  public static resolveGatewayStartupPluginIds(params: {
    config: CoreBlowConfig;
    activationSourceConfig?: CoreBlowConfig;
    workspaceDir?: string;
    env: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
  }): string[] {
    return [...GatewayStartupPluginResolver.loadGatewayStartupPluginPlan(params).pluginIds];
  }
}

export function resolveChannelPluginIds(params: {
  config: CoreBlowConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
}): string[] {
  return GatewayStartupPluginResolver.resolveChannelPluginIds(params);
}

export function resolveChannelPluginIdsFromRegistry(params: {
  manifestRegistry: PluginManifestRegistry;
}): string[] {
  return GatewayStartupPluginResolver.resolveChannelPluginIdsFromRegistry(params);
}

export function resolveConfiguredDeferredChannelPluginIdsFromRegistry(params: {
  config: CoreBlowConfig;
  env: NodeJS.ProcessEnv;
  index: PluginRegistrySnapshot;
  manifestRegistry: PluginManifestRegistry;
}): string[] {
  return GatewayStartupPluginResolver.resolveConfiguredDeferredChannelPluginIdsFromRegistry(params);
}

export function resolveConfiguredDeferredChannelPluginIds(params: {
  config: CoreBlowConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
}): string[] {
  return GatewayStartupPluginResolver.resolveConfiguredDeferredChannelPluginIds(params);
}

export function resolveGatewayStartupPluginPlanFromRegistry(params: {
  config: CoreBlowConfig;
  activationSourceConfig?: CoreBlowConfig;
  env: NodeJS.ProcessEnv;
  index: PluginRegistrySnapshot;
  manifestRegistry: PluginManifestRegistry;
  platform?: NodeJS.Platform;
}): GatewayStartupPluginPlan {
  return GatewayStartupPluginResolver.resolveGatewayStartupPluginPlanFromRegistry(params);
}

export function resolveGatewayStartupPluginIdsFromRegistry(params: {
  config: CoreBlowConfig;
  activationSourceConfig?: CoreBlowConfig;
  env: NodeJS.ProcessEnv;
  index: PluginRegistrySnapshot;
  manifestRegistry: PluginManifestRegistry;
  platform?: NodeJS.Platform;
}): string[] {
  return GatewayStartupPluginResolver.resolveGatewayStartupPluginIdsFromRegistry(params);
}

export function loadGatewayStartupPluginPlan(params: {
  config: CoreBlowConfig;
  activationSourceConfig?: CoreBlowConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
  index?: PluginRegistrySnapshot;
  metadataSnapshot?: PluginMetadataSnapshot;
  platform?: NodeJS.Platform;
}): GatewayStartupPluginPlan {
  return GatewayStartupPluginResolver.loadGatewayStartupPluginPlan(params);
}

export function resolveGatewayStartupPluginIds(params: {
  config: CoreBlowConfig;
  activationSourceConfig?: CoreBlowConfig;
  workspaceDir?: string;
  env: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
}): string[] {
  return GatewayStartupPluginResolver.resolveGatewayStartupPluginIds(params);
}
