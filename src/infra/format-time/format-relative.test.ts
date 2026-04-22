import { describe, expect, it } from "vitest";
import { formatTimeAgo, formatRelativeTimestamp } from "./format-relative.js";

describe("formatTimeAgo()", () => {
  it("returns fallback for null", () => {
    expect(formatTimeAgo(null)).toBe("unknown");
  });

  it("returns fallback for undefined", () => {
    expect(formatTimeAgo(undefined)).toBe("unknown");
  });

  it("returns custom fallback for negative", () => {
    expect(formatTimeAgo(-1, { fallback: "n/a" })).toBe("n/a");
  });

  it("returns 'just now' for 0ms", () => {
    expect(formatTimeAgo(0)).toBe("just now");
  });

  it("returns 'just now' for < 30s (rounds to 0 min)", () => {
    expect(formatTimeAgo(15_000)).toBe("just now");
  });

  it("returns Nm ago for minutes", () => {
    const result = formatTimeAgo(5 * 60_000);
    expect(result).toContain("5m");
    expect(result).toContain("ago");
  });

  it("suppresses 'ago' suffix when suffix=false", () => {
    const result = formatTimeAgo(5 * 60_000, { suffix: false });
    expect(result).not.toContain("ago");
    expect(result).toContain("5m");
  });

  it("returns Nh ago for hours", () => {
    const result = formatTimeAgo(3 * 3600_000);
    expect(result).toContain("3h");
  });

  it("returns Nd ago for days", () => {
    const result = formatTimeAgo(2 * 86400_000);
    expect(result).toContain("2d");
  });
});

describe("formatRelativeTimestamp()", () => {
  it("is a function", () => {
    expect(typeof formatRelativeTimestamp).toBe("function");
  });

  it("returns a string for past timestamp", () => {
    const result = formatRelativeTimestamp(Date.now() - 60_000);
    expect(typeof result).toBe("string");
  });

  it("returns a string for future timestamp", () => {
    const result = formatRelativeTimestamp(Date.now() + 60_000);
    expect(typeof result).toBe("string");
  });
});
