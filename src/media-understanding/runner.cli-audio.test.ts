import { describe, expect, it } from "vitest";
import { matchesMediaEntryCapability } from "./entry-capabilities.js";

describe("CLI audio entry capability", () => {
  it("requires an explicit capability for shared CLI entries", () => {
    const providerRegistry = new Map();
    expect(matchesMediaEntryCapability({
      entry: { type: "cli", command: "whisper", capabilities: ["audio"] },
      source: "shared",
      capability: "audio",
      providerRegistry,
    })).toBe(true);
    expect(matchesMediaEntryCapability({
      entry: { type: "cli", command: "whisper" },
      source: "shared",
      capability: "audio",
      providerRegistry,
    })).toBe(false);
  });
});
