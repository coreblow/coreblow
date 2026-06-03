import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("coreblow/plugin-sdk/provider-auth-runtime", () => ({
  resolveApiKeyForProvider: vi.fn(async () => ({ apiKey: "test-key" })),
}));

let buildAlibabaVideoGenerationProvider: typeof import("./video-generation-provider.js").buildAlibabaVideoGenerationProvider;

beforeAll(async () => {
  ({ buildAlibabaVideoGenerationProvider } = await import("./video-generation-provider.js"));
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

describe("alibaba video generation provider", () => {
  it("declares explicit mode capabilities", () => {
    const provider = buildAlibabaVideoGenerationProvider();
    expect(provider.capabilities).toEqual({
      generate: {
        maxVideos: 1,
        maxDurationSeconds: 10,
        supportsSize: true,
        supportsAspectRatio: true,
        supportsResolution: true,
        supportsAudio: true,
        supportsWatermark: true,
      },
      imageToVideo: {
        enabled: true,
        maxVideos: 1,
        maxInputImages: 1,
        maxDurationSeconds: 10,
        supportsSize: true,
        supportsAspectRatio: true,
        supportsResolution: true,
        supportsAudio: true,
        supportsWatermark: true,
      },
      videoToVideo: {
        enabled: true,
        maxVideos: 1,
        maxInputVideos: 4,
        maxDurationSeconds: 10,
        supportsSize: true,
        supportsAspectRatio: true,
        supportsResolution: true,
        supportsAudio: true,
        supportsWatermark: true,
      },
    });
  });

  it("submits async Wan generation, polls task status, and downloads the resulting video", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ output: { task_id: "task-1" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            output: {
              task_status: "SUCCEEDED",
              results: [{ video_url: "https://example.com/alibaba.mp4" }],
            },
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

    const provider = buildAlibabaVideoGenerationProvider();
    const result = await provider.generateVideo({
      provider: "alibaba",
      model: "wan2.6-r2v-flash",
      prompt: "animate this shot",
      cfg: {},
      inputImages: [{ url: "https://example.com/ref.png" }],
      durationSeconds: 6,
      audio: true,
      watermark: false,
      fetchFn,
      pollIntervalMs: 0,
    });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "https://dashscope-intl.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis",
    );
    const request = readJsonBody(fetchFn.mock.calls[0]?.[1]);
    expect(request.model).toBe("wan2.6-r2v-flash");
    expect(request.input).toEqual({
      prompt: "animate this shot",
      img_url: "https://example.com/ref.png",
    });
    expect(request.parameters).toEqual({
      duration: 6,
      enable_audio: true,
      watermark: false,
    });
    expect(fetchFn.mock.calls[1]?.[0]).toBe("https://dashscope-intl.aliyuncs.com/api/v1/tasks/task-1");
    expect(fetchFn.mock.calls[2]?.[0]).toBe("https://example.com/alibaba.mp4");
    expect(result.videos[0]?.buffer.toString()).toBe("mp4-bytes");
    expect(result.videos[0]).toMatchObject({
      mimeType: "video/mp4",
      fileName: "video-1.mp4",
    });
  });

  it("fails fast when reference inputs are local buffers instead of remote URLs", async () => {
    const provider = buildAlibabaVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "alibaba",
        model: "wan2.6-i2v",
        prompt: "animate this local frame",
        cfg: {},
        inputImages: [{ buffer: Buffer.from("png-bytes"), mimeType: "image/png" }],
        pollIntervalMs: 0,
      }),
    ).rejects.toThrow(
      "Alibaba Wan video generation currently requires remote http(s) URLs for reference images/videos.",
    );
  });
});
