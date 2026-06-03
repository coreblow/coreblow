import { afterEach, describe, expect, it, vi } from "vitest";
import { buildLitellmImageGenerationProvider } from "./image-generation-provider.js";

const {
  resolveApiKeyForProviderMock,
  postJsonRequestMock,
  assertOkOrThrowHttpErrorMock,
} = vi.hoisted(() => ({
  resolveApiKeyForProviderMock: vi.fn(async () => ({ apiKey: "litellm-key" })),
  postJsonRequestMock: vi.fn(),
  assertOkOrThrowHttpErrorMock: vi.fn(async () => {}),
}));

vi.mock("coreblow/plugin-sdk/provider-auth-runtime", () => ({
  resolveApiKeyForProvider: resolveApiKeyForProviderMock,
}));

vi.mock("coreblow/plugin-sdk/provider-http", () => ({
  assertOkOrThrowHttpError: assertOkOrThrowHttpErrorMock,
  postJsonRequest: postJsonRequestMock,
}));

function mockGeneratedPngResponse() {
  postJsonRequestMock.mockResolvedValue({
    response: {
      json: async () => ({
        data: [{ b64_json: Buffer.from("png-bytes").toString("base64") }],
      }),
    },
    release: vi.fn(async () => {}),
  });
}

function mockObjectArg(mock: unknown, index = -1): Record<string, unknown> {
  const calls = (mock as { mock?: { calls?: Array<Array<unknown>> } }).mock?.calls ?? [];
  const call = index < 0 ? calls.at(index) : calls[index];
  const [arg] = call ?? [];
  if (!arg || typeof arg !== "object") {
    throw new Error(`expected mock object argument ${index}`);
  }
  return arg as Record<string, unknown>;
}

function expectFields(value: unknown, expected: Record<string, unknown>): void {
  if (!value || typeof value !== "object") {
    throw new Error("expected fields object");
  }
  const record = value as Record<string, unknown>;
  for (const [key, expectedValue] of Object.entries(expected)) {
    expect(record[key], key).toEqual(expectedValue);
  }
}

describe("litellm image generation provider", () => {
  afterEach(() => {
    resolveApiKeyForProviderMock.mockClear();
    postJsonRequestMock.mockReset();
    assertOkOrThrowHttpErrorMock.mockClear();
  });

  it("declares litellm id and OpenAI-compatible size hints", () => {
    const provider = buildLitellmImageGenerationProvider();

    expect(provider.id).toBe("litellm");
    expect(provider.label).toBe("LiteLLM");
    expect(provider.defaultModel).toBe("gpt-image-2");
    expect(provider.capabilities.geometry?.sizes).toContain("1024x1024");
    expect(provider.capabilities.geometry?.sizes).toContain("2048x2048");
    expect(provider.capabilities.geometry?.sizes).toContain("3840x2160");
    expect(provider.capabilities.edit?.enabled).toBe(true);
  });

  it("defaults to the loopback proxy and allows private network for localhost", async () => {
    mockGeneratedPngResponse();

    const provider = buildLitellmImageGenerationProvider();
    await provider.generateImage({
      provider: "litellm",
      model: "gpt-image-2",
      prompt: "Draw a QA lighthouse",
      cfg: {},
    });

    expectFields(mockObjectArg(postJsonRequestMock), {
      url: "http://localhost:4000/images/generations",
      allowPrivateNetwork: true,
    });
  });

  it("honors configured baseUrl and keeps private-network off for public endpoints", async () => {
    mockGeneratedPngResponse();

    const provider = buildLitellmImageGenerationProvider();
    await provider.generateImage({
      provider: "litellm",
      model: "gpt-image-2",
      prompt: "campaign hero",
      cfg: {
        models: {
          providers: {
            litellm: {
              baseUrl: "https://proxy.example.com/v1",
              models: [],
            },
          },
        },
      },
    });

    expectFields(mockObjectArg(postJsonRequestMock), {
      url: "https://proxy.example.com/v1/images/generations",
      allowPrivateNetwork: false,
    });
  });

  it("forwards count and size overrides on generation requests", async () => {
    mockGeneratedPngResponse();

    const provider = buildLitellmImageGenerationProvider();
    await provider.generateImage({
      provider: "litellm",
      model: "dall-e-3",
      prompt: "two landscape variants",
      cfg: {},
      count: 2,
      size: "3840x2160",
    });

    expectFields(mockObjectArg(postJsonRequestMock), {
      url: "http://localhost:4000/images/generations",
      body: {
        model: "dall-e-3",
        prompt: "two landscape variants",
        n: 2,
        size: "3840x2160",
      },
    });
  });

  it("routes to the edit endpoint when input images are provided", async () => {
    mockGeneratedPngResponse();

    const provider = buildLitellmImageGenerationProvider();
    await provider.generateImage({
      provider: "litellm",
      model: "gpt-image-2",
      prompt: "refine the hero",
      cfg: {},
      inputImages: [
        {
          buffer: Buffer.from("fake-input"),
          mimeType: "image/png",
        },
      ],
    });

    expect(mockObjectArg(postJsonRequestMock).url).toBe("http://localhost:4000/images/edits");
    const call = postJsonRequestMock.mock.calls[0]?.[0] as { body: { images: unknown[] } };
    expect(call.body.images).toHaveLength(1);
  });

  it("throws a clear error when the API key is missing", async () => {
    resolveApiKeyForProviderMock.mockResolvedValueOnce({ apiKey: "" });

    const provider = buildLitellmImageGenerationProvider();
    await expect(
      provider.generateImage({
        provider: "litellm",
        model: "gpt-image-2",
        prompt: "x",
        cfg: {},
      }),
    ).rejects.toThrow("LiteLLM API key missing");
  });
});
