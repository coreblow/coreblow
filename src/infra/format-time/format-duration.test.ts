/**
 * src/infra/format-time/format-duration.test.ts
 *
 * CoreBlow — Format Duration Tests
 * Verifies formatDurationSeconds, formatDurationPrecise,
 * formatDurationCompact, formatDurationHuman.
 */
import { describe, expect, it } from "vitest";
import {
  formatDurationSeconds,
  formatDurationPrecise,
  formatDurationCompact,
  formatDurationHuman,
} from "./format-duration.js";

describe("formatDurationSeconds()", () => {
  it("returns 'unknown' for non-finite input", () => {
    expect(formatDurationSeconds(NaN)).toBe("unknown");
    expect(formatDurationSeconds(Infinity)).toBe("unknown");
  });

  it("formats 1000ms as '1s'", () => {
    expect(formatDurationSeconds(1000)).toBe("1s");
  });

  it("formats 1500ms as '1.5s'", () => {
    expect(formatDurationSeconds(1500)).toBe("1.5s");
  });

  it("formats 0ms as '0s'", () => {
    expect(formatDurationSeconds(0)).toBe("0s");
  });

  it("respects unit=seconds", () => {
    const r = formatDurationSeconds(2000, { unit: "seconds" });
    expect(r).toContain("seconds");
  });
});

describe("formatDurationPrecise()", () => {
  it("returns 'unknown' for NaN", () => {
    expect(formatDurationPrecise(NaN)).toBe("unknown");
  });

  it("formats sub-second durations as Nms", () => {
    expect(formatDurationPrecise(500)).toBe("500ms");
  });

  it("formats >= 1000ms in seconds", () => {
    expect(formatDurationPrecise(2000)).toContain("s");
  });

  it("formats 0ms as '0ms'", () => {
    expect(formatDurationPrecise(0)).toBe("0ms");
  });
});

describe("formatDurationCompact()", () => {
  it("returns undefined for null/undefined input", () => {
    expect(formatDurationCompact(null)).toBeUndefined();
    expect(formatDurationCompact(undefined)).toBeUndefined();
  });

  it("formats minutes correctly", () => {
    const r = formatDurationCompact(120_000); // 2 min
    expect(r).toContain("2m");
  });

  it("formats hours correctly", () => {
    const r = formatDurationCompact(3_600_000); // 1h
    expect(r).toContain("1h");
  });
});

describe("formatDurationHuman()", () => {
  it("returns fallback for null input", () => {
    expect(formatDurationHuman(null)).toBe("n/a");
  });

  it("returns custom fallback", () => {
    expect(formatDurationHuman(undefined, "–")).toBe("–");
  });

  it("returns a string for valid ms", () => {
    expect(typeof formatDurationHuman(60_000)).toBe("string");
  });
});
