import { resolveCoreBlowAgentDir } from "../agents/agent-paths.js";

/**
 * @deprecated Prefer resolveAgentDir(cfg, agentId) for scoped agent directories.
 * Kept for third-party plugin SDK compatibility.
 */
export function resolveCoreBlowAgentDirCompat(env: NodeJS.ProcessEnv = process.env): string {
  return resolveCoreBlowAgentDir(env);
}
