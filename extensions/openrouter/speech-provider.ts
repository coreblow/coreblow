import type {
  SpeechProviderConfig,
  SpeechProviderOverrides,
  SpeechProviderPlugin,
} from "coreblow/plugin-sdk/speech-core";
import { OPENROUTER_BASE_URL } from "./provider-catalog.js";

export const OPENROUTER_TTS_MODELS = [
  "hexgrad/kokoro-82m",
  "google/gemini-3.1-flash-tts-preview",
  "mistralai/voxtral-mini-tts-2603",
  "elevenlabs/eleven-turbo-v2",
] as const;

export const OPENROUTER_TTS_VOICES = [
  "af_alloy",
  "af_aoede",
  "af_bella",
  "af_heart",
  "am_adam",
  "am_echo",
  "bf_alice",
  "bm_daniel",
] as const;

type OpenRouterTtsConfig = {
  apiKey?: string;
  baseUrl: string;
  model: string;
  voice: string;
  speed?: number;
};

function trimString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readOpenRouterTtsConfig(config: SpeechProviderConfig): OpenRouterTtsConfig {
  return {
    apiKey: trimString(config.apiKey) ?? trimString(process.env.OPENROUTER_API_KEY),
    baseUrl: trimString(config.baseUrl)?.replace(/\/+$/u, "") ?? OPENROUTER_BASE_URL,
    model: trimString(config.model) ?? OPENROUTER_TTS_MODELS[0],
    voice: trimString(config.voice) ?? OPENROUTER_TTS_VOICES[0],
    speed: asNumber(config.speed),
  };
}

function readOpenRouterTtsOverrides(overrides?: SpeechProviderOverrides): Partial<OpenRouterTtsConfig> {
  return {
    model: trimString(overrides?.model),
    voice: trimString(overrides?.voice),
    speed: asNumber(overrides?.speed),
  };
}

export function buildOpenRouterSpeechHeaders(apiKey: string): Headers {
  return new Headers({
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://coreblow.com",
    "X-OpenRouter-Title": "CoreBlow",
  });
}

export function buildOpenRouterSpeechProvider(): SpeechProviderPlugin {
  return {
    id: "openrouter",
    label: "OpenRouter",
    autoSelectOrder: 40,
    models: [...OPENROUTER_TTS_MODELS],
    voices: [...OPENROUTER_TTS_VOICES],
    resolveConfig: ({ rawConfig }) => {
      const messages = asRecord(rawConfig.messages);
      const tts = asRecord(messages?.tts);
      const providers = asRecord(tts?.providers);
      const providerConfig = asRecord(providers?.openrouter);
      return readOpenRouterTtsConfig(
        providerConfig && typeof providerConfig === "object" ? providerConfig : {},
      );
    },
    listVoices: async () => OPENROUTER_TTS_VOICES.map((voice) => ({ id: voice, name: voice })),
    isConfigured: ({ providerConfig }) => Boolean(readOpenRouterTtsConfig(providerConfig).apiKey),
    synthesize: async (req) => {
      const config = readOpenRouterTtsConfig(req.providerConfig);
      const overrides = readOpenRouterTtsOverrides(req.providerOverrides);
      const apiKey = config.apiKey;
      if (!apiKey) {
        throw new Error("OpenRouter API key missing");
      }
      const responseFormat = req.target === "voice-note" ? "opus" : "mp3";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), req.timeoutMs);
      try {
        const response = await fetch(`${config.baseUrl}/audio/speech`, {
          method: "POST",
          headers: buildOpenRouterSpeechHeaders(apiKey),
          body: JSON.stringify({
            model: overrides.model ?? config.model,
            input: req.text,
            voice: overrides.voice ?? config.voice,
            response_format: responseFormat,
            ...(overrides.speed ?? config.speed ? { speed: overrides.speed ?? config.speed } : {}),
          }),
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error(`OpenRouter TTS API error (${response.status})`);
        }
        return {
          audioBuffer: Buffer.from(await response.arrayBuffer()),
          outputFormat: responseFormat,
          fileExtension: responseFormat === "opus" ? ".opus" : ".mp3",
          voiceCompatible: req.target === "voice-note",
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
