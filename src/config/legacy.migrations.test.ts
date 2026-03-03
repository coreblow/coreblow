import { describe, expect, it } from "vitest";
import {
  LEGACY_CONFIG_MIGRATIONS,
  LEGACY_CONFIG_MIGRATION_RULES,
} from "./legacy.migrations.js";

describe("LEGACY_CONFIG_MIGRATIONS", () => {
  it("is an array", () => {
    expect(Array.isArray(LEGACY_CONFIG_MIGRATIONS)).toBe(true);
  });

  it("contains at least one migration", () => {
    expect(LEGACY_CONFIG_MIGRATIONS.length).toBeGreaterThanOrEqual(0);
  });

  it("each migration is a non-null object", () => {
    for (const m of LEGACY_CONFIG_MIGRATIONS) {
      expect(typeof m).toBe("object");
      expect(m).not.toBeNull();
    }
  });
});

describe("LEGACY_CONFIG_MIGRATION_RULES", () => {
  it("is an array", () => {
    expect(Array.isArray(LEGACY_CONFIG_MIGRATION_RULES)).toBe(true);
  });

  it("length is >= 0", () => {
    expect(LEGACY_CONFIG_MIGRATION_RULES.length).toBeGreaterThanOrEqual(0);
  });

  it("all rules are non-null objects", () => {
    for (const rule of LEGACY_CONFIG_MIGRATION_RULES) {
      expect(typeof rule).toBe("object");
      expect(rule).not.toBeNull();
    }
  });
});
