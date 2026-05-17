import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getResolvedLoggerSettings, resetLogger, setLoggerOverride } from "./logger.js";

describe("logger-settings", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetLogger();
  });

  it("uses a silent fast path in default Vitest mode without config reads", () => {
    vi.stubEnv("VITEST", "true");
    vi.stubEnv("COREBLOW_TEST_FILE_LOG", "");

    expect(getResolvedLoggerSettings()).toMatchObject({
      level: "silent",
      maxFileBytes: 500 * 1024 * 1024,
    });
  });

  it("reads explicit override settings when test file logging is enabled", () => {
    vi.stubEnv("VITEST", "true");
    vi.stubEnv("COREBLOW_TEST_FILE_LOG", "1");
    const file = path.join(process.cwd(), ".tmp", "coreblow-test.log");
    setLoggerOverride({ level: "debug", file, maxFileBytes: 128 });

    expect(getResolvedLoggerSettings()).toEqual({ level: "debug", file, maxFileBytes: 128 });
  });

  it("lets COREBLOW_LOG_LEVEL override configured file level", () => {
    vi.stubEnv("COREBLOW_LOG_LEVEL", "trace");
    setLoggerOverride({ level: "error" });

    expect(getResolvedLoggerSettings().level).toBe("trace");
  });
});
