import { normalizeChatChannelId } from "../channels/registry.js";
import type { CoreBlowConfig } from "../config/config.js";
import {
  BUNDLED_LEGACY_PLUGIN_ID_ALIASES,
  BUNDLED_PROVIDER_PLUGIN_ID_ALIASES,
} from "./bundled-capability-metadata.js";
import type { PluginRecord } from "./registry.js";
import { defaultSlotIdForKey } from "./slots.js";

// Granular taxonomy for *why* a plugin activation decision came out the way
// it did, additive alongside the existing free-text `reason` strings (which
// are intentionally left unchanged for backward compatibility with existing
// callers/tests). Mirrors the upstream reference implementation's plugin
// activation cause taxonomy.
//
// NOTE: "enabled-by-effective-config" is part of the taxonomy for forward
// compatibility, but is NOT currently produced by CoreBlow's resolveEnableState.
// The upstream reference implementation distinguishes a "source/explicit"
// config layer from a separately computed "effective" config layer (see its
// activationSource/sourceConfig concept): "enabled-in-config" fires when the
// explicit/source layer has entries[id].enabled === true, while
// "enabled-by-effective-config" fires when only the effective/merged layer
// does. CoreBlow's resolveEnableState takes a single NormalizedPluginsConfig
// with no separate source/effective layering, so entries[id].enabled === true
// is always mapped to "enabled-in-config" here. If CoreBlow ever adopts a
// genuine source/effective config split, this mapping should be revisited.
export type PluginActivationCause =
  | "enabled-in-config"
  | "bundled-channel-enabled-in-config"
  | "selected-memory-slot"
  | "selected-context-engine-slot"
  | "selected-in-allowlist"
  | "plugins-disabled"
  | "blocked-by-denylist"
  | "disabled-in-config"
  | "workspace-disabled-by-default"
  | "not-in-allowlist"
  | "enabled-by-effective-config"
  | "bundled-channel-configured"
  | "bundled-default-enablement"
  | "bundled-disabled-by-default";

export type NormalizedPluginsConfig = {
  enabled: boolean;
  allow: string[];
  deny: string[];
  loadPaths: string[];
  slots: {
    memory?: string | null;
    contextEngine?: string | null;
  };
  entries: Record<
    string,
    {
      enabled?: boolean;
      hooks?: {
        allowPromptInjection?: boolean;
      };
      subagent?: {
        allowModelOverride?: boolean;
        allowedModels?: string[];
        hasAllowedModelsConfig?: boolean;
      };
      llm?: {
        allowAgentIdOverride?: boolean;
        allowModelOverride?: boolean;
        allowedModels?: string[];
        hasAllowedModelsConfig?: boolean;
      };
      config?: unknown;
    }
  >;
};

export function normalizePluginId(id: string): string {
  const trimmed = id.trim();
  return (
    BUNDLED_LEGACY_PLUGIN_ID_ALIASES[trimmed] ??
    BUNDLED_PROVIDER_PLUGIN_ID_ALIASES[trimmed] ??
    trimmed
  );
}

const normalizeList = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? normalizePluginId(entry) : ""))
    .filter(Boolean);
};

const normalizeSlotValue = (value: unknown): string | null | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.toLowerCase() === "none") {
    return null;
  }
  return trimmed;
};

