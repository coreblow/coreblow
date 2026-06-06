import { describe, expect, it } from "vitest";
import {
  buildCommandPayloadCandidates,
  detectCarriedShellBuiltinArgv,
  detectCommandCarrierArgv,
  detectEnvSplitStringFlag,
  detectInlineEvalArgv,
  detectShellWrapperThroughCarrierArgv,
} from "./risks.js";

describe("command-analysis risks", () => {
  it("detects inline eval through transparent carriers", () => {
    expect(detectInlineEvalArgv(["python3", "-c", "print(1)"])?.flag).toBe("-c");
    expect(detectInlineEvalArgv(["sudo", "python3", "-c", "print(1)"])?.flag).toBe("-c");
    expect(detectInlineEvalArgv(["env", "-S", "python3 -c 'print(1)'"])?.flag).toBe("-c");
    expect(detectInlineEvalArgv(["python3", "script.py"])).toBeNull();
  });

  it("detects command carriers and split-string forms", () => {
    expect(detectCommandCarrierArgv(["find", ".", "-exec", "rm", "{}", ";"])).toEqual([
      { command: "find", flag: "-exec" },
    ]);
    expect(detectCommandCarrierArgv(["xargs", "id"])).toEqual([{ command: "xargs" }]);
    expect(detectEnvSplitStringFlag(["env", "-S", "sh -c id"])).toBe("-S");
  });

  it("detects shell wrappers through carriers and carried builtins", () => {
    expect(
      detectShellWrapperThroughCarrierArgv(
        ["sudo", "bash", "-lc", "id"],
        (argv, startIndex) => argv[startIndex] === "-lc",
      ),
    ).toBe("sudo");
    expect(detectCarriedShellBuiltinArgv(["command", "source", "./env.sh"])).toEqual({
      kind: "source",
      command: "source",
    });
  });

  it("builds payload candidates through carriers", () => {
    expect(buildCommandPayloadCandidates(["sudo", "bash", "-lc", "/approve abc"])).toEqual([
      "bash -lc /approve abc",
      "/approve abc",
    ]);
  });
});
