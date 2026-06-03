import WebSocket from "ws";
import {
  DEFAULT_DEEPGRAM_AUDIO_BASE_URL,
  DEFAULT_DEEPGRAM_AUDIO_MODEL,
} from "./audio.js";

type DeepgramRealtimeTranscriptionEncoding = "linear16" | "mulaw" | "alaw";

export type DeepgramRealtimeTranscriptionProviderConfig = {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  language?: string;
  sampleRate?: number;
  encoding?: DeepgramRealtimeTranscriptionEncoding;
  interimResults?: boolean;
  endpointingMs?: number;
};

export type DeepgramRealtimeTranscriptionCallbacks = {
  onTranscript?: (text: string) => void;
  onPartial?: (text: string) => void;
  onSpeechStart?: () => void;
  onError?: (error: Error) => void;
};

export type DeepgramRealtimeTranscriptionSessionCreateRequest =
  DeepgramRealtimeTranscriptionCallbacks & {
    providerConfig?: unknown;
  };

export type DeepgramRealtimeTranscriptionSession = {
  connect(): Promise<void>;
  sendAudio(audio: Buffer): void;
  close(): void;
  isConnected(): boolean;
};

export type DeepgramRealtimeTranscriptionProvider = {
  id: string;
  label: string;
  aliases: string[];
  defaultModel: string;
  autoSelectOrder: number;
  resolveConfig: (params: { rawConfig?: unknown }) => DeepgramRealtimeTranscriptionProviderConfig;
  isConfigured: (params: {
    providerConfig?: unknown;
  }) => boolean;
  createSession: (
    req: DeepgramRealtimeTranscriptionSessionCreateRequest,
  ) => DeepgramRealtimeTranscriptionSession;
};

type DeepgramRealtimeSessionConfig = DeepgramRealtimeTranscriptionCallbacks & {
  apiKey: string;
  baseUrl: string;
  model: string;
  sampleRate: number;
  encoding: DeepgramRealtimeTranscriptionEncoding;
  interimResults: boolean;
  endpointingMs: number;
  language?: string;
};

type DeepgramRealtimeEvent = {
  type?: string;
  channel?: {
    alternatives?: Array<{
      transcript?: string;
    }>;
  };
  is_final?: boolean;
  speech_final?: boolean;
  error?: unknown;
  message?: string;
};

const DEEPGRAM_REALTIME_DEFAULT_SAMPLE_RATE = 8000;
const DEEPGRAM_REALTIME_DEFAULT_ENCODING: DeepgramRealtimeTranscriptionEncoding = "mulaw";
const DEEPGRAM_REALTIME_DEFAULT_ENDPOINTING_MS = 800;
const DEEPGRAM_REALTIME_CONNECT_TIMEOUT_MS = 10_000;
const DEEPGRAM_REALTIME_CLOSE_TIMEOUT_MS = 5_000;
const DEEPGRAM_REALTIME_MAX_RECONNECT_ATTEMPTS = 5;
const DEEPGRAM_REALTIME_RECONNECT_DELAY_MS = 1000;
const DEEPGRAM_REALTIME_MAX_QUEUED_BYTES = 2 * 1024 * 1024;

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function readRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readNestedDeepgramConfig(rawConfig: unknown) {
  const raw = readRecord(rawConfig);
  const providers = readRecord(raw?.providers);
  return readRecord(providers?.deepgram ?? raw?.deepgram ?? raw) ?? {};
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

function readBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function normalizeDeepgramEncoding(
  value: unknown,
): DeepgramRealtimeTranscriptionEncoding | undefined {
  const normalized = normalizeOptionalString(value)?.toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "pcm" || normalized === "pcm_s16le" || normalized === "linear16") {
    return "linear16";
  }
  if (normalized === "ulaw" || normalized === "g711_ulaw" || normalized === "g711-mulaw") {
    return "mulaw";
  }
  if (normalized === "g711_alaw" || normalized === "g711-alaw") {
    return "alaw";
  }
  if (normalized === "mulaw" || normalized === "alaw") {
    return normalized;
  }
  throw new Error(`Invalid Deepgram realtime transcription encoding: ${normalized}`);
}

function normalizeDeepgramRealtimeBaseUrl(value?: string): string {
  return normalizeOptionalString(value ?? process.env.DEEPGRAM_BASE_URL) ?? DEFAULT_DEEPGRAM_AUDIO_BASE_URL;
}

function toDeepgramRealtimeWsUrl(config: {
  baseUrl: string;
  model: string;
  sampleRate: number;
  encoding: DeepgramRealtimeTranscriptionEncoding;
  interimResults: boolean;
  endpointingMs: number;
  language?: string;
}): string {
  const url = new URL(normalizeDeepgramRealtimeBaseUrl(config.baseUrl));
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  url.pathname = `${url.pathname.replace(/\/+$/u, "")}/listen`;
  url.searchParams.set("model", config.model);
  url.searchParams.set("encoding", config.encoding);
  url.searchParams.set("sample_rate", String(config.sampleRate));
  url.searchParams.set("channels", "1");
  url.searchParams.set("interim_results", String(config.interimResults));
  url.searchParams.set("endpointing", String(config.endpointingMs));
  if (config.language) {
    url.searchParams.set("language", config.language);
  }
  return url.toString();
}

