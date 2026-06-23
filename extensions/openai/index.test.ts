// @ts-nocheck — structural test type mismatches (vitest mock compat)
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getModel } from "@mariozechner/pi-ai";
import { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import OpenAI from "openai";
import * as providerAuth from "coreblow/plugin-sdk/provider-auth-runtime";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../../src/config/config.js";
import { loadConfig } from "../../src/config/config.js";
import { encodePngRgba, fillPixel } from "../../src/media/png-encode.js";
import type { ResolvedTtsConfig } from "../../src/tts/tts.js";
import {
  registerProviderPlugin,
  requireRegisteredProvider,
} from "../../test/helpers/extensions/provider-registration.js";
import { buildOpenAIImageGenerationProvider } from "./image-generation-provider.js";
import plugin from "./index.js";

const runtimeMocks = vi.hoisted(() => ({
  ensureGlobalUndiciEnvProxyDispatcher: vi.fn(),
  refreshOpenAICodexToken: vi.fn(),
}));

vi.mock("coreblow/plugin-sdk/runtime-env", () => ({
  ensureGlobalUndiciEnvProxyDispatcher: runtimeMocks.ensureGlobalUndiciEnvProxyDispatcher,
}));

vi.mock("@mariozechner/pi-ai/oauth", () => ({
  getOAuthApiKey: vi.fn(),
  getOAuthProviders: () => [],
  refreshOpenAICodexToken: runtimeMocks.refreshOpenAICodexToken,
}));

import { refreshOpenAICodexToken } from "./openai-codex-provider.runtime.js";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
const LIVE_MODEL_ID = process.env.COREBLOW_LIVE_OPENAI_PLUGIN_MODEL?.trim() || "gpt-5.4-nano";
const LIVE_IMAGE_MODEL = process.env.COREBLOW_LIVE_OPENAI_IMAGE_MODEL?.trim() || "gpt-image-1";
const LIVE_VISION_MODEL = process.env.COREBLOW_LIVE_OPENAI_VISION_MODEL?.trim() || "gpt-4.1-mini";
const liveEnabled = OPENAI_API_KEY.trim().length > 0 && process.env.COREBLOW_LIVE_TEST === "1";
const describeLive = liveEnabled ? describe : describe.skip;
const EMPTY_AUTH_STORE = { version: 1, profiles: {} } as const;

function resolveTemplateModelId(modelId: string) {
  switch (modelId) {
    case "gpt-5.4":
      return "gpt-5.2";
    case "gpt-5.4-mini":
      return "gpt-5-mini";
    case "gpt-5.4-nano":
      return "gpt-5-nano";
    default:
      throw new Error(`Unsupported live OpenAI plugin model: ${modelId}`);
  }
}

function createTemplateModelRegistry(modelId: string): ModelRegistry {
  const registry = new ModelRegistry(AuthStorage.inMemory());
  const template = getModel("openai", resolveTemplateModelId(modelId));
  registry.registerProvider("openai", {
    apiKey: "test",
    baseUrl: template.baseUrl,
    models: [
      {
        id: template.id,
        name: template.name,
        api: template.api,
        reasoning: template.reasoning,
        input: template.input,
        cost: template.cost,
        contextWindow: template.contextWindow,
        maxTokens: template.maxTokens,
        ...(template.compat ? { compat: template.compat } : {}),
      },
    ],
  });
  return registry;
}

const registerOpenAIPlugin = () =>
  registerProviderPlugin({
    plugin,
    id: "openai",
    name: "OpenAI Provider",
  });

function createReferencePng(): Buffer {
  const width = 96;
  const height = 96;
  const buf = Buffer.alloc(width * height * 4, 255);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      fillPixel(buf, x, y, width, 225, 242, 255, 255);
    }
  }

  for (let y = 24; y < 72; y += 1) {
    for (let x = 24; x < 72; x += 1) {
      fillPixel(buf, x, y, width, 255, 153, 51, 255);
    }
  }

  return encodePngRgba(buf, width, height);
}

function createLiveConfig(): CoreBlowConfig {
  const cfg = loadConfig();
  return {
    ...cfg,
    models: {
      ...cfg.models,
      providers: {
        ...cfg.models?.providers,
        openai: {
          ...cfg.models?.providers?.openai,
          apiKey: OPENAI_API_KEY,
          baseUrl: "https://api.openai.com/v1",
        },
      },
    },
  } as CoreBlowConfig;
}

