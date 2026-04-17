export const COREBLOW_CLI_ENV_VAR = "COREBLOW_CLI";
export const COREBLOW_CLI_ENV_VALUE = "1";

export function markCoreBlowExecEnv<T extends Record<string, string | undefined>>(env: T): T {
  return {
    ...env,
    [COREBLOW_CLI_ENV_VAR]: COREBLOW_CLI_ENV_VALUE,
  };
}

export function ensureCoreBlowExecMarkerOnProcess(
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  env[COREBLOW_CLI_ENV_VAR] = COREBLOW_CLI_ENV_VALUE;
  return env;
}
