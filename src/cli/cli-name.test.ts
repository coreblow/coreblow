import { describe, expect, it } from "vitest";
import {
  DEFAULT_CLI_NAME,
  resolveCliName,
  replaceCliName,
} from "./cli-name.js";

describe("DEFAULT_CLI_NAME", () => {
  it("equals 'coreblow'", () => {
    expect(DEFAULT_CLI_NAME).toBe("coreblow");
  });

  it("is a non-empty string", () => {
    expect(typeof DEFAULT_CLI_NAME).toBe("string");
    expect(DEFAULT_CLI_NAME.length).toBeGreaterThan(0);
  });
});

describe("resolveCliName()", () => {
  it("returns DEFAULT_CLI_NAME for empty argv", () => {
    expect(resolveCliName([])).toBe(DEFAULT_CLI_NAME);
  });

  it("returns DEFAULT_CLI_NAME when argv[1] is undefined", () => {
    expect(resolveCliName(["/usr/bin/node"])).toBe(DEFAULT_CLI_NAME);
  });

  it("returns 'coreblow' when argv[1] basename is 'coreblow'", () => {
    expect(resolveCliName(["/node", "/usr/local/bin/coreblow"])).toBe("coreblow");
  });

  it("returns DEFAULT_CLI_NAME for unknown binary", () => {
    expect(resolveCliName(["/node", "/usr/local/bin/mycli"])).toBe(DEFAULT_CLI_NAME);
  });
});

describe("replaceCliName()", () => {
  it("returns whitespace string unchanged", () => {
    expect(replaceCliName("   ")).toBe("   ");
  });

  it("replaces 'coreblow' in a command string", () => {
    const result = replaceCliName("coreblow run agent", "mycli");
    expect(result).toContain("mycli");
  });

  it("returns original when no coreblow prefix", () => {
    const result = replaceCliName("some-other-command");
    expect(result).toBe("some-other-command");
  });
});
