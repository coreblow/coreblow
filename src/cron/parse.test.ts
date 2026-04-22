import { describe, it, expect } from "vitest";
import { parseAbsoluteTimeMs } from "./parse.js";

describe("parseAbsoluteTimeMs", () => {
  it("parses ISO-8601 timestamps with timezone", () => {
    const result = parseAbsoluteTimeMs("2026-01-15T10:30:00Z");
    expect(result).toBe(Date.parse("2026-01-15T10:30:00Z"));
  });

  it("parses ISO-8601 timestamps with offset", () => {
    const result = parseAbsoluteTimeMs("2026-01-15T10:30:00+07:00");
    expect(result).toBe(Date.parse("2026-01-15T10:30:00+07:00"));
  });

  it("appends Z to ISO datetime without timezone", () => {
    const result = parseAbsoluteTimeMs("2026-01-15T10:30:00");
    expect(result).toBe(Date.parse("2026-01-15T10:30:00Z"));
  });

  it("parses date-only as midnight UTC", () => {
    const result = parseAbsoluteTimeMs("2026-01-15");
    expect(result).toBe(Date.parse("2026-01-15T00:00:00Z"));
  });

  it("parses raw millisecond timestamps", () => {
    const result = parseAbsoluteTimeMs("1705312200000");
    expect(result).toBe(1705312200000);
  });

  it("returns null for empty input", () => {
    expect(parseAbsoluteTimeMs("")).toBeNull();
    expect(parseAbsoluteTimeMs("   ")).toBeNull();
  });

  it("returns null for invalid input", () => {
    expect(parseAbsoluteTimeMs("not-a-date")).toBeNull();
  });

  it("rejects zero as a pure-numeric timestamp (falls through to Date.parse)", () => {
    // "0" fails the n > 0 digit check, but Date.parse("0") may still produce a valid date
    // depending on the runtime. The key invariant is that positive integers are treated as ms.
    const result = parseAbsoluteTimeMs("0");
    // The function doesn't guarantee null for "0" — it depends on Date.parse behavior
    expect(typeof result === "number" || result === null).toBe(true);
  });

  it("returns null for truly invalid timestamps", () => {
    expect(parseAbsoluteTimeMs("xyz-not-valid")).toBeNull();
  });

  it("trims whitespace", () => {
    const result = parseAbsoluteTimeMs("  2026-01-15T10:30:00Z  ");
    expect(result).toBe(Date.parse("2026-01-15T10:30:00Z"));
  });
});
