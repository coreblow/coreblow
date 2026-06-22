import http from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VoiceCallRealtimeConfig } from "../config.js";
import type { CallManager } from "../manager.js";
import type { VoiceCallProvider } from "../providers/base.js";
import type { CallRecord, NormalizedEvent } from "../types.js";
import { connectWs, startUpgradeWsServer, waitForClose } from "../websocket-test-support.js";
import { RealtimeCallHandler } from "./realtime-handler.js";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeRequest(url: string, host = "gateway.ts.net"): http.IncomingMessage {
  const req = new http.IncomingMessage(null as never);
  req.url = url;
  req.method = "POST";
  req.headers = host ? { host } : {};
  return req;
}

function makeHandler(
  overrides?: Partial<VoiceCallRealtimeConfig>,
  deps?: {
    manager?: Partial<CallManager>;
    provider?: Partial<VoiceCallProvider>;
  },
) {
  const config: VoiceCallRealtimeConfig = {
    enabled: true,
    streamPath: overrides?.streamPath ?? "/voice/stream/realtime",
    instructions: overrides?.instructions ?? "Be helpful.",
    toolPolicy: overrides?.toolPolicy ?? "safe-read-only",
    consultPolicy: overrides?.consultPolicy ?? "auto",
    tools: overrides?.tools ?? [],
    fastContext: overrides?.fastContext ?? {
      enabled: false,
      timeoutMs: 800,
      maxResults: 3,
      sources: ["memory", "sessions"],
      fallbackToConsult: false,
    },
    agentContext: overrides?.agentContext ?? {
      enabled: false,
      maxChars: 6000,
      includeIdentity: true,
      includeSystemPrompt: true,
      includeWorkspaceFiles: true,
      files: ["SOUL.md", "IDENTITY.md", "USER.md"],
    },
    providers: overrides?.providers ?? {},
    ...(overrides?.provider ? { provider: overrides.provider } : {}),
  };
  return new RealtimeCallHandler(
    config,
    {
      processEvent: vi.fn(),
      getCall: vi.fn(),
      getCallByProviderCallId: vi.fn(),
      ...deps?.manager,
    } as unknown as CallManager,
    {
      name: "twilio",
      verifyWebhook: vi.fn(),
      parseWebhookEvent: vi.fn(),
      initiateCall: vi.fn(),
      hangupCall: vi.fn(),
      playTts: vi.fn(),
      startListening: vi.fn(),
      stopListening: vi.fn(),
      getCallStatus: vi.fn(),
      ...deps?.provider,
    } as unknown as VoiceCallProvider,
    "/voice/webhook",
  );
}

