import { randomUUID } from "node:crypto";
import http from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import type { VoiceCallRealtimeConfig } from "../config.js";
import type { CallManager } from "../manager.js";
import type { VoiceCallProvider } from "../providers/base.js";
import type { CallId, CallRecord, CallDirection, NormalizedEvent } from "../types.js";
import type { WebhookResponsePayload } from "../webhook.types.js";
import { RealtimeAudioPacer } from "./realtime-audio-pacer.js";
import {
  type StreamFrameAdapter,
  TelnyxStreamFrameAdapter,
  TwilioStreamFrameAdapter,
} from "./stream-frame-adapter.js";

const STREAM_TOKEN_TTL_MS = 30_000;
const DEFAULT_HOST = "localhost:8443";
const MAX_REALTIME_MESSAGE_BYTES = 256 * 1024;

type PendingStreamToken = {
  expiry: number;
  callId?: CallId;
  from?: string;
  to?: string;
  direction?: CallDirection;
  providerName?: "twilio" | "telnyx";
};

export type ToolHandlerContext = {
  partialUserTranscript?: string;
};

export type ToolHandlerFn = (
  args: unknown,
  callId: string,
  context: ToolHandlerContext,
) => Promise<unknown>;

export type StreamSessionRequest = {
  providerName?: "twilio" | "telnyx";
  callId?: CallId;
  from?: string;
  to?: string;
  direction?: CallDirection;
};

export type StreamSession = {
  token: string;
  streamUrl: string;
};

type ActiveRealtimeSession = {
  callId: CallId;
  providerCallId: string;
  ws: WebSocket;
  pacer: RealtimeAudioPacer;
  finalize: (reason: "completed" | "error") => void;
};

function normalizePath(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed) {
    return "/";
  }
  const prefixed = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (prefixed === "/") {
    return prefixed;
  }
  return prefixed.endsWith("/") ? prefixed.slice(0, -1) : prefixed;
}

function makeCallInitiatedEvent(params: {
  callId: CallId;
  providerCallId: string;
  direction?: CallDirection;
  from?: string;
  to?: string;
}): NormalizedEvent {
  return {
    id: `realtime-call-initiated-${randomUUID()}`,
    type: "call.initiated",
    callId: params.callId,
    providerCallId: params.providerCallId,
    timestamp: Date.now(),
    ...(params.direction ? { direction: params.direction } : {}),
    ...(params.from ? { from: params.from } : {}),
    ...(params.to ? { to: params.to } : {}),
  };
}

function makeCallEndedEvent(
  callId: CallId,
  providerCallId: string,
  reason: "completed" | "error",
): NormalizedEvent {
  return {
    id: `realtime-call-ended-${randomUUID()}`,
    type: "call.ended",
    callId,
    providerCallId,
    timestamp: Date.now(),
    reason,
  };
}

export class RealtimeCallHandler {
  private readonly pendingStreamTokens = new Map<string, PendingStreamToken>();
  private readonly activeSessions = new Map<CallId, ActiveRealtimeSession>();
  private publicOrigin: string | null = null;
  private publicPathPrefix = "";

  constructor(
    private readonly config: VoiceCallRealtimeConfig,
    private readonly manager: CallManager,
    private readonly provider: VoiceCallProvider,
    private readonly servePath: string,
  ) {}

  setPublicUrl(url: string): void {
    try {
      const parsed = new URL(url);
      this.publicOrigin = parsed.host;
      const normalizedServePath = normalizePath(this.servePath);
      const normalizedPublicPath = normalizePath(parsed.pathname);
      const idx = normalizedPublicPath.indexOf(normalizedServePath);
      this.publicPathPrefix = idx > 0 ? normalizedPublicPath.slice(0, idx) : "";
    } catch {
      this.publicOrigin = null;
      this.publicPathPrefix = "";
    }
  }

