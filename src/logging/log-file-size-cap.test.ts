import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { getResolvedLoggerSettings, resetLogger, setLoggerOverride } from "./logger.js";

describe("log-file-size-cap", () => {
  afterEach(() => {
    resetLogger();
  });

  it("defaults maxFileBytes to 500 MB when unset", () => {
    setLoggerOverride({ level: "info" });

    expect(getResolvedLoggerSettings().maxFileBytes).toBe(500 * 1024 * 1024);
  });

  it("uses configured maxFileBytes", () => {
    const file = path.join(process.cwd(), ".tmp", "configured-size-cap.log");
    setLoggerOverride({ level: "info", file, maxFileBytes: 4096 });

    expect(getResolvedLoggerSettings()).toMatchObject({ file, maxFileBytes: 4096 });
  });

  it("ignores invalid maxFileBytes values", () => {
    setLoggerOverride({ level: "info", maxFileBytes: -1 });

    expect(getResolvedLoggerSettings().maxFileBytes).toBe(500 * 1024 * 1024);
  });

  it.todo("suppresses file writes after cap is reached and warns once");
});
