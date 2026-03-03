import { describe, expect, it } from "vitest";
import { isPidAlive, getProcessStartTime } from "./pid-alive.js";

describe("isPidAlive", () => {
  it("returns true for the current running process", () => {
    expect(isPidAlive(process.pid)).toBe(true);
  });

  it("returns false for a non-existent PID", () => {
    expect(isPidAlive(999999999)).toBe(false);
  });

  it("returns false for invalid PIDs", () => {
    expect(isPidAlive(0)).toBe(false);
    expect(isPidAlive(-1)).toBe(false);
    expect(isPidAlive(NaN)).toBe(false);
  });
});

describe("getProcessStartTime", () => {
  it("returns a number or null for current process", () => {
    const startTime = getProcessStartTime(process.pid);
    // On macOS, this may return null since it's Linux-only
    expect(startTime === null || typeof startTime === "number").toBe(true);
  });

  it("returns null for invalid PIDs", () => {
    expect(getProcessStartTime(-1)).toBeNull();
    expect(getProcessStartTime(999999999)).toBeNull();
  });
});
