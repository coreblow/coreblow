import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../../config/paths.js";

export type CuratorLifecycleState = "active" | "stale" | "archived";

export type CuratorManagedSkill = {
  id: string;
  name: string;
  managedBy: "evoloop" | "curator" | "user" | "bundled";
  state: CuratorLifecycleState;
  pinned?: boolean;
  locked?: boolean;
  lastUsedAtMs: number;
  useCount: number;
  content?: string;
};

export type CuratorStateSnapshot = {
  lastRunAtMs: number | null;
  runCount: number;
  paused: boolean;
  backups: Record<string, { previousState: CuratorLifecycleState; backedUpAtMs: number }>;
};

export type CuratorRunResult = {
  ran: boolean;
  skippedReason?: string;
  transitionedToStale: string[];
  transitionedToArchived: string[];
  consolidated: string[];
};

export const CURATOR_DEFAULT_INTERVAL_HOURS = 24 * 7; // 7 days
export const CURATOR_DEFAULT_MIN_IDLE_HOURS = 2;
export const CURATOR_DEFAULT_STALE_AFTER_DAYS = 14;
export const CURATOR_DEFAULT_ARCHIVE_AFTER_DAYS = 30;

export function resolveCuratorStatePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "skills", "curator-state.json");
}

export function loadCuratorState(env: NodeJS.ProcessEnv = process.env): CuratorStateSnapshot {
  const filePath = resolveCuratorStatePath(env);
  if (!fs.existsSync(filePath)) {
    return { lastRunAtMs: null, runCount: 0, paused: false, backups: {} };
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<CuratorStateSnapshot>;
    return {
      lastRunAtMs: typeof parsed.lastRunAtMs === "number" ? parsed.lastRunAtMs : null,
      runCount: typeof parsed.runCount === "number" ? parsed.runCount : 0,
      paused: Boolean(parsed.paused),
      backups: parsed.backups && typeof parsed.backups === "object" ? parsed.backups : {},
    };
  } catch {
    return { lastRunAtMs: null, runCount: 0, paused: false, backups: {} };
  }
}

export function saveCuratorState(
  state: CuratorStateSnapshot,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const filePath = resolveCuratorStatePath(env);
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), { encoding: "utf8", mode: 0o600 });
}

/**
 * Inactivity-triggered Skill Curator (opt-in, no extra daemon).
 * Invariant: manages agent-generated skills (`evoloop` | `curator`) ONLY,
 * NEVER deletes skills (only transitions `active -> stale -> archived`),
 * respects `pinned` / `locked` flags, and uses an isolated auxiliary client if consolidating.
 */
export async function maybeRunSkillCurator(params: {
  enabled: boolean;
  skills: CuratorManagedSkill[];
  nowMs?: number;
  lastAgentActivityAtMs: number;
  intervalHours?: number;
  minIdleHours?: number;
  staleAfterDays?: number;
  archiveAfterDays?: number;
  env?: NodeJS.ProcessEnv;
  consolidateWithAuxClient?: (staleSkills: CuratorManagedSkill[]) => Promise<string[]>;
}): Promise<CuratorRunResult> {
  if (!params.enabled) {
    return {
      ran: false,
      skippedReason: "disabled",
      transitionedToStale: [],
      transitionedToArchived: [],
      consolidated: [],
    };
  }

  const nowMs = params.nowMs ?? Date.now();
  const minIdleMs = (params.minIdleHours ?? CURATOR_DEFAULT_MIN_IDLE_HOURS) * 3600_000;
  if (nowMs - params.lastAgentActivityAtMs < minIdleMs) {
    return {
      ran: false,
      skippedReason: "agent_not_idle",
      transitionedToStale: [],
      transitionedToArchived: [],
      consolidated: [],
    };
  }

  const env = params.env ?? process.env;
  const state = loadCuratorState(env);
  if (state.paused) {
    return {
      ran: false,
      skippedReason: "paused",
      transitionedToStale: [],
      transitionedToArchived: [],
      consolidated: [],
    };
  }

  const intervalMs = (params.intervalHours ?? CURATOR_DEFAULT_INTERVAL_HOURS) * 3600_000;
  if (state.lastRunAtMs !== null && nowMs - state.lastRunAtMs < intervalMs) {
    return {
      ran: false,
      skippedReason: "interval_not_elapsed",
      transitionedToStale: [],
      transitionedToArchived: [],
      consolidated: [],
    };
  }

  const staleAfterMs = (params.staleAfterDays ?? CURATOR_DEFAULT_STALE_AFTER_DAYS) * 86_400_000;
  const archiveAfterMs = (params.archiveAfterDays ?? CURATOR_DEFAULT_ARCHIVE_AFTER_DAYS) * 86_400_000;

  const transitionedToStale: string[] = [];
  const transitionedToArchived: string[] = [];
  const staleForAux: CuratorManagedSkill[] = [];

  for (const skill of params.skills) {
    if (skill.managedBy !== "evoloop" && skill.managedBy !== "curator") {
      continue;
    }
    if (skill.pinned || skill.locked) {
      continue;
    }
    const idleAgeMs = Math.max(0, nowMs - skill.lastUsedAtMs);
    if (skill.state !== "archived" && idleAgeMs >= archiveAfterMs) {
      state.backups[skill.id] = { previousState: skill.state, backedUpAtMs: nowMs };
      skill.state = "archived";
      transitionedToArchived.push(skill.id);
    } else if (skill.state === "active" && idleAgeMs >= staleAfterMs) {
      state.backups[skill.id] = { previousState: skill.state, backedUpAtMs: nowMs };
      skill.state = "stale";
      transitionedToStale.push(skill.id);
      staleForAux.push(skill);
    } else if (skill.state === "stale") {
      staleForAux.push(skill);
    }
  }

  const consolidated =
    params.consolidateWithAuxClient && staleForAux.length > 0
      ? await params.consolidateWithAuxClient(staleForAux)
      : [];

  state.lastRunAtMs = nowMs;
  state.runCount += 1;
  saveCuratorState(state, env);

  return {
    ran: true,
    transitionedToStale,
    transitionedToArchived,
    consolidated,
  };
}

export function rollbackCuratorSkillState(
  skill: CuratorManagedSkill,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const state = loadCuratorState(env);
  const backup = state.backups[skill.id];
  if (!backup) {
    return false;
  }
  skill.state = backup.previousState;
  delete state.backups[skill.id];
  saveCuratorState(state, env);
  return true;
}
