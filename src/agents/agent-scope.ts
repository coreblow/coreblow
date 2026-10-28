import fs from "node:fs";
import path from "node:path";
import type { CoreBlowConfig } from "../config/config.js";
import { resolveAgentModelFallbackValues } from "../config/model-input.js";
import { resolveStateDir } from "../config/paths.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import {
  DEFAULT_AGENT_ID,
  normalizeAgentId,
  parseAgentSessionKey,
  resolveAgentIdFromSessionKey,
} from "../routing/session-key.js";
import { resolveUserPath } from "../utils.js";
import {
  listAgentEntries,
  listAgentIds,
  resolveAgentConfig,
  resolveAgentContextLimits,
  resolveAgentDir,
  resolveDefaultAgentDir,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
  type ResolvedAgentConfig,
} from "./agent-scope-config.js";
import { normalizeSkillFilter } from "./skills/filter.js";

export {
  listAgentEntries,
  listAgentIds,
  resolveAgentConfig,
  resolveAgentContextLimits,
  resolveAgentDir,
  resolveDefaultAgentDir,
  resolveAgentIdFromSessionKey,
  resolveAgentWorkspaceDir,
  resolveDefaultAgentId,
  type ResolvedAgentConfig,
};

/** Strip null bytes from paths to prevent ENOTDIR errors. */
function stripNullBytes(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\0/g, "");
}

export function resolveSessionAgentIds(params: {
  sessionKey?: string;
  config?: CoreBlowConfig;
  agentId?: string;
}): {
  defaultAgentId: string;
  sessionAgentId: string;
} {
  const defaultAgentId = resolveDefaultAgentId(params.config ?? {});
  const explicitAgentIdRaw =
    typeof params.agentId === "string" ? params.agentId.trim().toLowerCase() : "";
  const explicitAgentId = explicitAgentIdRaw ? normalizeAgentId(explicitAgentIdRaw) : null;
  const sessionKey = params.sessionKey?.trim();
  const normalizedSessionKey = sessionKey ? sessionKey.toLowerCase() : undefined;
  const parsed = normalizedSessionKey ? parseAgentSessionKey(normalizedSessionKey) : null;
  const sessionAgentId =
    explicitAgentId ?? (parsed?.agentId ? normalizeAgentId(parsed.agentId) : defaultAgentId);
  return { defaultAgentId, sessionAgentId };
}

export function resolveSessionAgentId(params: {
  sessionKey?: string;
  config?: CoreBlowConfig;
}): string {
  return resolveSessionAgentIds(params).sessionAgentId;
}

export function resolveAgentSkillsFilter(
  cfg: CoreBlowConfig,
  agentId: string,
): string[] | undefined {
  return normalizeSkillFilter(resolveAgentConfig(cfg, agentId)?.skills);
}

function resolveModelPrimary(raw: unknown): string | undefined {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    return trimmed || undefined;
  }
  if (!raw || typeof raw !== "object") {
    return undefined;
  }
  const primary = (raw as { primary?: unknown }).primary;
  if (typeof primary !== "string") {
    return undefined;
  }
  const trimmed = primary.trim();
  return trimmed || undefined;
}

export function resolveAgentExplicitModelPrimary(
  cfg: CoreBlowConfig,
  agentId: string,
): string | undefined {
  const raw = resolveAgentConfig(cfg, agentId)?.model;
  return resolveModelPrimary(raw);
}

export function resolveAgentEffectiveModelPrimary(
  cfg: CoreBlowConfig,
  agentId: string,
): string | undefined {
  return (
    resolveAgentExplicitModelPrimary(cfg, agentId) ??
    resolveModelPrimary(cfg.agents?.defaults?.model)
  );
}

// Backward-compatible alias. Prefer explicit/effective helpers at new call sites.
export function resolveAgentModelPrimary(cfg: CoreBlowConfig, agentId: string): string | undefined {
  return resolveAgentExplicitModelPrimary(cfg, agentId);
}

