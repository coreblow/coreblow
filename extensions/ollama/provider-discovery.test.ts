import { describe, expect, it } from "vitest";
import { ollamaProviderDiscovery } from "./provider-discovery.js";

describe("ollama provider discovery", () => {
  it("exposes late provider discovery", () => {
    expect(ollamaProviderDiscovery.id).toBe("ollama");
    expect(ollamaProviderDiscovery.catalog.order).toBe("late");
  });
});
