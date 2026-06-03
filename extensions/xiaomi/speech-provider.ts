import fs from "node:fs/promises";
import path from "node:path";
import { runFfmpeg } from "coreblow/plugin-sdk/media-runtime";
import { normalizeResolvedSecretInputString } from "coreblow/plugin-sdk/secret-input";
import { withTempWorkspace } from "coreblow/plugin-sdk/temp-path";
import type {
  SpeechDirectiveTokenParseContext,
  SpeechProviderConfig,
  SpeechProviderOverrides,
  SpeechProviderPlugin,
} from "coreblow/plugin-sdk/speech-core";

const DEFAULT_XIAOMI_TTS_BASE_URL = "https://api.xiaomimimo.com/v1";
const DEFAULT_XIAOMI_TTS_MODEL = "mimo-v2.5-tts";
const DEFAULT_XIAOMI_TTS_VOICE = "mimo_default";
const DEFAULT_XIAOMI_TTS_FORMAT = "mp3";

const XIAOMI_TTS_MODELS = ["mimo-v2.5-tts", "mimo-v2-tts"] as const;
const XIAOMI_TTS_VOICES = [
  "mimo_default",
  "default_zh",
  "default_en",
  "Mia",
  "Chloe",
  "Milo",
  "Dean",
] as const;
const XIAOMI_TTS_FORMATS = ["mp3", "wav"] as const;

type XiaomiTtsFormat = (typeof XIAOMI_TTS_FORMATS)[number];

type XiaomiTtsProviderConfig = {
  apiKey?: string;
  baseUrl: string;
  model: string;
  voice: string;
  format: XiaomiTtsFormat;
  style?: string;
};

type XiaomiTtsOverrides = {
  model?: string;
  voice?: string;
  format?: XiaomiTtsFormat;
  style?: string;
};

function trimToUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function normalizeXiaomiTtsBaseUrl(baseUrl?: string): string {
  return (baseUrl?.trim() || DEFAULT_XIAOMI_TTS_BASE_URL).replace(/\/+$/, "");
}

function normalizeXiaomiTtsFormat(value: unknown): XiaomiTtsFormat | undefined {
  const normalized = trimToUndefined(value)?.toLowerCase();
  return XIAOMI_TTS_FORMATS.includes(normalized as XiaomiTtsFormat)
    ? (normalized as XiaomiTtsFormat)
    : undefined;
}

function resolveXiaomiTtsConfigRecord(
  rawConfig: Record<string, unknown>,
): Record<string, unknown> | undefined {
  const providers = asObject(rawConfig.providers);
  return asObject(providers?.xiaomi) ?? asObject(providers?.mimo) ?? asObject(rawConfig.xiaomi);
}

function normalizeXiaomiTtsProviderConfig(
  rawConfig: Record<string, unknown>,
): XiaomiTtsProviderConfig {
  const raw = resolveXiaomiTtsConfigRecord(rawConfig);
  return {
    apiKey: normalizeResolvedSecretInputString({
      value: raw?.apiKey,
      path: "messages.tts.providers.xiaomi.apiKey",
    }),
    baseUrl: normalizeXiaomiTtsBaseUrl(
      trimToUndefined(raw?.baseUrl) ?? trimToUndefined(process.env.XIAOMI_BASE_URL),
    ),
    model:
      trimToUndefined(raw?.model) ??
      trimToUndefined(process.env.XIAOMI_TTS_MODEL) ??
      DEFAULT_XIAOMI_TTS_MODEL,
    voice:
      trimToUndefined(raw?.voice) ??
      trimToUndefined(raw?.voiceId) ??
      trimToUndefined(process.env.XIAOMI_TTS_VOICE) ??
      DEFAULT_XIAOMI_TTS_VOICE,
    format:
      normalizeXiaomiTtsFormat(raw?.format) ??
      normalizeXiaomiTtsFormat(process.env.XIAOMI_TTS_FORMAT) ??
      DEFAULT_XIAOMI_TTS_FORMAT,
    style: trimToUndefined(raw?.style),
  };
}

function readXiaomiTtsProviderConfig(config: SpeechProviderConfig): XiaomiTtsProviderConfig {
  const normalized = normalizeXiaomiTtsProviderConfig({});
  return {
    apiKey:
      normalizeResolvedSecretInputString({
        value: config.apiKey,
        path: "messages.tts.providers.xiaomi.apiKey",
      }) ?? normalized.apiKey,
    baseUrl: normalizeXiaomiTtsBaseUrl(trimToUndefined(config.baseUrl) ?? normalized.baseUrl),
    model: trimToUndefined(config.model) ?? normalized.model,
    voice: trimToUndefined(config.voice) ?? trimToUndefined(config.voiceId) ?? normalized.voice,
    format: normalizeXiaomiTtsFormat(config.format) ?? normalized.format,
    style: trimToUndefined(config.style) ?? normalized.style,
  };
}

function readXiaomiTtsOverrides(
  overrides: SpeechProviderOverrides | undefined,
): XiaomiTtsOverrides {
  if (!overrides) {
    return {};
  }
  return {
    model: trimToUndefined(overrides.model),
    voice: trimToUndefined(overrides.voice) ?? trimToUndefined(overrides.voiceId),
    format: normalizeXiaomiTtsFormat(overrides.format),
    style: trimToUndefined(overrides.style),
  };
}

