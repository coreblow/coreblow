import type { CoreConfig } from "./core-bridge.js";

export type ResolvedRealtimeVoiceProvider = {
  id: string;
  providerConfig: Record<string, unknown>;
};

export function listRealtimeVoiceProviders(): [] {
  return [];
}

export function getRealtimeVoiceProvider(_providerId: string | undefined): undefined {
  return undefined;
}

export function resolveConfiguredRealtimeVoiceProvider(params: {
  configuredProviderId?: string;
  providerConfigs?: Record<string, Record<string, unknown>>;
  cfg?: CoreConfig;
}): ResolvedRealtimeVoiceProvider {
  const providerId = params.configuredProviderId?.trim();
  if (!providerId) {
    throw new Error("Realtime voice provider is not configured.");
  }
  const providerConfig = params.providerConfigs?.[providerId];
  if (!providerConfig) {
    throw new Error(`Realtime voice provider "${providerId}" is not available in this CoreBlow build.`);
  }
  return {
    id: providerId,
    providerConfig,
  };
}
