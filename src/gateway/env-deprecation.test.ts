import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  resetLegacyCoreBlowEnvWarningForTest,
  warnLegacyCoreBlowEnvVars,
} from "./env-deprecation.js";

describe("warnLegacyCoreBlowEnvVars", () => {
  let emitWarning: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    resetLegacyCoreBlowEnvWarningForTest();
    emitWarning = vi.spyOn(process, "emitWarning").mockImplementation(() => {});
  });

  afterEach(() => {
    emitWarning.mockRestore();
    resetLegacyCoreBlowEnvWarningForTest();
  });

  it("warns with counts and prefixes instead of secret-shaped env names", () => {
    warnLegacyCoreBlowEnvVars({
      OPENCLAW_GATEWAY_TOKEN: "old-token",
      CLAWDBOT_GATEWAY_PASSWORD: "old-password", // pragma: allowlist secret
      "MOLTBOT_MALICIOUS\nforged": "old-value",
    });

    expect(emitWarning).toHaveBeenCalledOnce();
    const [message, options] = emitWarning.mock.calls.at(0) as [
      string,
      { code: string; type: string },
    ];
    expect(message).toContain("Legacy OPENCLAW_*, CLAWDBOT_*, MOLTBOT_* environment variables");
    expect(message).toContain("3 total");
    expect(message).toContain("replacing the legacy prefix with COREBLOW_");
    expect(message).not.toContain("GATEWAY_TOKEN");
    expect(message).not.toContain("GATEWAY_PASSWORD");
    expect(message).not.toContain("forged");
    expect(options).toEqual({
      code: "COREBLOW_LEGACY_ENV_VARS",
      type: "DeprecationWarning",
    });
  });

  it("does not warn for current COREBLOW names", () => {
    warnLegacyCoreBlowEnvVars({ COREBLOW_GATEWAY_TOKEN: "token" });

    expect(emitWarning).not.toHaveBeenCalled();
  });

  it("warns only once after a successful emit", () => {
    warnLegacyCoreBlowEnvVars({ OPENCLAW_GATEWAY_TOKEN: "old-token" });
    warnLegacyCoreBlowEnvVars({ CLAWDBOT_GATEWAY_TOKEN: "old-token" });

    expect(emitWarning).toHaveBeenCalledOnce();
  });

  it("retries if emitWarning throws before the warning is emitted", () => {
    emitWarning
      .mockImplementationOnce(() => {
        throw new Error("warning sink failed");
      })
      .mockImplementationOnce(() => {});

    expect(() => warnLegacyCoreBlowEnvVars({ OPENCLAW_GATEWAY_TOKEN: "old-token" })).toThrow(
      "warning sink failed",
    );
    warnLegacyCoreBlowEnvVars({ OPENCLAW_GATEWAY_TOKEN: "old-token" });

    expect(emitWarning).toHaveBeenCalledTimes(2);
  });

  it("suppresses warning noise based on the passed test env", () => {
    warnLegacyCoreBlowEnvVars({
      OPENCLAW_GATEWAY_TOKEN: "old-token",
      VITEST: "true",
    });

    expect(emitWarning).not.toHaveBeenCalled();
  });
});
