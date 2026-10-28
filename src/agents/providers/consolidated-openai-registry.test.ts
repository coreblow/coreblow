import { beforeEach, describe, expect, it } from "vitest";
import { ConsolidatedOpenAiRegistry } from "./consolidated-openai-registry.js";

describe("ConsolidatedOpenAiRegistry", () => {
  let registry: ConsolidatedOpenAiRegistry;

  beforeEach(async () => {
    registry = new ConsolidatedOpenAiRegistry();
    await registry.start();
  });

  it("satisfies GatewayService lifecycle and health", async () => {
    expect(registry.health().status).toBe("healthy");
    await registry.stop();
    expect(registry.health().status).toBe("down");
  });

  it("resolves built-in OpenAI-compatible providers correctly", () => {
    const vllm = registry.resolveProvider("vllm");
    expect(vllm).toBeDefined();
    expect(vllm?.defaultBaseUrl).toBe("http://127.0.0.1:8000/v1");

    const deepseek = registry.resolveProvider("deepseek");
    expect(deepseek).toBeDefined();
    expect(deepseek?.supportsReasoningEffort).toBe(true);

    const openrouter = registry.resolveProvider("openrouter");
    expect(openrouter).toBeDefined();
    expect(openrouter?.defaultHeaders?.["X-Title"]).toBe("CoreBlow Agent-OS");
  });

  it("resolves provider aliases seamlessly", () => {
    expect(registry.resolveProvider("local-vllm")?.id).toBe("vllm");
    expect(registry.resolveProvider("local-ollama")?.id).toBe("ollama");
    expect(registry.resolveProvider("grok")?.id).toBe("xai");
    expect(registry.resolveProvider("kimi")?.id).toBe("moonshot");
  });

  it("builds compliant OpenAI-compatible request configs", () => {
    const config = registry.buildRequestConfig({
      providerId: "deepseek",
      model: "deepseek-reasoner",
      payload: {
        messages: [{ role: "user", content: "Solve math problem" }],
        stream: true,
      },
      apiKey: "sk-deepseek-test-key",
    });

    expect(config.url).toBe("https://api.deepseek.com/v1/chat/completions");
    expect(config.headers.Authorization).toBe("Bearer sk-deepseek-test-key");
    expect(config.headers["Content-Type"]).toBe("application/json");

    const parsedBody = JSON.parse(config.body) as {
      model: string;
      stream: boolean;
      messages: Array<{ role: string; content: string }>;
    };
    expect(parsedBody.model).toBe("deepseek-reasoner");
    expect(parsedBody.stream).toBe(true);
    expect(parsedBody.messages).toHaveLength(1);
  });

  it("allows registering custom provider specifications", () => {
    registry.registerProvider({
      id: "custom-local-llama",
      name: "Custom Llama.cpp",
      defaultBaseUrl: "http://127.0.0.1:8080/v1",
      envKey: "CUSTOM_LLAMA_KEY",
      contextWindow: 16_384,
      supportsStreaming: true,
      supportsReasoningEffort: false,
      supportsToolCalling: false,
      aliases: ["llama-cpp"],
    });

    const resolved = registry.resolveProvider("llama-cpp");
    expect(resolved).toBeDefined();
    expect(resolved?.id).toBe("custom-local-llama");
    expect(resolved?.contextWindow).toBe(16_384);
  });
});
