import { describe, it, expect } from "vitest";
import {
  TELEGRAM_COMMAND_NAME_PATTERN,
  normalizeTelegramCommandName,
  normalizeTelegramCommandDescription,
  resolveTelegramCustomCommands,
} from "./telegram-custom-commands.js";

describe("TELEGRAM_COMMAND_NAME_PATTERN", () => {
  it("accepts valid command names", () => {
    expect(TELEGRAM_COMMAND_NAME_PATTERN.test("start")).toBe(true);
    expect(TELEGRAM_COMMAND_NAME_PATTERN.test("my_command")).toBe(true);
    expect(TELEGRAM_COMMAND_NAME_PATTERN.test("cmd123")).toBe(true);
    expect(TELEGRAM_COMMAND_NAME_PATTERN.test("a")).toBe(true);
    expect(TELEGRAM_COMMAND_NAME_PATTERN.test("a".repeat(32))).toBe(true);
  });

  it("rejects invalid command names", () => {
    expect(TELEGRAM_COMMAND_NAME_PATTERN.test("")).toBe(false);
    expect(TELEGRAM_COMMAND_NAME_PATTERN.test("HAS_UPPER")).toBe(false);
    expect(TELEGRAM_COMMAND_NAME_PATTERN.test("has-dash")).toBe(false);
    expect(TELEGRAM_COMMAND_NAME_PATTERN.test("has space")).toBe(false);
    expect(TELEGRAM_COMMAND_NAME_PATTERN.test("a".repeat(33))).toBe(false);
  });
});

describe("normalizeTelegramCommandName", () => {
  it("trims and lowercases", () => {
    expect(normalizeTelegramCommandName("  MyCmd  ")).toBe("mycmd");
  });

  it("strips leading slash", () => {
    expect(normalizeTelegramCommandName("/start")).toBe("start");
  });

  it("replaces dashes with underscores", () => {
    expect(normalizeTelegramCommandName("my-command")).toBe("my_command");
  });

  it("returns empty for empty input", () => {
    expect(normalizeTelegramCommandName("")).toBe("");
    expect(normalizeTelegramCommandName("   ")).toBe("");
  });
});

describe("normalizeTelegramCommandDescription", () => {
  it("trims whitespace", () => {
    expect(normalizeTelegramCommandDescription("  Hello World  ")).toBe("Hello World");
  });
});

describe("resolveTelegramCustomCommands", () => {
  it("resolves valid commands", () => {
    const result = resolveTelegramCustomCommands({
      commands: [
        { command: "help", description: "Get help" },
        { command: "status", description: "Check status" },
      ],
    });
    expect(result.commands).toEqual([
      { command: "help", description: "Get help" },
      { command: "status", description: "Check status" },
    ]);
    expect(result.issues).toEqual([]);
  });

  it("normalizes command names", () => {
    const result = resolveTelegramCustomCommands({
      commands: [{ command: "/My-Cmd", description: "Test" }],
    });
    expect(result.commands[0].command).toBe("my_cmd");
  });

  it("reports missing command name", () => {
    const result = resolveTelegramCustomCommands({
      commands: [{ command: "", description: "desc" }],
    });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].field).toBe("command");
    expect(result.issues[0].message).toContain("missing a command name");
  });

  it("reports invalid command name", () => {
    const result = resolveTelegramCustomCommands({
      commands: [{ command: "has space!!", description: "desc" }],
    });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain("invalid");
  });

  it("reports reserved command conflict", () => {
    const result = resolveTelegramCustomCommands({
      commands: [{ command: "start", description: "desc" }],
      reservedCommands: new Set(["start"]),
    });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain("conflicts with a native command");
  });

  it("reports duplicate commands", () => {
    const result = resolveTelegramCustomCommands({
      commands: [
        { command: "help", description: "Help 1" },
        { command: "help", description: "Help 2" },
      ],
    });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].message).toContain("duplicated");
  });

  it("reports missing description", () => {
    const result = resolveTelegramCustomCommands({
      commands: [{ command: "good_cmd", description: "" }],
    });
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0].field).toBe("description");
  });

  it("handles null/undefined commands array", () => {
    expect(resolveTelegramCustomCommands({ commands: null }).commands).toEqual([]);
    expect(resolveTelegramCustomCommands({ commands: undefined }).commands).toEqual([]);
    expect(resolveTelegramCustomCommands({}).commands).toEqual([]);
  });

  it("skips reserved check when disabled", () => {
    const result = resolveTelegramCustomCommands({
      commands: [{ command: "start", description: "Start" }],
      reservedCommands: new Set(["start"]),
      checkReserved: false,
    });
    expect(result.commands).toHaveLength(1);
    expect(result.issues).toEqual([]);
  });

  it("skips duplicate check when disabled", () => {
    const result = resolveTelegramCustomCommands({
      commands: [
        { command: "help", description: "Help 1" },
        { command: "help", description: "Help 2" },
      ],
      checkDuplicates: false,
    });
    expect(result.commands).toHaveLength(2);
    expect(result.issues).toEqual([]);
  });
});
