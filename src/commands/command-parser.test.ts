import { describe, it, expect } from "vitest";
import { parseCommand } from "./command-parser.js";

describe("parseCommand", () => {
  it("parses simple command", () => {
    const result = parseCommand("/help");
    expect(result).not.toBeNull();
    expect(result!.command).toBe("help");
    expect(result!.args).toEqual([]);
    expect(result!.raw).toBe("/help");
  });

  it("parses command with positional args", () => {
    const result = parseCommand("/config set gateway.port 8080");
    expect(result).not.toBeNull();
    expect(result!.command).toBe("config");
    expect(result!.args).toContain("set");
  });

  it("lowercases command name", () => {
    const result = parseCommand("/HELP");
    expect(result).not.toBeNull();
    expect(result!.command).toBe("help");
  });

  it("trims whitespace", () => {
    const result = parseCommand("  /status  ");
    expect(result).not.toBeNull();
    expect(result!.command).toBe("status");
  });

  it("returns null for non-command text", () => {
    expect(parseCommand("hello world")).toBeNull();
    expect(parseCommand("no slash here")).toBeNull();
  });

  it("returns null for single slash", () => {
    expect(parseCommand("/")).toBeNull();
  });

  it("returns null for double slash", () => {
    expect(parseCommand("//comment")).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseCommand("")).toBeNull();
    expect(parseCommand("   ")).toBeNull();
  });

  it("parses flags", () => {
    const result = parseCommand("/deploy --force --env production");
    expect(result).not.toBeNull();
    expect(result!.command).toBe("deploy");
    expect(result!.flags).toBeDefined();
    expect(result!.flags.force).toBe(true);
    // parseFlags treats --env as a boolean flag; "production" goes to positional args
    expect(result!.flags.env).toBe(true);
    expect(result!.args).toContain("production");
  });

  it("preserves raw input", () => {
    const raw = "/test arg1 --flag value";
    const result = parseCommand(raw);
    expect(result!.raw).toBe(raw);
  });
});
