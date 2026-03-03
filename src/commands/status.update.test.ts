import { describe, expect, it } from "vitest";
import { formatUpdateAvailableHint, formatUpdateOneLiner } from "./status.update.js";

describe("formatUpdateOneLiner", () => {
  it("returns a string summary for git mode", () => {
    const result = formatUpdateOneLiner({
      installKind: "git",
      git: { behind: 0, ahead: 0, branch: "main" },
    } as any);
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatUpdateAvailableHint", () => {
  it("returns null when no update available", () => {
    const result = formatUpdateAvailableHint({
      installKind: "git",
      git: { behind: 0, ahead: 0, branch: "main" },
    } as any);
    expect(result).toBeNull();
  });
});