  getStreamPathPattern(): string {
    return `${this.publicPathPrefix}${normalizePath(this.config.streamPath ?? "/voice/stream/realtime")}`;
  }

  buildTwiMLPayload(req: http.IncomingMessage, params?: URLSearchParams): WebhookResponsePayload {
    const rawDirection = params?.get("Direction");
    const previousOrigin = this.publicOrigin;
    if (!previousOrigin) {
      this.publicOrigin = req.headers.host ?? DEFAULT_HOST;
    }
    try {
      const { streamUrl } = this.issueStreamSession({
        providerName: "twilio",
        from: params?.get("From") ?? undefined,
        to: params?.get("To") ?? undefined,
        direction: rawDirection?.startsWith("outbound") ? "outbound" : "inbound",
      });
      return {
        statusCode: 200,
        headers: { "Content-Type": "text/xml" },
        body: `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${streamUrl}" />
  </Connect>
</Response>`,
      };
    } finally {
      this.publicOrigin = previousOrigin;
    }
  }

  issueStreamSession(request: StreamSessionRequest = {}): StreamSession {
    const token = randomUUID();
    this.pendingStreamTokens.set(token, {
      expiry: Date.now() + STREAM_TOKEN_TTL_MS,
      providerName: request.providerName ?? "twilio",
      callId: request.callId,
      from: request.from,
      to: request.to,
      direction: request.direction,
    });
    this.pruneExpiredTokens();
    const host = this.publicOrigin || DEFAULT_HOST;
    return {
      token,
      streamUrl: `wss://${host}${this.getStreamPathPattern()}/${token}`,
    };
  }

  sendAudio(callId: CallId, muLaw: Buffer): boolean {
    const session = this.activeSessions.get(callId);
    if (!session) {
      return false;
    }
    session.pacer.sendAudio(muLaw);
    return true;
  }

  clearAudio(callId: CallId): number {
    return this.activeSessions.get(callId)?.pacer.clearAudio() ?? 0;
  }

  sendMark(callId: CallId, name: string): boolean {
    const session = this.activeSessions.get(callId);
    if (!session) {
      return false;
    }
    session.pacer.sendMark(name);
    return true;
  }

  handleWebSocketUpgrade(request: http.IncomingMessage, socket: Duplex, head: Buffer): void {
    const url = new URL(request.url ?? "/", "wss://localhost");
    const token = url.pathname.split("/").pop() ?? "";
    const callerMeta = this.consumeStreamToken(token);
    if (!callerMeta) {
      socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
      socket.destroy();
      return;
    }

    const adapter: StreamFrameAdapter =
      callerMeta.providerName === "telnyx"
        ? new TelnyxStreamFrameAdapter()
        : new TwilioStreamFrameAdapter();

    const wss = new WebSocketServer({
      noServer: true,
      maxPayload: MAX_REALTIME_MESSAGE_BYTES,
    });

    wss.handleUpgrade(request, socket, head, (ws) => {
      let session: ActiveRealtimeSession | null = null;
      let initialized = false;

      const finalize = (reason: "completed" | "error") => {
        if (!session) {
          return;
        }
        const current = session;
        session = null;
        current.pacer.close();
        this.activeSessions.delete(current.callId);
        this.manager.processEvent(
          makeCallEndedEvent(current.callId, current.providerCallId, reason),
        );
      };

      ws.on("message", (data, isBinary) => {
        if (isBinary) {
          return;
        }

        const frame = adapter.parseInbound(data.toString());
        if (frame.kind === "ignored") {
          return;
        }

        if (frame.kind === "start") {
          if (initialized) {
            return;
          }
          initialized = true;

          const boundCall = callerMeta.callId ? this.manager.getCall(callerMeta.callId) : undefined;
          if (boundCall?.providerCallId && boundCall.providerCallId !== frame.providerCallId) {
            ws.close(1008, "Call mismatch");
            return;
          }

          const callId =
            callerMeta.callId ??
            this.manager.getCallByProviderCallId(frame.providerCallId)?.callId ??
            frame.providerCallId;

          this.maybeRegisterCall({
            callId,
            providerCallId: frame.providerCallId,
            direction: callerMeta.direction,
            from: callerMeta.from,
            to: callerMeta.to,
          });

          session = this.createSession({
            callId,
            providerCallId: frame.providerCallId,
            ws,
            adapter,
            finalize,
          });
          this.activeSessions.set(callId, session);

          const activeCall = this.manager.getCall(callId);
          if (
            callerMeta.direction === "inbound" &&
            this.provider.answerCall &&
            (!activeCall || activeCall.state === "ringing" || activeCall.state === "initiated")
          ) {
            void this.provider.answerCall({
              callId,
              providerCallId: frame.providerCallId,
            });
          }
          return;
        }

        if (!session) {
          return;
        }

        if (frame.kind === "media") {
          return;
        }
        if (frame.kind === "mark") {
          return;
        }
        if (frame.kind === "error") {
          ws.close(1011, frame.detail ?? frame.title ?? "Realtime stream error");
          return;
        }
        if (frame.kind === "stop") {
          finalize("completed");
        }
      });

      ws.on("close", (code) => {
        if (!session) {
          return;
        }
        const reason = code === 1000 || code === 1005 ? "completed" : "error";
        finalize(reason);
      });

      ws.on("error", () => {
        if (!session) {
          return;
        }
        finalize("error");
      });
    });
  }

