import { normalizeOptionalString } from "coreblow/plugin-sdk/string-coerce-runtime";
import type { VoiceCallTtsConfig } from "./config.js";

function resolveProviderVoiceSetting(providerConfig: unknown): string | undefined {
  if (!providerConfig || typeof providerConfig !== "object") {
    return undefined;
  }
  const candidate = providerConfig as {
    voice?: unknown;
    voiceId?: unknown;
  };
  return normalizeOptionalString(candidate.voice) ?? normalizeOptionalString(candidate.voiceId);
}

export function resolvePreferredTtsVoice(config: { tts?: VoiceCallTtsConfig }): string | undefined {
  const providers = config.tts?.providers;
  const providerId =
    config.tts?.provider ??
    (providers?.openai ? "openai" : undefined) ??
    (providers?.elevenlabs ? "elevenlabs" : undefined);
  if (!providerId || !providers) {
    return undefined;
  }
  return resolveProviderVoiceSetting(providers[providerId]);
}
