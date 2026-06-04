import WebSocket from "ws";
import { normalizeResolvedSecretInputString } from "coreblow/plugin-sdk/secret-input";

type MistralRealtimeTranscriptionEncoding =
  | "pcm_s16le"
  | "pcm_s32le"
  | "pcm_f16le"
  | "pcm_f32le"
  | "pcm_mulaw"
  | "pcm_alaw";

export type MistralRealtimeTranscriptionProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  sampleRate?: number;
  encoding?: MistralRealtimeTranscriptionEncoding;
  targetStreamingDelayMs?: number;
};

export type MistralRealtimeTranscriptionCallbacks = {
  onTranscript?: (text: string) => void;
  onPartial?: (text: string) => void;
  onError?: (error: Error) => void;
};

export type MistralRealtimeTranscriptionSessionCreateRequest =
  MistralRealtimeTranscriptionCallbacks & {
    providerConfig?: unknown;
  };

export type MistralRealtimeTranscriptionSession = {
  connect(): Promise<void>;
  sendAudio(audio: Buffer): void;
  close(): void;
  isConnected(): boolean;
};

export type MistralRealtimeTranscriptionProvider = {
  id: string;
  label: string;
  aliases: string[];
  defaultModel: string;
  autoSelectOrder: number;
  resolveConfig: (params: { rawConfig?: unknown }) => MistralRealtimeTranscriptionProviderConfig;
  isConfigured: (params: { providerConfig?: unknown }) => boolean;
  createSession: (
    req: MistralRealtimeTranscriptionSessionCreateRequest,
  ) => MistralRealtimeTranscriptionSession;
};

type MistralRealtimeSessionConfig = MistralRealtimeTranscriptionCallbacks & {
  apiKey: string;
  baseUrl: string;
  model: string;
  sampleRate: number;
  encoding: MistralRealtimeTranscriptionEncoding;
  targetStreamingDelayMs?: number;
};

type MistralRealtimeTranscriptionEvent = {
  type?: string;
  text?: string;
  error?: {
    message?: unknown;
    code?: number;
  };
};

const MISTRAL_REALTIME_DEFAULT_BASE_URL = "wss://api.mistral.ai";
const MISTRAL_REALTIME_DEFAULT_MODEL = "voxtral-mini-transcribe-realtime-2602";
const MISTRAL_REALTIME_DEFAULT_SAMPLE_RATE = 8000;
const MISTRAL_REALTIME_DEFAULT_ENCODING: MistralRealtimeTranscriptionEncoding = "pcm_mulaw";
const MISTRAL_REALTIME_DEFAULT_DELAY_MS = 800;
const MISTRAL_REALTIME_CONNECT_TIMEOUT_MS = 10_000;
const MISTRAL_REALTIME_MAX_RECONNECT_ATTEMPTS = 5;
const MISTRAL_REALTIME_RECONNECT_DELAY_MS = 1000;

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readNestedMistralConfig(rawConfig: unknown): Record<string, unknown> {
  const raw = readRecord(rawConfig);
  const providers = readRecord(raw?.providers);
  return readRecord(providers?.mistral ?? raw?.mistral ?? raw) ?? {};
}

function readFiniteNumber(value: unknown): number | undefined {
  const next =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : undefined;
  return Number.isFinite(next) ? next : undefined;
}

function normalizeMistralEncoding(
  value: unknown,
): MistralRealtimeTranscriptionEncoding | undefined {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  switch (normalized) {
    case "pcm":
    case "linear16":
    case "pcm_s16le":
      return "pcm_s16le";
    case "pcm_s32le":
    case "pcm_f16le":
    case "pcm_f32le":
      return normalized;
    case "mulaw":
    case "ulaw":
    case "g711_ulaw":
    case "g711-mulaw":
    case "pcm_mulaw":
      return "pcm_mulaw";
    case "alaw":
    case "g711_alaw":
    case "g711-alaw":
    case "pcm_alaw":
      return "pcm_alaw";
    default:
      throw new Error(`Invalid Mistral realtime transcription encoding: ${normalized}`);
  }
}