export function resolveAgentModelFallbacksOverride(
  cfg: CoreBlowConfig,
  agentId: string,
): string[] | undefined {
  const raw = resolveAgentConfig(cfg, agentId)?.model;
  if (!raw || typeof raw === "string") {
    return undefined;
  }
  // Important: treat an explicitly provided empty array as an override to disable global fallbacks.
  if (!Object.hasOwn(raw, "fallbacks")) {
    return undefined;
  }
  return Array.isArray(raw.fallbacks) ? raw.fallbacks : undefined;
}

export function resolveFallbackAgentId(params: {
  agentId?: string | null;
  sessionKey?: string | null;
}): string {
  const explicitAgentId = typeof params.agentId === "string" ? params.agentId.trim() : "";
  if (explicitAgentId) {
    return normalizeAgentId(explicitAgentId);
  }
  return resolveAgentIdFromSessionKey(params.sessionKey);
}

export function resolveRunModelFallbacksOverride(params: {
  cfg: CoreBlowConfig | undefined;
  agentId?: string | null;
  sessionKey?: string | null;
}): string[] | undefined {
  if (!params.cfg) {
    return undefined;
  }
  return resolveAgentModelFallbacksOverride(
    params.cfg,
    resolveFallbackAgentId({ agentId: params.agentId, sessionKey: params.sessionKey }),
  );
}

export function hasConfiguredModelFallbacks(params: {
  cfg: CoreBlowConfig | undefined;
  agentId?: string | null;
  sessionKey?: string | null;
}): boolean {
  const fallbacksOverride = resolveRunModelFallbacksOverride(params);
  const defaultFallbacks = resolveAgentModelFallbackValues(params.cfg?.agents?.defaults?.model);
  return (fallbacksOverride ?? defaultFallbacks).length > 0;
}

export function resolveEffectiveModelFallbacks(params: {
  cfg: CoreBlowConfig;
  agentId: string;
  hasSessionModelOverride: boolean;
}): string[] | undefined {
  const agentFallbacksOverride = resolveAgentModelFallbacksOverride(params.cfg, params.agentId);
  if (!params.hasSessionModelOverride) {
    return agentFallbacksOverride;
  }
  const defaultFallbacks = resolveAgentModelFallbackValues(params.cfg.agents?.defaults?.model);
  return agentFallbacksOverride ?? defaultFallbacks;
}

function normalizePathForComparison(input: string): string {
  const resolved = path.resolve(stripNullBytes(resolveUserPath(input)));
  let normalized = resolved;
  // Prefer realpath when available to normalize aliases/symlinks (for example /tmp -> /private/tmp)
  // and canonical path case without forcing case-folding on case-sensitive macOS volumes.
  try {
    normalized = fs.realpathSync.native(resolved);
  } catch {
    // Keep lexical path for non-existent directories.
  }
  if (process.platform === "win32") {
    return normalized.toLowerCase();
  }
  return normalized;
}

function isPathWithinRoot(candidatePath: string, rootPath: string): boolean {
  const relative = path.relative(rootPath, candidatePath);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function resolveAgentIdsByWorkspacePath(
  cfg: CoreBlowConfig,
  workspacePath: string,
): string[] {
  const normalizedWorkspacePath = normalizePathForComparison(workspacePath);
  const ids = listAgentIds(cfg);
  const matches: Array<{ id: string; workspaceDir: string; order: number }> = [];

  for (let index = 0; index < ids.length; index += 1) {
    const id = ids[index];
    const workspaceDir = normalizePathForComparison(resolveAgentWorkspaceDir(cfg, id));
    if (!isPathWithinRoot(normalizedWorkspacePath, workspaceDir)) {
      continue;
    }
    matches.push({ id, workspaceDir, order: index });
  }

  matches.sort((left, right) => {
    const workspaceLengthDelta = right.workspaceDir.length - left.workspaceDir.length;
    if (workspaceLengthDelta !== 0) {
      return workspaceLengthDelta;
    }
    return left.order - right.order;
  });

  return matches.map((entry) => entry.id);
}

export function resolveAgentIdByWorkspacePath(
  cfg: CoreBlowConfig,
  workspacePath: string,
): string | undefined {
  return resolveAgentIdsByWorkspacePath(cfg, workspacePath)[0];
}
