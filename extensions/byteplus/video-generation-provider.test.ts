import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("coreblow/plugin-sdk/provider-auth-runtime", () => ({
  resolveApiKeyForProvider: vi.fn(async () => ({ apiKey: "test-key" })),
}));

let buildBytePlusVideoGenerationProvider: typeof import("./video-generation-provider.js").buildBytePlusVideoGenerationProvider;

beforeAll(async () => {
  ({ buildBytePlusVideoGenerationProvider } = await import("./video-generation-provider.js"));
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

describe("byteplus video generation provider", () => {
  it("declares explicit mode capabilities", () => {
    const provider = buildBytePlusVideoGenerationProvider();
    expect(provider.capabilities).toEqual({
      providerOptions: {
        seed: "number",
        draft: "boolean",
        camera_fixed: "boolean",
      },
      generate: {
        maxVideos: 1,
        maxDurationSeconds: 12,
        supportsAspectRatio: true,
        supportsResolution: true,
        supportsAudio: true,
        supportsWatermark: true,
      },
      imageToVideo: {
        enabled: true,
        maxVideos: 1,
        maxInputImages: 1,
        maxDurationSeconds: 12,
        supportsAspectRatio: true,
        supportsResolution: true,
        supportsAudio: true,
        supportsWatermark: true,
      },
      videoToVideo: {
        enabled: false,
      },
    });
  });

  it("creates a generation task, polls, and downloads the video", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "task_123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "task_123",
            status: "succeeded",
            model: "seedance-1-0-lite-t2v-250428",
            content: {
              video_url: "https://example.com/byteplus.webm",
            },
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

    const provider = buildBytePlusVideoGenerationProvider();
    const result = await provider.generateVideo({
      provider: "byteplus",
      model: "seedance-1-0-lite-t2v-250428",
      prompt: "A lantern floats upward into the night sky",
      cfg: {},
      fetchFn,
      pollIntervalMs: 0,
    });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchFn.mock.calls[0]?.[0]).toBe(
      "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks",
    );
    expect(fetchFn.mock.calls[1]?.[0]).toBe(
      "https://ark.ap-southeast.bytepluses.com/api/v3/contents/generations/tasks/task_123",
    );
    expect(fetchFn.mock.calls[2]?.[0]).toBe("https://example.com/byteplus.webm");
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0]).toMatchObject({
      mimeType: "video/webm",
      fileName: "video-1.webm",
    });
    expect(result.videos[0]?.buffer.toString()).toBe("webm-bytes");
    expect(result.metadata).toMatchObject({ taskId: "task_123" });
  });

  it("switches t2v image requests to i2v models and lowercases resolution", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "task_123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "task_123",
            status: "succeeded",
            model: "seedance-1-0-lite-i2v-250428",
            content: {
              video_url: "https://example.com/byteplus.mp4",
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

    const provider = buildBytePlusVideoGenerationProvider();
    await provider.generateVideo({
      provider: "byteplus",
      model: "seedance-1-0-lite-t2v-250428",
      prompt: "Animate this still image",
      resolution: "720P",
      inputImages: [{ url: "https://example.com/first-frame.png" }],
      cfg: {},
      fetchFn,
      pollIntervalMs: 0,
    });

    const request = readJsonBody(fetchFn.mock.calls[0]?.[1]);
    expect(request).toEqual({
      model: "seedance-1-0-lite-i2v-250428",
      resolution: "720p",
      content: [
        { type: "text", text: "Animate this still image" },
        {
          type: "image_url",
          image_url: { url: "https://example.com/first-frame.png" },
          role: "first_frame",
        },
      ],
    });
  });

  it("maps declared providerOptions into the request body", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "task_123" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "task_123",
            status: "succeeded",
            model: "seedance-1-0-pro-250528",
            content: {
              video_url: "https://example.com/byteplus.mp4",
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

    const provider = buildBytePlusVideoGenerationProvider();
    await provider.generateVideo({
      provider: "byteplus",
      model: "seedance-1-0-pro-250528",
      prompt: "A cinematic workflow-shell montage",
      providerOptions: {
        seed: 42,
        draft: true,
        camera_fixed: false,
      },
      cfg: {},
      fetchFn,
      pollIntervalMs: 0,
    });

    const request = readJsonBody(fetchFn.mock.calls[0]?.[1]);
    expect(request.model).toBe("seedance-1-0-pro-250528");
    expect(request.seed).toBe(42);
    expect(request.draft).toBe(true);
    expect(request.camera_fixed).toBe(false);
    expect(request.resolution).toBe("480p");
  });

  it("reports malformed create JSON with a provider-owned error", async () => {
    const malformedResponse = Object.assign(
      new Response("", {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
      {
        json: async () => {
          throw new SyntaxError("bad json");
        },
      },
    );
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce(malformedResponse);

    const provider = buildBytePlusVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "byteplus",
        model: "seedance-1-0-lite-t2v-250428",
        prompt: "bad create response",
        cfg: {},
        fetchFn,
      }),
    ).rejects.toThrow("BytePlus video generation failed: malformed JSON response");
  });

  it("rejects status responses missing a task status", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "task_missing_status" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "task_missing_status",
            content: {
              video_url: "https://example.com/byteplus.mp4",
            },
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    const provider = buildBytePlusVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "byteplus",
        model: "seedance-1-0-lite-t2v-250428",
        prompt: "missing status",
        cfg: {},
        fetchFn,
        pollIntervalMs: 0,
      }),
    ).rejects.toThrow("BytePlus video status response missing task status");
  });

  it("rejects malformed completed content", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "task_malformed_content" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "task_malformed_content",
            status: "succeeded",
            content: ["https://example.com/byteplus.mp4"],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    const provider = buildBytePlusVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "byteplus",
        model: "seedance-1-0-lite-t2v-250428",
        prompt: "malformed content",
        cfg: {},
        fetchFn,
        pollIntervalMs: 0,
      }),
    ).rejects.toThrow("BytePlus video generation completed with malformed content");
  });
});
