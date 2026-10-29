import { vi, type MockedFunction } from "vitest";
import type { PluginRuntime } from "../testing.js";
import type { DispatchFromConfigResult } from "../../auto-reply/reply/dispatch-from-config.js";
import type { EnvelopeFormatOptions } from "../../auto-reply/envelope.js";
import type { ChannelGroupPolicy } from "../../config/group-policy.js";
import type { ResolvedAgentRoute } from "../../routing/resolve-route.js";

const DEFAULT_PROVIDER = "anthropic";
const DEFAULT_MODEL = "claude-opus-4-6";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends (...args: never[]) => unknown
    ? T[K]
    : T[K] extends ReadonlyArray<unknown>
      ? T[K]
      : T[K] extends object
        ? DeepPartial<T[K]>
        : T[K];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeDeep<T>(base: T, overrides: DeepPartial<T>): T {
  for (const [key, overrideValue] of Object.entries(overrides as Record<string, unknown>)) {
    if (overrideValue === undefined) {
      continue;
    }
    const baseValue = (base as Record<string, unknown>)[key];
    if (isObject(baseValue) && isObject(overrideValue)) {
      (base as Record<string, unknown>)[key] = mergeDeep(baseValue, overrideValue);
      continue;
    }
    (base as Record<string, unknown>)[key] = overrideValue;
  }
  return base as T;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFn = (...args: any[]) => any;

/**
 * Centralized mock helper to avoid widespread unsafe casts.
 * Invariant: vi.fn() provides a callable interface that satisfies
 * the structural requirements of runtime function properties in tests.
 */
export function typedMock<T extends AnyFn>(): MockedFunction<T>;
export function typedMock<T extends AnyFn>(impl: T): MockedFunction<T>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function typedMock(impl?: any): any {
  return impl ? vi.fn(impl) : vi.fn();
}

/**
 * Creates a generic Proxy-based stub for massive channel ops surfaces
 * (like channel.discord, channel.slack) to avoid hundreds of manual stubs.
 * Invariant: Returns a stable callable vi.fn() for any string property accessed,
 * recursively satisfying deeply nested optional function surfaces in test environments.
 */
export function createProxySurface<T extends object>(): T {
  const cache = new Map<string, unknown>();
  const handler: ProxyHandler<object> = {
    get(_target, prop) {
      if (prop in _target) {
        return Reflect.get(_target, prop);
      }
      if (typeof prop !== "string" || prop === "then") {
        return undefined;
      }
      if (!cache.has(prop)) {
        cache.set(prop, new Proxy(vi.fn(), handler));
      }
      return cache.get(prop);
    },
  };
  // Internal isolated cast since Proxy generically maps unknown object properties
  return new Proxy({}, handler) as T;
}

export function createPluginRuntimeMediaMock(
  overrides: Record<string, unknown> = {},
): PluginRuntime["channel"]["media"] {
  const base: PluginRuntime["channel"]["media"] = {
    fetchRemoteMedia: typedMock(),
    saveMediaBuffer: typedMock().mockResolvedValue({
      path: "/tmp/test-media.jpg",
      contentType: "image/jpeg",
    }),
  };
  return mergeDeep(base, overrides);
}

export type PluginRuntimeMediaMock = ReturnType<typeof createPluginRuntimeMediaMock>;

const emptyDispatchResult: DispatchFromConfigResult = {
  queuedFinal: false,
  counts: { tool: 0, block: 0, final: 0 },
};

const emptyAgentRoute: ResolvedAgentRoute = {
  agentId: "main",
  accountId: "default",
  sessionKey: "agent:main:test:dm:peer",
  mainSessionKey: "agent:main:test:dm:peer",
  lastRoutePolicy: "session",
  matchedBy: "default",
  channel: "test",
};

const emptyGroupPolicy: ChannelGroupPolicy = {
  allowlistEnabled: false,
  allowed: true,
};

const emptyEnvelopeOptions: EnvelopeFormatOptions = {
  timezone: "utc",
};

export function createPluginRuntimeMock(overrides: DeepPartial<PluginRuntime> = {}): PluginRuntime {
  const base: PluginRuntime = {
    version: "0.0.0-test",
    config: {
      loadConfig: typedMock(() => ({})),
      writeConfigFile: typedMock(),
      current: typedMock(() => ({})),
      mutateConfigFile: typedMock().mockResolvedValue({
        nextConfig: {},
        previousHash: null,
        persistedHash: null,
        followUp: { mode: "auto", requiresRestart: false },
      }),
      replaceConfigFile: typedMock().mockResolvedValue({
        nextConfig: {},
        previousHash: null,
        persistedHash: null,
        followUp: { mode: "auto", requiresRestart: false },
      }),
    },
    agent: {
      defaults: {
        model: DEFAULT_MODEL,
        provider: DEFAULT_PROVIDER,
      },
      resolveAgentDir: typedMock(() => "/tmp/agent"),
      resolveAgentWorkspaceDir: typedMock(() => "/tmp/workspace"),
      resolveAgentIdentity: typedMock(() => ({ name: "test-agent" })),
      resolveThinkingDefault: typedMock(() => "off"),
      runEmbeddedPiAgent: typedMock().mockResolvedValue({ payloads: [], meta: {} }),
      resolveAgentTimeoutMs: typedMock(() => 30_000),
      ensureAgentWorkspace: typedMock().mockResolvedValue(undefined),
      session: {
        resolveStorePath: typedMock(() => "/tmp/agent-sessions.json"),
        loadSessionStore: typedMock(() => ({})),
        saveSessionStore: typedMock().mockResolvedValue(undefined),
        resolveSessionFilePath: typedMock((sessionId: string) => `/tmp/${sessionId}.json`),
      },
    },
    system: {
      enqueueSystemEvent: typedMock(),
      requestHeartbeatNow: typedMock(),
      runHeartbeatOnce: typedMock(async () => ({ status: "ran" as const, durationMs: 0 })),
      runCommandWithTimeout: typedMock(),
      formatNativeDependencyHint: typedMock(() => ""),
    },
    media: {
      loadWebMedia: typedMock(),
      detectMime: typedMock(),
      mediaKindFromMime: typedMock(),
      isVoiceCompatibleAudio: typedMock(),
      getImageMetadata: typedMock(),
      resizeToJpeg: typedMock(),
    },
    tts: {
      textToSpeech: typedMock(),
      textToSpeechTelephony: typedMock(),
      listVoices: typedMock(),
    },
    mediaUnderstanding: {
      runFile: typedMock(),
      describeImageFile: typedMock(),
      describeImageFileWithModel: typedMock(),
      describeVideoFile: typedMock(),
      transcribeAudioFile: typedMock(),
    },
    imageGeneration: {
      generate: typedMock(),
      listProviders: typedMock(),
    },
    webSearch: {
      listProviders: typedMock(),
      search: typedMock(),
    },
    stt: {
      transcribeAudioFile: typedMock(),
    },
    events: {
      onAgentEvent: typedMock(() => () => {}),
      onSessionTranscriptUpdate: typedMock(() => () => {}),
    },
    logging: {
      shouldLogVerbose: typedMock(() => false),
      getChildLogger: typedMock(() => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      })),
    },
    state: {
      resolveStateDir: typedMock(() => "/tmp/coreblow"),
    },
    modelAuth: {
      getApiKeyForModel: typedMock(),
      resolveApiKeyForProvider: typedMock(),
    },
    subagent: {
      run: typedMock(),
      waitForRun: typedMock(),
      getSessionMessages: typedMock(),
      getSession: typedMock(),
      deleteSession: typedMock(),
    },
    channel: {
      runtimeContexts: {
        register: typedMock(({ abortSignal }: { abortSignal?: AbortSignal }) => {
          const lease = { dispose: vi.fn() };
          abortSignal?.addEventListener("abort", lease.dispose, { once: true });
          return lease;
        }),
        get: typedMock(),
        watch: typedMock(() => vi.fn()),
      },
      text: {
        chunkByNewline: typedMock((text: string) => (text ? [text] : [])),
        chunkMarkdownText: typedMock((text: string) => [text]),
        chunkMarkdownTextWithMode: typedMock((text: string) => (text ? [text] : [])),
        chunkText: typedMock((text: string) => (text ? [text] : [])),
        chunkTextWithMode: typedMock((text: string) => (text ? [text] : [])),
        resolveChunkMode: typedMock(() => "length"),
        resolveTextChunkLimit: typedMock(() => 4000),
        hasControlCommand: typedMock(() => false),
        resolveMarkdownTableMode: typedMock(() => "code"),
        convertMarkdownTables: typedMock((text: string) => text),
      },
      reply: {
        dispatchReplyWithBufferedBlockDispatcher: typedMock(async () => emptyDispatchResult),
        createReplyDispatcherWithTyping: typedMock(),
        resolveEffectiveMessagesConfig: typedMock(),
        resolveHumanDelayConfig: typedMock(),
        dispatchReplyFromConfig: typedMock(async () => emptyDispatchResult),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        withReplyDispatcher: typedMock<PluginRuntime["channel"]["reply"]["withReplyDispatcher"]>(async ({ dispatcher, run, onSettled }: any) => {
          try {
            return await run();
          } finally {
            dispatcher.markComplete();
            try {
              await dispatcher.waitForIdle();
            } finally {
              await onSettled?.();
            }
          }
        }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        finalizeInboundContext: typedMock<PluginRuntime["channel"]["reply"]["finalizeInboundContext"]>((ctx: any) => ctx),
        formatAgentEnvelope: typedMock((opts: { body: string }) => opts.body),
        formatInboundEnvelope: typedMock((opts: { body: string }) => opts.body),
        resolveEnvelopeFormatOptions: typedMock(() => emptyEnvelopeOptions),
      },
      routing: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        buildAgentSessionKey: typedMock(({ agentId, channel, peer }: Parameters<PluginRuntime["channel"]["routing"]["buildAgentSessionKey"]>[0]) =>
          `agent:${agentId}:${channel}:${peer?.kind ?? "direct"}:${peer?.id ?? "peer"}`
        ),
        resolveAgentRoute: typedMock(() => emptyAgentRoute),
      },
      pairing: {
        buildPairingReply: typedMock(() => "Pairing code: TESTCODE"),
        readAllowFromStore: typedMock().mockResolvedValue([]),
        upsertPairingRequest: typedMock().mockResolvedValue({ code: "TESTCODE", created: true }),
      },
      media: createPluginRuntimeMediaMock(),
      activity: {
        record: typedMock(),
        get: typedMock(),
      },
      session: {
        resolveStorePath: typedMock(() => "/tmp/sessions.json"),
        readSessionUpdatedAt: typedMock(() => undefined),
        recordSessionMetaFromInbound: typedMock(),
        recordInboundSession: typedMock(),
        updateLastRoute: typedMock(),
      },
      mentions: {
        buildMentionRegexes: typedMock(() => [/\bbert\b/i]),
        matchesMentionPatterns: typedMock((text: string, regexes: RegExp[]) => regexes.some((r) => r.test(text))),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        matchesMentionWithExplicit: typedMock((params: Parameters<PluginRuntime["channel"]["mentions"]["matchesMentionWithExplicit"]>[0]) =>
          params.explicit?.isExplicitlyMentioned ? true : params.mentionRegexes.some((r: RegExp) => r.test(params.text))
        ),
      },
      reactions: {
        shouldAckReaction: typedMock(() => false),
        removeAckReactionAfterReply: typedMock(),
      },
      groups: {
        resolveGroupPolicy: typedMock(() => emptyGroupPolicy),
        resolveRequireMention: typedMock(() => false),
      },
      debounce: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createInboundDebouncer: typedMock<PluginRuntime["channel"]["debounce"]["createInboundDebouncer"]>((params: any) => ({
          enqueue: async (item: unknown) => { await params.onFlush([item]); },
          flushKey: vi.fn(),
          cancelKey: vi.fn(() => false),
        })),
        resolveInboundDebounceMs: typedMock(() => 0),
      },
      commands: {
        resolveCommandAuthorizedFromAuthorizers: typedMock(() => false),
        isControlCommandMessage: typedMock(),
        shouldComputeCommandAuthorized: typedMock(),
        shouldHandleTextCommands: typedMock(),
      },
      discord: createProxySurface(),
      slack: createProxySurface(),
      telegram: createProxySurface(),
      matrix: createProxySurface(),
      signal: createProxySurface(),
      imessage: createProxySurface(),
      whatsapp: createProxySurface(),
      line: createProxySurface(),
    },
    nodes: {
      list: typedMock().mockResolvedValue({ nodes: [] }),
      invoke: typedMock().mockResolvedValue({}),
    },
    llm: {
      complete: typedMock().mockResolvedValue({
        text: "",
        provider: "mock",
        model: "mock",
        agentId: "mock",
        usage: {},
        audit: { caller: { kind: "host" } },
      }),
    },
    tasks: {
      runs: {
        bindSession: typedMock(() => ({
          sessionKey: "test",
          get: typedMock(),
          list: typedMock(() => []),
          findLatest: typedMock(),
          resolve: typedMock(),
          cancel: typedMock().mockResolvedValue({ found: false, cancelled: false }),
        })),
        fromToolContext: typedMock(() => ({
          sessionKey: "test",
          get: typedMock(),
          list: typedMock(() => []),
          findLatest: typedMock(),
          resolve: typedMock(),
          cancel: typedMock().mockResolvedValue({ found: false, cancelled: false }),
        })),
      },
      flows: {
        bindSession: typedMock(() => ({
          sessionKey: "test",
          get: typedMock(),
          list: typedMock(() => []),
          findLatest: typedMock(),
          resolve: typedMock(),
          getTaskSummary: typedMock(),
        })),
        fromToolContext: typedMock(() => ({
          sessionKey: "test",
          get: typedMock(),
          list: typedMock(() => []),
          findLatest: typedMock(),
          resolve: typedMock(),
          getTaskSummary: typedMock(),
        })),
      },
      managedFlows: {
        bindSession: typedMock(),
        fromToolContext: typedMock(),
      } as unknown as PluginRuntime["tasks"]["managedFlows"],
      flow: {
        bindSession: typedMock(),
        fromToolContext: typedMock(),
      } as unknown as PluginRuntime["tasks"]["flow"],
    },
    taskFlow: {
      bindSession: typedMock(),
      fromToolContext: typedMock(),
    } as unknown as PluginRuntime["taskFlow"],
  };

  return mergeDeep(base, overrides);
}
