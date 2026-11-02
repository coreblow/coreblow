import { describe, expect, it } from "vitest";
import {
  CORE_DOP_PROVIDER_CATALOG,
  buildChatCompletionRequest,
  extractStreamDelta,
  isBuiltInDopProvider,
  listBuiltInDopProviders,
  parseSseLines,
  resolveDopProviderDescriptor,
  streamOpenAiCompatibleCompletion,
} from "./dop-openai-stream.js";

describe("Unified DOP OpenAI-Compatible Streaming Engine", () => {
  // ==========================================================================
  // Catalog & Descriptors
  // ==========================================================================
  describe("Provider Catalog Descriptors", () => {
    it("provides complete descriptors for all 17 supported providers", () => {
      const expectedProviders = [
        "openai",
        "ollama",
        "vllm",
        "sglang",
        "deepseek",
        "groq",
        "mistral",
        "xai",
        "together",
        "fireworks",
        "cerebras",
        "openrouter",
        "lmstudio",
        "perplexity",
        "moonshot",
        "qwen",
        "minimax",
      ];

      expect(listBuiltInDopProviders()).toHaveLength(17);

      for (const id of expectedProviders) {
        expect(isBuiltInDopProvider(id)).toBe(true);
        const desc = resolveDopProviderDescriptor(id);
        expect(desc, `Provider '${id}' must be in catalog`).not.toBeNull();
        expect(desc?.id).toBe(id);
        expect(desc?.baseUrl.length).toBeGreaterThan(0);
        expect(desc?.defaultModels.length).toBeGreaterThan(0);
        expect(typeof desc?.supportsStreaming).toBe("boolean");
      }

      expect(isBuiltInDopProvider("unknown-vendor")).toBe(false);
    });

    it("includes OpenRouter custom referral headers", () => {
      const openrouter = resolveDopProviderDescriptor("openrouter");
      expect(openrouter?.extraHeaders?.["HTTP-Referer"]).toBe("https://coreblow.com");
      expect(openrouter?.extraHeaders?.["X-Title"]).toBe("CoreBlow");
    });
  });

  // ==========================================================================
  // Request Building
  // ==========================================================================
  describe("buildChatCompletionRequest", () => {
    it("constructs standard URL and headers with Bearer token", () => {
      const openai = resolveDopProviderDescriptor("openai")!;
      const req = {
        model: "gpt-4o",
        messages: [{ role: "user" as const, content: "Hello" }],
      };

      const { url, init } = buildChatCompletionRequest(openai, req, "sk-test-12345");
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      expect(init.method).toBe("POST");
      expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer sk-test-12345");
      expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");

      const body = JSON.parse(init.body as string) as { stream: boolean; model: string };
      expect(body.stream).toBe(true);
      expect(body.model).toBe("gpt-4o");
    });

    it("respects customBaseUrl when provided", () => {
      const ollama = resolveDopProviderDescriptor("ollama")!;
      const req = {
        model: "llama3.3",
        messages: [{ role: "user" as const, content: "Ping" }],
      };

      const { url } = buildChatCompletionRequest(
        ollama,
        req,
        undefined,
        "http://custom-host:8888/v1/",
      );
      expect(url).toBe("http://custom-host:8888/v1/chat/completions");
    });
  });

  // ==========================================================================
  // SSE Parsing & Carry Buffer
  // ==========================================================================
  describe("parseSseLines", () => {
    it("parses clean data lines and ignores SSE comments", () => {
      const chunk = ": keepalive\n\ndata: {\"id\":\"1\"}\n\ndata: {\"id\":\"2\"}\n";
      const { events, remainingBuffer } = parseSseLines(chunk, "");

      expect(events).toEqual(['{"id":"1"}', '{"id":"2"}']);
      expect(remainingBuffer).toBe("");
    });

    it("handles fragmented chunks split across network frames", () => {
      const part1 = "data: {\"id\":\"1\"}\ndata: {\"id\":";
      const { events: e1, remainingBuffer: r1 } = parseSseLines(part1, "");
      expect(e1).toEqual(['{"id":"1"}']);
      expect(r1).toBe('data: {"id":');

      const part2 = '"2\"}\n';
      const { events: e2, remainingBuffer: r2 } = parseSseLines(part2, r1);
      expect(e2).toEqual(['{"id":"2"}']);
      expect(r2).toBe("");
    });
  });

  // ==========================================================================
  // Delta Extraction
  // ==========================================================================
  describe("extractStreamDelta", () => {
    it("extracts text content delta", () => {
      const event = JSON.stringify({
        choices: [
          {
            delta: { content: "Hello world" },
            finish_reason: null,
          },
        ],
      });

      const delta = extractStreamDelta(event);
      expect(delta).not.toBeNull();
      expect(delta?.content).toBe("Hello world");
      expect(delta?.finish_reason).toBeNull();
    });

    it("extracts tool call arguments delta", () => {
      const event = JSON.stringify({
        choices: [
          {
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: "call_abc",
                  type: "function",
                  function: { name: "search", arguments: '{"q":' },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      });

      const delta = extractStreamDelta(event);
      expect(delta?.tool_calls).toHaveLength(1);
      expect(delta?.tool_calls?.[0].function?.name).toBe("search");
      expect(delta?.tool_calls?.[0].function?.arguments).toBe('{"q":');
    });

    it("returns finish_reason stop for [DONE]", () => {
      const delta = extractStreamDelta("[DONE]");
      expect(delta).not.toBeNull();
      expect(delta?.finish_reason).toBe("stop");
    });
  });

  // ==========================================================================
  // Stream Generator Integration
  // ==========================================================================
  describe("streamOpenAiCompatibleCompletion", () => {
    it("streams deltas via simulated fetch ReadableStream", async () => {
      const deepseek = resolveDopProviderDescriptor("deepseek")!;
      const encoder = new TextEncoder();

      const mockStream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"role":"assistant","content":"Core"},"finish_reason":null}]}\n\n',
            ),
          );
          controller.enqueue(
            encoder.encode(
              'data: {"choices":[{"delta":{"content":"Blow"},"finish_reason":null}]}\n\n',
            ),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      const mockFetch = async () =>
        new Response(mockStream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });

      const tokens: string[] = [];
      for await (const delta of streamOpenAiCompatibleCompletion(
        deepseek,
        {
          model: "deepseek-chat",
          messages: [{ role: "user", content: "Hi" }],
        },
        {
          apiKey: "fake-key",
          fetchImpl: mockFetch as typeof fetch,
        },
      )) {
        if (delta.content) {
          tokens.push(delta.content);
        }
      }

      expect(tokens.join("")).toBe("CoreBlow");
    });

    it("throws descriptive error on HTTP failure response", async () => {
      const groq = resolveDopProviderDescriptor("groq")!;

      const mockFetch = async () =>
        new Response("Rate limit exceeded", {
          status: 429,
          statusText: "Too Many Requests",
        });

      const generator = streamOpenAiCompatibleCompletion(
        groq,
        {
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: "Hi" }],
        },
        {
          apiKey: "fake-key",
          fetchImpl: mockFetch as typeof fetch,
        },
      );

      await expect(generator.next()).rejects.toThrow(/failed with status 429/);
    });
  });
});