function normalizeMistralRealtimeBaseUrl(value?: string): string {
  const raw = normalizeOptionalString(value ?? process.env.MISTRAL_REALTIME_BASE_URL);
  if (!raw) {
    return MISTRAL_REALTIME_DEFAULT_BASE_URL;
  }
  const url = new URL(raw);
  url.protocol =
    url.protocol === "http:" ? "ws:" : url.protocol === "https:" ? "wss:" : url.protocol;
  url.pathname = url.pathname.replace(/\/v1\/?$/u, "").replace(/\/+$/u, "");
  return url.toString().replace(/\/+$/u, "");
}

function toMistralRealtimeWsUrl(config: {
  baseUrl: string;
  model: string;
  targetStreamingDelayMs?: number;
}): string {
  const base = new URL(`${normalizeMistralRealtimeBaseUrl(config.baseUrl)}/`);
  const url = new URL("v1/audio/transcriptions/realtime", base);
  url.searchParams.set("model", config.model);
  if (config.targetStreamingDelayMs != null) {
    url.searchParams.set("target_streaming_delay_ms", String(config.targetStreamingDelayMs));
  }
  return url.toString();
}

function normalizeProviderConfig(
  rawConfig: unknown,
): MistralRealtimeTranscriptionProviderConfig {
  const raw = readNestedMistralConfig(rawConfig);
  return {
    apiKey: normalizeResolvedSecretInputString({
      value: raw.apiKey,
      path: "plugins.entries.voice-call.config.streaming.providers.mistral.apiKey",
    }),
    baseUrl: normalizeOptionalString(raw.baseUrl),
    model: normalizeOptionalString(raw.model ?? raw.sttModel),
    sampleRate: readFiniteNumber(raw.sampleRate ?? raw.sample_rate),
    encoding: normalizeMistralEncoding(raw.encoding),
    targetStreamingDelayMs: readFiniteNumber(
      raw.targetStreamingDelayMs ?? raw.target_streaming_delay_ms ?? raw.delayMs,
    ),
  };
}

function readErrorDetail(event: MistralRealtimeTranscriptionEvent): string {
  const message = event.error?.message;
  if (typeof message === "string") {
    return message;
  }
  if (message && typeof message === "object") {
    return JSON.stringify(message);
  }
  if (typeof event.error?.code === "number") {
    return `Mistral realtime transcription error (${event.error.code})`;
  }
  return "Mistral realtime transcription error";
}

class MistralRealtimeSession implements MistralRealtimeTranscriptionSession {
  private ws: WebSocket | null = null;
  private connected = false;
  private ready = false;
  private closed = false;
  private partialText = "";
  private reconnectAttempts = 0;

  constructor(private readonly config: MistralRealtimeSessionConfig) {}

  async connect(): Promise<void> {
    this.closed = false;
    this.reconnectAttempts = 0;
    await this.doConnect();
  }

  private async doConnect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(toMistralRealtimeWsUrl(this.config), {
        headers: { Authorization: `Bearer ${this.config.apiKey}` },
      });
      this.ws = ws;

      const timeout = setTimeout(() => {
        reject(new Error("Mistral realtime transcription connection timeout"));
      }, MISTRAL_REALTIME_CONNECT_TIMEOUT_MS);

      ws.on("open", () => {
        this.connected = true;
        this.reconnectAttempts = 0;
      });

      ws.on("message", (data) => {
        try {
          this.handleEvent(JSON.parse(data.toString()) as MistralRealtimeTranscriptionEvent);
          if (this.ready) {
            clearTimeout(timeout);
            resolve();
          }
        } catch {
          this.config.onError?.(new Error("Mistral realtime transcription event parse failed"));
        }
      });

