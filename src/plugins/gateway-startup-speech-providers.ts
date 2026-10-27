import type { CoreBlowConfig } from "../config/types.coreblow.js";
import { normalizeOptionalLowercaseString } from "../shared/string-coerce.js";
import { resolveEffectiveTtsConfig } from "../tts/tts-config.js";

const TTS_PROVIDER_CONFIG_RESERVED_KEYS = new Set([
  "auto",
  "enabled",
  "maxTextLength",
  "mode",
  "modelOverrides",
  "persona",
  "personas",
  "prefsPath",
  "provider",
  "providers",
  "summaryModel",
  "timeoutMs",
]);

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

export class GatewayStartupSpeechProvidersManager {
  public static normalizeConfiguredSpeechProviderIdForStartup(
    value: unknown,
  ): string | undefined {
    if (typeof value !== "string") {
      return undefined;
    }
    const normalized = normalizeOptionalLowercaseString(value);
    if (!normalized) {
      return undefined;
    }
    return normalized === "edge" ? "microsoft" : normalized;
  }

  private static resolveProviderConfigActivation(
    ttsConfig: Record<string, unknown>,
    providerId: string,
  ): boolean | undefined {
    let fromProviders: boolean | undefined;
    if (isRecord(ttsConfig.providers)) {
      for (const [key, providerConfig] of Object.entries(ttsConfig.providers)) {
        if (
          GatewayStartupSpeechProvidersManager.normalizeConfiguredSpeechProviderIdForStartup(
            key,
          ) === providerId
        ) {
          fromProviders = isConfigActivationValueEnabled(providerConfig);
        }
      }
    }
    if (fromProviders !== undefined) {
      return fromProviders;
    }

    for (const [key, providerConfig] of Object.entries(ttsConfig)) {
      if (TTS_PROVIDER_CONFIG_RESERVED_KEYS.has(key) || !isRecord(providerConfig)) {
        continue;
      }
      if (
        GatewayStartupSpeechProvidersManager.normalizeConfiguredSpeechProviderIdForStartup(
          key,
        ) === providerId
      ) {
        return isConfigActivationValueEnabled(providerConfig);
      }
    }
    return undefined;
  }

  private static addProviderIfEnabled(
    target: Set<string>,
    ttsConfig: Record<string, unknown>,
    providerId: unknown,
  ): void {
    const normalized =
      GatewayStartupSpeechProvidersManager.normalizeConfiguredSpeechProviderIdForStartup(
        providerId,
      );
    if (!normalized) {
      return;
    }
    if (
      GatewayStartupSpeechProvidersManager.resolveProviderConfigActivation(
        ttsConfig,
        normalized,
      ) !== false
    ) {
      target.add(normalized);
    }
  }

  private static findActivePersona(
    ttsConfig: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    const personaId = normalizeOptionalLowercaseString(
      typeof ttsConfig.persona === "string" ? ttsConfig.persona : undefined,
    );
    if (!personaId || !isRecord(ttsConfig.personas)) {
      return undefined;
    }
    for (const [id, persona] of Object.entries(ttsConfig.personas)) {
      if (normalizeOptionalLowercaseString(id) === personaId && isRecord(persona)) {
        return persona;
      }
    }
    return undefined;
  }

  private static addActivePersonaProvider(
    target: Set<string>,
    ttsConfig: Record<string, unknown>,
  ): void {
    const persona = GatewayStartupSpeechProvidersManager.findActivePersona(ttsConfig);
    if (!persona) {
      return;
    }
    const provider =
      GatewayStartupSpeechProvidersManager.normalizeConfiguredSpeechProviderIdForStartup(
        persona.provider,
      );
    if (!provider) {
      return;
    }
    const rootActivation =
      GatewayStartupSpeechProvidersManager.resolveProviderConfigActivation(ttsConfig, provider);
    const personaActivation =
      GatewayStartupSpeechProvidersManager.resolveProviderConfigActivation(persona, provider);
    if ((personaActivation ?? rootActivation) !== false) {
      target.add(provider);
    }
  }

