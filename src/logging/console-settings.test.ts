import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getResolvedConsoleSettings,
  setConsoleConfigLoaderForTests,
} from "./console.js";
import { resetLogger, setLoggerOverride } from "./logger.js";

describe("console-settings", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    setConsoleConfigLoaderForTests();
    resetLogger();
  });

  it("does not recurse when loadConfig logs during resolution", () => {
    vi.stubEnv("VITEST", "");
    let calls = 0;
    setConsoleConfigLoaderForTests(() => {
      calls += 1;
      return { consoleLevel: "warn", consoleStyle: "compact" };
    });

    expect(getResolvedConsoleSettings()).toEqual({ level: "warn", style: "compact" });
    expect(calls).toBe(1);
  });

  it("skips config fallback during the default Vitest fast path", () => {
    vi.stubEnv("VITEST", "true");
    vi.stubEnv("COREBLOW_TEST_CONSOLE", "");
    const loader = vi.fn(() => ({ consoleLevel: "debug" as const }));
    setConsoleConfigLoaderForTests(loader);

    expect(getResolvedConsoleSettings().level).toBe("silent");
    expect(loader).not.toHaveBeenCalled();
  });

  it("uses logger override settings for console level and style", () => {
    setLoggerOverride({ consoleLevel: "error", consoleStyle: "json" });

    expect(getResolvedConsoleSettings()).toEqual({ level: "error", style: "json" });
  });
});
