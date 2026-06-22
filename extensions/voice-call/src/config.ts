import { z } from "coreblow/plugin-sdk/zod";
import {
  buildSecretInputSchema,
  hasConfiguredSecretInput,
  normalizeResolvedSecretInputString,
  type SecretInput,
} from "coreblow/plugin-sdk/secret-input";
import { TtsAutoSchema, TtsConfigSchema, TtsModeSchema, TtsProviderSchema } from "../api.js";
import { deepMergeDefined } from "./deep-merge.js";
import { DEFAULT_VOICE_CALL_REALTIME_INSTRUCTIONS } from "./realtime-defaults.js";

// -----------------------------------------------------------------------------
// Phone Number Validation
// -----------------------------------------------------------------------------

/**
 * E.164 phone number format: +[country code][number]
 * Examples use 555 prefix (reserved for fictional numbers)
 */
export const E164Schema = z
  .string()
  .regex(/^\+[1-9]\d{1,14}$/, "Expected E.164 format, e.g. +15550001234");

// -----------------------------------------------------------------------------
// Inbound Policy
// -----------------------------------------------------------------------------

/**
 * Controls how inbound calls are handled:
 * - "disabled": Block all inbound calls (outbound only)
 * - "allowlist": Only accept calls from numbers in allowFrom
 * - "pairing": Unknown callers can request pairing (future)
 * - "open": Accept all inbound calls (dangerous!)
 */
export const InboundPolicySchema = z.enum(["disabled", "allowlist", "pairing", "open"]);
export type InboundPolicy = z.infer<typeof InboundPolicySchema>;

// -----------------------------------------------------------------------------
// Provider-Specific Configuration
// -----------------------------------------------------------------------------

export const TelnyxConfigSchema = z
  .object({
    /** Telnyx API v2 key */
    apiKey: z.string().min(1).optional(),
    /** Telnyx connection ID (from Call Control app) */
    connectionId: z.string().min(1).optional(),
    /** Public key for webhook signature verification */
    publicKey: z.string().min(1).optional(),
  })
  .strict();
export type TelnyxConfig = z.infer<typeof TelnyxConfigSchema>;

export const TwilioConfigSchema = z
  .object({
    /** Twilio Account SID */
    accountSid: z.string().min(1).optional(),
    /** Twilio Auth Token */
    authToken: buildSecretInputSchema().optional(),
  })
  .strict();
export type TwilioConfig = z.infer<typeof TwilioConfigSchema>;

export const PlivoConfigSchema = z
  .object({
    /** Plivo Auth ID (starts with MA/SA) */
    authId: z.string().min(1).optional(),
    /** Plivo Auth Token */
    authToken: z.string().min(1).optional(),
  })
  .strict();
export type PlivoConfig = z.infer<typeof PlivoConfigSchema>;

// -----------------------------------------------------------------------------
// STT/TTS Configuration
// -----------------------------------------------------------------------------

export const SttConfigSchema = z
  .object({
    /** STT provider (currently only OpenAI supported) */
    provider: z.literal("openai").default("openai"),
    /** Whisper model to use */
    model: z.string().min(1).default("whisper-1"),
  })
  .strict()
  .default({ provider: "openai", model: "whisper-1" });
export type SttConfig = z.infer<typeof SttConfigSchema>;

export { TtsAutoSchema, TtsConfigSchema, TtsModeSchema, TtsProviderSchema };
export type VoiceCallTtsConfig = z.infer<typeof TtsConfigSchema>;

export const VoiceCallNumberRouteConfigSchema = z
  .object({
    inboundGreeting: z.string().optional(),
    tts: TtsConfigSchema.optional(),
    agentId: z.string().min(1).optional(),
    responseModel: z.string().optional(),
    responseSystemPrompt: z.string().optional(),
    responseTimeoutMs: z.number().int().positive().optional(),
  })
  .strict();
export type VoiceCallNumberRouteConfig = z.infer<typeof VoiceCallNumberRouteConfigSchema>;

// -----------------------------------------------------------------------------
// Webhook Server Configuration
// -----------------------------------------------------------------------------

export const VoiceCallServeConfigSchema = z
  .object({
    /** Port to listen on */
    port: z.number().int().positive().default(3334),
    /** Bind address */
    bind: z.string().default("127.0.0.1"),
    /** Webhook path */
    path: z.string().min(1).default("/voice/webhook"),
  })
  .strict()
  .default({ port: 3334, bind: "127.0.0.1", path: "/voice/webhook" });
