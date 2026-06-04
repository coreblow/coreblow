import fs from "node:fs";

const COREBLOW_CHILD_OOM_SCORE_ADJ_ENV_KEY = "COREBLOW_CHILD_OOM_SCORE_ADJ";
const LEGACY_OPENCLAW_CHILD_OOM_SCORE_ADJ_ENV_KEY = "OPENCLAW_CHILD_OOM_SCORE_ADJ";
const OOM_SCORE_WRAP_SHELL = "/bin/sh";
const OOM_SCORE_WRAP_SCRIPT = 'echo 1000 > /proc/self/oom_score_adj 2>/dev/null; exec "$0" "$@"';
const SHELL_INIT_ENV_KEYS = ["BASH_ENV", "ENV", "CDPATH"] as const;

function isDisabled(value: string | undefined): boolean {
  switch (value?.trim().toLowerCase()) {
    case "0":
    case "false":
    case "no":
    case "off":
      return true;
    default:
      return false;
  }
}

let cachedShellAvailable: boolean | null = null;

function defaultShellAvailable(): boolean {
  if (cachedShellAvailable !== null) {
    return cachedShellAvailable;
  }
  try {
    cachedShellAvailable = fs.statSync(OOM_SCORE_WRAP_SHELL).isFile();
  } catch {
    cachedShellAvailable = false;
  }
  return cachedShellAvailable;
}

export type OomWrapOptions = {
  platform?: NodeJS.Platform;
  env?: NodeJS.ProcessEnv;
  shellAvailable?: () => boolean;
};

export type OomScoreAdjustedSpawn = {
  command: string;
  args: string[];
  env: NodeJS.ProcessEnv | undefined;
  wrapped: boolean;
};

function isOomScoreAdjustmentDisabled(env: NodeJS.ProcessEnv): boolean {
  return (
    isDisabled(env[COREBLOW_CHILD_OOM_SCORE_ADJ_ENV_KEY]) ||
    isDisabled(env[LEGACY_OPENCLAW_CHILD_OOM_SCORE_ADJ_ENV_KEY])
  );
}

function shouldWrapChildForOomScore(options: OomWrapOptions | undefined): boolean {
  const platform = options?.platform ?? process.platform;
  if (platform !== "linux") {
    return false;
  }
  const env = options?.env ?? process.env;
  if (isOomScoreAdjustmentDisabled(env)) {
    return false;
  }
  return (options?.shellAvailable ?? defaultShellAvailable)();
}

function isWrapped(command: string, args: readonly string[]): boolean {
  return command === OOM_SCORE_WRAP_SHELL && args[0] === "-c" && args[1] === OOM_SCORE_WRAP_SCRIPT;
}

function canUseShellExecCommand(command: string): boolean {
  return !command.startsWith("-");
}

function hardenShellEnv(baseEnv: NodeJS.ProcessEnv | undefined): NodeJS.ProcessEnv {
  const next: NodeJS.ProcessEnv = { ...(baseEnv ?? process.env) };
  for (const key of SHELL_INIT_ENV_KEYS) {
    delete next[key];
  }
  return next;
}

export function prepareOomScoreAdjustedSpawn(
  command: string,
  args: readonly string[] = [],
  options?: OomWrapOptions,
): OomScoreAdjustedSpawn {
  const copy = [...args];
  if (!command || !canUseShellExecCommand(command) || !shouldWrapChildForOomScore(options)) {
    return { command, args: copy, env: options?.env, wrapped: false };
  }
  if (isWrapped(command, copy)) {
    return { command, args: copy, env: hardenShellEnv(options?.env), wrapped: true };
  }
  return {
    command: OOM_SCORE_WRAP_SHELL,
    args: ["-c", OOM_SCORE_WRAP_SCRIPT, command, ...copy],
    env: hardenShellEnv(options?.env),
    wrapped: true,
  };
}

export function wrapArgvForChildOomScoreRaise(
  argv: readonly string[],
  options?: OomWrapOptions,
): string[] {
  const copy = [...argv];
  if (copy.length === 0) {
    return copy;
  }
  const spawn = prepareOomScoreAdjustedSpawn(copy[0] ?? "", copy.slice(1), options);
  return [spawn.command, ...spawn.args];
}

export function hardenedEnvForChildOomWrap(
  baseEnv: NodeJS.ProcessEnv | undefined,
  options?: OomWrapOptions,
): NodeJS.ProcessEnv | undefined {
  if (!shouldWrapChildForOomScore(options)) {
    return baseEnv;
  }
  return hardenShellEnv(baseEnv);
}
