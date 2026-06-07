import { describe, expect, it } from "vitest";

describe("ollama provider discovery import guard", () => {
  it("imports without plugin entry side effects", async () => {
    const mod = await import("./provider-discovery.js");
    expect(mod.ollamaProviderDiscovery.id).toBe("ollama");
  });
});
