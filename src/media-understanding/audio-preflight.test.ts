import { describe, expect, it } from "vitest";
import { transcribeFirstAudio } from "./audio-preflight.js";

describe("audio preflight", () => {
  it("returns undefined when audio processing is disabled", async () => {
    await expect(
      transcribeFirstAudio({ ctx: {}, cfg: { tools: { media: { audio: { enabled: false } } } } }),
    ).resolves.toBeUndefined();
  });
});
