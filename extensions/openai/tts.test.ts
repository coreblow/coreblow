import { afterEach, describe, expect, it, vi } from "vitest";
import { createStreamingErrorResponse } from "../test-support/streaming-error-response.js";
import {
  isValidOpenAIModel,
  isValidOpenAIVoice,
  OPENAI_TTS_MODELS,
  OPENAI_TTS_VOICES,
  openaiTTS,
  resolveOpenAITtsInstructions,
} from "./tts.js";

function firstFetchCall(fetchMock: ReturnType<typeof vi.fn>): unknown[] {
  const call = fetchMock.mock.calls[0];
  if (!call) {
    throw new Error("expected fetch call");
  }
  return call;
}

function firstFetchInit(fetchMock: ReturnType<typeof vi.fn>): RequestInit {
  const init = firstFetchCall(fetchMock)[1];
  if (!init || typeof init !== "object") {
    throw new Error("expected fetch init");
  }
  return init as RequestInit;
}

describe("openai tts", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("isValidOpenAIVoice", () => {
    it("accepts all valid OpenAI voices including newer additions", () => {
      for (const voice of OPENAI_TTS_VOICES) {
        expect(isValidOpenAIVoice(voice)).toBe(true);
      }
      for (const newerVoice of ["ballad", "cedar", "juniper", "marin", "verse"]) {
        expect(isValidOpenAIVoice(newerVoice), newerVoice).toBe(true);
      }
    });

    it("rejects invalid voice names", () => {
      expect(isValidOpenAIVoice("invalid")).toBe(false);
      expect(isValidOpenAIVoice("")).toBe(false);
      expect(isValidOpenAIVoice("ALLOY")).toBe(false);
      expect(isValidOpenAIVoice("alloy ")).toBe(false);
      expect(isValidOpenAIVoice(" alloy")).toBe(false);
    });

    it("treats the default endpoint with trailing slash as the default endpoint", () => {
      expect(isValidOpenAIVoice("kokoro-custom-voice", "https://api.openai.com/v1/")).toBe(false);
    });
  });

  describe("isValidOpenAIModel", () => {
    it("matches the supported model set and rejects unsupported values", () => {
      expect(OPENAI_TTS_MODELS).toContain("gpt-4o-mini-tts");
      expect(OPENAI_TTS_MODELS).toContain("tts-1");
      expect(OPENAI_TTS_MODELS).toContain("tts-1-hd");
      expect(OPENAI_TTS_MODELS).toHaveLength(3);
      expect(Array.isArray(OPENAI_TTS_MODELS)).toBe(true);
      expect(OPENAI_TTS_MODELS.length).toBeGreaterThan(0);
      const cases = [
        { model: "gpt-4o-mini-tts", expected: true },
        { model: "tts-1", expected: true },
        { model: "tts-1-hd", expected: true },
        { model: "invalid", expected: false },
        { model: "", expected: false },
        { model: "gpt-4", expected: false },
      ] as const;
      for (const testCase of cases) {
        expect(isValidOpenAIModel(testCase.model), testCase.model).toBe(testCase.expected);
      }
    });

    it("treats the default endpoint with trailing slash as the default endpoint", () => {
      expect(isValidOpenAIModel("kokoro-custom-model", "https://api.openai.com/v1/")).toBe(false);
    });
  });

  describe("resolveOpenAITtsInstructions", () => {
    it("keeps instructions only for gpt-4o-mini-tts variants", () => {
      expect(resolveOpenAITtsInstructions("gpt-4o-mini-tts", " Speak warmly ")).toBe(
        "Speak warmly",
      );
      expect(resolveOpenAITtsInstructions("gpt-4o-mini-tts-2025-12-15", "Speak warmly")).toBe(
        "Speak warmly",
      );
      expect(resolveOpenAITtsInstructions("tts-1", "Speak warmly")).toBeUndefined();
      expect(resolveOpenAITtsInstructions("tts-1-hd", "Speak warmly")).toBeUndefined();
      expect(resolveOpenAITtsInstructions("gpt-4o-mini-tts", "   ")).toBeUndefined();
    });

    it("preserves instructions for custom OpenAI-compatible TTS endpoints", () => {
      expect(
        resolveOpenAITtsInstructions("tts-1", " Speak warmly ", "https://tts.example.com/v1"),
      ).toBe("Speak warmly");
      expect(
        resolveOpenAITtsInstructions("tts-1", " Speak warmly ", "https://api.openai.com/v1/"),
      ).toBeUndefined();
      expect(
        resolveOpenAITtsInstructions("tts-1", "   ", "https://tts.example.com/v1"),
      ).toBeUndefined();
    });
  });

  describe("openaiTTS diagnostics", () => {
    it("sends instructions to custom OpenAI-compatible endpoints", async () => {
      const fetchMock = vi.fn(
        async (_url: string | URL, _init?: RequestInit) =>
          new Response(Buffer.from("audio-bytes"), { status: 200 }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await openaiTTS({
        text: "hello",
        apiKey: "test-key",
        baseUrl: "https://tts.example.com/v1",
        model: "tts-1",
        voice: "custom-voice",
        instructions: " Speak warmly ",
        responseFormat: "mp3",
        timeoutMs: 5_000,
      });

      const init = firstFetchInit(fetchMock);
      if (typeof init.body !== "string") {
        throw new Error("expected JSON request body");
      }
      const body = JSON.parse(init.body) as Record<string, unknown>;
      expect(body.instructions).toBe("Speak warmly");
      expect(body.model).toBe("tts-1");
      expect(body.voice).toBe("custom-voice");
    });

    it("merges sanitized extraBody fields into TTS requests", async () => {
      const fetchMock = vi.fn(
        async (_url: string | URL, _init?: RequestInit) =>
          new Response(Buffer.from("audio-bytes"), { status: 200 }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;
      const extraBody = JSON.parse(
        '{"lang":"e","speed":1.2,"__proto__":{"polluted":true},"constructor":"bad","prototype":"bad"}',
      ) as Record<string, unknown>;

      await openaiTTS({
        text: "hello",
        apiKey: "test-key",
        baseUrl: "https://tts.example.com/v1",
        model: "tts-1",
        voice: "custom-voice",
        speed: 1,
        responseFormat: "mp3",
        extraBody,
        timeoutMs: 5_000,
      });

      const init = firstFetchInit(fetchMock);
      if (typeof init.body !== "string") {
        throw new Error("expected JSON request body");
      }
      const body = JSON.parse(init.body) as Record<string, unknown>;
      expect(body.model).toBe("tts-1");
      expect(body.input).toBe("hello");
      expect(body.voice).toBe("custom-voice");
      expect(body.response_format).toBe("mp3");
      expect(body.lang).toBe("e");
      expect(body.speed).toBe(1.2);
      expect(Object.hasOwn(body, "__proto__")).toBe(false);
      expect(Object.hasOwn(body, "constructor")).toBe(false);
      expect(Object.hasOwn(body, "prototype")).toBe(false);
      expect((Object.prototype as Record<string, unknown>).polluted).toBeUndefined();
    });

    it("omits instructions for unsupported models on the official OpenAI endpoint", async () => {
      const fetchMock = vi.fn(
        async (_url: string | URL, _init?: RequestInit) =>
          new Response(Buffer.from("audio-bytes"), { status: 200 }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await openaiTTS({
        text: "hello",
        apiKey: "test-key",
        baseUrl: "https://api.openai.com/v1/",
        model: "tts-1",
        voice: "alloy",
        instructions: "Speak warmly",
        responseFormat: "mp3",
        timeoutMs: 5_000,
      });

      const init = firstFetchInit(fetchMock);
      if (typeof init.body !== "string") {
        throw new Error("expected JSON request body");
      }
      const body = JSON.parse(init.body) as Record<string, unknown>;
      expect(body.instructions).toBeUndefined();
    });

    it("includes parsed provider detail and request id for JSON API errors", async () => {
      const fetchMock = vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              error: {
                message: "Invalid API key",
                type: "invalid_request_error",
                code: "invalid_api_key",
              },
            }),
            {
              status: 401,
              headers: {
                "Content-Type": "application/json",
                "x-request-id": "req_123",
              },
            },
          ),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await expect(
        openaiTTS({
          text: "hello",
          apiKey: "bad-key",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-4o-mini-tts",
          voice: "alloy",
          responseFormat: "mp3",
          timeoutMs: 5_000,
        }),
      ).rejects.toThrow(
        "OpenAI TTS API error (401): Invalid API key [type=invalid_request_error, code=invalid_api_key] [request_id=req_123]",
      );
    });

    it("falls back to raw body text when the error body is non-JSON", async () => {
      const fetchMock = vi.fn(
        async () => new Response("temporary upstream outage", { status: 503 }),
      );
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await expect(
        openaiTTS({
          text: "hello",
          apiKey: "test-key",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-4o-mini-tts",
          voice: "alloy",
          responseFormat: "mp3",
          timeoutMs: 5_000,
        }),
      ).rejects.toThrow("OpenAI TTS API error (503): temporary upstream outage");
    });

    it("caps streamed non-JSON error reads instead of consuming full response bodies", async () => {
      const streamed = createStreamingErrorResponse({
        status: 503,
        chunkCount: 200,
        chunkSize: 1024,
        byte: 120,
      });
      const fetchMock = vi.fn(async () => streamed.response);
      globalThis.fetch = fetchMock as unknown as typeof fetch;

      await expect(
        openaiTTS({
          text: "hello",
          apiKey: "test-key",
          baseUrl: "https://api.openai.com/v1",
          model: "gpt-4o-mini-tts",
          voice: "alloy",
          responseFormat: "mp3",
          timeoutMs: 5_000,
        }),
      ).rejects.toThrow("OpenAI TTS API error (503)");

      expect(streamed.getReadCount()).toBeLessThan(200);
    });
  });
});
