import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveEnvLogLevelOverride } from "./env-log-level.js";
import { loggingState } from "./state.js";

describe("logger-env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    loggingState.invalidEnvLogLevelValue = null;
  });

  it("applies a valid env override to both file and console levels", () => {
    vi.stubEnv("COREBLOW_LOG_LEVEL", "debug");

    expect(resolveEnvLogLevelOverride()).toBe("debug");
    expect(loggingState.invalidEnvLogLevelValue).toBeNull();
  });

  it("warns once and ignores invalid env values", () => {
    vi.stubEnv("COREBLOW_LOG_LEVEL", "loud");
    const write = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

    expect(resolveEnvLogLevelOverride()).toBeUndefined();
    expect(resolveEnvLogLevelOverride()).toBeUndefined();
    expect(write).toHaveBeenCalledTimes(1);
    expect(loggingState.invalidEnvLogLevelValue).toBe("loud");
  });
});
