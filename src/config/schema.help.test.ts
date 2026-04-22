/**
 * src/config/schema.help.test.ts
 *
 * CoreBlow — Config Schema Help Tests
 * Verifies FIELD_HELP constant structure.
 */
import { describe, expect, it } from "vitest";
import { FIELD_HELP } from "./schema.help.js";

describe("FIELD_HELP", () => {
  it("is a non-null object", () => {
    expect(typeof FIELD_HELP).toBe("object");
    expect(FIELD_HELP).not.toBeNull();
  });

  it("is non-empty", () => {
    expect(Object.keys(FIELD_HELP).length).toBeGreaterThan(0);
  });

  it("contains 'meta' key", () => {
    expect("meta" in FIELD_HELP).toBe(true);
  });

  it("all values are non-empty strings", () => {
    for (const [key, value] of Object.entries(FIELD_HELP)) {
      expect(typeof value).toBe("string");
      expect(value.length).toBeGreaterThan(0);
      void key;
    }
  });

  it("contains 'env' key", () => {
    expect("env" in FIELD_HELP).toBe(true);
  });
});