export type VoiceCallServeConfig = z.infer<typeof VoiceCallServeConfigSchema>;

export const VoiceCallTailscaleConfigSchema = z
  .object({
    /**
     * Tailscale exposure mode:
     * - "off": No Tailscale exposure
     * - "serve": Tailscale serve (private to tailnet)
     * - "funnel": Tailscale funnel (public HTTPS)
     */
    mode: z.enum(["off", "serve", "funnel"]).default("off"),
    /** Path for Tailscale serve/funnel (should usually match serve.path) */
    path: z.string().min(1).default("/voice/webhook"),
  })
  .strict()
  .default({ mode: "off", path: "/voice/webhook" });
export type VoiceCallTailscaleConfig = z.infer<typeof VoiceCallTailscaleConfigSchema>;

// -----------------------------------------------------------------------------
// Tunnel Configuration (unified ngrok/tailscale)
// -----------------------------------------------------------------------------

export const VoiceCallTunnelConfigSchema = z
  .object({
    /**
     * Tunnel provider:
     * - "none": No tunnel (use publicUrl if set, or manual setup)
     * - "ngrok": Use ngrok for public HTTPS tunnel
     * - "tailscale-serve": Tailscale serve (private to tailnet)
     * - "tailscale-funnel": Tailscale funnel (public HTTPS)
     */
    provider: z.enum(["none", "ngrok", "tailscale-serve", "tailscale-funnel"]).default("none"),
    /** ngrok auth token (optional, enables longer sessions and more features) */
    ngrokAuthToken: z.string().min(1).optional(),
    /** ngrok custom domain (paid feature, e.g., "myapp.ngrok.io") */
    ngrokDomain: z.string().min(1).optional(),
    /**
     * Allow ngrok free tier compatibility mode.
     * When true, forwarded headers may be trusted for loopback requests
     * to reconstruct the public ngrok URL used for signing.
     *
     * IMPORTANT: This does NOT bypass signature verification.
     */
    allowNgrokFreeTierLoopbackBypass: z.boolean().default(false),
  })
  .strict()
  .default({ provider: "none", allowNgrokFreeTierLoopbackBypass: false });
export type VoiceCallTunnelConfig = z.infer<typeof VoiceCallTunnelConfigSchema>;

// -----------------------------------------------------------------------------
// Webhook Security Configuration
// -----------------------------------------------------------------------------

export const VoiceCallWebhookSecurityConfigSchema = z
  .object({
    /**
     * Allowed hostnames for webhook URL reconstruction.
     * Only these hosts are accepted from forwarding headers.
     */
    allowedHosts: z.array(z.string().min(1)).default([]),
    /**
     * Trust X-Forwarded-* headers without a hostname allowlist.
     * WARNING: Only enable if you trust your proxy configuration.
     */
    trustForwardingHeaders: z.boolean().default(false),
    /**
     * Trusted proxy IP addresses. Forwarded headers are only trusted when
     * the remote IP matches one of these addresses.
     */
    trustedProxyIPs: z.array(z.string().min(1)).default([]),
  })
  .strict()
  .default({ allowedHosts: [], trustForwardingHeaders: false, trustedProxyIPs: [] });
export type WebhookSecurityConfig = z.infer<typeof VoiceCallWebhookSecurityConfigSchema>;

// -----------------------------------------------------------------------------
// Outbound Call Configuration
// -----------------------------------------------------------------------------

/**
 * Call mode determines how outbound calls behave:
 * - "notify": Deliver message and auto-hangup after delay (one-way notification)
 * - "conversation": Stay open for back-and-forth until explicit end or timeout
 */
export const CallModeSchema = z.enum(["notify", "conversation"]);
export type CallMode = z.infer<typeof CallModeSchema>;

export const VoiceCallSessionScopeSchema = z.enum(["per-phone", "per-call"]);
export type VoiceCallSessionScope = z.infer<typeof VoiceCallSessionScopeSchema>;

export const OutboundConfigSchema = z
  .object({
    /** Default call mode for outbound calls */
    defaultMode: CallModeSchema.default("notify"),
    /** Seconds to wait after TTS before auto-hangup in notify mode */
    notifyHangupDelaySec: z.number().int().nonnegative().default(3),
  })
  .strict()
  .default({ defaultMode: "notify", notifyHangupDelaySec: 3 });
