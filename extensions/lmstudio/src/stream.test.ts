import type { StreamFn } from "@mariozechner/pi-agent-core";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetLmstudioPreloadCooldownForTest, wrapLmstudioInferencePreload } from "./stream.js";

const ensureLmstudioModelLoadedMock = vi.hoisted(() => vi.fn(async (_params?: unknown) => {}));
const resolveLmstudioProviderHeadersMock = vi.hoisted(() =>
  vi.fn(async (_params?: unknown) => undefined),
);
const resolveLmstudioRuntimeApiKeyMock = vi.hoisted(() =>
  vi.fn(async (_params?: unknown) => undefined),
);

vi.mock("./models.fetch.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./models.fetch.js")>();
  return {
    ...actual,
    ensureLmstudioModelLoaded: (params: unknown) => ensureLmstudioModelLoadedMock(params),
  };
});

vi.mock("./runtime.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./runtime.js")>();
  return {
    ...actual,
    resolveLmstudioProviderHeaders: (params: unknown) => resolveLmstudioProviderHeadersMock(params),
    resolveLmstudioRuntimeApiKey: (params: unknown) => resolveLmstudioRuntimeApiKeyMock(params),
  };
});

afterAll(() => {
  vi.doUnmock("./models.fetch.js");
  vi.doUnmock("./runtime.js");
  vi.resetModules();
});

type FakeStream = {
  result: () => Promise<unknown>;
  [Symbol.asyncIterator]: () => AsyncIterator<unknown>;
};

function createFakeStream(params: { events?: unknown[]; resultMessage: unknown }): FakeStream {
  return {
    async result() {
      return params.resultMessage;
    },
    [Symbol.asyncIterator]() {
      return (async function* () {
        for (const event of params.events ?? []) {
          yield event;
        }
      })();
    },
  };
}

function createWrapped(baseStream: StreamFn): StreamFn {
  const wrapped = wrapLmstudioInferencePreload({
    provider: "lmstudio",
    modelId: "qwen3",
    config: {
      models: {
        providers: {
          lmstudio: {
            baseUrl: "http://lmstudio.internal:1234/v1",
            models: [],
          },
        },
      },
    },
    streamFn: baseStream,
  } as never);
  if (!wrapped) {
    throw new Error("expected LM Studio stream wrapper");
  }
  return wrapped;
}

describe("lmstudio stream wrapper", () => {
  beforeEach(() => {
    resetLmstudioPreloadCooldownForTest();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    ensureLmstudioModelLoadedMock.mockClear();
    resolveLmstudioProviderHeadersMock.mockClear();
    resolveLmstudioRuntimeApiKeyMock.mockClear();
    resetLmstudioPreloadCooldownForTest();
  });

  it("preloads using contextTokens, stream apiKey, and SSRF host policy before inference", async () => {
    const baseStream = vi.fn(() =>
      createFakeStream({
        resultMessage: { role: "assistant", content: [] },
      }),
    ) as unknown as StreamFn;
    const wrapped = createWrapped(baseStream);

    const stream = await wrapped(
      {
        id: "lmstudio/qwen3",
        provider: "lmstudio",
        api: "openai-completions",
        contextWindow: 131072,
        contextTokens: 64000,
      } as never,
      { messages: [] } as never,
      { apiKey: "lmstudio-token" } as never,
    );

    expect(await (stream as FakeStream).result()).toEqual({ role: "assistant", content: [] });
    expect(ensureLmstudioModelLoadedMock).toHaveBeenCalledWith(
      expect.objectContaining({
        baseUrl: "http://lmstudio.internal:1234/v1",
        modelKey: "qwen3",
        requestedContextLength: 64000,
        apiKey: "lmstudio-token",
        ssrfPolicy: { allowedHostnames: ["lmstudio.internal"] },
      }),
    );
    expect(baseStream).toHaveBeenCalledTimes(1);
  });

  it("continues inference when preload fails and cooldown suppresses immediate retry", async () => {
    ensureLmstudioModelLoadedMock.mockRejectedValue(new Error("load failed"));
    const baseStream = vi.fn(() =>
      createFakeStream({
        resultMessage: { role: "assistant", content: [] },
      }),
    ) as unknown as StreamFn;
    const wrapped = createWrapped(baseStream);
    const model = {
      id: "lmstudio/qwen3",
      provider: "lmstudio",
      api: "openai-completions",
    } as never;

    await (await wrapped(model, { messages: [] } as never, undefined as never) as FakeStream).result();
    await (await wrapped(model, { messages: [] } as never, undefined as never) as FakeStream).result();

    expect(ensureLmstudioModelLoadedMock).toHaveBeenCalledTimes(1);
    expect(baseStream).toHaveBeenCalledTimes(2);
  });

  it("promotes standalone local-model tool text to structured tool calls", async () => {
    const rawToolText = [
      "[mempalace_search]",
      '{"query":"codename","room":"identities"}',
      "[END_TOOL_REQUEST]",
    ].join("\n");
    const baseStream = vi.fn(() =>
      createFakeStream({
        resultMessage: {
          role: "assistant",
          content: [{ type: "text", text: rawToolText }],
          stopReason: "stop",
        },
      }),
    ) as unknown as StreamFn;
    const wrapped = createWrapped(baseStream);
    const stream = await wrapped(
      {
        id: "lmstudio/qwen3",
        provider: "lmstudio",
        api: "openai-completions",
      } as never,
      {
        messages: [],
        tools: [{ name: "mempalace_search" }],
      } as never,
      undefined as never,
    );

    await expect((stream as FakeStream).result()).resolves.toEqual({
      role: "assistant",
      content: [
        {
          type: "toolCall",
          id: expect.stringMatching(/^call_[a-f0-9]{24}$/u),
          name: "mempalace_search",
          arguments: { query: "codename", room: "identities" },
        },
      ],
      stopReason: "toolUse",
    });
  });
});
