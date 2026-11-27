import { describe, expect, it } from "vitest";
import {
  resolveSessionResumeParams,
  rewriteUpdateFlagArgv,
  shouldDivertToHeadless,
  shouldEnsureCliPath,
  shouldRegisterPrimarySubcommand,
  shouldSkipPluginCommandRegistration,
  shouldUseRootHelpFastPath,
} from "./run-main.js";

describe("rewriteUpdateFlagArgv", () => {
  it("leaves argv unchanged when --update is absent", () => {
    const argv = ["node", "entry.js", "status"];
    expect(rewriteUpdateFlagArgv(argv)).toBe(argv);
  });

  it("rewrites --update into the update command", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--update"])).toEqual([
      "node",
      "entry.js",
      "update",
    ]);
  });

  it("preserves global flags that appear before --update", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--profile", "p", "--update"])).toEqual([
      "node",
      "entry.js",
      "--profile",
      "p",
      "update",
    ]);
  });

  it("keeps update options after the rewritten command", () => {
    expect(rewriteUpdateFlagArgv(["node", "entry.js", "--update", "--json"])).toEqual([
      "node",
      "entry.js",
      "update",
      "--json",
    ]);
  });
});

describe("shouldRegisterPrimarySubcommand", () => {
  it("skips eager primary registration for help/version invocations", () => {
    expect(shouldRegisterPrimarySubcommand(["node", "coreblow", "status", "--help"])).toBe(false);
    expect(shouldRegisterPrimarySubcommand(["node", "coreblow", "-V"])).toBe(false);
    expect(shouldRegisterPrimarySubcommand(["node", "coreblow", "-v"])).toBe(false);
  });

  it("keeps eager primary registration for regular command runs", () => {
    expect(shouldRegisterPrimarySubcommand(["node", "coreblow", "status"])).toBe(true);
    expect(shouldRegisterPrimarySubcommand(["node", "coreblow", "acp", "-v"])).toBe(true);
  });
});

describe("shouldSkipPluginCommandRegistration", () => {
  it("skips plugin registration for root help/version", () => {
    expect(
      shouldSkipPluginCommandRegistration({
        argv: ["node", "coreblow", "--help"],
        primary: null,
        hasBuiltinPrimary: false,
      }),
    ).toBe(true);
  });

  it("skips plugin registration for builtin subcommand help", () => {
    expect(
      shouldSkipPluginCommandRegistration({
        argv: ["node", "coreblow", "config", "--help"],
        primary: "config",
        hasBuiltinPrimary: true,
      }),
    ).toBe(true);
  });

  it("skips plugin registration for builtin command runs", () => {
    expect(
      shouldSkipPluginCommandRegistration({
        argv: ["node", "coreblow", "sessions", "--json"],
        primary: "sessions",
        hasBuiltinPrimary: true,
      }),
    ).toBe(true);
  });

  it("keeps plugin registration for non-builtin help", () => {
    expect(
      shouldSkipPluginCommandRegistration({
        argv: ["node", "coreblow", "voicecall", "--help"],
        primary: "voicecall",
        hasBuiltinPrimary: false,
      }),
    ).toBe(false);
  });

  it("keeps plugin registration for non-builtin command runs", () => {
    expect(
      shouldSkipPluginCommandRegistration({
        argv: ["node", "coreblow", "voicecall", "status"],
        primary: "voicecall",
        hasBuiltinPrimary: false,
      }),
    ).toBe(false);
  });
});

describe("shouldEnsureCliPath", () => {
  it("skips path bootstrap for help/version invocations", () => {
    expect(shouldEnsureCliPath(["node", "coreblow", "--help"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "coreblow", "-V"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "coreblow", "-v"])).toBe(false);
  });

  it("skips path bootstrap for read-only fast paths", () => {
    expect(shouldEnsureCliPath(["node", "coreblow", "status"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "coreblow", "--log-level", "debug", "status"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "coreblow", "sessions", "--json"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "coreblow", "config", "get", "update"])).toBe(false);
    expect(shouldEnsureCliPath(["node", "coreblow", "models", "status", "--json"])).toBe(false);
  });

  it("keeps path bootstrap for mutating or unknown commands", () => {
    expect(shouldEnsureCliPath(["node", "coreblow", "message", "send"])).toBe(true);
    expect(shouldEnsureCliPath(["node", "coreblow", "voicecall", "status"])).toBe(true);
    expect(shouldEnsureCliPath(["node", "coreblow", "acp", "-v"])).toBe(true);
  });
});

describe("shouldUseRootHelpFastPath", () => {
  it("uses the fast path for root help only", () => {
    expect(shouldUseRootHelpFastPath(["node", "coreblow", "--help"])).toBe(true);
    expect(shouldUseRootHelpFastPath(["node", "coreblow", "--profile", "work", "-h"])).toBe(true);
    expect(shouldUseRootHelpFastPath(["node", "coreblow", "status", "--help"])).toBe(false);
    expect(shouldUseRootHelpFastPath(["node", "coreblow", "--help", "status"])).toBe(false);
  });
});