export type OutboundConfig = z.infer<typeof OutboundConfigSchema>;

export const VoiceCallRealtimeToolPolicySchema = z.enum([
  "disabled",
  "safe-read-only",
  "safe-write",
  "allow-all",
]);
export type VoiceCallRealtimeToolPolicy = z.infer<typeof VoiceCallRealtimeToolPolicySchema>;

export const VoiceCallRealtimeConsultPolicySchema = z.enum(["auto", "substantive", "always"]);
export type VoiceCallRealtimeConsultPolicy = z.infer<typeof VoiceCallRealtimeConsultPolicySchema>;

export const VoiceCallRealtimeFastContextSourceSchema = z.enum(["memory", "sessions"]);
export type VoiceCallRealtimeFastContextSource = z.infer<
  typeof VoiceCallRealtimeFastContextSourceSchema
>;

export const VoiceCallRealtimeFastContextConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    timeoutMs: z.number().int().positive().default(800),
    maxResults: z.number().int().positive().default(3),
    sources: z.array(VoiceCallRealtimeFastContextSourceSchema).min(1).default([
      "memory",
      "sessions",
    ]),
    fallbackToConsult: z.boolean().default(false),
  })
  .strict()
  .default({
    enabled: false,
    timeoutMs: 800,
    maxResults: 3,
    sources: ["memory", "sessions"],
    fallbackToConsult: false,
  });
export type VoiceCallRealtimeFastContextConfig = z.infer<
  typeof VoiceCallRealtimeFastContextConfigSchema
>;

export const VoiceCallRealtimeAgentContextConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    maxChars: z.number().int().positive().default(6000),
    includeIdentity: z.boolean().default(true),
    includeSystemPrompt: z.boolean().default(true),
    includeWorkspaceFiles: z.boolean().default(true),
    files: z.array(z.string().min(1)).default(["SOUL.md", "IDENTITY.md", "USER.md"]),
  })
  .strict()
  .default({
    enabled: false,
    maxChars: 6000,
    includeIdentity: true,
    includeSystemPrompt: true,
    includeWorkspaceFiles: true,
    files: ["SOUL.md", "IDENTITY.md", "USER.md"],
  });
export type VoiceCallRealtimeAgentContextConfig = z.infer<
  typeof VoiceCallRealtimeAgentContextConfigSchema
>;

export const VoiceCallRealtimeConsultThinkingLevelSchema = z.enum([
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "adaptive",
  "max",
]);
export type VoiceCallRealtimeConsultThinkingLevel = z.infer<
  typeof VoiceCallRealtimeConsultThinkingLevelSchema
>;

export const VoiceCallRealtimeConfigSchema = z
  .object({
    enabled: z.boolean().default(false),
    provider: z.string().min(1).optional(),
    streamPath: z.string().min(1).optional(),
    instructions: z.string().default(DEFAULT_VOICE_CALL_REALTIME_INSTRUCTIONS),
    toolPolicy: VoiceCallRealtimeToolPolicySchema.default("safe-read-only"),
    consultPolicy: VoiceCallRealtimeConsultPolicySchema.default("auto"),
    consultThinkingLevel: VoiceCallRealtimeConsultThinkingLevelSchema.optional(),
    consultFastMode: z.boolean().optional(),
    tools: z.array(z.record(z.string(), z.unknown())).default([]),
    fastContext: VoiceCallRealtimeFastContextConfigSchema,
    agentContext: VoiceCallRealtimeAgentContextConfigSchema,
    providers: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  })
  .strict()
  .default({
    enabled: false,
    instructions: DEFAULT_VOICE_CALL_REALTIME_INSTRUCTIONS,
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
  });
export type VoiceCallRealtimeConfig = z.infer<typeof VoiceCallRealtimeConfigSchema>;

// -----------------------------------------------------------------------------
// Streaming Configuration (OpenAI Realtime STT)
// -----------------------------------------------------------------------------