function parseDirectiveToken(ctx: SpeechDirectiveTokenParseContext): {
  handled: boolean;
  overrides?: SpeechProviderOverrides;
  warnings?: string[];
} {
  switch (ctx.key) {
    case "voice":
    case "voiceid":
    case "voice_id":
    case "mimo_voice":
    case "xiaomi_voice":
      if (!ctx.policy.allowVoice) {
        return { handled: true };
      }
      return { handled: true, overrides: { voice: ctx.value } };
    case "model":
    case "mimo_model":
    case "xiaomi_model":
      if (!ctx.policy.allowModelId) {
        return { handled: true };
      }
      return { handled: true, overrides: { model: ctx.value } };
    case "style":
    case "mimo_style":
    case "xiaomi_style":
      if (!ctx.policy.allowVoiceSettings) {
        return { handled: true };
      }
      return { handled: true, overrides: { style: ctx.value } };
    case "format":
    case "responseformat":
    case "response_format": {
      if (!ctx.policy.allowVoiceSettings) {
        return { handled: true };
      }
      const format = normalizeXiaomiTtsFormat(ctx.value);
      if (!format) {
        return { handled: true, warnings: [`invalid Xiaomi TTS format "${ctx.value}"`] };
      }
      return { handled: true, overrides: { format } };
    }
    default:
      return { handled: false };
  }
}

function buildXiaomiTtsMessages(params: { text: string; style?: string }) {
  const style = trimToUndefined(params.style);
  return [
    ...(style ? [{ role: "user" as const, content: style }] : []),
    { role: "assistant" as const, content: params.text },
  ];
}

function decodeXiaomiAudioData(body: unknown): Buffer {
  const root = asObject(body);
  const choices = Array.isArray(root?.choices) ? root.choices : [];
  const firstChoice = asObject(choices[0]);
  const message = asObject(firstChoice?.message);
  const audio = asObject(message?.audio);
  const audioData = trimToUndefined(audio?.data);
  if (!audioData) {
    throw new Error("Xiaomi TTS API returned no audio data");
  }
  return Buffer.from(audioData, "base64");
}

async function xiaomiTTS(params: {
  text: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  voice: string;
  format: XiaomiTtsFormat;
  style?: string;
  timeoutMs: number;
}): Promise<Buffer> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), params.timeoutMs);

  try {
    const response = await fetch(`${params.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "api-key": params.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: params.model,
        messages: buildXiaomiTtsMessages({ text: params.text, style: params.style }),
        audio: { format: params.format, voice: params.voice },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Xiaomi TTS API error: ${response.status}`);
    }
    return decodeXiaomiAudioData(await response.json());
  } finally {
    clearTimeout(timeout);
  }
}

async function transcodeAudioBufferToOpus(params: {
  audioBuffer: Buffer;
  inputExtension: "mp3" | "wav";
  timeoutMs: number;
}) {
  return await withTempWorkspace({ prefix: "tts-xiaomi-" }, async ({ dir }) => {
    const inputPath = path.join(dir, `input.${params.inputExtension}`);
    const outputPath = path.join(dir, "output.opus");
    await fs.writeFile(inputPath, params.audioBuffer);
    await runFfmpeg(
      [
        "-y",
        "-i",
        inputPath,
        "-c:a",
        "libopus",
        "-b:a",
        "64k",
        outputPath,
      ],
      { timeoutMs: params.timeoutMs },
    );
    return await fs.readFile(outputPath);
  });
}

export function buildXiaomiSpeechProvider(): SpeechProviderPlugin {
  return {
    id: "xiaomi",
    label: "Xiaomi MiMo",
    aliases: ["mimo"],
    autoSelectOrder: 45,
    models: XIAOMI_TTS_MODELS,
    voices: XIAOMI_TTS_VOICES,
    resolveConfig: ({ rawConfig }) => normalizeXiaomiTtsProviderConfig(rawConfig),
    parseDirectiveToken,
    listVoices: async () => XIAOMI_TTS_VOICES.map((voice) => ({ id: voice, name: voice })),
    isConfigured: ({ providerConfig }) =>
      Boolean(readXiaomiTtsProviderConfig(providerConfig).apiKey || process.env.XIAOMI_API_KEY),
    synthesize: async (req) => {
      const config = readXiaomiTtsProviderConfig(req.providerConfig);
      const overrides = readXiaomiTtsOverrides(req.providerOverrides);
      const apiKey = config.apiKey || process.env.XIAOMI_API_KEY;
      if (!apiKey) {
        throw new Error("Xiaomi API key missing");
      }
      const format = overrides.format ?? config.format;
      const audioBuffer = await xiaomiTTS({
        text: req.text,
        apiKey,
        baseUrl: config.baseUrl,
        model: overrides.model ?? config.model,
        voice: overrides.voice ?? config.voice,
        format,
        style: overrides.style ?? config.style,
        timeoutMs: req.timeoutMs,
      });

      if (req.target === "voice-note") {
        const opus = await transcodeAudioBufferToOpus({
          audioBuffer,
          inputExtension: format,
          timeoutMs: req.timeoutMs,
        });
        return {
          audioBuffer: opus,
          outputFormat: "opus",
          fileExtension: ".opus",
          voiceCompatible: true,
        };
      }

      return {
        audioBuffer,
        outputFormat: format,
        fileExtension: format === "wav" ? ".wav" : ".mp3",
        voiceCompatible: false,
      };
    },
  };
}
