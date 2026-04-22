/**
 * src/infra/exec-wrapper-tokens.test.ts
 *
 * CoreBlow — Exec Wrapper Tokens Tests
 * Verifies basenameLower and normalizeExecutableToken.
 */
import { describe, expect, it } from "vitest";
import { basenameLower, normalizeExecutableToken } from "./exec-wrapper-tokens.js";

describe("basenameLower()", () => {
  it("extracts basename and lowercases", () => {
    expect(basenameLower("/usr/bin/Node")).toBe("node");
  });

  it("handles Windows path separator", () => {
    expect(basenameLower("C:\\Windows\\System32\\CMD.EXE")).toBe("cmd.exe");
  });

  it("returns empty string for empty input", () => {
    expect(basenameLower("")).toBe("");
  });

  it("returns lowercase for single token", () => {
    expect(basenameLower("PYTHON")).toBe("python");
  });

  it("trims whitespace", () => {
    expect(basenameLower("  node  ")).toBe("node");
  });
});

describe("normalizeExecutableToken()", () => {
  it("strips .exe suffix on Windows paths", () => {
    expect(normalizeExecutableToken("C:\\bin\\node.exe")).toBe("node");
  });

  it("strips .cmd suffix", () => {
    expect(normalizeExecutableToken("script.cmd")).toBe("script");
  });

  it("strips .bat suffix", () => {
    expect(normalizeExecutableToken("run.bat")).toBe("run");
  });

  it("keeps token without Windows suffix unchanged", () => {
    expect(normalizeExecutableToken("/usr/bin/python3")).toBe("python3");
  });

  it("lowercases the result", () => {
    expect(normalizeExecutableToken("NPM")).toBe("npm");
  });
});
