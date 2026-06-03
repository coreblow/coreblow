import { normalizeResolvedSecretInputString } from "coreblow/plugin-sdk/secret-input";
import type {
  SpeechDirectiveTokenParseContext,
  SpeechProviderConfig,
  SpeechProviderOverrides,
  SpeechProviderPlugin,
} from "coreblow/plugin-sdk/speech-core";
import {
  azureSpeechTTS,
  DEFAULT_AZURE_SPEECH_AUDIO_FORMAT,
  DEFAULT_AZURE_SPEECH_LANG,
  DEFAULT_AZURE_SPEECH_TELEPHONY_FORMAT,
  DEFAULT_AZURE_SPEECH_VOICE,
  DEFAULT_AZURE_SPEECH_VOICE_NOTE_FORMAT,
  inferAzureSpeechFileExtension,
  isAzureSpeechVoiceCompatible,
  listAzureSpeechVoices,
  normalizeAzureSpeechBaseUrl,
} from "./tts.js";

type AzureSpeechProviderConfig = {
  apiKey?: string;
  region?: string;
  endpoint?: string;
  baseUrl?: string;
  voice: string;
  lang: string;
  outputFormat: string;
  voiceNoteOutputFormat: string;
  timeoutMs?: number;
};

type AzureSpeechProviderOverrides = {
  voice?: string;
  lang?: string;
  outputFormat?: string;
};

function trimToUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function asFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readAzureSpeechEnvApiKey(): string | undefined {
  return (
    trimToUndefined(process.env.AZURE_SPEECH_KEY) ??
    trimToUndefined(process.env.AZURE_SPEECH_API_KEY) ??
    trimToUndefined(process.env.SPEECH_KEY)
  );
}

function readAzureSpeechEnvRegion(): string | undefined {
  return (
    trimToUndefined(process.env.AZURE_SPEECH_REGION) ?? trimToUndefined(process.env.SPEECH_REGION)
  );
}

function readAzureSpeechEnvEndpoint(): string | undefined {
  return trimToUndefined(process.env.AZURE_SPEECH_ENDPOINT);
}

function resolveAzureSpeechConfigRecord(
  rawConfig: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const providers = asObject(rawConfig.providers);
  return (
    asObject(providers?.["azure-speech"]) ??
    asObject(providers?.azure) ??
    asObject(rawConfig["azure-speech"]) ??
    asObject(rawConfig.azure)
  );
}

function normalizeAzureSpeechProviderConfig(
  rawConfig: Record<string, unknown>,
): AzureSpeechProviderConfig {
  const raw = resolveAzureSpeechConfigRecord(rawConfig);
  const region = trimToUndefined(raw?.region) ?? readAzureSpeechEnvRegion();
  const endpoint = trimToUndefined(raw?.endpoint) ?? readAzureSpeechEnvEndpoint();
  const baseUrl = normalizeAzureSpeechBaseUrl({
    baseUrl: trimToUndefined(raw?.baseUrl),
    endpoint,
    region,
  });
  return {
    apiKey: normalizeResolvedSecretInputString({
      value: raw?.apiKey,
      path: "messages.tts.providers.azure-speech.apiKey",
    }),
    region,
    endpoint,
    baseUrl,
    voice: trimToUndefined(raw?.voice ?? raw?.voiceId) ?? DEFAULT_AZURE_SPEECH_VOICE,
    lang: trimToUndefined(raw?.lang ?? raw?.languageCode) ?? DEFAULT_AZURE_SPEECH_LANG,
    outputFormat: trimToUndefined(raw?.outputFormat) ?? DEFAULT_AZURE_SPEECH_AUDIO_FORMAT,
    voiceNoteOutputFormat:
      trimToUndefined(raw?.voiceNoteOutputFormat) ?? DEFAULT_AZURE_SPEECH_VOICE_NOTE_FORMAT,
    timeoutMs: asFiniteNumber(raw?.timeoutMs),
  };
}

function readAzureSpeechProviderConfig(config: SpeechProviderConfig): AzureSpeechProviderConfig {
  const defaults = normalizeAzureSpeechProviderConfig({});
  const region = trimToUndefined(config.region) ?? defaults.region;
  const endpoint = trimToUndefined(config.endpoint) ?? defaults.endpoint;
  const baseUrl = normalizeAzureSpeechBaseUrl({
    baseUrl: trimToUndefined(config.baseUrl) ?? defaults.baseUrl,
    endpoint,
    region,
  });
  return {
    apiKey: trimToUndefined(config.apiKey) ?? defaults.apiKey,
    region,
    endpoint,
    baseUrl,
    voice: trimToUndefined(config.voice ?? config.voiceId) ?? defaults.voice,
    lang: trimToUndefined(config.lang ?? config.languageCode) ?? defaults.lang,
    outputFormat: trimToUndefined(config.outputFormat) ?? defaults.outputFormat,
    voiceNoteOutputFormat:
      trimToUndefined(config.voiceNoteOutputFormat) ?? defaults.voiceNoteOutputFormat,
    timeoutMs: asFiniteNumber(config.timeoutMs) ?? defaults.timeoutMs,
  };
}

