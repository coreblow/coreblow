import type { CoreBlowConfig } from "../config/config.js";
import type { TtsAutoMode, TtsConfig, TtsMode, TtsProvider } from "../config/types.tts.js";
import type { SpeechModelOverridePolicy, SpeechProviderConfig } from "./provider-types.js";

export type ResolvedTtsModelOverrides = SpeechModelOverridePolicy;

export type ResolvedTtsPersona = Record<string, unknown>;

export type ResolvedTtsConfig = {
  auto: TtsAutoMode;
  mode: TtsMode;
  provider: TtsProvider;
  providerSource: "config" | "default";
  persona?: string;
  personas: Record<string, ResolvedTtsPersona>;
  summaryModel?: string;
  modelOverrides: ResolvedTtsModelOverrides;
  providerConfigs: Record<string, SpeechProviderConfig>;
  prefsPath?: string;
  maxTextLength: number;
  timeoutMs: number;
  rawConfig?: TtsConfig;
  sourceConfig?: CoreBlowConfig;
};
