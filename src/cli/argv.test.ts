import { describe, expect, it } from "vitest";
import {
  buildParseArgv,
  getFlagValue,
  getCommandPath,
  getCommandPositionalsWithRootOptions,
  getCommandPathWithRootOptions,
  getPrimaryCommand,
  getPositiveIntFlagValue,
  getVerboseFlag,
  hasHelpOrVersion,
  hasFlag,
  isRootHelpInvocation,
  isRootVersionInvocation,
  shouldMigrateState,
  shouldMigrateStateFromPath,
} from "./argv.js";

describe("argv helpers", () => {
  it.each([
    {
      name: "help flag",
      argv: ["node", "coreblow", "--help"],
      expected: true,
    },
    {
      name: "version flag",
      argv: ["node", "coreblow", "-V"],
      expected: true,
    },
    {
      name: "normal command",
      argv: ["node", "coreblow", "status"],
      expected: false,
    },
    {
      name: "root -v alias",
      argv: ["node", "coreblow", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "coreblow", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "root -v alias with log-level",
      argv: ["node", "coreblow", "--log-level", "debug", "-v"],
      expected: true,
    },
    {
      name: "subcommand -v should not be treated as version",
      argv: ["node", "coreblow", "acp", "-v"],
      expected: false,
    },
    {
      name: "root -v alias with equals profile",
      argv: ["node", "coreblow", "--profile=work", "-v"],
      expected: true,
    },
    {
      name: "subcommand path after global root flags should not be treated as version",
      argv: ["node", "coreblow", "--dev", "skills", "list", "-v"],
      expected: false,
    },
  ])("detects help/version flags: $name", ({ argv, expected }) => {
    expect(hasHelpOrVersion(argv)).toBe(expected);
  });

  it.each([
    {
      name: "root --version",
      argv: ["node", "coreblow", "--version"],
      expected: true,
    },
    {
      name: "root -V",
      argv: ["node", "coreblow", "-V"],
      expected: true,
    },
    {
      name: "root -v alias with profile",
      argv: ["node", "coreblow", "--profile", "work", "-v"],
      expected: true,
    },
    {
      name: "subcommand version flag",
      argv: ["node", "coreblow", "status", "--version"],
      expected: false,
    },
    {
      name: "unknown root flag with version",
      argv: ["node", "coreblow", "--unknown", "--version"],
      expected: false,
    },
  ])("detects root-only version invocations: $name", ({ argv, expected }) => {
    expect(isRootVersionInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "root --help",
      argv: ["node", "coreblow", "--help"],
      expected: true,
    },
    {
      name: "root -h",
      argv: ["node", "coreblow", "-h"],
      expected: true,
    },
    {
      name: "root --help with profile",
      argv: ["node", "coreblow", "--profile", "work", "--help"],
      expected: true,
    },
    {
      name: "subcommand --help",
      argv: ["node", "coreblow", "status", "--help"],
      expected: false,
    },
    {
      name: "help before subcommand token",
      argv: ["node", "coreblow", "--help", "status"],
      expected: false,
    },
    {
      name: "help after -- terminator",
      argv: ["node", "coreblow", "nodes", "run", "--", "git", "--help"],
      expected: false,
    },
    {
      name: "unknown root flag before help",
      argv: ["node", "coreblow", "--unknown", "--help"],
      expected: false,
    },
    {
      name: "unknown root flag after help",
      argv: ["node", "coreblow", "--help", "--unknown"],
      expected: false,
    },
  ])("detects root-only help invocations: $name", ({ argv, expected }) => {
    expect(isRootHelpInvocation(argv)).toBe(expected);
  });

  it.each([
    {
      name: "single command with trailing flag",
      argv: ["node", "coreblow", "status", "--json"],
      expected: ["status"],
    },
    {
      name: "two-part command",
      argv: ["node", "coreblow", "agents", "list"],
      expected: ["agents", "list"],
    },
    {
      name: "terminator cuts parsing",
      argv: ["node", "coreblow", "status", "--", "ignored"],
      expected: ["status"],
    },
  ])("extracts command path: $name", ({ argv, expected }) => {
    expect(getCommandPath(argv, 2)).toEqual(expected);
  });

  it("extracts command path while skipping known root option values", () => {
    expect(
      getCommandPathWithRootOptions(
        [
          "node",
          "coreblow",
          "--profile",
          "work",
          "--container",
          "demo",
          "--no-color",
          "config",
          "validate",
        ],
        2,
      ),
    ).toEqual(["config", "validate"]);
  });

  it("extracts routed config get positionals with interleaved root options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "coreblow", "config", "get", "--log-level", "debug", "update.channel", "--json"],
        {
          commandPath: ["config", "get"],
          booleanFlags: ["--json"],
        },
      ),
    ).toEqual(["update.channel"]);
  });

  it("extracts routed config unset positionals with interleaved root options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "coreblow", "config", "unset", "--profile", "work", "update.channel"],
        {
          commandPath: ["config", "unset"],
        },
      ),
    ).toEqual(["update.channel"]);
  });

  it("returns null when routed command sees unknown options", () => {
    expect(
      getCommandPositionalsWithRootOptions(
        ["node", "coreblow", "config", "get", "--mystery", "value", "update.channel"],
        {
          commandPath: ["config", "get"],
          booleanFlags: ["--json"],
        },
      ),
    ).toBeNull();
  });

  it.each([
    {
      name: "returns first command token",
      argv: ["node", "coreblow", "agents", "list"],
      expected: "agents",
    },
    {
      name: "returns null when no command exists",
      argv: ["node", "coreblow"],
      expected: null,
    },
    {
      name: "skips known root option values",
      argv: ["node", "coreblow", "--log-level", "debug", "status"],
      expected: "status",
    },
  ])("returns primary command: $name", ({ argv, expected }) => {
    expect(getPrimaryCommand(argv)).toBe(expected);
  });

  it.each([
    {
      name: "detects flag before terminator",
      argv: ["node", "coreblow", "status", "--json"],
      flag: "--json",
      expected: true,
    },
    {
      name: "ignores flag after terminator",
      argv: ["node", "coreblow", "--", "--json"],
      flag: "--json",
      expected: false,
    },
  ])("parses boolean flags: $name", ({ argv, flag, expected }) => {
    expect(hasFlag(argv, flag)).toBe(expected);
  });

  it.each([
    {
      name: "value in next token",
      argv: ["node", "coreblow", "status", "--timeout", "5000"],
      expected: "5000",
    },
    {
      name: "value in equals form",
      argv: ["node", "coreblow", "status", "--timeout=2500"],
      expected: "2500",
    },
    {
      name: "missing value",
      argv: ["node", "coreblow", "status", "--timeout"],
      expected: null,
    },
    {
      name: "next token is another flag",
      argv: ["node", "coreblow", "status", "--timeout", "--json"],
      expected: null,
    },
    {
      name: "flag appears after terminator",
      argv: ["node", "coreblow", "--", "--timeout=99"],
      expected: undefined,
    },
  ])("extracts flag values: $name", ({ argv, expected }) => {
    expect(getFlagValue(argv, "--timeout")).toBe(expected);
  });

  it("parses verbose flags", () => {
    expect(getVerboseFlag(["node", "coreblow", "status", "--verbose"])).toBe(true);
    expect(getVerboseFlag(["node", "coreblow", "status", "--debug"])).toBe(false);
    expect(getVerboseFlag(["node", "coreblow", "status", "--debug"], { includeDebug: true })).toBe(
      true,
    );
  });

  it.each([
    {
      name: "missing flag",
      argv: ["node", "coreblow", "status"],
      expected: undefined,
    },
    {
      name: "missing value",
      argv: ["node", "coreblow", "status", "--timeout"],
      expected: null,
    },
    {
      name: "valid positive integer",
      argv: ["node", "coreblow", "status", "--timeout", "5000"],
      expected: 5000,
    },
    {
      name: "invalid integer",
      argv: ["node", "coreblow", "status", "--timeout", "nope"],
      expected: undefined,
    },
  ])("parses positive integer flag values: $name", ({ argv, expected }) => {
    expect(getPositiveIntFlagValue(argv, "--timeout")).toBe(expected);
  });

  it.each([
    {
      name: "keeps plain node argv",
      rawArgs: ["node", "coreblow", "status"],
      expected: ["node", "coreblow", "status"],
    },
    {
      name: "keeps version-suffixed node binary",
      rawArgs: ["node-22", "coreblow", "status"],
      expected: ["node-22", "coreblow", "status"],
    },
    {
      name: "keeps windows versioned node exe",
      rawArgs: ["node-22.2.0.exe", "coreblow", "status"],
      expected: ["node-22.2.0.exe", "coreblow", "status"],
    },
    {
      name: "keeps dotted node binary",
      rawArgs: ["node-22.2", "coreblow", "status"],
      expected: ["node-22.2", "coreblow", "status"],
    },
    {
      name: "keeps dotted node exe",
      rawArgs: ["node-22.2.exe", "coreblow", "status"],
      expected: ["node-22.2.exe", "coreblow", "status"],
    },
    {
      name: "keeps absolute versioned node path",
      rawArgs: ["/usr/bin/node-22.2.0", "coreblow", "status"],
      expected: ["/usr/bin/node-22.2.0", "coreblow", "status"],
    },
    {
      name: "keeps node24 shorthand",
      rawArgs: ["node24", "coreblow", "status"],
      expected: ["node24", "coreblow", "status"],
    },
    {
      name: "keeps absolute node24 shorthand",
      rawArgs: ["/usr/bin/node24", "coreblow", "status"],
      expected: ["/usr/bin/node24", "coreblow", "status"],
    },
    {
      name: "keeps windows node24 exe",
      rawArgs: ["node24.exe", "coreblow", "status"],
      expected: ["node24.exe", "coreblow", "status"],
    },
    {
      name: "keeps nodejs binary",
      rawArgs: ["nodejs", "coreblow", "status"],
      expected: ["nodejs", "coreblow", "status"],
    },
    {
      name: "prefixes fallback when first arg is not a node launcher",
      rawArgs: ["node-dev", "coreblow", "status"],
      expected: ["node", "coreblow", "node-dev", "coreblow", "status"],
    },
    {
      name: "prefixes fallback when raw args start at program name",
      rawArgs: ["coreblow", "status"],
      expected: ["node", "coreblow", "status"],
    },
    {
      name: "keeps bun execution argv",
      rawArgs: ["bun", "src/entry.ts", "status"],
      expected: ["bun", "src/entry.ts", "status"],
    },
  ] as const)("builds parse argv from raw args: $name", ({ rawArgs, expected }) => {
    const parsed = buildParseArgv({
      programName: "coreblow",
      rawArgs: [...rawArgs],
    });
    expect(parsed).toEqual([...expected]);
  });

  it("builds parse argv from fallback args", () => {
    const fallbackArgv = buildParseArgv({
      programName: "coreblow",
      fallbackArgv: ["status"],
    });
    expect(fallbackArgv).toEqual(["node", "coreblow", "status"]);
  });

  it.each([
    { argv: ["node", "coreblow", "status"], expected: false },
    { argv: ["node", "coreblow", "health"], expected: false },
    { argv: ["node", "coreblow", "sessions"], expected: false },
    { argv: ["node", "coreblow", "config", "get", "update"], expected: false },
    { argv: ["node", "coreblow", "config", "unset", "update"], expected: false },
    { argv: ["node", "coreblow", "models", "list"], expected: false },
    { argv: ["node", "coreblow", "models", "status"], expected: false },
    { argv: ["node", "coreblow", "update", "status", "--json"], expected: false },
    { argv: ["node", "coreblow", "agent", "--message", "hi"], expected: false },
    { argv: ["node", "coreblow", "agents", "list"], expected: true },
    { argv: ["node", "coreblow", "message", "send"], expected: true },
  ] as const)("decides when to migrate state: $argv", ({ argv, expected }) => {
    expect(shouldMigrateState([...argv])).toBe(expected);
  });

  it.each([
    { path: ["status"], expected: false },
    { path: ["update", "status"], expected: false },
    { path: ["config", "get"], expected: false },
    { path: ["models", "status"], expected: false },
    { path: ["agents", "list"], expected: true },
  ])("reuses command path for migrate state decisions: $path", ({ path, expected }) => {
    expect(shouldMigrateStateFromPath(path)).toBe(expected);
  });
});
