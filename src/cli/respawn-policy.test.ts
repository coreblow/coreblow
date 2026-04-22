import { describe, expect, it } from "vitest";
import { shouldSkipRespawnForArgv } from "./respawn-policy.js";

describe("shouldSkipRespawnForArgv()", () => {
  it("is a function", () => {
    expect(typeof shouldSkipRespawnForArgv).toBe("function");
  });

  it("returns false for empty argv", () => {
    expect(shouldSkipRespawnForArgv([])).toBe(false);
  });

  it("returns false for regular command argv", () => {
    expect(shouldSkipRespawnForArgv(["node", "cli.js", "start"])).toBe(false);
  });

  it("returns true when --help is present", () => {
    expect(shouldSkipRespawnForArgv(["node", "cli.js", "--help"])).toBe(true);
  });

  it("returns true when --version is present", () => {
    expect(shouldSkipRespawnForArgv(["node", "cli.js", "--version"])).toBe(true);
  });

  it("returns true when -h is present", () => {
    expect(shouldSkipRespawnForArgv(["node", "cli.js", "-h"])).toBe(true);
  });

  it("returns true when -V is present", () => {
    expect(shouldSkipRespawnForArgv(["node", "cli.js", "-V"])).toBe(true);
  });
});
