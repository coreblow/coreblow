import { describe, expect, it } from "vitest";
import { resolveHermesModelRef } from "./model.js";

describe("Hermes migration model planning", () => {
  it("resolves provider-qualified model refs", () => {
    expect(resolveHermesModelRef({ provider: "openai", model: "gpt-5.4" })).toBe(
      "openai/gpt-5.4",
    );
    expect(resolveHermesModelRef({ model: { provider: "anthropic", model: "claude" } })).toBe(
      "anthropic/claude",
    );
  });
});
