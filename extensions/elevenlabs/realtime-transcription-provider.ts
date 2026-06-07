import type { CoreBlowPluginApi } from "coreblow/plugin-sdk/plugin-entry";
import {
  createRealtimeTranscriptionWebSocketSession,
  type RealtimeTranscriptionProviderConfig,
  type RealtimeTranscriptionSessionCreateRequest,
} from "coreblow/plugin-sdk/realtime-transcription";
import { resolveElevenLabsApiKeyWithProfileFallback } from "./config-api.js";
import { DEFAULT_ELEVENLABS_BASE_URL, normalizeElevenLabsBaseUrl } from "./shared.js";

export const DEFAULT_ELEVENLABS_REALTIME_MODEL = "scribe_v2_realtime";
export const DEFAULT_ELEVENLABS_REALTIME_AUDIO_FORMAT = "ulaw_8000";
export const DEFAULT_ELEVENLABS_REALTIME_SAMPLE_RATE = 8000;

type ElevenLabsRealtimeTranscriptionProviderPlugin = Parameters<
  CoreBlowPluginApi["registerRealtimeTranscriptionProvider"]
>[0];

type ElevenLabsRealtimeConfig = {
  apiKey?: string;
  baseUrl: string;
  modelId: string;
  audioFormat: string;
  sampleRate: number;
  commitStrategy: "vad" | "manual";
};

type ElevenLabsRealtimeEvent = {
  type?: string;
  text?: string;
  error?: {
    message?: string;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function trimString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function normalizeCommitStrategy(value: unknown): "vad" | "manual" {
  const normalized = trimString(value)?.toLowerCase();
  if (normalized === "manual" || normalized === "vad") {
    return normalized;
  }
  if (normalized == null) {
    return "vad";
  }
  throw new Error(`Unsupported ElevenLabs realtime commit strategy "${normalized}"`);
}

function normalizeRealtimeConfig(rawConfig: RealtimeTranscriptionProviderConfig): ElevenLabsRealtimeConfig {
  const providers = asRecord(rawConfig.providers);
  const raw = asRecord(providers.elevenlabs ?? rawConfig.elevenlabs ?? rawConfig);
  return {
    apiKey: trimString(raw.apiKey),
    baseUrl: normalizeElevenLabsBaseUrl(trimString(raw.baseUrl) ?? DEFAULT_ELEVENLABS_BASE_URL),
    modelId: trimString(raw.modelId) ?? DEFAULT_ELEVENLABS_REALTIME_MODEL,
    audioFormat: trimString(raw.audioFormat) ?? DEFAULT_ELEVENLABS_REALTIME_AUDIO_FORMAT,
    sampleRate: positiveNumber(raw.sampleRate) ?? DEFAULT_ELEVENLABS_REALTIME_SAMPLE_RATE,
    commitStrategy: normalizeCommitStrategy(raw.commitStrategy),
  };
}

function resolveApiKey(config: ElevenLabsRealtimeConfig): string | undefined {
  return config.apiKey ?? resolveElevenLabsApiKeyWithProfileFallback() ?? process.env.XI_API_KEY;
}

function buildSessionUrl(config: ElevenLabsRealtimeConfig): string {
  const url = new URL(`${config.baseUrl.replace(/^http/, "ws")}/v1/speech-to-text/realtime`);
  url.searchParams.set("model_id", config.modelId);
  url.searchParams.set("audio_format", config.audioFormat);
  url.searchParams.set("sample_rate", String(config.sampleRate));
  url.searchParams.set("commit_strategy", config.commitStrategy);
  return url.toString();
}

function parseRealtimeMessage(payload: Buffer): ElevenLabsRealtimeEvent {
  const event = JSON.parse(payload.toString()) as ElevenLabsRealtimeEvent;
  return event;
}

function handleRealtimeMessage(event: ElevenLabsRealtimeEvent, callbacks: RealtimeTranscriptionSessionCreateRequest): void {
  switch (event.type) {
    case "session_started":
      return;
    case "partial_transcript":
      if (event.text) {
        callbacks.onPartial?.(event.text);
      }
      return;
    case "committed_transcript":
      if (event.text) {
        callbacks.onTranscript?.(event.text);
      }
      return;
    case "error":
      callbacks.onError?.(new Error(event.error?.message ?? "ElevenLabs realtime transcription error"));
      return;
    default:
      return;
  }
}

export function buildElevenLabsRealtimeTranscriptionProvider(): ElevenLabsRealtimeTranscriptionProviderPlugin {
  return {
    id: "elevenlabs",
    label: "ElevenLabs",
    resolveConfig: ({ rawConfig }) => normalizeRealtimeConfig(rawConfig),
    isConfigured: ({ providerConfig }) => Boolean(resolveApiKey(normalizeRealtimeConfig(providerConfig))),
    createSession: (req) => {
      const config = normalizeRealtimeConfig(req.providerConfig);
      const apiKey = resolveApiKey(config);
      if (!apiKey) {
        throw new Error("ElevenLabs API key missing");
      }
      return createRealtimeTranscriptionWebSocketSession<ElevenLabsRealtimeEvent>({
        providerId: "elevenlabs",
        callbacks: req,
        url: () => buildSessionUrl(config),
        headers: () => ({ "xi-api-key": apiKey }),
        parseMessage: parseRealtimeMessage,
        onMessage: (event) => handleRealtimeMessage(event, req),
        readyOnOpen: true,
        sendAudio(audio, transport) {
          transport.sendJson({
            type: "input_audio_chunk",
            audio: audio.toString("base64"),
          });
        },
      });
    },
  };
}