export const VoiceCallStreamingConfigSchema = z
  .object({
    /** Enable real-time audio streaming (requires WebSocket support) */
    enabled: z.boolean().default(false),
    /** Provider id from registered streaming providers */
    provider: z.string().min(1).optional(),
    /** STT provider for real-time transcription */
    sttProvider: z.enum(["openai-realtime"]).default("openai-realtime"),
    /** OpenAI API key for Realtime API (uses OPENAI_API_KEY env if not set) */
    openaiApiKey: z.string().min(1).optional(),
    /** OpenAI transcription model (default: gpt-4o-transcribe) */
    sttModel: z.string().min(1).default("gpt-4o-transcribe"),
    /** VAD silence duration in ms before considering speech ended */
    silenceDurationMs: z.number().int().positive().default(800),
    /** VAD threshold 0-1 (higher = less sensitive) */
    vadThreshold: z.number().min(0).max(1).default(0.5),
    /** WebSocket path for media stream connections */
    streamPath: z.string().min(1).default("/voice/stream"),
    /**
     * Close unauthenticated media stream sockets if no valid `start` frame arrives in time.
     * Protects against pre-auth idle connection hold attacks.
     */
    preStartTimeoutMs: z.number().int().positive().default(5000),
    /** Maximum number of concurrently pending (pre-start) media stream sockets. */
    maxPendingConnections: z.number().int().positive().default(32),
    /** Maximum pending media stream sockets per source IP. */
    maxPendingConnectionsPerIp: z.number().int().positive().default(4),
    /** Hard cap for all open media stream sockets (pending + active). */
    maxConnections: z.number().int().positive().default(128),
    /** Provider-owned config blobs keyed by provider id. */
    providers: z.record(z.string(), z.record(z.string(), z.unknown())).default({}),
  })
  .strict()
  .default({
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
  });
export type VoiceCallStreamingConfig = z.infer<typeof VoiceCallStreamingConfigSchema>;

// -----------------------------------------------------------------------------
// Main Voice Call Configuration
// -----------------------------------------------------------------------------

export const VoiceCallConfigSchema = z
  .object({
    /** Enable voice call functionality */
    enabled: z.boolean().default(false),

    /** Active provider (telnyx, twilio, plivo, or mock) */
    provider: z.enum(["telnyx", "twilio", "plivo", "mock"]).optional(),

    /** Telnyx-specific configuration */
    telnyx: TelnyxConfigSchema.optional(),

    /** Twilio-specific configuration */
    twilio: TwilioConfigSchema.optional(),

    /** Plivo-specific configuration */
    plivo: PlivoConfigSchema.optional(),

    /** Phone number to call from (E.164) */
    fromNumber: E164Schema.optional(),

    /** Default phone number to call (E.164) */
    toNumber: E164Schema.optional(),

    /** Inbound call policy */
    inboundPolicy: InboundPolicySchema.default("disabled"),

    /** Allowlist of phone numbers for inbound calls (E.164) */
    allowFrom: z.array(E164Schema).default([]),

    /** Greeting message for inbound calls */
    inboundGreeting: z.string().optional(),

    /** Per-dialed-number overrides for inbound calls */
    numbers: z.record(E164Schema, VoiceCallNumberRouteConfigSchema).default({}),

    /** Outbound call configuration */
    outbound: OutboundConfigSchema,

    /** Maximum call duration in seconds */
    maxDurationSeconds: z.number().int().positive().default(300),

    /**
     * Maximum age of a call in seconds before it is automatically reaped.
     * Catches calls stuck in unexpected states (e.g., notify-mode calls that
     * never receive a terminal webhook). Set to 0 to disable.
     * Default: 0 (disabled). Recommended: 120-300 for production.
     */
    staleCallReaperSeconds: z.number().int().nonnegative().default(0),

    /** Silence timeout for end-of-speech detection (ms) */
    silenceTimeoutMs: z.number().int().positive().default(800),

    /** Timeout for user transcript (ms) */
    transcriptTimeoutMs: z.number().int().positive().default(180000),

    /** Ring timeout for outbound calls (ms) */
    ringTimeoutMs: z.number().int().positive().default(30000),

    /** Maximum concurrent calls */
    maxConcurrentCalls: z.number().int().positive().default(1),

    /** Webhook server configuration */
    serve: VoiceCallServeConfigSchema,

    /** Tailscale exposure configuration (legacy, prefer tunnel config) */
    tailscale: VoiceCallTailscaleConfigSchema,

    /** Tunnel configuration (unified ngrok/tailscale) */
    tunnel: VoiceCallTunnelConfigSchema,

    /** Webhook signature reconstruction and proxy trust configuration */
    webhookSecurity: VoiceCallWebhookSecurityConfigSchema,

    /** Real-time audio streaming configuration */
    streaming: VoiceCallStreamingConfigSchema,

    /** Realtime voice-to-voice configuration */
    realtime: VoiceCallRealtimeConfigSchema,

    /** Session memory scope for voice conversations. */
    sessionScope: VoiceCallSessionScopeSchema.default("per-phone"),

    /** Public webhook URL override (if set, bypasses tunnel auto-detection) */
    publicUrl: z.string().url().optional(),

    /** Skip webhook signature verification (development only, NOT for production) */
    skipSignatureVerification: z.boolean().default(false),

    /** STT configuration */
    stt: SttConfigSchema,

    /** TTS override (deep-merges with core messages.tts) */
    tts: TtsConfigSchema,

    /** Store path for call logs */
    store: z.string().optional(),

    /** Agent ID to use for voice response generation. */
    agentId: z.string().min(1).optional(),

    /** Model for generating voice responses */
    responseModel: z.string().optional(),

    /** System prompt for voice responses */
    responseSystemPrompt: z.string().optional(),

    /** Timeout for response generation in ms (default 30s) */
    responseTimeoutMs: z.number().int().positive().default(30000),
  })
  .strict();

