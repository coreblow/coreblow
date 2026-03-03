import { describe, expect, it } from "vitest";
import { resolveTimezone, formatUtcTimestamp } from "./format-datetime.js";

describe("resolveTimezone()", () => {
  it("returns valid IANA timezone string", () => {
    expect(resolveTimezone("America/New_York")).toBe("America/New_York");
  });

  it("returns valid UTC timezone", () => {
    expect(resolveTimezone("UTC")).toBe("UTC");
  });

  it("returns undefined for invalid timezone", () => {
    expect(resolveTimezone("Invalid/Zone")).toBeUndefined();
  });

  it("returns undefined for empty string timezone", () => {
    expect(resolveTimezone("")).toBeUndefined();
  });

  it("returns Asia/Jakarta as valid", () => {
    expect(resolveTimezone("Asia/Jakarta")).toBe("Asia/Jakarta");
  });
});

describe("formatUtcTimestamp()", () => {
  it("returns a non-empty string", () => {
    const result = formatUtcTimestamp(new Date("2025-01-15T12:00:00Z"));
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });

  it("contains year component", () => {
    const result = formatUtcTimestamp(new Date("2025-06-01T00:00:00Z"));
    expect(result).toContain("2025");
  });

  it("does not throw for epoch date", () => {
    expect(() => formatUtcTimestamp(new Date(0))).not.toThrow();
  });
});
