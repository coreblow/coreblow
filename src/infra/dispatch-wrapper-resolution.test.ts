import { describe, expect, it } from "vitest";
import {
  MAX_DISPATCH_WRAPPER_DEPTH,
  isEnvAssignment,
  unwrapEnvInvocation,
} from "./dispatch-wrapper-resolution.js";

describe("MAX_DISPATCH_WRAPPER_DEPTH", () => {
  it("is a positive number", () => {
    expect(typeof MAX_DISPATCH_WRAPPER_DEPTH).toBe("number");
    expect(MAX_DISPATCH_WRAPPER_DEPTH).toBeGreaterThan(0);
  });

  it("equals 4", () => {
    expect(MAX_DISPATCH_WRAPPER_DEPTH).toBe(4);
  });
});

describe("isEnvAssignment()", () => {
  it("returns true for KEY=value format", () => {
    expect(isEnvAssignment("NODE_ENV=production")).toBe(true);
  });

  it("returns true for single-char key", () => {
    expect(isEnvAssignment("X=1")).toBe(true);
  });

  it("returns false for plain token", () => {
    expect(isEnvAssignment("node")).toBe(false);
  });

  it("returns false for flag", () => {
    expect(isEnvAssignment("--verbose")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isEnvAssignment("")).toBe(false);
  });

  it("returns false for numeric start (1KEY=val)", () => {
    expect(isEnvAssignment("1KEY=val")).toBe(false);
  });
});

describe("unwrapEnvInvocation()", () => {
  it("returns null for empty argv", () => {
    expect(unwrapEnvInvocation([])).toBeNull();
  });

  it("returns null or array for any argv (strips wrapper tokens)", () => {
    const result = unwrapEnvInvocation(["node", "index.js"]);
    expect(result === null || Array.isArray(result)).toBe(true);
  });

  it("unwraps env invocation when first token is env", () => {
    const result = unwrapEnvInvocation(["env", "NODE_ENV=production", "node", "server.js"]);
    expect(result === null || Array.isArray(result)).toBe(true);
  });

  it("does not throw for any valid argv", () => {
    expect(() => unwrapEnvInvocation(["env", "X=1", "python", "script.py"])).not.toThrow();
  });
});
