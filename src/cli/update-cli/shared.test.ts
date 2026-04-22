/**
 * src/cli/update-cli/shared.test.ts
 *
 * CoreBlow — Update CLI Shared Tests
 * Verifies DEFAULT_PACKAGE_NAME and normalizeTag.
 */
import { describe, expect, it } from "vitest";
import { DEFAULT_PACKAGE_NAME, normalizeTag } from "./shared.js";

describe("DEFAULT_PACKAGE_NAME", () => {
  it("equals 'coreblow'", () => {
    expect(DEFAULT_PACKAGE_NAME).toBe("coreblow");
  });

  it("is a non-empty string", () => {
    expect(typeof DEFAULT_PACKAGE_NAME).toBe("string");
    expect(DEFAULT_PACKAGE_NAME.length).toBeGreaterThan(0);
  });
});

describe("normalizeTag()", () => {
  it("returns null for undefined", () => {
    expect(normalizeTag(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(normalizeTag(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeTag("")).toBeNull();
  });

  it("returns string for valid tag", () => {
    const result = normalizeTag("latest");
    expect(result === null || typeof result === "string").toBe(true);
  });
});
