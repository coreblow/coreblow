import { describe, expect, it } from "vitest";
import { CORE_AUTH_CHOICE_OPTIONS } from "./auth-choice-options.static.js";

describe("CORE_AUTH_CHOICE_OPTIONS", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(CORE_AUTH_CHOICE_OPTIONS)).toBe(true);
    expect(CORE_AUTH_CHOICE_OPTIONS.length).toBeGreaterThan(0);
  });

  it("each option has a value field (not id)", () => {
    for (const opt of CORE_AUTH_CHOICE_OPTIONS) {
      expect(typeof (opt as { value: string }).value).toBe("string");
    }
  });

  it("each option has a label field", () => {
    for (const opt of CORE_AUTH_CHOICE_OPTIONS) {
      expect(typeof (opt as { label: string }).label).toBe("string");
    }
  });

  it("all option values are non-empty strings", () => {
    for (const opt of CORE_AUTH_CHOICE_OPTIONS) {
      expect((opt as { value: string }).value.length).toBeGreaterThan(0);
    }
  });

  it("option values are unique", () => {
    const values = CORE_AUTH_CHOICE_OPTIONS.map((o) => (o as { value: string }).value);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it("contains custom-api-key option", () => {
    const values = CORE_AUTH_CHOICE_OPTIONS.map((o) => (o as { value: string }).value);
    expect(values).toContain("custom-api-key");
  });
});
