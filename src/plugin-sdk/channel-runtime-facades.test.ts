import { describe, expect, it, vi } from "vitest";

// channel-route
import {
  channelRouteCompactKey,
  channelRouteDedupeKey,
  channelRouteIdentityKey,
  channelRouteKey,
  channelRouteTarget,
  channelRouteThreadId,
  channelRoutesMatchExact,
  channelRoutesShareConversation,
  channelRouteTargetsMatchExact,
  channelRouteTargetsShareConversation,
  normalizeChannelRouteRef,
  normalizeChannelRouteTarget,
  normalizeRouteThreadId,
  resolveChannelRouteTargetWithParser,
  stringifyRouteThreadId,
} from "./channel-route.js";

// channel-lifecycle.core
import {
  createAccountStatusSink,
  createChannelRunQueue,
  keepHttpServerTaskAlive,
  runPassiveAccountLifecycle,
  waitUntilAbort,
} from "./channel-lifecycle.core.js";

// channel-streaming
import {
  buildChannelProgressDraftLine,
  createChannelProgressDraftGate,
  DEFAULT_PROGRESS_DRAFT_INITIAL_DELAY_MS,
  DEFAULT_PROGRESS_DRAFT_LABELS,
  formatChannelProgressDraftLine,
  formatChannelProgressDraftText,
  isChannelProgressDraftWorkToolName,
  isPotentialTruncatedFinal,
  mergeChannelProgressDraftLine,
  resolveChannelPreviewStreamMode,
  resolveChannelProgressDraftLabel,
  resolveChannelStreamingBlockEnabled,
  resolveChannelStreamingChunkMode,
  resolveChannelStreamingNativeTransport,
  selectLongerFinalText,
} from "./channel-streaming.js";

// messaging-targets
import {
  buildMessagingTarget,
  ensureTargetId,
  normalizeTargetId,
  parseAtUserTarget,
  parseTargetMention,
} from "./messaging-targets.js";

// runtime-logger
import {
  createLoggerBackedRuntime,
  resolveRuntimeEnv,
} from "./runtime-logger.js";

// string-coerce helper used by channel-route
import { normalizeOptionalThreadValue } from "../shared/string-coerce.js";

// ─────────────────────────────────────────────────────────────────────────────
// channel-route tests
// ─────────────────────────────────────────────────────────────────────────────

describe("normalizeOptionalThreadValue", () => {
  it("truncates floats to integers", () => {
    expect(normalizeOptionalThreadValue(3.7)).toBe(3);
  });
  it("returns undefined for non-finite numbers", () => {
    expect(normalizeOptionalThreadValue(Infinity)).toBeUndefined();
  });
  it("trims and returns strings", () => {
    expect(normalizeOptionalThreadValue("  abc  ")).toBe("abc");
  });
  it("returns undefined for empty string", () => {
    expect(normalizeOptionalThreadValue("")).toBeUndefined();
  });
});

describe("normalizeRouteThreadId", () => {
  it("normalizes numeric thread ids", () => {
    expect(normalizeRouteThreadId(42)).toBe(42);
  });
  it("normalizes string thread ids", () => {
    expect(normalizeRouteThreadId("T123")).toBe("T123");
  });
});

describe("stringifyRouteThreadId", () => {
  it("converts number to string", () => {
    expect(stringifyRouteThreadId(7)).toBe("7");
  });
  it("returns undefined for undefined input", () => {
    expect(stringifyRouteThreadId(undefined)).toBeUndefined();
  });
});

describe("normalizeChannelRouteRef", () => {
  it("returns undefined for empty input", () => {
    expect(normalizeChannelRouteRef({})).toBeUndefined();
  });

  it("normalizes a basic route", () => {
    const result = normalizeChannelRouteRef({ channel: "Discord", to: "user123" });
    expect(result?.channel).toBe("discord");
    expect(result?.target?.to).toBe("user123");
  });

  it("includes thread info when threadId is present", () => {
    const result = normalizeChannelRouteRef({
      channel: "slack",
      to: "user1",
      threadId: "T42",
      threadKind: "thread",
    });
    expect(result?.thread?.id).toBe("T42");
    expect(result?.thread?.kind).toBe("thread");
  });
});

