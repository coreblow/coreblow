import { describe, expect, it, vi } from "vitest";
import { postTranscriptionRequest } from "./shared.js";

describe("OpenAI-compatible audio SSRF policy", () => {
  it("allows explicit private provider endpoints only when requested", async () => {
    const fetchFn = vi.fn<typeof fetch>().mockResolvedValue(new Response("{}"));
    await postTranscriptionRequest({
      url: "http://127.0.0.1/audio/transcriptions",
      headers: new Headers(),
      body: new FormData(),
      fetchFn,
      allowPrivateNetwork: true,
    });
    expect(fetchFn).toHaveBeenCalledOnce();
  });
});
