/**
 * src/cron/isolated-agent/skills-snapshot.test.ts
 *
 * CoreBlow — Cron Isolated Agent Skills Snapshot Tests
 * Verifies resolveCronSkillsSnapshot fast-test-env behavior and
 * existing snapshot passthrough.
 */
import { describe, expect, it } from "vitest";
import { resolveCronSkillsSnapshot } from "./skills-snapshot.js";

const baseCfg = { agents: {} } as never;

describe("resolveCronSkillsSnapshot", () => {
  it("returns empty snapshot in fast-test-env with no existing snapshot", () => {
    const result = resolveCronSkillsSnapshot({
      workspaceDir: "/tmp",
      config: baseCfg,
      agentId: "main",
      isFastTestEnv: true,
    });
    expect(result).toEqual({ prompt: "", skills: [] });
  });

  it("returns existing snapshot in fast-test-env when provided", () => {
    const existing = { prompt: "existing", skills: ["skill-a"], version: "v1" } as never;
    const result = resolveCronSkillsSnapshot({
      workspaceDir: "/tmp",
      config: baseCfg,
      agentId: "main",
      existingSnapshot: existing,
      isFastTestEnv: true,
    });
    expect(result).toBe(existing);
  });

  it("result has prompt and skills fields", () => {
    const result = resolveCronSkillsSnapshot({
      workspaceDir: "/tmp",
      config: baseCfg,
      agentId: "main",
      isFastTestEnv: true,
    });
    expect(result).toHaveProperty("prompt");
    expect(result).toHaveProperty("skills");
    expect(Array.isArray(result.skills)).toBe(true);
  });

  it("fast-test-env prompt is empty string by default", () => {
    const result = resolveCronSkillsSnapshot({
      workspaceDir: "/tmp",
      config: baseCfg,
      agentId: "agent-2",
      isFastTestEnv: true,
    });
    expect(result.prompt).toBe("");
  });

  it("does not throw for any agentId in fast-test-env", () => {
    const agents = ["main", "cron-agent", "sub-agent-1", ""];
    for (const agentId of agents) {
      expect(() =>
        resolveCronSkillsSnapshot({
          workspaceDir: "/tmp",
          config: baseCfg,
          agentId,
          isFastTestEnv: true,
        }),
      ).not.toThrow();
    }
  });
});
