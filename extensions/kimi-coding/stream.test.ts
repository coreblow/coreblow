import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Context, Model } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import {
  createKimiThinkingWrapper,
  createKimiToolCallMarkupWrapper,
  resolveKimiThinkingType,
  wrapKimiProviderStream,
} from "./stream.js";

type FakeStream = {
  result: () => Promise<unknown>;
  [Symbol.asyncIterator]: () => AsyncIterator<unknown>;
};

function createFakeStream(params: { events: unknown[]; resultMessage: unknown }): FakeStream {
  return {
    async result() {
      return params.resultMessage;
    },
    [Symbol.asyncIterator]() {
      return (async function* () {
        for (const event of params.events) {
          yield event;
        }
      })();
    },
  };
}

const KIMI_TOOL_TEXT =
  ' <|tool_calls_section_begin|> <|tool_call_begin|> functions.read:0 <|tool_call_argument_begin|> {"file_path":"./package.json"} <|tool_call_end|> <|tool_calls_section_end|>';
const KIMI_MODEL = {
  api: "anthropic-messages",
  provider: "kimi",
  id: "k2p5",
} as Model<"anthropic-messages">;
const KIMI_CONTEXT = { messages: [] } as Context;

function createReadToolCall() {
  return {
    type: "toolCall",
    id: "functions.read:0",
    name: "functions.read",
    arguments: { file_path: "./package.json" },
  };
}

function createAssistantTextMessage(text: string) {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    stopReason: "stop",
  };
}

function createPayloadCapturingStream(initialPayload: Record<string, unknown> = {}) {
  let capturedPayload: Record<string, unknown> | undefined;
  const streamFn: StreamFn = (model, _context, options) => {
    const payload: Record<string, unknown> = { ...initialPayload };
    options?.onPayload?.(payload as never, model as never);
    capturedPayload = payload;
    return createFakeStream({
      events: [],
      resultMessage: { role: "assistant", content: [] },
    }) as never;
  };
  return { streamFn, getCapturedPayload: () => capturedPayload };
}

describe("kimi stream wrappers", () => {
  it("defaults Kimi thinking to disabled unless explicitly enabled", () => {
    expect(resolveKimiThinkingType({ configuredThinking: undefined })).toBe("disabled");
    expect(resolveKimiThinkingType({ configuredThinking: undefined, thinkingLevel: "high" })).toBe(
      "enabled",
    );
    expect(resolveKimiThinkingType({ configuredThinking: "off", thinkingLevel: "high" })).toBe(
      "disabled",
    );
  });

  it("converts tagged Kimi tool-call text into structured tool calls", async () => {
    const finalMessage = {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "Need to read the file first." },
        { type: "text", text: KIMI_TOOL_TEXT },
      ],
      stopReason: "stop",
    };
    const baseStreamFn: StreamFn = () =>
      createFakeStream({
        events: [],
        resultMessage: finalMessage,
      }) as ReturnType<StreamFn>;

    const wrapped = createKimiToolCallMarkupWrapper(baseStreamFn);
    const stream = wrapped(KIMI_MODEL, KIMI_CONTEXT, {}) as FakeStream;

    await expect(stream.result()).resolves.toEqual({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "Need to read the file first." },
        {
          ...createReadToolCall(),
        },
      ],
      stopReason: "toolUse",
    });
  });

  it("leaves normal assistant text unchanged", async () => {
    const finalMessage = createAssistantTextMessage("normal response");
    const baseStreamFn: StreamFn = () =>
      createFakeStream({
        events: [],
        resultMessage: finalMessage,
      }) as ReturnType<StreamFn>;

    const wrapped = createKimiToolCallMarkupWrapper(baseStreamFn);
    const stream = wrapped(KIMI_MODEL, KIMI_CONTEXT, {}) as FakeStream;

    await expect(stream.result()).resolves.toBe(finalMessage);
  });

  it("forces Kimi thinking disabled and strips proxy reasoning fields", () => {
    const { streamFn: baseStreamFn, getCapturedPayload } = createPayloadCapturingStream({
      reasoning: { effort: "high" },
      reasoning_effort: "high",
      reasoningEffort: "high",
    });

    const wrapped = createKimiThinkingWrapper(baseStreamFn, "disabled");
    void wrapped(
      {
        api: "anthropic-messages",
        provider: "kimi",
        id: "kimi-code",
      } as Model<"anthropic-messages">,
      { messages: [] } as Context,
      {},
    );

    expect(getCapturedPayload()).toEqual({
      thinking: { type: "disabled" },
    });
  });

  it("backfills OpenAI-compatible tool-call reasoning_content when thinking is enabled", () => {
    const { streamFn: baseStreamFn, getCapturedPayload } = createPayloadCapturingStream({
      messages: [
        {
          role: "assistant",
          content: null,
          tool_calls: [{ id: "call_1", type: "function" }],
        },
      ],
    });

    const wrapped = createKimiThinkingWrapper(baseStreamFn, "enabled");
    void wrapped(
      {
        api: "openai-completions",
        provider: "kimi",
        id: "kimi-for-coding",
      } as Model<"openai-completions">,
      { messages: [] } as Context,
      {},
    );

    expect(getCapturedPayload()).toEqual({
      messages: [
        {
          role: "assistant",
          content: null,
          reasoning_content: "",
          tool_calls: [{ id: "call_1", type: "function" }],
        },
      ],
      thinking: { type: "enabled" },
    });
  });

  it("enables Anthropic thinking with enough output room", () => {
    const { streamFn: baseStreamFn, getCapturedPayload } = createPayloadCapturingStream();

    const wrapped = wrapKimiProviderStream({
      provider: "kimi",
      modelId: "kimi-code",
      thinkingLevel: "high",
      streamFn: baseStreamFn,
    } as never);

    void wrapped(
      {
        api: "anthropic-messages",
        provider: "kimi",
        id: "kimi-code",
      } as Model<"anthropic-messages">,
      { messages: [] } as Context,
      {},
    );

    expect(getCapturedPayload()).toEqual({
      max_tokens: 16000,
      thinking: { type: "enabled", budget_tokens: 8192 },
    });
  });
});
