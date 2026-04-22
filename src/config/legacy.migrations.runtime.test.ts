/**
 * src/config/legacy.migrations.runtime.test.ts
 *
 * CoreBlow — Legacy Config Migrations Runtime Tests
 */
import { describe, expect, it } from "vitest";
import { LEGACY_CONFIG_MIGRATIONS_RUNTIME } from "./legacy.migrations.runtime.js";

describe("LEGACY_CONFIG_MIGRATIONS_RUNTIME", () => {
  it("is an array", () => {
    expect(Array.isArray(LEGACY_CONFIG_MIGRATIONS_RUNTIME)).toBe(true);
  });

  it("length is >= 0", () => {
    expect(LEGACY_CONFIG_MIGRATIONS_RUNTIME.length).toBeGreaterThanOrEqual(0);
  });

  it("each entry is a non-null object", () => {
    for (const m of LEGACY_CONFIG_MIGRATIONS_RUNTIME) {
      expect(typeof m).toBe("object");
      expect(m).not.toBeNull();
    }
  });
});