const normalizePluginEntries = (entries: unknown): NormalizedPluginsConfig["entries"] => {
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    return {};
  }
  const normalized: NormalizedPluginsConfig["entries"] = {};
  for (const [key, value] of Object.entries(entries)) {
    const normalizedKey = normalizePluginId(key);
    if (!normalizedKey) {
      continue;
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      normalized[normalizedKey] = {};
      continue;
    }
    const entry = value as Record<string, unknown>;
    const hooksRaw = entry.hooks;
    const hooks =
      hooksRaw && typeof hooksRaw === "object" && !Array.isArray(hooksRaw)
        ? {
            allowPromptInjection: (hooksRaw as { allowPromptInjection?: unknown })
              .allowPromptInjection,
          }
        : undefined;
    const normalizedHooks =
      hooks && typeof hooks.allowPromptInjection === "boolean"
        ? {
            allowPromptInjection: hooks.allowPromptInjection,
          }
        : undefined;
    const subagentRaw = entry.subagent;
    const subagent =
      subagentRaw && typeof subagentRaw === "object" && !Array.isArray(subagentRaw)
        ? {
            allowModelOverride: (subagentRaw as { allowModelOverride?: unknown })
              .allowModelOverride,
            hasAllowedModelsConfig: Array.isArray(
              (subagentRaw as { allowedModels?: unknown }).allowedModels,
            ),
            allowedModels: Array.isArray((subagentRaw as { allowedModels?: unknown }).allowedModels)
              ? ((subagentRaw as { allowedModels?: unknown }).allowedModels as unknown[])
                  .map((model) => (typeof model === "string" ? model.trim() : ""))
                  .filter(Boolean)
              : undefined,
          }
        : undefined;
    const normalizedSubagent =
      subagent &&
      (typeof subagent.allowModelOverride === "boolean" ||
        subagent.hasAllowedModelsConfig ||
        (Array.isArray(subagent.allowedModels) && subagent.allowedModels.length > 0))
        ? {
            ...(typeof subagent.allowModelOverride === "boolean"
              ? { allowModelOverride: subagent.allowModelOverride }
              : {}),
            ...(subagent.hasAllowedModelsConfig ? { hasAllowedModelsConfig: true } : {}),
            ...(Array.isArray(subagent.allowedModels) && subagent.allowedModels.length > 0
              ? { allowedModels: subagent.allowedModels }
              : {}),
          }
        : undefined;
    const llmRaw = entry.llm;
    const llm =
      llmRaw && typeof llmRaw === "object" && !Array.isArray(llmRaw)
        ? {
            allowAgentIdOverride: (llmRaw as { allowAgentIdOverride?: unknown })
              .allowAgentIdOverride,
            allowModelOverride: (llmRaw as { allowModelOverride?: unknown })
              .allowModelOverride,
            hasAllowedModelsConfig: Array.isArray(
              (llmRaw as { allowedModels?: unknown }).allowedModels,
            ),
            allowedModels: Array.isArray((llmRaw as { allowedModels?: unknown }).allowedModels)
              ? ((llmRaw as { allowedModels?: unknown }).allowedModels as unknown[])
                  .map((model) => (typeof model === "string" ? model.trim() : ""))
                  .filter(Boolean)
              : undefined,
          }
        : undefined;
    const normalizedLlm =
      llm &&
      (typeof llm.allowAgentIdOverride === "boolean" ||
        typeof llm.allowModelOverride === "boolean" ||
        llm.hasAllowedModelsConfig ||
        (Array.isArray(llm.allowedModels) && llm.allowedModels.length > 0))
        ? {
            ...(typeof llm.allowAgentIdOverride === "boolean"
              ? { allowAgentIdOverride: llm.allowAgentIdOverride }
              : {}),
            ...(typeof llm.allowModelOverride === "boolean"
              ? { allowModelOverride: llm.allowModelOverride }
              : {}),
            ...(llm.hasAllowedModelsConfig ? { hasAllowedModelsConfig: true } : {}),
            ...(Array.isArray(llm.allowedModels) && llm.allowedModels.length > 0
              ? { allowedModels: llm.allowedModels }
              : {}),
          }
        : undefined;
    normalized[normalizedKey] = {
      ...normalized[normalizedKey],
      enabled:
        typeof entry.enabled === "boolean" ? entry.enabled : normalized[normalizedKey]?.enabled,
      hooks: normalizedHooks ?? normalized[normalizedKey]?.hooks,
      subagent: normalizedSubagent ?? normalized[normalizedKey]?.subagent,
      llm: normalizedLlm ?? normalized[normalizedKey]?.llm,
      config: "config" in entry ? entry.config : normalized[normalizedKey]?.config,
    };
  }
  return normalized;
};

export const normalizePluginsConfig = (
  config?: CoreBlowConfig["plugins"],
): NormalizedPluginsConfig => {
  const memorySlot = normalizeSlotValue(config?.slots?.memory);
  const contextEngineSlot = normalizeSlotValue(config?.slots?.contextEngine);
  return {
    enabled: config?.enabled !== false,
    allow: normalizeList(config?.allow),
    deny: normalizeList(config?.deny),
    loadPaths: normalizeList(config?.load?.paths),
    slots: {
      memory: memorySlot === undefined ? defaultSlotIdForKey("memory") : memorySlot,
      contextEngine:
        contextEngineSlot === undefined
          ? defaultSlotIdForKey("contextEngine")
          : contextEngineSlot,
    },
    entries: normalizePluginEntries(config?.entries),
  };
};

