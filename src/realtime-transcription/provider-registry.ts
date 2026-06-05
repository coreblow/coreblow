import type { CoreBlowConfig } from "../config/config.js";
import { isBlockedObjectKey } from "../infra/prototype-keys.js";
import { resolvePluginCapabilityProviders } from "../plugins/capability-provider-runtime.js";
import type { RealtimeTranscriptionProviderPlugin } from "../plugins/types.js";
import type { RealtimeTranscriptionProviderId } from "./provider-types.js";

const BUILTIN_REALTIME_TRANSCRIPTION_PROVIDERS: readonly RealtimeTranscriptionProviderPlugin[] = [];
const UNSAFE_PROVIDER_IDS = new Set(["__proto__", "constructor", "prototype"]);

export function normalizeRealtimeTranscriptionProviderId(
  providerId: string | undefined,
): RealtimeTranscriptionProviderId | undefined {
  const normalized = providerId?.trim().toLowerCase();
  if (!normalized || isBlockedObjectKey(normalized)) {
    return undefined;
  }
  return normalized;
}

function resolveRealtimeTranscriptionProviderEntries(
  cfg?: CoreBlowConfig,
): RealtimeTranscriptionProviderPlugin[] {
  return resolvePluginCapabilityProviders({
    key: "realtimeTranscriptionProviders",
    cfg,
  });
}

function isSafeRealtimeTranscriptionProviderId(id: string | undefined): id is string {
  return Boolean(id && !UNSAFE_PROVIDER_IDS.has(id));
}

function buildProviderMaps(cfg?: CoreBlowConfig): {
  canonical: Map<string, RealtimeTranscriptionProviderPlugin>;
  aliases: Map<string, RealtimeTranscriptionProviderPlugin>;
} {
  const canonical = new Map<string, RealtimeTranscriptionProviderPlugin>();
  const aliases = new Map<string, RealtimeTranscriptionProviderPlugin>();
  const register = (provider: RealtimeTranscriptionProviderPlugin) => {
    const id = normalizeRealtimeTranscriptionProviderId(provider.id);
    if (!isSafeRealtimeTranscriptionProviderId(id)) {
      return;
    }
    canonical.set(id, provider);
    aliases.set(id, provider);
    for (const alias of provider.aliases ?? []) {
      const normalizedAlias = normalizeRealtimeTranscriptionProviderId(alias);
      if (isSafeRealtimeTranscriptionProviderId(normalizedAlias)) {
        aliases.set(normalizedAlias, provider);
      }
    }
  };

  for (const provider of BUILTIN_REALTIME_TRANSCRIPTION_PROVIDERS) {
    register(provider);
  }
  for (const provider of resolveRealtimeTranscriptionProviderEntries(cfg)) {
    register(provider);
  }

  return { canonical, aliases };
}

export function listRealtimeTranscriptionProviders(
  cfg?: CoreBlowConfig,
): RealtimeTranscriptionProviderPlugin[] {
  return [...buildProviderMaps(cfg).canonical.values()];
}

export function getRealtimeTranscriptionProvider(
  providerId: string | undefined,
  cfg?: CoreBlowConfig,
): RealtimeTranscriptionProviderPlugin | undefined {
  const normalized = normalizeRealtimeTranscriptionProviderId(providerId);
  if (!normalized) {
    return undefined;
  }
  return buildProviderMaps(cfg).aliases.get(normalized);
}

export function canonicalizeRealtimeTranscriptionProviderId(
  providerId: string | undefined,
  cfg?: CoreBlowConfig,
): RealtimeTranscriptionProviderId | undefined {
  const normalized = normalizeRealtimeTranscriptionProviderId(providerId);
  if (!normalized) {
    return undefined;
  }
  return getRealtimeTranscriptionProvider(normalized, cfg)?.id ?? normalized;
}