function createLiveTtsConfig(): ResolvedTtsConfig {
  return {
    auto: "off",
    mode: "final",
    provider: "openai",
    providerSource: "config",
    modelOverrides: {
      enabled: true,
      allowText: true,
      allowProvider: true,
      allowVoice: true,
      allowModelId: true,
      allowVoiceSettings: true,
      allowNormalization: true,
      allowSeed: true,
    },
    providerConfigs: {
      openai: {
        apiKey: OPENAI_API_KEY,
        baseUrl: "https://api.openai.com/v1",
        model: "gpt-4o-mini-tts",
        voice: "alloy",
      },
    },
    maxTextLength: 4_000,
    timeoutMs: 30_000,
  };
}

async function createTempAgentDir(): Promise<string> {
  return await fs.mkdtemp(path.join(os.tmpdir(), "openai-plugin-live-"));
}

describe("openai plugin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("registers the expected provider surfaces", () => {
    const { providers, speechProviders, mediaProviders, imageProviders } = registerOpenAIPlugin();

    expect(providers).toHaveLength(2);
    expect(providers.map((provider) => provider.id)).toEqual(["openai", "openai-codex"]);
    expect(speechProviders).toHaveLength(1);
    expect(mediaProviders.map((provider) => provider.id)).toEqual(["openai", "openai-codex"]);
    const codexMediaProvider = requireRegisteredProvider(
      mediaProviders,
      "openai-codex",
      "media provider",
    );
    expect(codexMediaProvider.capabilities).toEqual(["image", "audio"]);
    expect(imageProviders).toHaveLength(1);
  });

  it("registers provider-owned OpenAI tool compat hooks for openai and codex", () => {
    const { providers } = registerOpenAIPlugin();
    const openaiProvider = requireRegisteredProvider(providers, "openai", "provider");
    const codexProvider = requireRegisteredProvider(providers, "openai-codex", "provider");
    const noParamsTool = {
      name: "ping",
      description: "",
      parameters: {},
      execute: vi.fn(),
    } as never;

    const normalizedOpenAI = openaiProvider.normalizeToolSchemas?.({
      provider: "openai",
      modelId: "gpt-5.4",
      modelApi: "openai-responses",
      model: {
        provider: "openai",
        api: "openai-responses",
        baseUrl: "https://api.openai.com/v1",
        id: "gpt-5.4",
      } as never,
      tools: [noParamsTool],
    });
    const normalizedCodex = codexProvider.normalizeToolSchemas?.({
      provider: "openai-codex",
      modelId: "gpt-5.4",
      modelApi: "openai-codex-responses",
      model: {
        provider: "openai-codex",
        api: "openai-codex-responses",
        baseUrl: "https://chatgpt.com/backend-api",
        id: "gpt-5.4",
      } as never,
      tools: [noParamsTool],
    });

    expect(normalizedOpenAI?.[0]?.parameters).toEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    });
    expect(normalizedCodex?.[0]?.parameters).toEqual({
      type: "object",
      properties: {},
      required: [],
      additionalProperties: false,
    });
    expect(
      openaiProvider.inspectToolSchemas?.({
        provider: "openai",
        modelId: "gpt-5.4",
        modelApi: "openai-responses",
        model: {
          provider: "openai",
          api: "openai-responses",
          baseUrl: "https://api.openai.com/v1",
          id: "gpt-5.4",
        } as never,
        tools: [noParamsTool],
      }),
    ).toStrictEqual([]);
    expect(
      codexProvider.inspectToolSchemas?.({
        provider: "openai-codex",
        modelId: "gpt-5.4",
        modelApi: "openai-codex-responses",
        model: {
          provider: "openai-codex",
          api: "openai-codex-responses",
          baseUrl: "https://chatgpt.com/backend-api",
          id: "gpt-5.4",
        } as never,
        tools: [noParamsTool],
      }),
    ).toStrictEqual([]);
  });

  it("generates PNG buffers from the OpenAI Images API", async () => {
    const resolveApiKeySpy = vi.spyOn(providerAuth, "resolveApiKeyForProvider").mockResolvedValue({
      apiKey: "sk-test",
      source: "env",
      mode: "api-key",
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          {
            b64_json: Buffer.from("png-data").toString("base64"),
            revised_prompt: "revised",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const provider = buildOpenAIImageGenerationProvider();
    const authStore = { version: 1, profiles: {} };
    const result = await provider.generateImage({
      provider: "openai",
      model: "gpt-image-1",
      prompt: "draw a cat",
      cfg: {},
      authStore,
    });

    expect(resolveApiKeySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        store: authStore,
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/images/generations",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt: "draw a cat",
          n: 1,
          size: "1024x1024",
        }),
      }),
    );
    expect(result).toEqual({
      images: [
        {
          buffer: Buffer.from("png-data"),
          mimeType: "image/png",
          fileName: "image-1.png",
          revisedPrompt: "revised",
        },
      ],
      model: "gpt-image-1",
    });
  });

  it("submits reference-image edits to the OpenAI Images edits endpoint", async () => {
    const resolveApiKeySpy = vi.spyOn(providerAuth, "resolveApiKeyForProvider").mockResolvedValue({
      apiKey: "sk-test",
      source: "env",
      mode: "api-key",
    });
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ b64_json: Buffer.from("edited-image").toString("base64") }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = buildOpenAIImageGenerationProvider();
    const authStore = { version: 1, profiles: {} };
    const result = await provider.generateImage({
      provider: "openai",
      model: "gpt-image-1",
      prompt: "Edit this image",
      cfg: {},
      authStore,
      count: 2,
      size: "1536x1024",
      inputImages: [
        { buffer: Buffer.from("x"), mimeType: "image/png" },
        { buffer: Buffer.from("y"), mimeType: "image/jpeg", fileName: "ref.jpg" },
      ],
    });

    expect(resolveApiKeySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "openai",
        store: authStore,
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/images/edits",
      expect.objectContaining({ method: "POST" }),
    );
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toBeInstanceOf(Headers);
    expect((init.headers as Headers).has("Content-Type")).toBe(false);
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect(form.get("model")).toBe("gpt-image-1");
    expect(form.get("prompt")).toBe("Edit this image");
    expect(form.get("n")).toBe("2");
    expect(form.get("size")).toBe("1536x1024");
    const images = form.getAll("image[]") as File[];
    expect(images).toHaveLength(2);
    expect(images[0]?.name).toBe("image-1.png");
    expect(images[0]?.type).toBe("image/png");
    expect(images[1]?.name).toBe("ref.jpg");
    expect(images[1]?.type).toBe("image/jpeg");
    expect(result).toEqual({
      images: [
        {
          buffer: Buffer.from("edited-image"),
          mimeType: "image/png",
          fileName: "image-1.png",
        },
      ],
      model: "gpt-image-1",
    });
  });

  it("does not allow private-network routing just because a custom base URL is configured", async () => {
    vi.spyOn(providerAuth, "resolveApiKeyForProvider").mockResolvedValue({
      apiKey: "sk-test",
      source: "env",
      mode: "api-key",
    });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const provider = buildOpenAIImageGenerationProvider();
    await expect(
      provider.generateImage({
        provider: "openai",
        model: "gpt-image-1",
        prompt: "draw a cat",
        cfg: {
          models: {
            providers: {
              openai: {
                baseUrl: "http://127.0.0.1:8080/v1",
                models: [],
              },
            },
          },
        },
      }),
    ).rejects.toThrow("Blocked hostname or private/internal/special-use IP address");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("bootstraps the env proxy dispatcher before refreshing codex oauth credentials", async () => {
    const refreshed = {
      access: "next-access",
      refresh: "next-refresh",
      expires: Date.now() + 60_000,
    };
    runtimeMocks.refreshOpenAICodexToken.mockResolvedValue(refreshed);

    await expect(refreshOpenAICodexToken("refresh-token")).resolves.toBe(refreshed);

    expect(runtimeMocks.ensureGlobalUndiciEnvProxyDispatcher).toHaveBeenCalledOnce();
    expect(runtimeMocks.refreshOpenAICodexToken).toHaveBeenCalledOnce();
    expect(
      runtimeMocks.ensureGlobalUndiciEnvProxyDispatcher.mock.invocationCallOrder[0],
    ).toBeLessThan(runtimeMocks.refreshOpenAICodexToken.mock.invocationCallOrder[0]);
  });
});

