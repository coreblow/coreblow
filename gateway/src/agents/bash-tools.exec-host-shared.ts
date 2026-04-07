/** agents/bash-tools.exec-host-shared.ts */
export interface ExecHostConfig { shell?: string; env?: Record<string, string>; cwd?: string; timeout?: number; maxOutput?: number; }
export const DEFAULT_EXEC_HOST_CONFIG: ExecHostConfig = { timeout: 30_000, maxOutput: 200_000 };
export function mergeExecHostConfig(base: ExecHostConfig, override?: Partial<ExecHostConfig>): ExecHostConfig { return { ...base, ...override }; }
