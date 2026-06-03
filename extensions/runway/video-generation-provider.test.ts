import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("coreblow/plugin-sdk/provider-auth-runtime", () => ({
  resolveApiKeyForProvider: vi.fn(async () => ({ apiKey: "test-key" })),
}));

let buildRunwayVideoGenerationProvider: typeof import("./video-generation-provider.js").buildRunwayVideoGenerationProvider;

beforeAll(async () => {
  ({ buildRunwayVideoGenerationProvider } = await import("./video-generation-provider.js"));
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

describe("runway video generation provider", () => {
  it("declares explicit mode capabilities", () => {
    const provider = buildRunwayVideoGenerationProvider();
    expect(provider.capabilities).toEqual({
      generate: {
        maxVideos: 1,
        maxDurationSeconds: 10,
        supportsAspectRatio: true,
        supportsSize: true,
      },
      imageToVideo: {
        enabled: true,
        maxVideos: 1,
        maxInputImages: 1,
        maxDurationSeconds: 10,
        supportsAspectRatio: true,
        supportsSize: true,
      },
      videoToVideo: {
        enabled: true,
        maxVideos: 1,
        maxInputVideos: 1,
        supportsAspectRatio: true,
        supportsSize: true,
      },
    });
  });

  it("submits a text-to-video task, polls it, and downloads the output", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "task-1" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "task-1",
            status: "SUCCEEDED",
            output: ["https://example.com/out.mp4"],
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
          headers: { "content-type": "video/webm" },
        }),
      );

    const provider = buildRunwayVideoGenerationProvider();
    const result = await provider.generateVideo({
      provider: "runway",
      model: "gen4.5",
      prompt: "a tiny lobster DJ under neon lights",
      cfg: {},
      durationSeconds: 4,
      aspectRatio: "16:9",
      fetchFn,
      pollIntervalMs: 0,
    });

    expect(fetchFn).toHaveBeenCalledTimes(3);
    expect(fetchFn.mock.calls[0]?.[0]).toBe("https://api.dev.runwayml.com/v1/text_to_video");
    expect(readJsonBody(fetchFn.mock.calls[0]?.[1])).toEqual({
      model: "gen4.5",
      promptText: "a tiny lobster DJ under neon lights",
      ratio: "1280:720",
      duration: 4,
    });
    expect(fetchFn.mock.calls[1]?.[0]).toBe("https://api.dev.runwayml.com/v1/tasks/task-1");
    expect(fetchFn.mock.calls[2]?.[0]).toBe("https://example.com/out.mp4");
    expect(result.videos[0]).toMatchObject({
      mimeType: "video/webm",
      fileName: "video-1.webm",
    });
    expect(result.metadata).toEqual({
      taskId: "task-1",
      status: "SUCCEEDED",
      endpoint: "/v1/text_to_video",
    });
  });

  it("accepts local image buffers by converting them into data URIs", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "task-2" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "task-2",
            status: "SUCCEEDED",
            output: ["https://example.com/out.mp4"],
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

    const provider = buildRunwayVideoGenerationProvider();
    await provider.generateVideo({
      provider: "runway",
      model: "gen4_turbo",
      prompt: "animate this frame",
      cfg: {},
      inputImages: [{ buffer: Buffer.from("png-bytes"), mimeType: "image/png" }],
      aspectRatio: "1:1",
      durationSeconds: 6,
      fetchFn,
      pollIntervalMs: 0,
    });

    expect(fetchFn.mock.calls[0]?.[0]).toBe("https://api.dev.runwayml.com/v1/image_to_video");
    const request = readJsonBody(fetchFn.mock.calls[0]?.[1]);
    expect(String(request.promptImage)).toMatch(/^data:image\/png;base64,/u);
    expect(request.ratio).toBe("960:960");
    expect(request.duration).toBe(6);
  });

  it("requires gen4_aleph for video-to-video", async () => {
    const provider = buildRunwayVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "runway",
        model: "gen4.5",
        prompt: "restyle this clip",
        cfg: {},
        inputVideos: [{ url: "https://example.com/input.mp4" }],
        pollIntervalMs: 0,
      }),
    ).rejects.toThrow("Runway video-to-video currently requires model gen4_aleph.");
  });

  it("reports malformed create JSON with a provider-owned error", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "application/json" }),
      json: async () => {
        throw new SyntaxError("bad json");
      },
    } as unknown as Response);

    const provider = buildRunwayVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "runway",
        model: "gen4.5",
        prompt: "bad create response",
        cfg: {},
        fetchFn,
      }),
    ).rejects.toThrow("Runway video generation failed: malformed JSON response");
  });

  it("rejects status responses missing a task status", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "task-missing-status" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "task-missing-status",
            output: ["https://example.com/out.mp4"],
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    const provider = buildRunwayVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "runway",
        model: "gen4.5",
        prompt: "missing status",
        cfg: {},
        fetchFn,
      }),
    ).rejects.toThrow("Runway video status response missing task status");
  });

  it("rejects malformed completed output URLs", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ id: "task-malformed-output" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "task-malformed-output",
            status: "SUCCEEDED",
            output: "https://example.com/out.mp4",
          }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        ),
      );

    const provider = buildRunwayVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "runway",
        model: "gen4.5",
        prompt: "malformed output",
        cfg: {},
        fetchFn,
      }),
    ).rejects.toThrow("Runway video generation completed with malformed output URLs");
  });
});