describeLive("openai plugin live", () => {
  it("registers an OpenAI provider that can complete a live request", async () => {
    const { providers } = registerOpenAIPlugin();
    const provider = requireRegisteredProvider(providers, "openai");

    const resolved = provider.resolveDynamicModel?.({
      provider: "openai",
      modelId: LIVE_MODEL_ID,
      modelRegistry: createTemplateModelRegistry(LIVE_MODEL_ID),
    });

    if (!resolved) {
      throw new Error("openai provider did not resolve the live model");
    }

    const normalized = provider.normalizeResolvedModel?.({
      provider: "openai",
      modelId: resolved.id,
      model: resolved,
    });

    expect(normalized).toMatchObject({
      provider: "openai",
      id: LIVE_MODEL_ID,
      api: "openai-responses",
      baseUrl: "https://api.openai.com/v1",
    });

    const client = new OpenAI({
      apiKey: OPENAI_API_KEY,
      baseURL: normalized?.baseUrl,
    });
    const response = await client.responses.create({
      model: normalized?.id ?? LIVE_MODEL_ID,
      input: "Reply with exactly OK.",
      max_output_tokens: 16,
    });

    expect(response.output_text.trim()).toMatch(/^OK[.!]?$/);
  }, 30_000);

  it("lists voices and synthesizes audio through the registered speech provider", async () => {
    const { speechProviders } = registerOpenAIPlugin();
    const speechProvider = requireRegisteredProvider(speechProviders, "openai");

    const voices = await speechProvider.listVoices?.({});
    if (!voices) {
      throw new Error("openai speech provider did not return voices");
    }
    expect(voices).toEqual(expect.arrayContaining([expect.objectContaining({ id: "alloy" })]));

    const cfg = createLiveConfig();
    const ttsConfig = createLiveTtsConfig();

    const audioFile = await speechProvider.synthesize({
      text: "CoreBlow integration test OK.",
      cfg,
      providerConfig: ttsConfig.providerConfigs.openai ?? {},
      target: "audio-file",
      timeoutMs: ttsConfig.timeoutMs,
    });
    expect(audioFile.outputFormat).toBe("mp3");
    expect(audioFile.fileExtension).toBe(".mp3");
    expect(audioFile.audioBuffer.byteLength).toBeGreaterThan(512);

    const telephony = await speechProvider.synthesizeTelephony?.({
      text: "Telephony check OK.",
      cfg,
      providerConfig: ttsConfig.providerConfigs.openai ?? {},
      timeoutMs: ttsConfig.timeoutMs,
    });
    expect(telephony?.outputFormat).toBe("pcm");
    expect(telephony?.sampleRate).toBe(24_000);
    expect(telephony?.audioBuffer.byteLength).toBeGreaterThan(512);
  }, 45_000);

  it("transcribes synthesized speech through the registered media provider", async () => {
    const { speechProviders, mediaProviders } = registerOpenAIPlugin();
    const speechProvider = requireRegisteredProvider(speechProviders, "openai");
    const mediaProvider = requireRegisteredProvider(mediaProviders, "openai");

    const cfg = createLiveConfig();
    const ttsConfig = createLiveTtsConfig();

    const synthesized = await speechProvider.synthesize({
      text: "CoreBlow integration test OK.",
      cfg,
      providerConfig: ttsConfig.providerConfigs.openai ?? {},
      target: "audio-file",
      timeoutMs: ttsConfig.timeoutMs,
    });

    const transcription = await mediaProvider.transcribeAudio?.({
      buffer: synthesized.audioBuffer,
      fileName: "openai-plugin-live.mp3",
      mime: "audio/mpeg",
      apiKey: OPENAI_API_KEY,
      timeoutMs: 30_000,
    });

    const text = String(transcription?.text ?? "").toLowerCase();
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain("coreblow");
    expect(text).toMatch(/\bok\b/);
  }, 45_000);

  it("generates an image through the registered image provider", async () => {
    const { imageProviders } = registerOpenAIPlugin();
    const imageProvider = requireRegisteredProvider(imageProviders, "openai");

    const cfg = createLiveConfig();
    const agentDir = await createTempAgentDir();

    try {
      const generated = await imageProvider.generateImage({
        provider: "openai",
        model: LIVE_IMAGE_MODEL,
        prompt: "Create a minimal flat orange square centered on a white background.",
        cfg,
        agentDir,
        authStore: EMPTY_AUTH_STORE,
        timeoutMs: 45_000,
        size: "1024x1024",
      });

      expect(generated.model).toBe(LIVE_IMAGE_MODEL);
      expect(generated.images.length).toBeGreaterThan(0);
      expect(generated.images[0]?.mimeType).toBe("image/png");
      expect(generated.images[0]?.buffer.byteLength).toBeGreaterThan(1_000);
    } finally {
      await fs.rm(agentDir, { recursive: true, force: true });
    }
  }, 60_000);

  it("describes a deterministic image through the registered media provider", async () => {
    const { mediaProviders } = registerOpenAIPlugin();
    const mediaProvider = requireRegisteredProvider(mediaProviders, "openai");

    const cfg = createLiveConfig();
    const agentDir = await createTempAgentDir();

    try {
      const description = await mediaProvider.describeImage?.({
        buffer: createReferencePng(),
        fileName: "reference.png",
        mime: "image/png",
        prompt: "Reply with one lowercase word for the dominant center color.",
        timeoutMs: 30_000,
        agentDir,
        cfg,
        model: LIVE_VISION_MODEL,
        provider: "openai",
      });

      expect(String(description?.text ?? "").toLowerCase()).toContain("orange");
    } finally {
      await fs.rm(agentDir, { recursive: true, force: true });
    }
  }, 60_000);
});
