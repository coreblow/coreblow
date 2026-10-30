// CoreBlow config policy compatibility surface.
// Re-exports activation and normalization helpers from config-state.ts
// under the OpenClaw-compatible API surface.

import type { CoreBlowConfig } from "../config/types.coreblow.js";
import {
  isBundledChannelEnabledByChannelConfig as isBundledChannelEnabledByChannelConfigShared,
  hasExplicitPluginConfig as hasExplicitPluginConfigShared,
  normalizePluginId as normalizePluginIdFn,
  normalizePluginsConfig as normalizePluginsConfigShared,
  resolveEffectiveEnableState,
  resolveEnableState,
  resolveMemorySlotDecision as resolveMemorySlotDecisionShared,
  type NormalizedPluginsConfig as SharedNormalizedPluginsConfig,
  type PluginActivationCause,
} from "./config-state.js";
import type { PluginOrigin } from "./types.js";

export type PluginActivationSource = "disabled" | "explicit" | "auto" | "default";

export type PluginActivationState = {
  enabled: boolean;
  activated: boolean;
  explicitlyEnabled: boolean;
  source: PluginActivationSource;
  reason?: string;
  cause?: PluginActivationCause;
};

export type NormalizedPluginsConfig = SharedNormalizedPluginsConfig;

export { normalizePluginsConfigWithResolver } from "./config-normalization-shared.js";

export function resolvePluginActivationState(params: {
  id: string;
  origin: PluginOrigin;
  config: NormalizedPluginsConfig;
  rootConfig?: CoreBlowConfig;
  enabledByDefault?: boolean;
}): PluginActivationState {
  const result = resolveEffectiveEnableState({
    id: params.id,
    origin: params.origin,
    config: params.config,
    rootConfig: params.rootConfig,
    enabledByDefault: params.enabledByDefault,
  });
  const base = resolveEnableState(
    params.id,
    params.origin,
    params.config,
    params.enabledByDefault,
  );
  return {
    enabled: result.enabled,
    activated: result.enabled,
    explicitlyEnabled: result.cause === "enabled-in-config",
    source: result.enabled
      ? result.cause?.includes("bundled")
        ? "auto"
        : "explicit"
      : result.cause === "disabled-in-config"
        ? "disabled"
        : "default",
    reason: result.reason,
    cause: result.cause,
  };
}

export const hasExplicitPluginConfig = hasExplicitPluginConfigShared;

export const isBundledChannelEnabledByChannelConfig = isBundledChannelEnabledByChannelConfigShared;

export function resolveEffectivePluginActivationState(params: {
  id: string;
  origin: PluginOrigin;
  config: NormalizedPluginsConfig;
  rootConfig?: CoreBlowConfig;
  enabledByDefault?: boolean;
}): PluginActivationState {
  return resolvePluginActivationState(params);
}

export function resolveMemorySlotDecision(params: {
  id: string;
  kind?: string;
  slot: string | null | undefined;
  selectedId: string | null;
}): { enabled: boolean; reason?: string; selected?: boolean } {
  return resolveMemorySlotDecisionShared(params);
}

export { normalizePluginIdFn as identityNormalizePluginId };