describe("channelRouteTarget / channelRouteThreadId", () => {
  it("returns target to from route", () => {
    const route = normalizeChannelRouteRef({ channel: "slack", to: "user1" });
    expect(channelRouteTarget(route)).toBe("user1");
  });

  it("returns thread id from route", () => {
    const route = normalizeChannelRouteRef({ channel: "slack", to: "u", threadId: 55 });
    expect(channelRouteThreadId(route)).toBe(55);
  });
});

describe("channelRouteDedupeKey / channelRouteIdentityKey (deprecated alias)", () => {
  it("produces stable JSON key", () => {
    const input = { channel: "discord", to: "abc" };
    expect(channelRouteDedupeKey(input)).toBe(channelRouteIdentityKey(input));
  });
});

describe("channelRoutesMatchExact", () => {
  it("matches identical routes", () => {
    const a = normalizeChannelRouteRef({ channel: "slack", to: "user1" });
    expect(channelRoutesMatchExact({ left: a, right: a })).toBe(true);
  });
  it("does not match different channels", () => {
    const a = normalizeChannelRouteRef({ channel: "slack", to: "user1" });
    const b = normalizeChannelRouteRef({ channel: "discord", to: "user1" });
    expect(channelRoutesMatchExact({ left: a, right: b })).toBe(false);
  });
});

describe("channelRoutesShareConversation", () => {
  it("treats threadless routes as sharing conversation", () => {
    const a = normalizeChannelRouteRef({ channel: "slack", to: "user1" });
    const b = normalizeChannelRouteRef({ channel: "slack", to: "user1", threadId: "T1" });
    expect(channelRoutesShareConversation({ left: a, right: b })).toBe(true);
  });
  it("differs on thread id mismatch", () => {
    const a = normalizeChannelRouteRef({ channel: "slack", to: "u", threadId: "T1" });
    const b = normalizeChannelRouteRef({ channel: "slack", to: "u", threadId: "T2" });
    expect(channelRoutesShareConversation({ left: a, right: b })).toBe(false);
  });
});

describe("channelRouteTargetsMatchExact / channelRouteTargetsShareConversation", () => {
  it("wraps normalizeChannelRouteTarget for exact match", () => {
    expect(
      channelRouteTargetsMatchExact({
        left: { channel: "slack", to: "u" },
        right: { channel: "slack", to: "u" },
      }),
    ).toBe(true);
  });
  it("wraps normalizeChannelRouteTarget for shared conversation", () => {
    expect(
      channelRouteTargetsShareConversation({
        left: { channel: "slack", to: "u" },
        right: { channel: "slack", to: "u" },
      }),
    ).toBe(true);
  });
});

describe("resolveChannelRouteTargetWithParser", () => {
  it("returns null when channel is empty", () => {
    expect(
      resolveChannelRouteTargetWithParser({
        channel: "",
        rawTarget: "user1",
        parseExplicitTarget: () => null,
      }),
    ).toBeNull();
  });

  it("uses parsed to field when parser provides one", () => {
    const result = resolveChannelRouteTargetWithParser({
      channel: "slack",
      rawTarget: "@alice",
      parseExplicitTarget: (_ch, raw) => ({ to: raw.slice(1) }),
    });
    expect(result?.to).toBe("alice");
    expect(result?.rawTo).toBe("@alice");
  });
});

