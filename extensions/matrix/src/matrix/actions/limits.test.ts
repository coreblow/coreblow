/**
 * extensions/matrix/src/matrix/actions/limits.test.ts
 *
 * CoreBlow — Matrix Extension: Limits Tests
 * Verifies Action rate limiting and throttle enforcement.
 */
import { describe, expect, it } from "vitest";
import { resolveMatrixActionLimit } from "./limits.js";

describe("resolveMatrixActionLimit", () => {
  it("uses fallback for undefined", () => {
    expect(resolveMatrixActionLimit(undefined, 20)).toBe(20);
  });

  it("uses fallback for NaN", () => {
    expect(resolveMatrixActionLimit(Number.NaN, 20)).toBe(20);
  });

  it("uses fallback for Infinity", () => {
    expect(resolveMatrixActionLimit(Infinity, 20)).toBe(20);
  });

  it("uses fallback for string input", () => {
    expect(resolveMatrixActionLimit("10", 20)).toBe(20);
  });

  it("uses fallback for null", () => {
    expect(resolveMatrixActionLimit(null, 20)).toBe(20);
  });

  it("floors fractional values", () => {
    expect(resolveMatrixActionLimit(7.9, 20)).toBe(7);
    expect(resolveMatrixActionLimit(1.1, 20)).toBe(1);
  });

  it("clamps zero to 1", () => {
    expect(resolveMatrixActionLimit(0, 20)).toBe(1);
  });

  it("clamps negative values to 1", () => {
    expect(resolveMatrixActionLimit(-3, 20)).toBe(1);
    expect(resolveMatrixActionLimit(-100, 20)).toBe(1);
  });

  it("passes through valid positive integers", () => {
    expect(resolveMatrixActionLimit(5, 20)).toBe(5);
    expect(resolveMatrixActionLimit(100, 20)).toBe(100);
  });

  it("uses different fallbacks correctly", () => {
    expect(resolveMatrixActionLimit(undefined, 10)).toBe(10);
    expect(resolveMatrixActionLimit(undefined, 50)).toBe(50);
  });
});
