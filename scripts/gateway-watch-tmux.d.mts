type GatewayWatchTmuxEnv = Record<string, string | undefined>;

type GatewayWatchTmuxOutput = {
  write(message: string): unknown;
};

type GatewayWatchTmuxSpawnResult = {
  error?: { code?: string; message?: string };
  signal?: string | null;
  status?: number | null;
  stderr?: string;
  stdout?: string;
};

type GatewayWatchTmuxSpawnSync = (
  command: string,
  args: readonly string[],
  options?: Record<string, unknown>,
) => GatewayWatchTmuxSpawnResult;

export function resolveGatewayWatchTmuxSessionName(params?: {
  args?: readonly string[];
  env?: GatewayWatchTmuxEnv;
}): string;

export function buildGatewayWatchTmuxCommand(params?: {
  args?: readonly string[];
  cwd?: string;
  env?: GatewayWatchTmuxEnv;
  nodePath?: string;
  sessionName?: string;
}): string;

export function runGatewayWatchTmuxMain(params?: {
  args?: readonly string[];
  cwd?: string;
  env?: GatewayWatchTmuxEnv;
  nodePath?: string;
  sessionName?: string;
  spawnSync?: GatewayWatchTmuxSpawnSync;
  stderr?: GatewayWatchTmuxOutput;
  stdinIsTTY?: boolean;
  stdout?: GatewayWatchTmuxOutput;
  stdoutIsTTY?: boolean;
}): number;
