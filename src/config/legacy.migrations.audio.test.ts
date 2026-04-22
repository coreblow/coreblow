/**
 * src/config/legacy.migrations.audio.test.ts
 *
 * CoreBlow — Legacy Config Migrations Audio Tests
 */
import { describe, expect, it } from "vitest";
import { LEGACY_CONFIG_MIGRATIONS_AUDIO } from "./legacy.migrations.audio.js";

describe("LEGACY_CONFIG_MIGRATIONS_AUDIO", () => {
  it("is an array", () => {
    expect(Array.isArray(LEGACY_CONFIG_MIGRATIONS_AUDIO)).toBe(true);
  });

  it("each entry is a non-null object", () => {
    for (const m of LEGACY_CONFIG_MIGRATIONS_AUDIO) {
      expect(typeof m).toBe("object");
      expect(m).not.toBeNull();
    }
  });

  it("length is >= 0", () => {
    expect(LEGACY_CONFIG_MIGRATIONS_AUDIO.length).toBeGreaterThanOrEqual(0);
  });
});
