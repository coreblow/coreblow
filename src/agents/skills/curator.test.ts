import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  maybeRunSkillCurator,
  rollbackCuratorSkillState,
  type CuratorManagedSkill,
} from "./curator.js";

describe("opt-in Skill Curator", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  function makeEnv(): NodeJS.ProcessEnv {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-curator-test-"));
    tempDirs.push(dir);
    return { ...process.env, COREBLOW_STATE_DIR: dir };
  }

  it("never deletes skills, only archives (active -> stale -> archived), respects pin/lock, and supports rollback", async () => {
    const env = makeEnv();
    const now = Date.UTC(2026, 10, 28, 12, 0, 0);
    const dayMs = 86_400_000;
    const skills: CuratorManagedSkill[] = [
      {
        id: "evo-stale",
        name: "evo-stale",
        managedBy: "evoloop",
        state: "active",
        lastUsedAtMs: now - 16 * dayMs,
        useCount: 1,
      },
      {
        id: "evo-archive",
        name: "evo-archive",
        managedBy: "evoloop",
        state: "stale",
        lastUsedAtMs: now - 35 * dayMs,
        useCount: 2,
      },
      {
        id: "evo-pinned",
        name: "evo-pinned",
        managedBy: "evoloop",
        state: "active",
        pinned: true,
        lastUsedAtMs: now - 60 * dayMs,
        useCount: 0,
      },
      {
        id: "bundled-safe",
        name: "bundled-safe",
        managedBy: "bundled",
        state: "active",
        lastUsedAtMs: now - 90 * dayMs,
        useCount: 0,
      },
    ];

    const auxSpy = vi.fn(async (stale: CuratorManagedSkill[]) => stale.map((s) => s.id));
    const res = await maybeRunSkillCurator({
      enabled: true,
      skills,
      nowMs: now,
      lastAgentActivityAtMs: now - 3 * 3600_000,
      env,
      consolidateWithAuxClient: auxSpy,
    });

    expect(res.ran).toBe(true);
    expect(skills).toHaveLength(4); // NEVER deletes
    expect(res.transitionedToStale).toEqual(["evo-stale"]);
    expect(res.transitionedToArchived).toEqual(["evo-archive"]);
    expect(skills.find((s) => s.id === "evo-pinned")?.state).toBe("active");
    expect(skills.find((s) => s.id === "bundled-safe")?.state).toBe("active");
    expect(auxSpy).toHaveBeenCalledTimes(1);

    // Rollback support
    const archivedSkill = skills.find((s) => s.id === "evo-archive")!;
    expect(rollbackCuratorSkillState(archivedSkill, env)).toBe(true);
    expect(archivedSkill.state).toBe("stale");
  });

  it("stays idle-gated and zero-cost when disabled or active", async () => {
    const env = makeEnv();
    const now = Date.now();
    const disabled = await maybeRunSkillCurator({
      enabled: false,
      skills: [],
      nowMs: now,
      lastAgentActivityAtMs: now - 10 * 3600_000,
      env,
    });
    expect(disabled).toMatchObject({ ran: false, skippedReason: "disabled" });

    const notIdle = await maybeRunSkillCurator({
      enabled: true,
      skills: [],
      nowMs: now,
      lastAgentActivityAtMs: now - 60_000,
      env,
    });
    expect(notIdle).toMatchObject({ ran: false, skippedReason: "agent_not_idle" });
  });
});