describe("RealtimeCallHandler", () => {
  it("uses the request host and stream path in TwiML", () => {
    const handler = makeHandler();
    const payload = handler.buildTwiMLPayload(makeRequest("/voice/webhook", "gateway.ts.net"));

    expect(payload.statusCode).toBe(200);
    expect(payload.body).toMatch(
      /wss:\/\/gateway\.ts\.net\/voice\/stream\/realtime\/[0-9a-f-]{36}/,
    );
  });

  it("preserves a public path prefix ahead of serve.path", () => {
    const handler = makeHandler({ streamPath: "/custom/stream/realtime" });
    handler.setPublicUrl("https://public.example/api/voice/webhook");
    const payload = handler.buildTwiMLPayload(makeRequest("/voice/webhook", "127.0.0.1:3334"));

    expect(handler.getStreamPathPattern()).toBe("/api/custom/stream/realtime");
    expect(payload.body).toMatch(
      /wss:\/\/public\.example\/api\/custom\/stream\/realtime\/[0-9a-f-]{36}/,
    );
  });

  it("normalizes Twilio outbound realtime directions", async () => {
    const processEvent = vi.fn();
    const handler = makeHandler(undefined, {
      manager: {
        processEvent,
      },
    });
    const payload = handler.buildTwiMLPayload(
      makeRequest("/voice/webhook"),
      new URLSearchParams({
        Direction: "outbound-dial",
        From: "+15550001234",
        To: "+15550009999",
      }),
    );
    const match = payload.body.match(/wss:\/\/[^/]+(\/[^"]+)/);
    expect(match).toBeTruthy();
    const urlPath = match?.[1];
    if (!urlPath) {
      throw new Error("Failed to extract realtime stream path");
    }

    const server = await startUpgradeWsServer({
      urlPath,
      onUpgrade: (request, socket, head) => {
        handler.handleWebSocketUpgrade(request, socket, head);
      },
    });

    try {
      const ws = await connectWs(server.url);
      ws.send(
        JSON.stringify({
          event: "start",
          start: { streamSid: "MZ-outbound", callSid: "CA-outbound" },
        }),
      );

      await vi.waitFor(() => {
        expect(processEvent).toHaveBeenCalled();
      });

      const event = processEvent.mock.calls[0]?.[0] as NormalizedEvent | undefined;
      expect(event?.type).toBe("call.initiated");
      if (!event || event.type !== "call.initiated") {
        throw new Error("Expected call.initiated");
      }
      expect(event.direction).toBe("outbound");
      expect(event.from).toBe("+15550001234");
      expect(event.to).toBe("+15550009999");
      ws.close();
      await waitForClose(ws);
    } finally {
      await server.close();
    }
  });

  it("joins Telnyx realtime streams to the token-bound call", async () => {
    const getCall = vi.fn(
      (callId: string): CallRecord | undefined =>
        callId === "call-1"
          ? {
              callId: "call-1",
              providerCallId: "telnyx-call-1",
              provider: "telnyx",
              direction: "outbound",
              state: "active",
              from: "+15550001234",
              to: "+15550009999",
              startedAt: Date.now(),
              transcript: [],
              processedEventIds: [],
              metadata: {},
            }
          : undefined,
    );
    const handler = makeHandler(undefined, {
      manager: { getCall },
      provider: { name: "telnyx" },
    });
    const session = handler.issueStreamSession({
      providerName: "telnyx",
      callId: "call-1",
      direction: "outbound",
    });

    const server = await startUpgradeWsServer({
      urlPath: new URL(session.streamUrl).pathname,
      onUpgrade: (request, socket, head) => {
        handler.handleWebSocketUpgrade(request, socket, head);
      },
    });

    try {
      const received: string[] = [];
      const ws = await connectWs(server.url);
      ws.on("message", (data) => {
        received.push(data.toString());
      });
      ws.send(
        JSON.stringify({
          event: "start",
          stream_id: "stream-1",
          start: { call_control_id: "telnyx-call-1" },
        }),
      );

      await vi.waitFor(() => {
        expect(handler.sendAudio("call-1", Buffer.alloc(160, 0x7f))).toBe(true);
        expect(received.length).toBeGreaterThan(0);
      });

      const outbound = JSON.parse(received[0] ?? "{}") as { event?: string; media?: { payload?: string } };
      expect(outbound.event).toBe("media");
      expect(typeof outbound.media?.payload).toBe("string");

      ws.close();
      await waitForClose(ws);
    } finally {
      await server.close();
    }
  });

  it("rejects Telnyx stream starts that do not match the token-bound call", async () => {
    const getCall = vi.fn(
      (callId: string): CallRecord | undefined =>
        callId === "call-1"
          ? {
              callId: "call-1",
              providerCallId: "telnyx-call-1",
              provider: "telnyx",
              direction: "outbound",
              state: "active",
              from: "+15550001234",
              to: "+15550009999",
              startedAt: Date.now(),
              transcript: [],
              processedEventIds: [],
              metadata: {},
            }
          : undefined,
    );
    const handler = makeHandler(undefined, {
      manager: { getCall },
      provider: { name: "telnyx" },
    });
    const session = handler.issueStreamSession({
      providerName: "telnyx",
      callId: "call-1",
      direction: "outbound",
    });
    const server = await startUpgradeWsServer({
      urlPath: new URL(session.streamUrl).pathname,
      onUpgrade: (request, socket, head) => {
        handler.handleWebSocketUpgrade(request, socket, head);
      },
    });

    try {
      const ws = await connectWs(server.url);
      ws.send(
        JSON.stringify({
          event: "start",
          stream_id: "stream-1",
          start: { call_control_id: "telnyx-other" },
        }),
      );
      const closed = await waitForClose(ws);
      expect(closed.code).toBe(1008);
      expect(closed.reason).toContain("Call mismatch");
    } finally {
      await server.close();
    }
  });

  it("ends realtime calls when the telephony stream stops", async () => {
    const processEvent = vi.fn();
    const getCallByProviderCallId = vi.fn(
      (providerCallId: string): CallRecord | undefined =>
        providerCallId === "CA-stream"
          ? {
              callId: "call-1",
              providerCallId,
              provider: "twilio",
              direction: "inbound",
              state: "active",
              from: "+15550001234",
              to: "+15550009999",
              startedAt: Date.now(),
              transcript: [],
              processedEventIds: [],
              metadata: {},
            }
          : undefined,
    );
    const handler = makeHandler(undefined, {
      manager: {
        processEvent,
        getCallByProviderCallId,
      },
    });
    const payload = handler.buildTwiMLPayload(makeRequest("/voice/webhook"));
    const match = payload.body.match(/wss:\/\/[^/]+(\/[^"]+)/);
    expect(match).toBeTruthy();
    const urlPath = match?.[1];
    if (!urlPath) {
      throw new Error("Failed to extract realtime stream path");
    }
    const server = await startUpgradeWsServer({
      urlPath,
      onUpgrade: (request, socket, head) => {
        handler.handleWebSocketUpgrade(request, socket, head);
      },
    });

    try {
      const ws = await connectWs(server.url);
      ws.send(
        JSON.stringify({
          event: "start",
          start: { streamSid: "MZ-stream", callSid: "CA-stream" },
        }),
      );

      ws.send(JSON.stringify({ event: "stop" }));

      await vi.waitFor(() => {
        expect(processEvent).toHaveBeenCalled();
        const ended = processEvent.mock.calls.find(
          ([event]) => (event as NormalizedEvent).type === "call.ended",
        )?.[0] as NormalizedEvent | undefined;
        expect(ended?.type).toBe("call.ended");
        if (!ended || ended.type !== "call.ended") {
          throw new Error("Expected call.ended");
        }
        expect(ended.reason).toBe("completed");
        expect(ended.callId).toBe("call-1");
      });

      ws.close();
      await waitForClose(ws);
    } finally {
      await server.close();
    }
  });
});