export type PluginActivationConfigSource = {
  plugins: NormalizedPluginsConfig;
  rootConfig?: CoreBlowConfig;
};

export function createPluginActivationSource(params: {
  config?: CoreBlowConfig;
  plugins?: NormalizedPluginsConfig;
}): PluginActivationConfigSource {
  return {
    plugins: params.plugins ?? normalizePluginsConfig(params.config?.plugins),
    rootConfig: params.config,
  };
};

const hasExplicitMemorySlot = (plugins?: CoreBlowConfig["plugins"]) =>
  Boolean(plugins?.slots && Object.prototype.hasOwnProperty.call(plugins.slots, "memory"));

const hasExplicitMemoryEntry = (plugins?: CoreBlowConfig["plugins"]) =>
  Boolean(plugins?.entries && Object.prototype.hasOwnProperty.call(plugins.entries, "memory-core"));

export const hasExplicitPluginConfig = (plugins?: CoreBlowConfig["plugins"]) => {
  if (!plugins) {
    return false;
  }
  if (typeof plugins.enabled === "boolean") {
    return true;
  }
  if (Array.isArray(plugins.allow) && plugins.allow.length > 0) {
    return true;
  }
  if (Array.isArray(plugins.deny) && plugins.deny.length > 0) {
    return true;
  }
  if (plugins.load?.paths && Array.isArray(plugins.load.paths) && plugins.load.paths.length > 0) {
    return true;
  }
  if (plugins.slots && Object.keys(plugins.slots).length > 0) {
    return true;
  }
  if (plugins.entries && Object.keys(plugins.entries).length > 0) {
    return true;
  }
  return false;
};

export function applyTestPluginDefaults(
  cfg: CoreBlowConfig,
  env: NodeJS.ProcessEnv = process.env,
): CoreBlowConfig {
  if (!env.VITEST) {
    return cfg;
  }
  const plugins = cfg.plugins;
  const explicitConfig = hasExplicitPluginConfig(plugins);
  if (explicitConfig) {
    if (hasExplicitMemorySlot(plugins) || hasExplicitMemoryEntry(plugins)) {
      return cfg;
    }
    return {
      ...cfg,
      plugins: {
        ...plugins,
        slots: {
          ...plugins?.slots,
          memory: "none",
        },
      },
    };
  }

  return {
    ...cfg,
    plugins: {
      ...plugins,
      enabled: false,
      slots: {
        ...plugins?.slots,
        memory: "none",
      },
    },
  };
}

export function isTestDefaultMemorySlotDisabled(
  cfg: CoreBlowConfig,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!env.VITEST) {
    return false;
  }
  const plugins = cfg.plugins;
  if (hasExplicitMemorySlot(plugins) || hasExplicitMemoryEntry(plugins)) {
    return false;
  }
  return true;
}

export function resolveEnableState(
  id: string,
  origin: PluginRecord["origin"],
  config: NormalizedPluginsConfig,
  enabledByDefault?: boolean,
): { enabled: boolean; reason?: string; cause?: PluginActivationCause } {
  if (!config.enabled) {
    return { enabled: false, reason: "plugins disabled", cause: "plugins-disabled" };
  }
  if (config.deny.includes(id)) {
    return { enabled: false, reason: "blocked by denylist", cause: "blocked-by-denylist" };
  }
  const entry = config.entries[id];
  if (entry?.enabled === false) {
    return { enabled: false, reason: "disabled in config", cause: "disabled-in-config" };
  }
  const explicitlyAllowed = config.allow.includes(id);
  if (origin === "workspace" && !explicitlyAllowed && entry?.enabled !== true) {
    return {
      enabled: false,
      reason: "workspace plugin (disabled by default)",
      cause: "workspace-disabled-by-default",
    };
  }
  if (config.slots.memory === id) {
    return { enabled: true, cause: "selected-memory-slot" };
  }
  if (config.allow.length > 0 && !explicitlyAllowed) {
    return { enabled: false, reason: "not in allowlist", cause: "not-in-allowlist" };
  }
  if (entry?.enabled === true) {
    // CoreBlow has no separate source/effective config layer (see the
    // PluginActivationCause doc comment above), so an explicit
    // entries[id].enabled === true is always treated as the explicit/source
    // cause, never "enabled-by-effective-config".
    return { enabled: true, cause: "enabled-in-config" };
  }
  if (origin === "bundled" && enabledByDefault === true) {
    return { enabled: true, cause: "bundled-default-enablement" };
  }
  if (origin === "bundled") {
    return {
      enabled: false,
      reason: "bundled (disabled by default)",
      cause: "bundled-disabled-by-default",
    };
  }
  return { enabled: true };
}

