import { describe, expect, it } from "vitest";
import { isValidProfileName, normalizeProfileName } from "./profile-utils.js";

describe("isValidProfileName()", () => {
  it("returns true for lowercase alphanumeric", () => {
    expect(isValidProfileName("production")).toBe(true);
  });

  it("returns true for name with hyphen", () => {
    expect(isValidProfileName("my-profile")).toBe(true);
  });

  it("returns true for name with underscore", () => {
    expect(isValidProfileName("my_profile")).toBe(true);
  });

  it("returns true for mixed case", () => {
    expect(isValidProfileName("MyProfile")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isValidProfileName("")).toBe(false);
  });

  it("returns false for name starting with special char", () => {
    expect(isValidProfileName("-bad")).toBe(false);
  });

  it("returns false for name with spaces", () => {
    expect(isValidProfileName("my profile")).toBe(false);
  });
});

describe("normalizeProfileName()", () => {
  it("returns null for undefined", () => {
    expect(normalizeProfileName(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(normalizeProfileName(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeProfileName("")).toBeNull();
  });

  it("returns null for 'default' (case-insensitive)", () => {
    expect(normalizeProfileName("default")).toBeNull();
    expect(normalizeProfileName("DEFAULT")).toBeNull();
  });

  it("returns trimmed valid name", () => {
    expect(normalizeProfileName("  production  ")).toBe("production");
  });

  it("returns null for invalid name", () => {
    expect(normalizeProfileName("-bad-name")).toBeNull();
  });
});
