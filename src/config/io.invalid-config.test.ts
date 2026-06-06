import { describe, expect, it, vi } from "vitest";
import {
  createInvalidConfigError,
  formatInvalidConfigDetails,
  formatInvalidConfigLogMessage,
  logInvalidConfigOnce,
  throwInvalidConfig,
} from "./io.invalid-config.js";

describe("invalid config formatting", () => {
  it("sanitizes validation issues for terminal output", () => {
    expect(
      formatInvalidConfigDetails([
        { path: "channels.discord\nbad", message: "must be enabled\tfirst" },
      ]),
    ).toBe("- channels.discord\\nbad: must be enabled\\tfirst");
  });

  it("logs each config path once", () => {
    const logger = { error: vi.fn() };
    const loggedConfigPaths = new Set<string>();
    const details = "- <root>: invalid";

    logInvalidConfigOnce({ configPath: "/tmp/coreblow.json", details, logger, loggedConfigPaths });
    logInvalidConfigOnce({ configPath: "/tmp/coreblow.json", details, logger, loggedConfigPaths });

    expect(logger.error).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(formatInvalidConfigLogMessage("/tmp/coreblow.json", details));
  });

  it("creates and throws INVALID_CONFIG errors", () => {
    const error = createInvalidConfigError("/tmp/coreblow.json", "- <root>: invalid");
    expect(error.message).toContain("Invalid config at /tmp/coreblow.json");
    expect((error as { code?: string }).code).toBe("INVALID_CONFIG");

    expect(() =>
      throwInvalidConfig({
        configPath: "/tmp/coreblow.json",
        issues: [{ path: "", message: "invalid" }],
        logger: { error: vi.fn() },
        loggedConfigPaths: new Set<string>(),
      }),
    ).toThrow("Invalid config at /tmp/coreblow.json");
  });
});