export type VoiceCallConfig = z.infer<typeof VoiceCallConfigSchema>;
export type VoiceCallEffectiveConfigResult = {
  config: VoiceCallConfig;
  numberRouteKey?: string;
};
type DeepPartial<T> =
  T extends SecretInput
    ? T
    : T extends Array<infer U>
    ? DeepPartial<U>[]
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;
export type VoiceCallConfigInput = DeepPartial<VoiceCallConfig>;
const TWILIO_AUTH_TOKEN_PATH = "plugins.entries.voice-call.config.twilio.authToken";

// -----------------------------------------------------------------------------
// Configuration Helpers
// -----------------------------------------------------------------------------

const DEFAULT_VOICE_CALL_CONFIG = VoiceCallConfigSchema.parse({});

function cloneDefaultVoiceCallConfig(): VoiceCallConfig {
  return structuredClone(DEFAULT_VOICE_CALL_CONFIG);
}

function normalizeVoiceCallTtsConfig(
  defaults: VoiceCallTtsConfig,
  overrides: DeepPartial<NonNullable<VoiceCallTtsConfig>> | undefined,
): VoiceCallTtsConfig {
  if (!defaults && !overrides) {
    return undefined;
  }

  return TtsConfigSchema.parse(deepMergeDefined(defaults ?? {}, overrides ?? {}));
}

export function normalizeVoiceCallConfig(config: VoiceCallConfigInput): VoiceCallConfig {
  const defaults = cloneDefaultVoiceCallConfig();
  return {
    ...defaults,
    ...config,
    allowFrom: config.allowFrom ?? defaults.allowFrom,
    numbers: (config.numbers ?? defaults.numbers) as VoiceCallConfig["numbers"],
    outbound: { ...defaults.outbound, ...config.outbound },
    serve: { ...defaults.serve, ...config.serve },
    tailscale: { ...defaults.tailscale, ...config.tailscale },
    tunnel: { ...defaults.tunnel, ...config.tunnel },
    webhookSecurity: {
      ...defaults.webhookSecurity,
      ...config.webhookSecurity,
      allowedHosts: config.webhookSecurity?.allowedHosts ?? defaults.webhookSecurity.allowedHosts,
      trustedProxyIPs:
        config.webhookSecurity?.trustedProxyIPs ?? defaults.webhookSecurity.trustedProxyIPs,
    },
    streaming: {
      ...defaults.streaming,
      ...config.streaming,
      providers: (config.streaming?.providers ??
        defaults.streaming.providers) as VoiceCallConfig["streaming"]["providers"],
    },
    realtime: {
      ...defaults.realtime,
      ...config.realtime,
      fastContext: {
        ...defaults.realtime.fastContext,
        ...config.realtime?.fastContext,
        sources:
          config.realtime?.fastContext?.sources ?? defaults.realtime.fastContext.sources,
      },
      agentContext: {
        ...defaults.realtime.agentContext,
        ...config.realtime?.agentContext,
        files: config.realtime?.agentContext?.files ?? defaults.realtime.agentContext.files,
      },
      tools: config.realtime?.tools ?? defaults.realtime.tools,
      providers: (config.realtime?.providers ??
        defaults.realtime.providers) as VoiceCallConfig["realtime"]["providers"],
    },
    stt: { ...defaults.stt, ...config.stt },
    tts: normalizeVoiceCallTtsConfig(defaults.tts, config.tts),
  };
}

