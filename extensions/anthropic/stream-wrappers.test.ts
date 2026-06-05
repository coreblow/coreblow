import type { StreamFn } from "@mariozechner/pi-agent-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAnthropicBetaHeadersWrapper,
  createAnthropicFastModeWrapper,
  createAnthropicServiceTierWrapper,
  createAnthropicThinkingPrefillWrapper,
  testing,
  wrapAnthropicProviderStream,
} from "./stream-wrappers.js";

const CONTEXT_1M_BETA = "context-1m-2025-08-07";
const DEFAULT_BETA_HEADER =
  "fine-grained-tool-streaming-2025-05-14,interleaved-thinking-2025-05-14";
const OAUTH_BETA_HEADER =
  "claude-code-20250219,oauth-2025-04-20,fine-grained-tool-streaming-2025-05-14,interleaved-thinking-2025-05-14";

function runBetaWrapper(apiKey: string): Record<string, string> | undefined {
  const captured: { headers?: Record<string, string> } = {};
  const base: StreamFn = (_model, _context, options) => {
    captured.headers = options?.headers;
    return {} as ReturnType<StreamFn>;
  };
  const wrapper = createAnthropicBetaHeadersWrapper(base, [CONTEXT_1M_BETA]);
  void wrapper(
    { provider: "anthropic", id: "claude-opus-4-6" } as never,
    {} as never,
    { apiKey } as never,
  );
  return captured.headers;
}

function createPayloadCapturingBaseStream(captured: {
  headers?: Record<string, string>;
  payload?: Record<string, unknown>;
}): StreamFn {
  return (model, _context, options) => {
    captured.headers = options?.headers;
    const payload = {} as Record<string, unknown>;
    options?.onPayload?.(payload as never, model as never);
    captured.payload = payload;
    return {} as ReturnType<StreamFn>;
  };
}

function runPayloadWrapper(
  params: {
    apiKey?: string;
    provider?: string;
    api?: string;
    serviceTier?: "auto" | "standard_only";
    fastMode?: boolean;
  },
  createWrapper: (base: StreamFn) => StreamFn,
): Record<string, unknown> | undefined {
  const captured: { payload?: Record<string, unknown> } = {};
  const wrapper = createWrapper(createPayloadCapturingBaseStream(captured));
  void wrapper(
    {
      provider: params.provider ?? "anthropic",
      api: params.api ?? "anthropic-messages",
      id: "claude-sonnet-4-6",
    } as never,
    {} as never,
    { apiKey: params.apiKey } as never,
  );
  return captured.payload;
}

describe("anthropic stream wrappers", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("strips context-1m for OAuth token auth", () => {
    const warn = vi.spyOn(testing.log, "warn").mockImplementation(() => undefined);
    const headers = runBetaWrapper("sk-ant-oat01-123");

    expect(headers?.["anthropic-beta"]).toBe(OAUTH_BETA_HEADER);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("keeps context-1m for API key auth", () => {
    const warn = vi.spyOn(testing.log, "warn").mockImplementation(() => undefined);
    const headers = runBetaWrapper("sk-ant-api03-123");

    expect(headers?.["anthropic-beta"]).toBe(`${DEFAULT_BETA_HEADER},${CONTEXT_1M_BETA}`);
    expect(warn).not.toHaveBeenCalled();
  });

  it("injects service_tier for API keys and skips it for OAuth tokens", () => {
    expect(
      runPayloadWrapper({ apiKey: "sk-ant-api03-test" }, (base) =>
        createAnthropicServiceTierWrapper(base, "auto"),
      )?.service_tier,
    ).toBe("auto");
    expect(
      runPayloadWrapper({ apiKey: "sk-ant-oat01-test" }, (base) =>
        createAnthropicFastModeWrapper(base, true),
      )?.service_tier,
    ).toBeUndefined();
  });

  it("removes trailing assistant prefill when thinking is enabled", () => {
    const payload = {
      thinking: { type: "enabled" },
      messages: [
        { role: "user", content: "Return JSON." },
        { role: "assistant", content: "{" },
      ],
    };
    const wrapper = createAnthropicThinkingPrefillWrapper(((_model, _context, options) => {
      options?.onPayload?.(payload as never, {} as never);
      return {} as ReturnType<StreamFn>;
    }) as StreamFn);

    vi.spyOn(testing.log, "warn").mockImplementation(() => undefined);
    void wrapper({ provider: "anthropic", api: "anthropic-messages" } as never, {} as never, {});

    expect(payload.messages).toEqual([{ role: "user", content: "Return JSON." }]);
  });

  it("composes the Anthropic provider stream chain", () => {
    const captured: { headers?: Record<string, string>; payload?: Record<string, unknown> } = {};
    vi.spyOn(testing.log, "warn").mockImplementation(() => undefined);
    const wrapped = wrapAnthropicProviderStream({
      streamFn: createPayloadCapturingBaseStream(captured),
      modelId: "claude-sonnet-4-6",
      extraParams: { context1m: true, serviceTier: "auto" },
    } as never);

    void wrapped?.(
      { provider: "anthropic", api: "anthropic-messages", id: "claude-sonnet-4-6" } as never,
      {} as never,
      { apiKey: "sk-ant-api03-test" } as never,
    );

    expect(captured.headers?.["anthropic-beta"]).toBe(`${DEFAULT_BETA_HEADER},${CONTEXT_1M_BETA}`);
    expect(captured.payload).toEqual({ service_tier: "auto" });
  });
});
