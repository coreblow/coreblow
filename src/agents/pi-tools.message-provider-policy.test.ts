import { describe, expect, it } from "vitest";
import { createCoreBlowCodingTools } from "./pi-tools.js";

describe("createCoreBlowCodingTools message provider policy", () => {
  it.each(["voice", "VOICE", " Voice "])(
    "does not expose tts tool for normalized voice provider: %s",
    (messageProvider) => {
      const tools = createCoreBlowCodingTools({ messageProvider });
      const names = new Set(tools.map((tool) => tool.name));
      expect(names.has("tts")).toBe(false);
    },
  );

  it("keeps tts tool for non-voice providers", () => {
    const tools = createCoreBlowCodingTools({ messageProvider: "discord" });
    const names = new Set(tools.map((tool) => tool.name));
    expect(names.has("tts")).toBe(true);
  });
});
