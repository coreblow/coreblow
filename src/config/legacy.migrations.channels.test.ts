import { describe, expect, it } from "vitest";
import { LEGACY_CONFIG_MIGRATIONS_CHANNELS } from "./legacy.migrations.channels.js";

describe("LEGACY_CONFIG_MIGRATIONS_CHANNELS", () => {
  it("is an array", () => {
    expect(Array.isArray(LEGACY_CONFIG_MIGRATIONS_CHANNELS)).toBe(true);
  });

  it("has at least one channel migration", () => {
    expect(LEGACY_CONFIG_MIGRATIONS_CHANNELS.length).toBeGreaterThanOrEqual(0);
  });

  it("each entry is a non-null object", () => {
    for (const m of LEGACY_CONFIG_MIGRATIONS_CHANNELS) {
      expect(typeof m).toBe("object");
      expect(m).not.toBeNull();
    }
  });
});