  private static addConfiguredTtsProviderIds(target: Set<string>, value: unknown): void {
    if (!isRecord(value)) {
      return;
    }
    GatewayStartupSpeechProvidersManager.addProviderIfEnabled(target, value, value.provider);
    GatewayStartupSpeechProvidersManager.addActivePersonaProvider(target, value);

    if (isRecord(value.providers)) {
      for (const [providerId, providerConfig] of Object.entries(value.providers)) {
        if (isConfigActivationValueEnabled(providerConfig)) {
          GatewayStartupSpeechProvidersManager.addProviderIfEnabled(target, value, providerId);
        }
      }
    }
    for (const [key, providerConfig] of Object.entries(value)) {
      if (TTS_PROVIDER_CONFIG_RESERVED_KEYS.has(key) || !isRecord(providerConfig)) {
        continue;
      }
      if (isConfigActivationValueEnabled(providerConfig)) {
        GatewayStartupSpeechProvidersManager.addProviderIfEnabled(target, value, key);
      }
    }
  }

  public static collectConfiguredSpeechProviderIds(config: CoreBlowConfig): ReadonlySet<string> {
    const configured = new Set<string>();
    GatewayStartupSpeechProvidersManager.addConfiguredTtsProviderIds(
      configured,
      resolveEffectiveTtsConfig(config),
    );

    const agents = config.agents;
    if (isRecord(agents) && Array.isArray(agents.list)) {
      for (const agent of agents.list) {
        if (isRecord(agent)) {
          if (typeof agent.id === "string") {
            GatewayStartupSpeechProvidersManager.addConfiguredTtsProviderIds(
              configured,
              resolveEffectiveTtsConfig(config, { agentId: agent.id }),
            );
          } else {
            GatewayStartupSpeechProvidersManager.addConfiguredTtsProviderIds(
              configured,
              (agent as { tts?: unknown })?.tts,
            );
          }
        }
      }
    }

    const channels = config.channels;
    if (isRecord(channels)) {
      for (const [channelId, channelConfig] of Object.entries(channels)) {
        if (!isRecord(channelConfig)) {
          continue;
        }
        GatewayStartupSpeechProvidersManager.addConfiguredTtsProviderIds(
          configured,
          resolveEffectiveTtsConfig(config, { channelId }),
        );
        if (isRecord(channelConfig.voice)) {
          GatewayStartupSpeechProvidersManager.addConfiguredTtsProviderIds(
            configured,
            channelConfig.voice.tts,
          );
        }
        if (isRecord(channelConfig.accounts)) {
          for (const [accountId, accountConfig] of Object.entries(channelConfig.accounts)) {
            if (!isRecord(accountConfig)) {
              continue;
            }
            GatewayStartupSpeechProvidersManager.addConfiguredTtsProviderIds(
              configured,
              resolveEffectiveTtsConfig(config, { channelId, accountId }),
            );
            if (isRecord(accountConfig.voice)) {
              GatewayStartupSpeechProvidersManager.addConfiguredTtsProviderIds(
                configured,
                accountConfig.voice.tts,
              );
            }
          }
        }
      }
    }

    const pluginEntries = config.plugins?.entries;
    if (isRecord(pluginEntries)) {
      for (const entry of Object.values(pluginEntries)) {
        if (isRecord(entry) && isRecord(entry.config)) {
          GatewayStartupSpeechProvidersManager.addConfiguredTtsProviderIds(
            configured,
            entry.config.tts,
          );
        }
      }
    }

    return configured;
  }
}

export function normalizeConfiguredSpeechProviderIdForStartup(
  value: unknown,
): string | undefined {
  return GatewayStartupSpeechProvidersManager.normalizeConfiguredSpeechProviderIdForStartup(value);
}

export function collectConfiguredSpeechProviderIds(
  config: CoreBlowConfig,
): ReadonlySet<string> {
  return GatewayStartupSpeechProvidersManager.collectConfiguredSpeechProviderIds(config);
}