      ws.on("error", (error) => {
        if (!this.ready) {
          clearTimeout(timeout);
          reject(error);
        } else {
          this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      });

      ws.on("close", () => {
        clearTimeout(timeout);
        this.connected = false;
        this.ready = false;
        if (!this.closed) {
          void this.attemptReconnect();
        }
      });
    });
  }

  private async attemptReconnect(): Promise<void> {
    if (this.closed || this.reconnectAttempts >= MISTRAL_REALTIME_MAX_RECONNECT_ATTEMPTS) {
      return;
    }
    this.reconnectAttempts += 1;
    await new Promise((resolve) => setTimeout(resolve, MISTRAL_REALTIME_RECONNECT_DELAY_MS));
    if (!this.closed) {
      await this.doConnect();
    }
  }

  private handleEvent(event: MistralRealtimeTranscriptionEvent): void {
    if (event.type === "session.created") {
      this.ws?.send(
        JSON.stringify({
          type: "session.update",
          session: {
            audio_format: {
              encoding: this.config.encoding,
              sample_rate: this.config.sampleRate,
            },
          },
        }),
      );
      this.ready = true;
      return;
    }
    if (!this.ready && event.type === "error") {
      throw new Error(readErrorDetail(event));
    }
    switch (event.type) {
      case "transcription.text.delta":
        if (event.text) {
          this.partialText += event.text;
          this.config.onPartial?.(this.partialText);
        }
        return;
      case "transcription.segment":
        if (event.text) {
          this.config.onTranscript?.(event.text);
          this.partialText = "";
        }
        return;
      case "transcription.done":
        if (this.partialText.trim()) {
          this.config.onTranscript?.(this.partialText);
          this.partialText = "";
        }
        this.close();
        return;
      case "error":
        this.config.onError?.(new Error(readErrorDetail(event)));
        return;
      default:
        return;
    }
  }

  sendAudio(audio: Buffer): void {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      return;
    }
    this.ws.send(
      JSON.stringify({
        type: "input_audio.append",
        audio: audio.toString("base64"),
      }),
    );
  }

  close(): void {
    this.closed = true;
    this.connected = false;
    this.ready = false;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "input_audio.flush" }));
      this.ws.send(JSON.stringify({ type: "input_audio.end" }));
    }
    this.ws?.close(1000, "closing");
    this.ws = null;
  }

  isConnected(): boolean {
    return this.connected && this.ready;
  }
}

export function buildMistralRealtimeTranscriptionProvider(): MistralRealtimeTranscriptionProvider {
  return {
    id: "mistral",
    label: "Mistral Realtime Transcription",
    aliases: ["mistral-realtime", "voxtral-realtime"],
    defaultModel: MISTRAL_REALTIME_DEFAULT_MODEL,
    autoSelectOrder: 45,
    resolveConfig: ({ rawConfig }) => normalizeProviderConfig(rawConfig),
    isConfigured: ({ providerConfig }) =>
      Boolean(normalizeProviderConfig(providerConfig).apiKey || process.env.MISTRAL_API_KEY),
    createSession: (req) => {
      const config = normalizeProviderConfig(req.providerConfig);
      const apiKey = config.apiKey || process.env.MISTRAL_API_KEY;
      if (!apiKey) {
        throw new Error("Mistral API key missing");
      }
      return new MistralRealtimeSession({
        ...req,
        apiKey,
        baseUrl: normalizeMistralRealtimeBaseUrl(config.baseUrl),
        model: config.model ?? MISTRAL_REALTIME_DEFAULT_MODEL,
        sampleRate: config.sampleRate ?? MISTRAL_REALTIME_DEFAULT_SAMPLE_RATE,
        encoding: config.encoding ?? MISTRAL_REALTIME_DEFAULT_ENCODING,
        targetStreamingDelayMs: config.targetStreamingDelayMs ?? MISTRAL_REALTIME_DEFAULT_DELAY_MS,
      });
    },
  };
}

export const testing = {
  normalizeProviderConfig,
  toMistralRealtimeWsUrl,
};