describe("shouldDivertToHeadless", () => {
  it("diverts when print prompt or output format is passed", () => {
    expect(
      shouldDivertToHeadless({
        argv: ["node", "coreblow", "-p", "hello"],
        isPipedStdin: false,
        primaryCommand: null,
      }),
    ).toBe(true);

    expect(
      shouldDivertToHeadless({
        argv: ["node", "coreblow", "--output-format", "json"],
        isPipedStdin: false,
        primaryCommand: null,
      }),
    ).toBe(true);
  });

  it("diverts on piped stdin when no primary subcommand is given", () => {
    expect(
      shouldDivertToHeadless({
        argv: ["node", "coreblow"],
        isPipedStdin: true,
        primaryCommand: null,
      }),
    ).toBe(true);
  });

  it("does NOT divert non-TTY subcommands to headless runner", () => {
    // Non-TTY gateway run (e.g. Electron launch or shell redirect)
    expect(
      shouldDivertToHeadless({
        argv: ["node", "coreblow", "gateway", "run", "--port", "18799"],
        isPipedStdin: true,
        primaryCommand: "gateway",
      }),
    ).toBe(false);

    // Non-TTY cron list
    expect(
      shouldDivertToHeadless({
        argv: ["node", "coreblow", "cron", "list"],
        isPipedStdin: true,
        primaryCommand: "cron",
      }),
    ).toBe(false);

    // Non-TTY doctor
    expect(
      shouldDivertToHeadless({
        argv: ["node", "coreblow", "doctor"],
        isPipedStdin: true,
        primaryCommand: "doctor",
      }),
    ).toBe(false);

    // Non-TTY mcp serve
    expect(
      shouldDivertToHeadless({
        argv: ["node", "coreblow", "mcp", "serve"],
        isPipedStdin: true,
        primaryCommand: "mcp",
      }),
    ).toBe(false);
  });

  it("does NOT divert when help or version flags are present", () => {
    expect(
      shouldDivertToHeadless({
        argv: ["node", "coreblow", "--help"],
        isPipedStdin: true,
        primaryCommand: null,
      }),
    ).toBe(false);

    expect(
      shouldDivertToHeadless({
        argv: ["node", "coreblow", "-V"],
        isPipedStdin: true,
        primaryCommand: null,
      }),
    ).toBe(false);
  });

  it("does NOT divert when unknown root flags are passed on piped stdin", () => {
    expect(
      shouldDivertToHeadless({
        argv: ["node", "coreblow", "--nonexistent-flag-qc"],
        isPipedStdin: true,
        primaryCommand: null,
      }),
    ).toBe(false);
  });
});

describe("resolveSessionResumeParams", () => {
  it("opens session picker modal for bare -r flag", () => {
    const params = resolveSessionResumeParams(["node", "coreblow", "-r"]);
    expect(params.hasResume).toBe(true);
    expect(params.resumeValue).toBeUndefined();
    expect(params.initialModal).toBe("sessions");
    expect(params.continueFlag).toBe(false);
  });

  it("opens session picker modal for bare --resume flag", () => {
    const params = resolveSessionResumeParams(["node", "coreblow", "--resume"]);
    expect(params.hasResume).toBe(true);
    expect(params.resumeValue).toBeUndefined();
    expect(params.initialModal).toBe("sessions");
    expect(params.continueFlag).toBe(false);
  });

  it("resolves specific session ID for -r <id>", () => {
    const params = resolveSessionResumeParams(["node", "coreblow", "-r", "session-abc"]);
    expect(params.hasResume).toBe(true);
    expect(params.resumeValue).toBe("session-abc");
    expect(params.initialModal).toBe("none");
    expect(params.continueFlag).toBe(false);
  });

  it("resolves specific session ID for --resume <id>", () => {
    const params = resolveSessionResumeParams(["node", "coreblow", "--resume", "session-xyz"]);
    expect(params.hasResume).toBe(true);
    expect(params.resumeValue).toBe("session-xyz");
    expect(params.initialModal).toBe("none");
    expect(params.continueFlag).toBe(false);
  });

  it("resolves specific session ID for --resume=<id> and -r=<id>", () => {
    const paramsEqual = resolveSessionResumeParams(["node", "coreblow", "--resume=session-eq-1"]);
    expect(paramsEqual.hasResume).toBe(true);
    expect(paramsEqual.resumeValue).toBe("session-eq-1");
    expect(paramsEqual.initialModal).toBe("none");
    expect(paramsEqual.continueFlag).toBe(false);

    const paramsREqual = resolveSessionResumeParams(["node", "coreblow", "-r=session-eq-2"]);
    expect(paramsREqual.hasResume).toBe(true);
    expect(paramsREqual.resumeValue).toBe("session-eq-2");
    expect(paramsREqual.initialModal).toBe("none");
    expect(paramsREqual.continueFlag).toBe(false);
  });

  it("sets continueFlag for -c / --continue", () => {
    const paramsC = resolveSessionResumeParams(["node", "coreblow", "-c"]);
    expect(paramsC.continueFlag).toBe(true);
    expect(paramsC.hasResume).toBe(false);
    expect(paramsC.initialModal).toBe("none");

    const paramsContinue = resolveSessionResumeParams(["node", "coreblow", "--continue"]);
    expect(paramsContinue.continueFlag).toBe(true);
    expect(paramsContinue.hasResume).toBe(false);
    expect(paramsContinue.initialModal).toBe("none");
  });

  it("defaults to initialModal none when no resume or continue flags passed", () => {
    const params = resolveSessionResumeParams(["node", "coreblow"]);
    expect(params.continueFlag).toBe(false);
    expect(params.hasResume).toBe(false);
    expect(params.resumeValue).toBeUndefined();
    expect(params.initialModal).toBe("none");
  });
});
