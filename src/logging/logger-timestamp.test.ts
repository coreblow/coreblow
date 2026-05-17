import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getLogger, resetLogger, setLoggerOverride } from "./logger.js";

describe("logger-timestamp", () => {
  const tempRoots: string[] = [];

  afterEach(() => {
    resetLogger();
    vi.restoreAllMocks();
    vi.useRealTimers();
    for (const root of tempRoots.splice(0)) {
      fs.rmSync(root, { force: true, recursive: true });
    }
  });

  it("uses local time format in file logs (not UTC)", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-logger-timestamp-"));
    tempRoots.push(root);
    const file = path.join(root, "coreblow.log");
    setLoggerOverride({ level: "info", file });
    vi.setSystemTime(new Date("2026-05-17T10:00:00.123Z"));

    getLogger().info("timestamp check");

    const log = fs.readFileSync(file, "utf8");
    const record = JSON.parse(log) as { time?: string };
    expect(record.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
    expect(record.time?.endsWith("Z")).toBe(false);
  });
});
