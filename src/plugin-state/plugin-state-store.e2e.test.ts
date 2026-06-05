import { describe, expect, it } from "vitest";
import { PluginStateStoreError } from "./plugin-state-store.types.js";

describe("plugin state e2e facade", () => {
  it("exports typed store errors", () => {
    const error = new PluginStateStoreError("demo", {
      code: "PLUGIN_STATE_INVALID_INPUT",
      operation: "open",
    });

    expect(error.name).toBe("PluginStateStoreError");
    expect(error.code).toBe("PLUGIN_STATE_INVALID_INPUT");
  });
});
