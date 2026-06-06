import { splitShellArgs } from "../utils/shell-argv.js";
import { normalizeExecutableToken } from "./exec-wrapper-resolution.js";

export const COMMAND_CARRIER_EXECUTABLES = new Set([
  "sudo",
  "doas",
  "env",
  "command",
  "builtin",
]);

export const SOURCE_EXECUTABLES = new Set([".", "source"]);

export function isEnvAssignmentToken(token: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*=/u.test(token);
}

export function parseEnvInvocationPrelude(argv: readonly string[]): {
  argv: string[];
  splitStringFlag?: string;
} {
  const next = [...argv];
  if (normalizeExecutableToken(next[0] ?? "") !== "env") {
    return { argv: next };
  }
  next.shift();
  while (next.length > 0) {
    const token = next[0] ?? "";
    if (token === "--") {
      next.shift();
      break;
    }
    if (token === "-S" || token === "--split-string") {
      next.shift();
      const payload = next.shift();
      return { argv: payload ? (splitShellArgs(payload) ?? [payload]) : [], splitStringFlag: "-S" };
    }
    if (token.startsWith("--split-string=")) {
      return {
        argv: splitShellArgs(token.slice("--split-string=".length)) ?? [],
        splitStringFlag: "--split-string",
      };
    }
    const compact = token.match(/^-.*S(.+)$/u);
    if (compact?.[1]) {
      next.shift();
      return { argv: splitShellArgs(compact[1]) ?? [compact[1]], splitStringFlag: "-S" };
    }
    if (token.startsWith("-") || isEnvAssignmentToken(token)) {
      next.shift();
      continue;
    }
    break;
  }
  return { argv: next };
}

export function resolveCarrierCommandArgv(
  argv: readonly string[],
  startIndex = 0,
  options: { includeExec?: boolean } = {},
): string[] | null {
  const executable = normalizeExecutableToken(argv[startIndex] ?? "");
  if (!executable) {
    return null;
  }
  if (executable === "exec" && options.includeExec) {
    let index = startIndex + 1;
    if (argv[index] === "-a") {
      index += 2;
    }
    if (argv[index] === "--") {
      index += 1;
    }
    return argv.slice(index).map(String);
  }
  if (executable === "command" || executable === "builtin") {
    if (argv[startIndex + 1] === "-v" || argv[startIndex + 1] === "-V") {
      return null;
    }
    return argv.slice(startIndex + 1).map(String);
  }
  if (executable === "env") {
    return parseEnvInvocationPrelude(argv.slice(startIndex)).argv;
  }
  if (executable === "sudo" || executable === "doas") {
    let index = startIndex + 1;
    while (index < argv.length) {
      const token = argv[index] ?? "";
      if (token === "--") {
        index += 1;
        break;
      }
      if (isEnvAssignmentToken(token)) {
        index += 1;
        continue;
      }
      if (token === "-u" || token === "--user" || token === "-g" || token === "--group") {
        index += 2;
        continue;
      }
      if (token.startsWith("-u") || token.startsWith("--user=") || token.startsWith("-g")) {
        index += 1;
        continue;
      }
      if (token.startsWith("-")) {
        index += 1;
        continue;
      }
      break;
    }
    return argv.slice(index).map(String);
  }
  return null;
}