/**
 * Resolves the configuration by merging environment variables into missing fields.
 * Returns a new configuration object with environment variables applied.
 */
export function resolveVoiceCallConfig(config: VoiceCallConfigInput): VoiceCallConfig {
  const resolved = normalizeVoiceCallConfig(config);

  // Telnyx
  if (resolved.provider === "telnyx") {
    resolved.telnyx = resolved.telnyx ?? {};
    resolved.telnyx.apiKey = resolved.telnyx.apiKey ?? process.env.TELNYX_API_KEY;
    resolved.telnyx.connectionId = resolved.telnyx.connectionId ?? process.env.TELNYX_CONNECTION_ID;
    resolved.telnyx.publicKey = resolved.telnyx.publicKey ?? process.env.TELNYX_PUBLIC_KEY;
  }

  // Twilio
  if (resolved.provider === "twilio") {
    resolved.twilio = resolved.twilio ?? {};
    resolved.twilio.accountSid = resolved.twilio.accountSid ?? process.env.TWILIO_ACCOUNT_SID;
    resolved.twilio.authToken = resolved.twilio.authToken ?? process.env.TWILIO_AUTH_TOKEN;
  }

  // Plivo
  if (resolved.provider === "plivo") {
    resolved.plivo = resolved.plivo ?? {};
    resolved.plivo.authId = resolved.plivo.authId ?? process.env.PLIVO_AUTH_ID;
    resolved.plivo.authToken = resolved.plivo.authToken ?? process.env.PLIVO_AUTH_TOKEN;
  }

  // Tunnel Config
  resolved.tunnel = resolved.tunnel ?? {
    provider: "none",
    allowNgrokFreeTierLoopbackBypass: false,
  };
  resolved.tunnel.allowNgrokFreeTierLoopbackBypass =
    resolved.tunnel.allowNgrokFreeTierLoopbackBypass ?? false;
  resolved.tunnel.ngrokAuthToken = resolved.tunnel.ngrokAuthToken ?? process.env.NGROK_AUTHTOKEN;
  resolved.tunnel.ngrokDomain = resolved.tunnel.ngrokDomain ?? process.env.NGROK_DOMAIN;

  // Webhook Security Config
  resolved.webhookSecurity = resolved.webhookSecurity ?? {
    allowedHosts: [],
    trustForwardingHeaders: false,
    trustedProxyIPs: [],
  };
  resolved.webhookSecurity.allowedHosts = resolved.webhookSecurity.allowedHosts ?? [];
  resolved.webhookSecurity.trustForwardingHeaders =
    resolved.webhookSecurity.trustForwardingHeaders ?? false;
  resolved.webhookSecurity.trustedProxyIPs = resolved.webhookSecurity.trustedProxyIPs ?? [];

  resolved.streaming = resolved.streaming ?? {
    enabled: false,
    sttProvider: "openai-realtime",
    sttModel: "gpt-4o-transcribe",
    silenceDurationMs: 800,
    vadThreshold: 0.5,
    streamPath: "/voice/stream",
    preStartTimeoutMs: 5000,
    maxPendingConnections: 32,
    maxPendingConnectionsPerIp: 4,
    maxConnections: 128,
    providers: {},
  };
  resolved.streaming.providers = resolved.streaming.providers ?? {};
  const openaiCompat = resolved.streaming.providers.openai;
  const openaiConfig =
    openaiCompat && typeof openaiCompat === "object"
      ? { ...(openaiCompat as Record<string, unknown>) }
      : {};
  if (!resolved.streaming.provider && resolved.streaming.sttProvider) {
    resolved.streaming.provider = resolved.streaming.sttProvider;
  }
  if (!openaiConfig.apiKey && resolved.streaming.openaiApiKey) {
    openaiConfig.apiKey = resolved.streaming.openaiApiKey;
  }
  if (!openaiConfig.model && resolved.streaming.sttModel) {
    openaiConfig.model = resolved.streaming.sttModel;
  }
  if (!openaiConfig.silenceDurationMs && resolved.streaming.silenceDurationMs) {
    openaiConfig.silenceDurationMs = resolved.streaming.silenceDurationMs;
  }
  if (!openaiConfig.vadThreshold && resolved.streaming.vadThreshold) {
    openaiConfig.vadThreshold = resolved.streaming.vadThreshold;
  }
  resolved.streaming.providers.openai = openaiConfig;

  return normalizeVoiceCallConfig(resolved);
}

