import { describe, expect, it } from "vitest";
import {
  clearPluginManifestRegistryCache,
  loadPluginManifestRegistry,
} from "./manifest-registry.js";

describe("plugin manifest registry", () => {
  it("clears the cache without errors", () => {
    expect(() => clearPluginManifestRegistryCache()).not.toThrow();
  });

  it("loads the plugin manifest registry", async () => {
    clearPluginManifestRegistryCache();
    const registry = await loadPluginManifestRegistry();
    expect(registry).toBeDefined();
    expect(typeof registry).toBe("object");
  });
});
