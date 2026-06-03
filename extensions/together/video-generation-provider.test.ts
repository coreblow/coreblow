import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("coreblow/plugin-sdk/provider-auth-runtime", () => ({
  resolveApiKeyForProvider: vi.fn(async () => ({ apiKey: "test-key" })),
}));

let buildTogetherVideoGenerationProvider: typeof import("./video-generation-provider.js").buildTogetherVideoGenerationProvider;

beforeAll(async () => {
  ({ buildTogetherVideoGenerationProvider } = await import("./video-generation-provider.js"));
});

function readJsonBody(init: RequestInit | undefined): Record<string, unknown> {
  const body =
    typeof init?.body === "string"
      ? init.body
      : Buffer.isBuffer(init?.body)
        ? init.body.toString("utf8")
        : "";
  return JSON.parse(body) as Record<string, unknown>;
}

describe("together video generation provider", () => {
  it("declares explicit mode capabilities", () => {
    const provider = buildTogetherVideoGenerationProvider();
    expect(provider.capabilities).toEqual({
      generate: {
        maxVideos: 1,
        maxDurationSeconds: 12,
        supportsSize: true,
      },
      imageToVideo: {
        enabled: true,
        maxVideos: 1,
        maxInputImages: 1,
        maxDurationSeconds: 12,
        supportsSize: true,
      },
      videoToVideo: {
        enabled: false,
      },
    });
  });

  it("creates a video, polls completion, and downloads the output", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "video_123", status: "in_progress" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "video_123",
            status: "completed",
            outputs: { video_url: "https://example.com/together.webm" },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(Buffer.from("webm-bytes"), {
          status: 200,
          headers: { "content-type": "video/webm" },
        }),
      );

    const provider = buildTogetherVideoGenerationProvider();
    const result = await provider.generateVideo({
      provider: "together",
      model: "Wan-AI/Wan2.2-T2V-A14B",
      prompt: "A bicycle weaving through a rainy neon street",
      cfg: {},
      fetchFn,
      pollIntervalMs: 0,
    });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchFn.mock.calls[0]?.[0]).toBe("https://api.together.xyz/v2/videos");
    const firstBody = readJsonBody(fetchFn.mock.calls[0]?.[1]);
    expect(firstBody.model).toBe("Wan-AI/Wan2.2-T2V-A14B");
    expect(firstBody.prompt).toBe("A bicycle weaving through a rainy neon street");

    expect(fetchFn.mock.calls[1]?.[0]).toBe("https://api.together.xyz/v2/videos/video_123");
    expect(fetchFn.mock.calls[2]?.[0]).toBe("https://example.com/together.webm");

    expect(result.videos).toHaveLength(1);
    expect(result.videos[0]).toMatchObject({
      mimeType: "video/webm",
      fileName: "video-1.webm",
    });
    expect(result.videos[0]?.buffer.toString()).toBe("webm-bytes");
    expect(result.metadata).toEqual({
      videoId: "video_123",
      status: "completed",
      videoUrl: "https://example.com/together.webm",
    });
  });

  it("uses the video API endpoint when the shared Together text base URL is configured", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "video_123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "video_123",
            status: "completed",
            outputs: { video_url: "https://example.com/together.mp4" },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      )
      .mockResolvedValueOnce(
        new Response(Buffer.from("mp4-bytes"), {
          status: 200,
          headers: { "content-type": "video/mp4" },
        }),
      );

    const provider = buildTogetherVideoGenerationProvider();
    await provider.generateVideo({
      provider: "together",
      model: "Wan-AI/Wan2.2-T2V-A14B",
      prompt: "A bicycle weaving through a rainy neon street",
      cfg: {
        models: {
          providers: {
            together: {
              baseUrl: "https://api.together.xyz/v1",
              models: [],
            },
          },
        },
      },
      fetchFn,
      pollIntervalMs: 0,
    });

    expect(fetchFn.mock.calls[0]?.[0]).toBe("https://api.together.xyz/v2/videos");
  });
});
