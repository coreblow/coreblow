import type { VoiceCallConfig } from "./config.js";

export function createVoiceCallBaseConfig(params?: {
  provider?: "telnyx" | "twilio" | "plivo" | "mock";
  tunnelProvider?: "none" | "ngrok";
}): VoiceCallConfig {
  return {
    enabled: true,
    provider: params?.provider ?? "mock",
    fromNumber: "+15550001234",
    inboundPolicy: "disabled",
    allowFrom: [],
    numbers: {},
    outbound: { defaultMode: "notify", notifyHangupDelaySec: 3 },
    maxDurationSeconds: 300,
    staleCallReaperSeconds: 600,
    silenceTimeoutMs: 800,
    transcriptTimeoutMs: 180000,
    ringTimeoutMs: 30000,
    maxConcurrentCalls: 1,
    serve: { port: 3334, bind: "127.0.0.1", path: "/voice/webhook" },
    tailscale: { mode: "off", path: "/voice/webhook" },
    tunnel: {
      provider: params?.tunnelProvider ?? "none",
      allowNgrokFreeTierLoopbackBypass: false,
    },
    webhookSecurity: {
      allowedHosts: [],
      trustForwardingHeaders: false,
      trustedProxyIPs: [],
    },
    streaming: {
      enabled: false,
      providers: {},
      sttProvider: "openai-realtime",
      sttModel: "gpt-4o-transcribe",
      silenceDurationMs: 800,
      vadThreshold: 0.5,
      streamPath: "/voice/stream",
      preStartTimeoutMs: 5000,
      maxPendingConnections: 32,
      maxPendingConnectionsPerIp: 4,
      maxConnections: 128,
    },
    realtime: {
      enabled: false,
      instructions:
        "You are CoreBlow's phone-call realtime voice interface. Keep spoken replies brief and natural. When a question needs deeper reasoning, current information, or tools, call coreblow_agent_consult before answering.",
      toolPolicy: "safe-read-only",
      consultPolicy: "auto",
      tools: [],
      fastContext: {
        enabled: false,
        timeoutMs: 800,
        maxResults: 3,
        sources: ["memory", "sessions"],
        fallbackToConsult: false,
      },
      agentContext: {
        enabled: false,
        maxChars: 6000,
        includeIdentity: true,
        includeSystemPrompt: true,
        includeWorkspaceFiles: true,
        files: ["SOUL.md", "IDENTITY.md", "USER.md"],
      },
      providers: {},
    },
    skipSignatureVerification: false,
    sessionScope: "per-phone",
    stt: { provider: "openai", model: "whisper-1" },
    tts: {
      provider: "openai",
      providers: {
        openai: { model: "gpt-4o-mini-tts", voice: "coral" },
      },
    },
    responseModel: "openai/gpt-4o-mini",
    responseTimeoutMs: 30000,
  };
}
