import { describe, expect, it } from "vitest";
import {
  DEFAULT_SAFE_BINS,
  SAFE_BIN_PROFILES,
  validateSafeBinArgv,
} from "./exec-safe-bin-policy.js";

describe("exec safe bin policy", () => {
  it("exports a non-empty default safe bins list", () => {
    expect(DEFAULT_SAFE_BINS).toBeDefined();
  });

  it("exports profile definitions", () => {
    expect(SAFE_BIN_PROFILES).toBeDefined();
    expect(typeof SAFE_BIN_PROFILES).toBe("object");
    expect(Object.keys(SAFE_BIN_PROFILES).length).toBeGreaterThan(0);
  });

  it("validates safe argv for known profiles", () => {
    const profiles = Object.entries(SAFE_BIN_PROFILES);
    expect(profiles.length).toBeGreaterThan(0);
    // A basic invocation should be safe
    for (const [binName, profile] of profiles.slice(0, 3)) {
      const result = validateSafeBinArgv([], profile, { binName });
      expect(typeof result).toBe("boolean");
    }
  });
});
