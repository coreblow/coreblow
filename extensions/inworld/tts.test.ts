import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

const { fetchWithSsrFGuardMock } = vi.hoisted(() => ({
  fetchWithSsrFGuardMock: vi.fn(),
}));

vi.mock("coreblow/plugin-sdk/ssrf-runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("coreblow/plugin-sdk/ssrf-runtime")>();
  return {
    ...actual,
    fetchWithSsrFGuard: fetchWithSsrFGuardMock,
  };
});

import { inworldTTS, listInworldVoices } from "./tts.js";

function queueGuardedResponse(response: Response) {
  const release = vi.fn(async () => {});
  fetchWithSsrFGuardMock.mockResolvedValueOnce({ response, release });
  return { release };
}

afterAll(() => {
  vi.doUnmock("coreblow/plugin-sdk/ssrf-runtime");
  vi.resetModules();
});

describe("listInworldVoices", () => {
  afterEach(() => {
    fetchWithSsrFGuardMock.mockReset();
    vi.restoreAllMocks();
  });

  it("maps Inworld voice metadata into speech voice options", async () => {
    queueGuardedResponse(
      new Response(
        JSON.stringify({
          voices: [
            {
              voiceId: "Dennis",
              displayName: "Dennis",
              description: "Smooth voice",
              langCode: "EN_US",
              tags: ["male"],
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const voices = await listInworldVoices({ apiKey: "test-key" });
    expect(voices).toEqual([
      {
        id: "Dennis",
        name: "Dennis",
        description: "Smooth voice",
        locale: "EN_US",
        gender: "male",
      },
    ]);
  });

  it("throws on API errors with response body", async () => {
    queueGuardedResponse(new Response("service unavailable", { status: 503 }));
    await expect(listInworldVoices({ apiKey: "test-key" })).rejects.toThrow(
      "Inworld voices API error (503): service unavailable",
    );
  });
});

describe("inworldTTS", () => {
  afterEach(() => {
    fetchWithSsrFGuardMock.mockReset();
    vi.restoreAllMocks();
  });

  it("concatenates base64 audio chunks from streaming response", async () => {
    const chunk1 = Buffer.from("audio-chunk-1").toString("base64");
    const chunk2 = Buffer.from("audio-chunk-2").toString("base64");
    queueGuardedResponse(
      new Response(
        [JSON.stringify({ result: { audioContent: chunk1 } }), JSON.stringify({ result: { audioContent: chunk2 } })].join("\n"),
        { status: 200 },
      ),
    );

    const buffer = await inworldTTS({ text: "Hello world", apiKey: "test-key" });
    expect(buffer).toEqual(
      Buffer.concat([Buffer.from("audio-chunk-1"), Buffer.from("audio-chunk-2")]),
    );
  });
});
