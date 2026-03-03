import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAFE_BINS,
  collectKnownLongFlags,
} from "./exec-safe-bin-policy-profiles.js";

describe("DEFAULT_SAFE_BINS", () => {
  it("is a non-empty readonly array", () => {
    expect(Array.isArray(DEFAULT_SAFE_BINS)).toBe(true);
    expect(DEFAULT_SAFE_BINS.length).toBeGreaterThan(0);
  });

  it("contains 'cut'", () => {
    expect(DEFAULT_SAFE_BINS).toContain("cut");
  });

  it("contains 'wc'", () => {
    expect(DEFAULT_SAFE_BINS).toContain("wc");
  });

  it("contains 'head' and 'tail'", () => {
    expect(DEFAULT_SAFE_BINS).toContain("head");
    expect(DEFAULT_SAFE_BINS).toContain("tail");
  });

  it("all entries are non-empty strings", () => {
    for (const bin of DEFAULT_SAFE_BINS) {
      expect(typeof bin).toBe("string");
      expect(bin.length).toBeGreaterThan(0);
    }
  });
});

describe("collectKnownLongFlags()", () => {
  it("is a function", () => {
    expect(typeof collectKnownLongFlags).toBe("function");
  });

  it("returns an array", () => {
    const result = collectKnownLongFlags(new Set(), new Set());
    expect(Array.isArray(result)).toBe(true);
  });

  it("returns empty array for empty inputs", () => {
    const result = collectKnownLongFlags(new Set(), new Set());
    expect(result).toHaveLength(0);
  });

  it("collects flags from allowedValueFlags", () => {
    const result = collectKnownLongFlags(new Set(["--output", "--format"]), new Set());
    expect(result).toContain("--output");
    expect(result).toContain("--format");
  });
});
