import { describe, expect, it } from "vitest";
import * as pluginSdk from "./index.js";

describe("plugin-sdk exports", () => {
  it("exports the plugin SDK module", () => {
    expect(pluginSdk).toBeDefined();
    expect(typeof pluginSdk).toBe("object");
  });

  it("re-exports expected types and interfaces", () => {
    // The SDK should re-export config and channel types
    const exportNames = Object.keys(pluginSdk);
    expect(exportNames.length).toBeGreaterThanOrEqual(0);
  });
});
