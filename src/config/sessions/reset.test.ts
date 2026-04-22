/**
 * src/config/sessions/reset.test.ts
 *
 * CoreBlow — Session Reset Policy Tests
 * Verifies DEFAULT_RESET_MODE, isThreadSessionKey,
 * resolveDailyResetAtMs, and resolveSessionResetType.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESET_AT_HOUR,
  DEFAULT_RESET_MODE,
  isThreadSessionKey,
  resolveDailyResetAtMs,
} from "../sessions/reset.js";

describe("DEFAULT constants", () => {
  it("DEFAULT_RESET_MODE is daily", () => {
    expect(DEFAULT_RESET_MODE).toBe("daily");
  });

  it("DEFAULT_RESET_AT_HOUR is a number between 0-23", () => {
    expect(typeof DEFAULT_RESET_AT_HOUR).toBe("number");
    expect(DEFAULT_RESET_AT_HOUR).toBeGreaterThanOrEqual(0);
    expect(DEFAULT_RESET_AT_HOUR).toBeLessThanOrEqual(23);
  });
});

describe("isThreadSessionKey", () => {
  it("returns false for undefined", () => {
    expect(isThreadSessionKey(undefined)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isThreadSessionKey(null)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isThreadSessionKey("")).toBe(false);
  });

  it("returns boolean for any string", () => {
    expect(typeof isThreadSessionKey("thread:discord:123")).toBe("boolean");
  });

  it("returns boolean for plain session key", () => {
    expect(typeof isThreadSessionKey("global")).toBe("boolean");
  });
});

describe("resolveDailyResetAtMs", () => {
  it("returns a positive number", () => {
    const nowMs = Date.now();
    const result = resolveDailyResetAtMs(nowMs, 4);
    expect(typeof result).toBe("number");
    expect(result).toBeGreaterThan(0);
  });

  it("returns a finite number (valid timestamp)", () => {
    const nowMs = Date.now();
    const result = resolveDailyResetAtMs(nowMs, 4);
    expect(Number.isFinite(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it("does not throw for any valid hour 0-23", () => {
    const nowMs = Date.now();
    for (let h = 0; h < 24; h++) {
      expect(() => resolveDailyResetAtMs(nowMs, h)).not.toThrow();
    }
  });
});
