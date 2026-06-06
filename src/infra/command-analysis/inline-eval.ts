import { normalizeLowercaseStringOrEmpty } from "../../shared/string-coerce.js";
import { normalizeExecutableToken } from "../exec-wrapper-resolution.js";

export type InterpreterInlineEvalHit = {
  executable: string;
  normalizedExecutable: string;
  flag: string;
  argv: string[];
};

const FLAG_MAP = new Map<string, readonly string[]>([
  ["python", ["-c"]],
  ["python2", ["-c"]],
  ["python3", ["-c"]],
  ["pypy", ["-c"]],
  ["pypy3", ["-c"]],
  ["node", ["-e", "--eval", "-p", "--print"]],
  ["nodejs", ["-e", "--eval", "-p", "--print"]],
  ["bun", ["-e", "--eval", "-p", "--print"]],
  ["deno", ["-e", "--eval", "-p", "--print"]],
  ["ruby", ["-e"]],
  ["perl", ["-e", "-E"]],
  ["php", ["-r"]],
  ["lua", ["-e"]],
  ["osascript", ["-e"]],
  ["find", ["-exec", "-execdir", "-ok", "-okdir"]],
  ["make", ["-f", "--file", "--makefile", "--eval", "-E"]],
  ["gmake", ["-f", "--file", "--makefile", "--eval", "-E"]],
  ["awk", ["-e", "--source"]],
  ["gawk", ["-e", "--source"]],
  ["mawk", ["-e", "--source"]],
  ["nawk", ["-e", "--source"]],
  ["sed", ["-e"]],
  ["gsed", ["-e"]],
]);

const POSITIONAL_INLINE = new Set(["awk", "gawk", "mawk", "nawk", "sed", "gsed", "xargs"]);

function createHit(executable: string, argv: string[], flag: string): InterpreterInlineEvalHit {
  return {
    executable,
    normalizedExecutable: normalizeExecutableToken(executable),
    flag,
    argv,
  };
}

export function detectInterpreterInlineEvalArgv(
  argv: string[] | undefined | null,
): InterpreterInlineEvalHit | null {
  if (!Array.isArray(argv) || argv.length === 0) {
    return null;
  }
  const executable = argv[0]?.trim();
  if (!executable) {
    return null;
  }
  const normalized = normalizeExecutableToken(executable);
  const flags = FLAG_MAP.get(normalized) ?? [];
  for (let index = 1; index < argv.length; index += 1) {
    const raw = argv[index] ?? "";
    const lower = normalizeLowercaseStringOrEmpty(raw);
    for (const flag of flags) {
      const lowerFlag = flag.toLowerCase();
      if (lower === lowerFlag || lower.startsWith(`${lowerFlag}=`)) {
        return createHit(executable, argv, flag === "-E" ? "-E" : lowerFlag);
      }
      if ((flag === "-e" || flag === "-E") && raw.startsWith(flag) && raw.length > flag.length) {
        return createHit(executable, argv, flag);
      }
      if (flag === "-f" && raw.startsWith("-f") && raw.length > 2) {
        return createHit(executable, argv, "-f");
      }
    }
  }
  if (POSITIONAL_INLINE.has(normalized)) {
    if ((normalized === "awk" || normalized.endsWith("awk")) && !argv.includes("-f")) {
      return argv[1] ? createHit(executable, argv, "<program>") : null;
    }
    if ((normalized === "sed" || normalized === "gsed") && !argv.includes("-f")) {
      return argv[1] ? createHit(executable, argv, "<program>") : null;
    }
    if (normalized === "xargs" && argv.length > 1) {
      return createHit(executable, argv, "<command>");
    }
  }
  return null;
}

export function describeInterpreterInlineEval(hit: InterpreterInlineEvalHit): string {
  if (hit.flag === "<program>") {
    return `${hit.normalizedExecutable} inline program`;
  }
  if (hit.flag === "<command>") {
    return `${hit.normalizedExecutable} inline command`;
  }
  return `${hit.normalizedExecutable} ${hit.flag.toLowerCase()}`;
}

export function isInterpreterLikeAllowlistPattern(pattern: string): boolean {
  const normalized = normalizeExecutableToken(pattern.replace(/[*]/gu, ""));
  return FLAG_MAP.has(normalized.replace(/^\//u, "")) || POSITIONAL_INLINE.has(normalized);
}
