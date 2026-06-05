import { describe, expect, it } from "vitest";
import { MAX_PLUGIN_STATE_ENTRIES_PER_PLUGIN, MAX_PLUGIN_STATE_VALUE_BYTES } from "./plugin-state-store.sqlite.js";

describe("plugin state limits", () => {
  it("keeps bounded storage constants", () => {
    expect(MAX_PLUGIN_STATE_VALUE_BYTES).toBe(65_536);
    expect(MAX_PLUGIN_STATE_ENTRIES_PER_PLUGIN).toBeGreaterThan(0);
  });
});