export function resolveTwilioAuthToken(config: VoiceCallConfig): string | undefined {
  const token = config.twilio?.authToken;
  const normalized = normalizeResolvedSecretInputString({
    value: token,
    path: TWILIO_AUTH_TOKEN_PATH,
  });
  if (normalized) {
    return normalized;
  }
  return typeof token === "string" ? token : undefined;
}

export function resolveVoiceCallSessionKey(params: {
  config: VoiceCallConfig;
  callId: string;
  phone?: string;
  explicitSessionKey?: string;
}): string {
  const explicit = params.explicitSessionKey?.trim();
  if (explicit) {
    return explicit;
  }
  if (params.config.sessionScope === "per-call") {
    return `voice:${params.callId}`;
  }
  const normalizedPhone = params.phone?.replace(/[^\d+]/g, "")?.trim();
  if (normalizedPhone) {
    return `voice:${normalizedPhone}`;
  }
  return `voice:${params.callId}`;
}

export function resolveVoiceCallNumberRouteKey(
  config: VoiceCallConfig,
  phone?: string,
): string | undefined {
  if (!phone) {
    return undefined;
  }
  return phone in config.numbers ? phone : undefined;
}

export function resolveVoiceCallEffectiveConfig(
  config: VoiceCallConfig,
  phone?: string,
): VoiceCallEffectiveConfigResult {
  const numberRouteKey = resolveVoiceCallNumberRouteKey(config, phone);
  if (!numberRouteKey) {
    return { config };
  }
  const route = config.numbers[numberRouteKey];
  if (!route) {
    return { config };
  }
  return {
    numberRouteKey,
    config: {
      ...config,
      inboundGreeting: route.inboundGreeting ?? config.inboundGreeting,
      tts: normalizeVoiceCallTtsConfig(config.tts, route.tts),
      agentId: route.agentId ?? config.agentId,
      responseModel: route.responseModel ?? config.responseModel,
      responseSystemPrompt: route.responseSystemPrompt ?? config.responseSystemPrompt,
      responseTimeoutMs: route.responseTimeoutMs ?? config.responseTimeoutMs,
    },
  };
}

/**
 * Validate that the configuration has all required fields for the selected provider.
 */
export function validateProviderConfig(config: VoiceCallConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!config.enabled) {
    return { valid: true, errors: [] };
  }

  if (!config.provider) {
    errors.push("plugins.entries.voice-call.config.provider is required");
  }

  if (!config.fromNumber && config.provider !== "mock") {
    errors.push("plugins.entries.voice-call.config.fromNumber is required");
  }

  if (config.provider === "telnyx") {
    if (!config.telnyx?.apiKey) {
      errors.push(
        "plugins.entries.voice-call.config.telnyx.apiKey is required (or set TELNYX_API_KEY env)",
      );
    }
    if (!config.telnyx?.connectionId) {
      errors.push(
        "plugins.entries.voice-call.config.telnyx.connectionId is required (or set TELNYX_CONNECTION_ID env)",
      );
    }
    if (!config.skipSignatureVerification && !config.telnyx?.publicKey) {
      errors.push(
        "plugins.entries.voice-call.config.telnyx.publicKey is required (or set TELNYX_PUBLIC_KEY env)",
      );
    }
  }

  if (config.provider === "twilio") {
    if (!config.twilio?.accountSid) {
      errors.push(
        "plugins.entries.voice-call.config.twilio.accountSid is required (or set TWILIO_ACCOUNT_SID env)",
      );
    }
    if (!resolveTwilioAuthToken(config) && !hasConfiguredSecretInput(config.twilio?.authToken)) {
      errors.push(
        "plugins.entries.voice-call.config.twilio.authToken is required (or set TWILIO_AUTH_TOKEN env)",
      );
    }
  }

  if (config.provider === "plivo") {
    if (!config.plivo?.authId) {
      errors.push(
        "plugins.entries.voice-call.config.plivo.authId is required (or set PLIVO_AUTH_ID env)",
      );
    }
    if (!config.plivo?.authToken) {
      errors.push(
        "plugins.entries.voice-call.config.plivo.authToken is required (or set PLIVO_AUTH_TOKEN env)",
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