  private maybeRegisterCall(params: {
    callId: CallId;
    providerCallId: string;
    direction?: CallDirection;
    from?: string;
    to?: string;
  }): CallRecord | undefined {
    const existing =
      this.manager.getCallByProviderCallId(params.providerCallId) ?? this.manager.getCall(params.callId);
    if (existing) {
      return existing;
    }
    this.manager.processEvent(
      makeCallInitiatedEvent({
        callId: params.callId,
        providerCallId: params.providerCallId,
        direction: params.direction,
        from: params.from,
        to: params.to,
      }),
    );
    return this.manager.getCallByProviderCallId(params.providerCallId) ?? this.manager.getCall(params.callId);
  }

  private createSession(params: {
    callId: CallId;
    providerCallId: string;
    ws: WebSocket;
    adapter: StreamFrameAdapter;
    finalize: (reason: "completed" | "error") => void;
  }): ActiveRealtimeSession {
    const send = (message: string): boolean => {
      if (params.ws.readyState !== WebSocket.OPEN) {
        return false;
      }
      try {
        params.ws.send(message);
        return true;
      } catch {
        return false;
      }
    };

    const pacer = new RealtimeAudioPacer({
      send,
      serializer: {
        media: (payloadBase64) => params.adapter.serializeMedia(payloadBase64),
        clear: () => params.adapter.serializeClear(),
        mark: (name) => params.adapter.serializeMark(name),
      },
      onBackpressure: () => {
        params.ws.close(1013, "Realtime audio backpressure");
        params.finalize("error");
      },
    });

    return {
      callId: params.callId,
      providerCallId: params.providerCallId,
      ws: params.ws,
      pacer,
      finalize: params.finalize,
    };
  }

  private consumeStreamToken(token: string): Omit<PendingStreamToken, "expiry"> | null {
    const entry = this.pendingStreamTokens.get(token);
    if (!entry) {
      return null;
    }
    this.pendingStreamTokens.delete(token);
    if (Date.now() > entry.expiry) {
      return null;
    }
    return {
      callId: entry.callId,
      from: entry.from,
      to: entry.to,
      direction: entry.direction,
      providerName: entry.providerName,
    };
  }

  private pruneExpiredTokens(): void {
    const now = Date.now();
    for (const [token, entry] of this.pendingStreamTokens) {
      if (entry.expiry < now) {
        this.pendingStreamTokens.delete(token);
      }
    }
  }
}
