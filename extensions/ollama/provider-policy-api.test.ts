import { describe, expect, it } from "vitest";
import { normalizeConfig, resolveThinkingProfile } from "./provider-policy-api.js";

describe("ollama provider policy api", () => {
  it("normalizes empty ollama provider config", () => {
    expect(normalizeConfig({ provider: "ollama", providerConfig: {} }).baseUrl).toContain("11434");
    const levels = resolveThinkingProfile({ reasoning: true }).levels.map(
      (level: { id: string }) => level.id,
    );
    expect(levels).toContain("max");
  });
});
