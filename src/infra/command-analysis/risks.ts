import { splitShellArgs } from "../../utils/shell-argv.js";
import {
  COMMAND_CARRIER_EXECUTABLES,
  isEnvAssignmentToken,
  parseEnvInvocationPrelude,
  resolveCarrierCommandArgv,
  SOURCE_EXECUTABLES,
} from "../command-carriers.js";
import type { ExecCommandSegment } from "../exec-approvals-analysis.js";
import { normalizeExecutableToken } from "../exec-wrapper-resolution.js";
import { extractShellWrapperInlineCommand, isShellWrapperExecutable } from "../shell-wrapper-resolution.js";
import { detectInterpreterInlineEvalArgv, type InterpreterInlineEvalHit } from "./inline-eval.js";

export { COMMAND_CARRIER_EXECUTABLES, resolveCarrierCommandArgv, SOURCE_EXECUTABLES };

export type CommandCarrierHit = {
  command: string;
  flag?: string;
};

export type CarriedShellBuiltinHit = { kind: "eval" } | { kind: "source"; command: string };

function stripLeadingEnvAssignments(argv: string[]): string[] {
  let index = 0;
  while (index < argv.length && isEnvAssignmentToken(argv[index] ?? "")) {
    index += 1;
  }
  return index > 0 ? argv.slice(index) : argv;
}

export function buildCommandPayloadCandidates(argv: string[]): string[] {
  const stripped = stripLeadingEnvAssignments(argv);
  const carried = resolveCarrierCommandArgv(stripped, 0, { includeExec: true });
  const executableArgv = carried ?? stripped;
  const shellPayload = extractShellWrapperInlineCommand(executableArgv);
  return [
    ...(executableArgv.length ? [executableArgv.join(" ")] : []),
    ...(shellPayload ? [shellPayload] : []),
  ].filter((entry, index, all) => entry.trim() && all.indexOf(entry) === index);
}

function detectInlineEvalArgvInternal(
  argv: string[] | undefined | null,
  seen = new Set<string>(),
): InterpreterInlineEvalHit | null {
  if (!Array.isArray(argv) || argv.length === 0) {
    return null;
  }
  const key = argv.join("\0");
  if (seen.has(key)) {
    return null;
  }
  seen.add(key);
  const direct = detectInterpreterInlineEvalArgv(argv);
  if (direct) {
    return direct;
  }
  const carried = resolveCarrierCommandArgv(stripLeadingEnvAssignments(argv), 0, { includeExec: true });
  if (carried) {
    return detectInlineEvalArgvInternal(carried, seen);
  }
  const payload = extractShellWrapperInlineCommand(argv);
  const payloadArgv = payload ? splitShellArgs(payload) : null;
  return payloadArgv ? detectInlineEvalArgvInternal(payloadArgv, seen) : null;
}

export function detectInlineEvalArgv(
  argv: string[] | undefined | null,
): InterpreterInlineEvalHit | null {
  return detectInlineEvalArgvInternal(argv);
}

export function detectInlineEvalInSegments(
  segments: readonly ExecCommandSegment[],
): InterpreterInlineEvalHit | null {
  for (const segment of segments) {
    const hit = detectInlineEvalArgv(segment.argv);
    if (hit) {
      return hit;
    }
  }
  return null;
}

export function detectCommandCarrierArgv(argv: string[]): CommandCarrierHit[] {
  const executable = normalizeExecutableToken(argv[0] ?? "");
  if (executable === "find") {
    const flag = argv.find((entry) => ["-exec", "-execdir", "-ok", "-okdir"].includes(entry));
    return flag ? [{ command: "find", flag }] : [];
  }
  if (executable === "xargs") {
    return argv.length > 1 ? [{ command: "xargs" }] : [];
  }
  if (executable === "env") {
    const flag = detectEnvSplitStringFlag(argv);
    return flag ? [{ command: "env", flag }] : [];
  }
  return [];
}

export function detectEnvSplitStringFlag(argv: string[]): string | null {
  const parsed = parseEnvInvocationPrelude(argv);
  return parsed.splitStringFlag ?? null;
}

export function detectShellWrapperThroughCarrierArgv(
  argv: string[],
  isInlineFlag: (argv: string[], startIndex: number) => boolean,
): string | null {
  const carried = resolveCarrierCommandArgv(argv, 0, { includeExec: true });
  if (!carried) {
    return null;
  }
  const executable = normalizeExecutableToken(carried[0] ?? "");
  return isShellWrapperExecutable(executable) && isInlineFlag(carried, 1)
    ? normalizeExecutableToken(argv[0] ?? "")
    : null;
}

export function detectCarriedShellBuiltinArgv(argv: string[]): CarriedShellBuiltinHit | null {
  const carried = resolveCarrierCommandArgv(argv, 0, { includeExec: true }) ?? argv;
  const command = normalizeExecutableToken(carried[0] ?? "");
  if (command === "eval") {
    return { kind: "eval" };
  }
  if (SOURCE_EXECUTABLES.has(command)) {
    return { kind: "source", command };
  }
  return null;
}
