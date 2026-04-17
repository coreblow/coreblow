import { describe, expect, it } from "vitest";
import {
  normalizeEnvVarKey,
  isDangerousHostEnvVarName,
  isDangerousHostEnvOverrideVarName,
  sanitizeHostExecEnv,
  sanitizeHostExecEnvWithDiagnostics,
  sanitizeSystemRunEnvOverrides,
} from "./host-env-security.js";

describe("normalizeEnvVarKey", () => {
  it("returns the key as-is for valid env var names", () => {
    expect(normalizeEnvVarKey("HELLO")).toBe("HELLO");
    expect(normalizeEnvVarKey("MY_VAR_1")).toBe("MY_VAR_1");
  });
});

describe("isDangerousHostEnvVarName", () => {
  it("flags known dangerous environment variable names", () => {
    expect(isDangerousHostEnvVarName("LD_PRELOAD")).toBe(true);
    expect(isDangerousHostEnvVarName("DYLD_INSERT_LIBRARIES")).toBe(true);
    expect(isDangerousHostEnvVarName("NODE_OPTIONS")).toBe(true);
    expect(isDangerousHostEnvVarName("BASH_ENV")).toBe(true);
  });

  it("allows safe environment variable names", () => {
    expect(isDangerousHostEnvVarName("MY_SAFE_VAR")).toBe(false);
    expect(isDangerousHostEnvVarName("HOME")).toBe(false);
    expect(isDangerousHostEnvVarName("PATH")).toBe(false);
  });
});

describe("sanitizeHostExecEnv", () => {
  it("strips dangerous keys from base environment", () => {
    const result = sanitizeHostExecEnv({
      baseEnv: {
        PATH: "/usr/bin",
        LD_PRELOAD: "/evil.so",
        HOME: "/home/user",
        MY_APP: "ok",
      },
    });
    expect(result).toBeDefined();
    expect(result.LD_PRELOAD).toBeUndefined();
    expect(result.HOME).toBe("/home/user");
    expect(result.MY_APP).toBe("ok");
  });

  it("strips shell trace variables", () => {
    const result = sanitizeHostExecEnv({
      baseEnv: {
        PATH: "/usr/bin",
        SHELLOPTS: "xtrace",
        PS4: "$(evil)",
      },
    });
    expect(result).toBeDefined();
    expect(result.SHELLOPTS).toBeUndefined();
    expect(result.PS4).toBeUndefined();
  });
});

describe("sanitizeHostExecEnvWithDiagnostics", () => {
  it("returns sanitized env with accepted overrides", () => {
    const result = sanitizeHostExecEnvWithDiagnostics({
      baseEnv: { PATH: "/usr/bin" },
      overrides: { SAFE_VAR: "ok" },
    });
    expect(result.env).toBeDefined();
    expect(result.env.SAFE_VAR).toBe("ok");
  });
});

describe("sanitizeSystemRunEnvOverrides", () => {
  it("passes through overrides for non-shell commands", () => {
    const result = sanitizeSystemRunEnvOverrides({
      overrides: { MY_VAR: "hello" },
      shellWrapper: false,
    });
    expect(result).toBeDefined();
    expect(result!.MY_VAR).toBe("hello");
  });

  it("returns undefined when no overrides provided", () => {
    const result = sanitizeSystemRunEnvOverrides({});
    expect(result).toBeUndefined();
  });
});
