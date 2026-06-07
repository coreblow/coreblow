import { normalizeResolvedSecretInputString } from "coreblow/plugin-sdk/secret-input";
import type {
  SpeechProviderConfig,
  SpeechProviderOverrides,
  SpeechProviderPlugin,
} from "coreblow/plugin-sdk/speech-core";
import { asObject } from "coreblow/plugin-sdk/speech-core";
import {
  DEFAULT_MINIMAX_TTS_BASE_URL,
  MINIMAX_TTS_MODELS,
  MINIMAX_TTS_VOICES,
  minimaxTTS,
  normalizeMinimaxTtsBaseUrl,
} from "./tts.js";

type MinimaxTtsProviderConfig = {
  apiKey?: string;
  baseUrl: string;
  model: string;
  voiceId: string;
  speed?: number;
  vol?: number;
  pitch?: number;
};

function trimToUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeMinimaxProviderConfig(rawConfig: Record<string, unknown>): MinimaxTtsProviderConfig {
  const providers = asObject(rawConfig.providers);
  const raw = asObject(providers?.minimax) ?? asObject(rawConfig.minimax);
  return {
    apiKey: normalizeResolvedSecretInputString({
      value: raw?.apiKey,
      path: "messages.tts.providers.minimax.apiKey",
    }),
    baseUrl: normalizeMinimaxTtsBaseUrl(
      trimToUndefined(raw?.baseUrl) ?? trimToUndefined(process.env.MINIMAX_API_HOST) ?? DEFAULT_MINIMAX_TTS_BASE_URL,
    ),
    model: trimToUndefined(raw?.model) ?? trimToUndefined(process.env.MINIMAX_TTS_MODEL) ?? "speech-2.8-hd",
    voiceId:
      trimToUndefined(raw?.voiceId) ??
      trimToUndefined(process.env.MINIMAX_TTS_VOICE_ID) ??
      "English_expressive_narrator",
    speed: asFiniteNumber(raw?.speed),
    vol: asFiniteNumber(raw?.vol),
    pitch: asFiniteNumber(raw?.pitch),
  };
}

function readMinimaxProviderConfig(config: SpeechProviderConfig): MinimaxTtsProviderConfig {
  const normalized = normalizeMinimaxProviderConfig({});
  return {
    apiKey: trimToUndefined(config.apiKey) ?? normalized.apiKey,
    baseUrl: normalizeMinimaxTtsBaseUrl(trimToUndefined(config.baseUrl) ?? normalized.baseUrl),
    model: trimToUndefined(config.model) ?? normalized.model,
    voiceId: trimToUndefined(config.voiceId) ?? normalized.voiceId,
    speed: asFiniteNumber(config.speed) ?? normalized.speed,
    vol: asFiniteNumber(config.vol) ?? normalized.vol,
    pitch: asFiniteNumber(config.pitch) ?? normalized.pitch,
  };
}

function readMinimaxOverrides(overrides: SpeechProviderOverrides | undefined) {
  return {
    model: trimToUndefined(overrides?.model),
    voiceId: trimToUndefined(overrides?.voiceId),
    speed: asFiniteNumber(overrides?.speed),
    vol: asFiniteNumber(overrides?.vol),
    pitch: asFiniteNumber(overrides?.pitch),
  };
}

export function buildMinimaxSpeechProvider(): SpeechProviderPlugin {
  return {
    id: "minimax",
    label: "MiniMax",
    autoSelectOrder: 40,
    models: [...MINIMAX_TTS_MODELS],
    voices: [...MINIMAX_TTS_VOICES],
    resolveConfig: ({ rawConfig }) => normalizeMinimaxProviderConfig(rawConfig),
    isConfigured: ({ providerConfig }) =>
      Boolean(readMinimaxProviderConfig(providerConfig).apiKey || process.env.MINIMAX_API_KEY),
    synthesize: async (req) => {
      const config = readMinimaxProviderConfig(req.providerConfig);
      const overrides = readMinimaxOverrides(req.providerOverrides);
      const apiKey = config.apiKey || process.env.MINIMAX_API_KEY;
      if (!apiKey) {
        throw new Error("MiniMax API key missing");
      }
      const audioBuffer = await minimaxTTS({
        text: req.text,
        apiKey,
        baseUrl: config.baseUrl,
        model: overrides.model ?? config.model,
        voiceId: overrides.voiceId ?? config.voiceId,
        speed: overrides.speed ?? config.speed,
        vol: overrides.vol ?? config.vol,
        pitch: overrides.pitch ?? config.pitch,
        timeoutMs: req.timeoutMs,
      });
      return {
        audioBuffer,
        outputFormat: "mp3",
        fileExtension: ".mp3",
        voiceCompatible: false,
      };
    },
  };
}
