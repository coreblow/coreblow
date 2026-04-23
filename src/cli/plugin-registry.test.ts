import { describe, it, expect } from "vitest";
import {
  ensurePluginRegistryLoaded,
} from "./plugin-registry.js";

describe("plugin-registry — export contract", () => {
  it("exports expected public API surface", () => {
    expect(typeof ensurePluginRegistryLoaded).toBe("function");
  });
});
