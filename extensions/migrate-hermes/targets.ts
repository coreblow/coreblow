import path from "node:path";
import {
  resolveAgentConfig,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
} from "coreblow/plugin-sdk/agent-runtime";
import type { MigrationProviderContext } from "coreblow/plugin-sdk/plugin-entry";
import { resolveHomePath } from "./helpers.js";

export type PlannedTargets = {
  workspaceDir: string;
  stateDir: string;
  agentDir: string;
};

export function resolveTargets(ctx: MigrationProviderContext): PlannedTargets {
  const cfg = ctx.config;
  const agentId = resolveDefaultAgentId(cfg);
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
  const configuredAgentDir = resolveAgentConfig(cfg, agentId)?.agentDir?.trim();
  const resolveRuntimeAgentDir = ctx.runtime?.agent?.resolveAgentDir;
  const agentDir =
    (resolveRuntimeAgentDir ? resolveRuntimeAgentDir(cfg, agentId) : undefined) ??
    (configuredAgentDir ? resolveHomePath(configuredAgentDir) : undefined) ??
    path.join(ctx.stateDir, "agents", agentId, "agent");
  return {
    workspaceDir,
    stateDir: ctx.stateDir,
    agentDir,
  };
}