function readAzureSpeechOverrides(
  overrides: SpeechProviderOverrides | undefined,
): AzureSpeechProviderOverrides {
  if (!overrides) {
    return {};
  }
  return {
    voice: trimToUndefined(overrides.voice ?? overrides.voiceId),
    lang: trimToUndefined(overrides.lang ?? overrides.languageCode),
    outputFormat: trimToUndefined(overrides.outputFormat),
  };
}

function parseDirectiveToken(ctx: SpeechDirectiveTokenParseContext): {
  handled: boolean;
  overrides?: SpeechProviderOverrides;
} {
  switch (ctx.key) {
    case "voice":
    case "voiceid":
    case "voice_id":
    case "azure_voice":
    case "azurevoice":
    case "azure_speech_voice":
      if (!ctx.policy.allowVoice) {
        return { handled: true };
      }
      return { handled: true, overrides: { voice: ctx.value } };
    case "lang":
    case "language":
    case "language_code":
    case "languagecode":
    case "azure_lang":
    case "azure_language":
      if (!ctx.policy.allowVoiceSettings) {
        return { handled: true };
      }
      return { handled: true, overrides: { lang: ctx.value } };
    case "output_format":
    case "outputformat":
    case "azure_format":
    case "azure_output_format":
      if (!ctx.policy.allowVoiceSettings) {
        return { handled: true };
      }
      return { handled: true, overrides: { outputFormat: ctx.value } };
    default:
      return { handled: false };
  }
}

function resolveApiKey(config: AzureSpeechProviderConfig): string | undefined {
  return config.apiKey ?? readAzureSpeechEnvApiKey();
}

function resolveTimeoutMs(config: AzureSpeechProviderConfig, timeoutMs: number): number {
  return config.timeoutMs ?? timeoutMs;
}

export function buildAzureSpeechProvider(): SpeechProviderPlugin {
  return {
    id: "azure-speech",
    label: "Azure Speech",
    aliases: ["azure"],
    autoSelectOrder: 30,
    resolveConfig: ({ rawConfig }) => normalizeAzureSpeechProviderConfig(rawConfig),
    parseDirectiveToken,
    listVoices: async (req) => {
      const config = req.providerConfig ? readAzureSpeechProviderConfig(req.providerConfig) : undefined;
      const apiKey = req.apiKey || resolveApiKey(config ?? normalizeAzureSpeechProviderConfig({}));
      if (!apiKey) {
        throw new Error("Azure Speech API key missing");
      }
      return await listAzureSpeechVoices({
        apiKey,
        baseUrl: req.baseUrl ?? config?.baseUrl,
        endpoint: config?.endpoint,
        region: config?.region,
      });
    },
    isConfigured: ({ providerConfig }) => {
      const config = readAzureSpeechProviderConfig(providerConfig);
      return Boolean(resolveApiKey(config) && (config.region || config.endpoint || config.baseUrl));
    },
    synthesize: async (req) => {
      const config = readAzureSpeechProviderConfig(req.providerConfig);
      const overrides = readAzureSpeechOverrides(req.providerOverrides);
      const apiKey = resolveApiKey(config);
      if (!apiKey) {
        throw new Error("Azure Speech API key missing");
      }
      const outputFormat =
        req.target === "voice-note"
          ? config.voiceNoteOutputFormat
          : overrides.outputFormat ?? config.outputFormat;
      const audioBuffer = await azureSpeechTTS({
        text: req.text,
        apiKey,
        baseUrl: config.baseUrl,
        endpoint: config.endpoint,
        region: config.region,
        voice: overrides.voice ?? config.voice,
        lang: overrides.lang ?? config.lang,
        outputFormat,
        timeoutMs: resolveTimeoutMs(config, req.timeoutMs),
      });
      return {
        audioBuffer,
        outputFormat,
        fileExtension: inferAzureSpeechFileExtension(outputFormat),
        voiceCompatible: isAzureSpeechVoiceCompatible(outputFormat),
      };
    },
    synthesizeTelephony: async (req) => {
      const config = readAzureSpeechProviderConfig(req.providerConfig);
      const apiKey = resolveApiKey(config);
      if (!apiKey) {
        throw new Error("Azure Speech API key missing");
      }
      const outputFormat = DEFAULT_AZURE_SPEECH_TELEPHONY_FORMAT;
      return {
        audioBuffer: await azureSpeechTTS({
          text: req.text,
          apiKey,
          baseUrl: config.baseUrl,
          endpoint: config.endpoint,
          region: config.region,
          voice: config.voice,
          lang: config.lang,
          outputFormat,
          timeoutMs: resolveTimeoutMs(config, req.timeoutMs),
        }),
        outputFormat,
        sampleRate: 8_000,
      };
    },
  };
}