describe("channelRouteCompactKey / channelRouteKey (deprecated)", () => {
  it("returns pipe-separated key", () => {
    const route = normalizeChannelRouteRef({ channel: "slack", to: "user1" });
    const key = channelRouteCompactKey(route);
    expect(key).toBe("slack|user1||");
    expect(channelRouteKey(route)).toBe(key);
  });
  it("returns undefined without target", () => {
    const route = normalizeChannelRouteRef({ channel: "slack" });
    expect(channelRouteCompactKey(route)).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// channel-lifecycle.core tests
// ─────────────────────────────────────────────────────────────────────────────

describe("createAccountStatusSink", () => {
  it("injects accountId into every status patch", () => {
    const patches: unknown[] = [];
    const sink = createAccountStatusSink({
      accountId: "acc-1",
      setStatus: (s) => patches.push(s),
    });
    sink({ state: "running" } as never);
    expect(patches).toEqual([{ accountId: "acc-1", state: "running" }]);
  });
});

describe("waitUntilAbort", () => {
  it("resolves immediately when signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(waitUntilAbort(controller.signal)).resolves.toBeUndefined();
  });

  it("stays pending when no signal is provided", async () => {
    let resolved = false;
    void waitUntilAbort(undefined).then(() => {
      resolved = true;
    });
    await Promise.resolve();
    expect(resolved).toBe(false);
  });
});

describe("runPassiveAccountLifecycle", () => {
  it("calls start and stop around the lifecycle", async () => {
    const order: string[] = [];
    const controller = new AbortController();
    controller.abort();

    await runPassiveAccountLifecycle({
      abortSignal: controller.signal,
      start: async () => {
        order.push("start");
        return "handle";
      },
      stop: async (h) => {
        order.push(`stop:${h}`);
      },
      onStop: async () => {
        order.push("onStop");
      },
    });

    expect(order).toEqual(["start", "stop:handle", "onStop"]);
  });
});

describe("keepHttpServerTaskAlive", () => {
  it("resolves after server close event", async () => {
    const listeners: Array<() => void> = [];
    const fakeServer = {
      once: (_event: string, listener: () => void) => {
        listeners.push(listener);
      },
    };

    const settled: string[] = [];
    const task = keepHttpServerTaskAlive({ server: fakeServer }).then(() =>
      settled.push("resolved"),
    );

    listeners.forEach((l) => l());
    await task;
    expect(settled).toEqual(["resolved"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// channel-streaming tests
// ─────────────────────────────────────────────────────────────────────────────

describe("isChannelProgressDraftWorkToolName", () => {
  it("returns false for non-work tool names", () => {
    expect(isChannelProgressDraftWorkToolName("message")).toBe(false);
    expect(isChannelProgressDraftWorkToolName("reply")).toBe(false);
  });
  it("returns true for work tool names", () => {
    expect(isChannelProgressDraftWorkToolName("exec")).toBe(true);
    expect(isChannelProgressDraftWorkToolName("apply_patch")).toBe(true);
  });
  it("returns false for null/undefined", () => {
    expect(isChannelProgressDraftWorkToolName(null)).toBe(false);
    expect(isChannelProgressDraftWorkToolName(undefined)).toBe(false);
  });
});

describe("isPotentialTruncatedFinal", () => {
  it("detects trailing ellipsis on sufficiently long text", () => {
    const long = "a".repeat(50) + "...";
    expect(isPotentialTruncatedFinal(long)).toBe(true);
  });
  it("returns false for short text", () => {
    expect(isPotentialTruncatedFinal("short...")).toBe(false);
  });
  it("returns false when no ellipsis", () => {
    const long = "a".repeat(60);
    expect(isPotentialTruncatedFinal(long)).toBe(false);
  });
});

describe("selectLongerFinalText", () => {
  it("returns a longer candidate that extends the truncated final", () => {
    const finalText = "a".repeat(50) + "...";
    const extension = "a".repeat(50) + " and more words here extending beyond truncation";
    const result = selectLongerFinalText({ finalText, candidateTexts: [extension] });
    expect(result).toBe(extension);
  });
  it("returns undefined when no candidate is longer", () => {
    const finalText = "a".repeat(50) + "...";
    expect(selectLongerFinalText({ finalText, candidateTexts: ["short"] })).toBeUndefined();
  });
});

describe("resolveChannelPreviewStreamMode", () => {
  it("returns default mode when no entry", () => {
    expect(resolveChannelPreviewStreamMode(null, "off")).toBe("off");
    expect(resolveChannelPreviewStreamMode(null, "partial")).toBe("partial");
  });
  it("reads mode from streaming config object", () => {
    const entry = { streaming: { mode: "progress" } };
    expect(resolveChannelPreviewStreamMode(entry, "off")).toBe("progress");
  });
  it("reads legacy boolean streaming field", () => {
    expect(resolveChannelPreviewStreamMode({ streaming: true }, "off")).toBe("partial");
    expect(resolveChannelPreviewStreamMode({ streaming: false }, "partial")).toBe("off");
  });
});

describe("resolveChannelStreamingChunkMode", () => {
  it("returns undefined when not configured", () => {
    expect(resolveChannelStreamingChunkMode(null)).toBeUndefined();
  });
  it("reads chunkMode from streaming config", () => {
    expect(resolveChannelStreamingChunkMode({ streaming: { chunkMode: "newline" } })).toBe(
      "newline",
    );
  });
});

describe("resolveChannelStreamingBlockEnabled", () => {
  it("returns undefined when not configured", () => {
    expect(resolveChannelStreamingBlockEnabled(null)).toBeUndefined();
  });
  it("reads legacy blockStreaming flag", () => {
    expect(resolveChannelStreamingBlockEnabled({ blockStreaming: true })).toBe(true);
  });
});

describe("resolveChannelStreamingNativeTransport", () => {
  it("reads nativeTransport from streaming object", () => {
    expect(
      resolveChannelStreamingNativeTransport({ streaming: { nativeTransport: true } }),
    ).toBe(true);
  });
  it("falls back to legacy nativeStreaming", () => {
    expect(resolveChannelStreamingNativeTransport({ nativeStreaming: false })).toBe(false);
  });
});

describe("resolveChannelProgressDraftLabel", () => {
  it("returns undefined when label is false", () => {
    expect(
      resolveChannelProgressDraftLabel({
        entry: { streaming: { progress: { label: false } } },
      }),
    ).toBeUndefined();
  });
  it("returns a custom label string", () => {
    expect(
      resolveChannelProgressDraftLabel({
        entry: { streaming: { progress: { label: "Working…" } } },
      }),
    ).toBe("Working…");
  });
  it("returns a label from the default list when seed is provided", () => {
    const label = resolveChannelProgressDraftLabel({ seed: "test-seed" });
    expect(DEFAULT_PROGRESS_DRAFT_LABELS).toContain(label as string);
  });
});

describe("buildChannelProgressDraftLine / formatChannelProgressDraftLine", () => {
  it("builds a tool event line", () => {
    const line = buildChannelProgressDraftLine({ event: "tool", name: "exec" });
    expect(line).toBeDefined();
    expect(line?.kind).toBe("tool");
  });
  it("returns undefined for empty reasoning item", () => {
    const line = buildChannelProgressDraftLine({
      event: "item",
      itemKind: "analysis",
      title: "reasoning",
    });
    expect(line).toBeUndefined();
  });
  it("formatChannelProgressDraftLine returns text string", () => {
    const text = formatChannelProgressDraftLine({ event: "tool", name: "web_search" });
    expect(typeof text).toBe("string");
  });
});

describe("mergeChannelProgressDraftLine", () => {
  it("appends distinct lines", () => {
    const result = mergeChannelProgressDraftLine([], "Line 1", { maxLines: 8 });
    expect(result).toEqual(["Line 1"]);
  });
  it("dedupes identical consecutive lines", () => {
    const result = mergeChannelProgressDraftLine(["Line 1"], "Line 1", { maxLines: 8 });
    expect(result).toHaveLength(1);
  });
  it("trims to maxLines", () => {
    const initial = ["a", "b", "c"];
    const result = mergeChannelProgressDraftLine(initial, "d", { maxLines: 3 });
    expect(result).toEqual(["b", "c", "d"]);
  });
});

describe("formatChannelProgressDraftText", () => {
  it("formats lines with bullet prefix for non-emoji lines", () => {
    const text = formatChannelProgressDraftText({
      entry: { streaming: { progress: { label: false } } },
      lines: ["Working on it"],
    });
    expect(text).toBe("• Working on it");
  });
});

describe("DEFAULT_PROGRESS_DRAFT_LABELS / DEFAULT_PROGRESS_DRAFT_INITIAL_DELAY_MS", () => {
  it("has at least 10 labels", () => {
    expect(DEFAULT_PROGRESS_DRAFT_LABELS.length).toBeGreaterThanOrEqual(10);
  });
  it("has a positive initial delay", () => {
    expect(DEFAULT_PROGRESS_DRAFT_INITIAL_DELAY_MS).toBeGreaterThan(0);
  });
});

describe("createChannelProgressDraftGate", () => {
  it("starts immediately on second work event", async () => {
    let started = false;
    const gate = createChannelProgressDraftGate({
      onStart: () => {
        started = true;
      },
      initialDelayMs: -1, // disable timer
    });
    await gate.noteWork();
    expect(started).toBe(false);
    await gate.noteWork();
    expect(started).toBe(true);
  });

  it("startNow triggers start", async () => {
    let started = false;
    const gate = createChannelProgressDraftGate({
      onStart: () => {
        started = true;
      },
      initialDelayMs: -1,
    });
    await gate.startNow();
    expect(started).toBe(true);
  });

  it("cancel prevents further starts", async () => {
    let started = false;
    const gate = createChannelProgressDraftGate({
      onStart: () => {
        started = true;
      },
      initialDelayMs: -1,
    });
    gate.cancel();
    const didStart = await gate.noteWork();
    expect(didStart).toBe(false);
    expect(started).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// messaging-targets tests
// ─────────────────────────────────────────────────────────────────────────────

describe("messaging-targets re-exports", () => {
  it("normalizeTargetId produces namespaced kind:id key", () => {
    // CoreBlow targets use "kind:id" normalization, not "@" prefix
    expect(normalizeTargetId("user", "alice")).toBe("user:alice");
  });

  it("buildMessagingTarget returns a target with all fields", () => {
    const t = buildMessagingTarget("user", "alice", "@alice");
    expect(t.kind).toBe("user");
    expect(t.id).toBe("alice");
    expect(t.raw).toBe("@alice");
    expect(t.normalized).toBe("user:alice");
  });

  it("ensureTargetId throws when pattern does not match", () => {
    expect(() =>
      ensureTargetId({ candidate: "", pattern: /^\w+$/, errorMessage: "invalid id" }),
    ).toThrow("invalid id");
  });

  it("parseTargetMention parses mention via regex pattern", () => {
    const result = parseTargetMention({
      raw: "@alice rest",
      mentionPattern: /^@(\w+)/,
      kind: "user",
    });
    expect(result?.id).toBe("alice");
    expect(result?.kind).toBe("user");
  });

  it("parseAtUserTarget returns target for @-prefixed raw string", () => {
    const result = parseAtUserTarget({
      raw: "@alice",
      pattern: /^\w+$/,
      errorMessage: "invalid",
    });
    expect(result?.id).toBe("alice");
    expect(result?.kind).toBe("user");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runtime-logger tests
// ─────────────────────────────────────────────────────────────────────────────

describe("createLoggerBackedRuntime", () => {
  it("writes log calls to logger.info", () => {
    const messages: string[] = [];
    const runtime = createLoggerBackedRuntime({
      logger: {
        info: (m) => messages.push(`info:${m}`),
        error: (m) => messages.push(`error:${m}`),
      },
    });
    runtime.log("hello %s", "world");
    expect(messages).toEqual(["info:hello world"]);
  });

  it("writes error calls to logger.error", () => {
    const messages: string[] = [];
    const runtime = createLoggerBackedRuntime({
      logger: {
        info: (m) => messages.push(`info:${m}`),
        error: (m) => messages.push(`error:${m}`),
      },
    });
    runtime.error("oops");
    expect(messages).toEqual(["error:oops"]);
  });

  it("exit throws provided exitError", () => {
    const runtime = createLoggerBackedRuntime({
      logger: { info: vi.fn(), error: vi.fn() },
      exitError: (code) => new Error(`exit:${code}`),
    });
    expect(() => runtime.exit(1)).toThrow("exit:1");
  });
});

describe("resolveRuntimeEnv", () => {
  it("returns provided runtime when given", () => {
    const fakeRuntime = { log: vi.fn(), error: vi.fn(), exit: vi.fn() };
    const result = resolveRuntimeEnv({ runtime: fakeRuntime as never, logger: { info: vi.fn(), error: vi.fn() } });
    expect(result).toBe(fakeRuntime);
  });

  it("creates logger-backed runtime when runtime is undefined", () => {
    const messages: string[] = [];
    const result = resolveRuntimeEnv({ logger: { info: (m) => messages.push(m), error: vi.fn() } });
    result.log("ping");
    expect(messages).toContain("ping");
  });
});