function normalizeProviderConfig(
  rawConfig: unknown,
): DeepgramRealtimeTranscriptionProviderConfig {
  const raw = readNestedDeepgramConfig(rawConfig);
  return {
    apiKey: normalizeOptionalString(raw.apiKey),
    baseUrl: normalizeOptionalString(raw.baseUrl),
    model: normalizeOptionalString(raw.model ?? raw.sttModel),
    language: normalizeOptionalString(raw.language),
    sampleRate: readFiniteNumber(raw.sampleRate ?? raw.sample_rate),
    encoding: normalizeDeepgramEncoding(raw.encoding),
    interimResults: readBoolean(raw.interimResults ?? raw.interim_results),
    endpointingMs: readFiniteNumber(raw.endpointingMs ?? raw.endpointing ?? raw.silenceDurationMs),
  };
}

function readErrorDetail(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  const record = readRecord(value);
  return (
    normalizeOptionalString(record?.message) ??
    normalizeOptionalString(record?.code) ??
    "Deepgram realtime transcription error"
  );
}

function readTranscriptText(event: DeepgramRealtimeEvent): string | undefined {
  return normalizeOptionalString(event.channel?.alternatives?.[0]?.transcript);
}

class DeepgramRealtimeSession implements DeepgramRealtimeTranscriptionSession {
  private ws: WebSocket | null = null;
  private connected = false;
  private closed = false;
  private reconnectAttempts = 0;

  constructor(private readonly config: DeepgramRealtimeSessionConfig) {}

  async connect(): Promise<void> {
    this.closed = false;
    this.reconnectAttempts = 0;
    await this.doConnect();
  }

  private async doConnect(): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      const ws = new WebSocket(toDeepgramRealtimeWsUrl(this.config), {
        headers: { Authorization: `Token ${this.config.apiKey}` },
      });
      this.ws = ws;

      const timeout = setTimeout(() => {
        reject(new Error("Deepgram realtime transcription connection timeout"));
      }, DEEPGRAM_REALTIME_CONNECT_TIMEOUT_MS);

      ws.on("open", () => {
        clearTimeout(timeout);
        this.connected = true;
        this.reconnectAttempts = 0;
        resolve();
      });

      ws.on("message", (data) => {
        try {
          this.handleEvent(JSON.parse(data.toString()) as DeepgramRealtimeEvent);
        } catch {
          this.config.onError?.(new Error("Deepgram realtime transcription event parse failed"));
        }
      });

      ws.on("error", (error) => {
        if (!this.connected) {
          clearTimeout(timeout);
          reject(error);
        } else {
          this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
        }
      });

      ws.on("close", () => {
        clearTimeout(timeout);
        this.connected = false;
        if (!this.closed) {
          void this.attemptReconnect();
        }
      });
    });
  }

  private async attemptReconnect(): Promise<void> {
    if (this.closed || this.reconnectAttempts >= DEEPGRAM_REALTIME_MAX_RECONNECT_ATTEMPTS) {
      return;
    }
    this.reconnectAttempts += 1;
    await new Promise((resolve) => setTimeout(resolve, DEEPGRAM_REALTIME_RECONNECT_DELAY_MS));
    if (!this.closed) {
      await this.doConnect();
    }
  }

  private handleEvent(event: DeepgramRealtimeEvent): void {
    switch (event.type) {
      case "Results": {
        const text = readTranscriptText(event);
        if (!text) {
          return;
        }
        if (event.is_final || event.speech_final) {
          this.config.onTranscript?.(text);
          return;
        }
        this.config.onPartial?.(text);
        return;
      }
      case "SpeechStarted":
        this.config.onSpeechStart?.();
        return;
      case "Error":
      case "error":
        this.config.onError?.(new Error(readErrorDetail(event.error ?? event.message)));
        return;
      default:
        return;
    }
  }

  sendAudio(audio: Buffer): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(audio);
    }
  }

  close(): void {
    this.closed = true;
    this.connected = false;
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: "Finalize" }));
    }
    this.ws?.close(1000, "closing");
    this.ws = null;
  }

  isConnected(): boolean {
    return this.connected;
  }
}

export function buildDeepgramRealtimeTranscriptionProvider(): DeepgramRealtimeTranscriptionProvider {
  return {
    id: "deepgram",
    label: "Deepgram Realtime Transcription",
    aliases: ["deepgram-realtime", "nova-3-streaming"],
    defaultModel: DEFAULT_DEEPGRAM_AUDIO_MODEL,
    autoSelectOrder: 35,
    resolveConfig: ({ rawConfig }) => normalizeProviderConfig(rawConfig),
    isConfigured: ({ providerConfig }) =>
      Boolean(normalizeProviderConfig(providerConfig).apiKey || process.env.DEEPGRAM_API_KEY),
    createSession: (req) => {
      const config = normalizeProviderConfig(req.providerConfig);
      const apiKey = config.apiKey || process.env.DEEPGRAM_API_KEY;
      if (!apiKey) {
        throw new Error("Deepgram API key missing");
      }
      return new DeepgramRealtimeSession({
        ...req,
        apiKey,
        baseUrl: normalizeDeepgramRealtimeBaseUrl(config.baseUrl),
        model: config.model ?? DEFAULT_DEEPGRAM_AUDIO_MODEL,
        sampleRate: config.sampleRate ?? DEEPGRAM_REALTIME_DEFAULT_SAMPLE_RATE,
        encoding: config.encoding ?? DEEPGRAM_REALTIME_DEFAULT_ENCODING,
        interimResults: config.interimResults ?? true,
        endpointingMs: config.endpointingMs ?? DEEPGRAM_REALTIME_DEFAULT_ENDPOINTING_MS,
        language: config.language,
      });
    },
  };
}

export const testing = {
  toDeepgramRealtimeWsUrl,
  normalizeProviderConfig,
  constants: {
    DEEPGRAM_REALTIME_CLOSE_TIMEOUT_MS,
    DEEPGRAM_REALTIME_MAX_QUEUED_BYTES,
  },
};
