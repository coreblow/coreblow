import { describe, expect, it } from "vitest";
import { DEFAULT_ECHO_TRANSCRIPT_FORMAT, sendTranscriptEcho } from "./echo-transcript.js";

describe("transcript echo", () => {
  it("is a no-op when no destination can be resolved", async () => {
    expect(DEFAULT_ECHO_TRANSCRIPT_FORMAT).toContain("{transcript}");
    await expect(sendTranscriptEcho({ ctx: {}, cfg: {}, transcript: "hello" })).resolves.toBeUndefined();
  });
});
