import { describe, expect, it } from "vitest";
import { normalizeWindowsArgv } from "./windows-argv.js";

describe("normalizeWindowsArgv()", () => {
  it("returns same array on non-win32 platform", () => {
    // On macOS/Linux: returns argv unchanged
    const argv = ["/usr/bin/node", "/app/index.js", "--flag"];
    const result = normalizeWindowsArgv(argv);
    expect(Array.isArray(result)).toBe(true);
    if (process.platform !== "win32") {
      expect(result).toEqual(argv);
    }
  });

  it("returns empty array unchanged", () => {
    expect(normalizeWindowsArgv([])).toEqual([]);
  });

  it("returns single-element array unchanged", () => {
    expect(normalizeWindowsArgv(["/node"])).toEqual(["/node"]);
  });

  it("does not throw for any valid argv", () => {
    expect(() =>
      normalizeWindowsArgv(["node", "script.js", "--verbose"])
    ).not.toThrow();
  });

  it("returns an array (never null/undefined)", () => {
    const result = normalizeWindowsArgv(["node", "app.js"]);
    expect(Array.isArray(result)).toBe(true);
  });
});