export function isBundledChannelEnabledByChannelConfig(
  cfg: CoreBlowConfig | undefined,
  pluginId: string,
): boolean {
  if (!cfg) {
    return false;
  }
  const channelId = normalizeChatChannelId(pluginId);
  if (!channelId) {
    return false;
  }
  const channels = cfg.channels as Record<string, unknown> | undefined;
  const entry = channels?.[channelId];
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    return false;
  }
  return (entry as Record<string, unknown>).enabled === true;
}

export function resolveEffectiveEnableState(params: {
  id: string;
  origin: PluginRecord["origin"];
  config: NormalizedPluginsConfig;
  rootConfig?: CoreBlowConfig;
  enabledByDefault?: boolean;
}): { enabled: boolean; reason?: string; cause?: PluginActivationCause } {
  const base = resolveEnableState(params.id, params.origin, params.config, params.enabledByDefault);
  if (
    !base.enabled &&
    base.reason === "bundled (disabled by default)" &&
    isBundledChannelEnabledByChannelConfig(params.rootConfig, params.id)
  ) {
    return { enabled: true, cause: "bundled-channel-configured" };
  }
  return base;
}

export type PluginActivationSource = "explicit" | "default" | "fallback";

export type PluginActivationState = {
  enabled: boolean;
  activated: boolean;
  explicitlyEnabled: boolean;
  source: PluginActivationSource;
  reason?: string;
  cause?: PluginActivationCause;
};

export function resolveEffectivePluginActivationState(params: {
  id: string;
  origin: PluginRecord["origin"];
  config: NormalizedPluginsConfig;
  rootConfig?: CoreBlowConfig;
  enabledByDefault?: boolean;
  activationSource?: PluginActivationConfigSource;
  autoEnabledReason?: string;
}): PluginActivationState {
  const activeConfig = params.activationSource?.plugins ?? params.config;
  const activeRoot = params.activationSource?.rootConfig ?? params.rootConfig;
  const base = resolveEffectiveEnableState({
    id: params.id,
    origin: params.origin,
    config: activeConfig,
    rootConfig: activeRoot,
    enabledByDefault: params.enabledByDefault,
  });
  const entry = activeConfig.entries[params.id];
  const explicitlyEnabled =
    entry?.enabled === true ||
    (params.origin === "bundled" && isBundledChannelEnabledByChannelConfig(activeRoot, params.id)) ||
    activeConfig.slots.memory === params.id ||
    activeConfig.slots.contextEngine === params.id ||
    (params.origin !== "bundled" && activeConfig.allow.includes(params.id));
  const source: PluginActivationSource =
    entry?.enabled !== undefined || activeConfig.deny.includes(params.id) || explicitlyEnabled
      ? "explicit"
      : params.origin === "bundled" && params.enabledByDefault === true
        ? "default"
        : "fallback";
  return {
    ...base,
    activated: base.enabled,
    explicitlyEnabled,
    source,
  };
}

export function resolveMemorySlotDecision(params: {
  id: string;
  kind?: string;
  slot: string | null | undefined;
  selectedId: string | null;
}): { enabled: boolean; reason?: string; selected?: boolean } {
  if (params.kind !== "memory") {
    return { enabled: true };
  }
  if (params.slot === null) {
    return { enabled: false, reason: "memory slot disabled" };
  }
  if (typeof params.slot === "string") {
    if (params.slot === params.id) {
      return { enabled: true, selected: true };
    }
    return {
      enabled: false,
      reason: `memory slot set to "${params.slot}"`,
    };
  }
  if (params.selectedId && params.selectedId !== params.id) {
    return {
      enabled: false,
      reason: `memory slot already filled by "${params.selectedId}"`,
    };
  }
  return { enabled: true, selected: true };
}
