// Shared speech-provider implementation helpers for bundled and third-party plugins.

export type { SpeechProviderPlugin } from "../plugins/types.js";
export type { ResolvedTtsConfig, ResolvedTtsPersona } from "../tts/tts-types.js";
export type {
  SpeechDirectiveTokenParseContext,
  SpeechDirectiveTokenParseResult,
  SpeechListVoicesRequest,
  SpeechModelOverridePolicy,
  SpeechProviderConfig,
  SpeechProviderConfiguredContext,
  SpeechProviderResolveConfigContext,
  SpeechProviderResolveTalkConfigContext,
  SpeechProviderResolveTalkOverridesContext,
  SpeechProviderOverrides,
  SpeechSynthesisRequest,
  SpeechTelephonySynthesisRequest,
  SpeechVoiceOption,
  TtsDirectiveOverrides,
  TtsDirectiveParseResult,
} from "../tts/provider-types.js";

export {
  scheduleCleanup,
  summarizeText,
  normalizeApplyTextNormalization,
  normalizeLanguageCode,
  normalizeSeed,
  requireInRange,
} from "../tts/tts-core.js";
export { parseTtsDirectives } from "../tts/directives.js";
export {
  canonicalizeSpeechProviderId,
  getSpeechProvider,
  listSpeechProviders,
  normalizeSpeechProviderId,
} from "../tts/provider-registry.js";
export { normalizeTtsAutoMode, TTS_AUTO_MODES } from "../tts/tts-auto-mode.js";

export function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
