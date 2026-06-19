import { describe, expect, it } from "vitest";
import { normalizeBaseUrl, readErrorResponse, requireTranscriptionText } from "./shared.js";

describe("media provider HTTP helpers", () => {
  it("normalizes base URLs and bounds provider errors", async () => {
    expect(normalizeBaseUrl("https://api.example.com///", "fallback")).toBe("https://api.example.com");
    expect(await readErrorResponse(new Response("x".repeat(500)))).toHaveLength(301);
    expect(requireTranscriptionText("  hello  ", "missing")).toBe("hello");
  });
});
