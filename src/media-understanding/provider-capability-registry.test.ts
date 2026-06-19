import { describe, expect, it, vi } from "vitest";

vi.mock("../plugins/capability-provider-runtime.js", () => ({
  resolvePluginCapabilityProviders: () => [],
}));

import { buildMediaUnderstandingCapabilityRegistry } from "./provider-capability-registry.js";

describe("media capability registry", () => {
  it("discovers image-capable configured providers", () => {
    const registry = buildMediaUnderstandingCapabilityRegistry({
      models: {
        providers: {
          custom: {
            baseUrl: "https://api.example.com/v1",
            models: [
              {
                id: "vision",
                name: "Vision",
                reasoning: false,
                input: ["text", "image"],
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 8_192,
                maxTokens: 1_024,
              },
            ],
          },
        },
      },
    });
    expect(registry.get("custom")?.capabilities).toEqual(["image"]);
  });
});
