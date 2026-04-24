import { describe, it, expect } from "vitest";

import { isFileLogLevelEnabled, getLogger, getChildLogger, toPinoLikeLogger, getResolvedLoggerSettings, setLoggerOverride, resetLogger, registerLogTransport, DEFAULT_LOG_DIR, DEFAULT_LOG_FILE, __test__ } from "./logger.js";

describe("logging/logger browser-safe import", () => {
  it("resolves all imports without errors", () => {
    expect(isFileLogLevelEnabled).toBeDefined();
    expect(getLogger).toBeDefined();
    expect(getChildLogger).toBeDefined();
    expect(toPinoLikeLogger).toBeDefined();
    expect(getResolvedLoggerSettings).toBeDefined();
    expect(setLoggerOverride).toBeDefined();
    expect(resetLogger).toBeDefined();
    expect(registerLogTransport).toBeDefined();
    expect(DEFAULT_LOG_DIR).toBeDefined();
    expect(DEFAULT_LOG_FILE).toBeDefined();
    expect(__test__).toBeDefined();
  });

  it.todo("does not resolve the preferred temp dir at import time when node fs is unavailable");
  it.todo("disables file logging when imported in a browser-like environment");
});
