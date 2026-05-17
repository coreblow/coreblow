import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../config/config.js";
import { captureFullEnv } from "../test-utils/env.js";
import { writeSkill } from "./skills.e2e-test-helpers.js";

function installSandboxMocks() {
  vi.resetModules();
  vi.doMock("./sandbox/backend.js", () => ({
    requireSandboxBackendFactory: vi.fn(() =>
      vi.fn(async (params: { workspaceDir: string; cfg: { docker?: { image?: string } } }) => ({
        id: "docker",
        runtimeId: "coreblow-sbx-test",
        runtimeLabel: "CoreBlow Sandbox Test",
        workdir: "/workspace",
        configLabel: params.cfg.docker?.image,
        configLabelKind: "Image",
        capabilities: { browser: false },
      })),
    ),
  }));
  vi.doMock("./sandbox/browser.js", () => ({
    ensureSandboxBrowser: vi.fn(async () => null),
  }));
  vi.doMock("./sandbox/prune.js", () => ({
    maybePruneSandboxes: vi.fn(async () => undefined),
  }));
}

describe("sandbox skill mirroring", () => {
  let envSnapshot: ReturnType<typeof captureFullEnv>;
  const cleanupDirs: string[] = [];

  beforeEach(() => {
    envSnapshot = captureFullEnv();
  });

  afterEach(async () => {
    envSnapshot.restore();
    await Promise.all(
      cleanupDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })),
    );
  });

  const runContext = async (workspaceAccess: "none" | "ro") => {
    const bundledDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-bundled-skills-"));
    cleanupDirs.push(bundledDir);
    process.env.COREBLOW_BUNDLED_SKILLS_DIR = bundledDir;

    const workspaceDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-workspace-"));
    cleanupDirs.push(workspaceDir);
    await writeSkill({
      dir: path.join(workspaceDir, "skills", "demo-skill"),
      name: "demo-skill",
      description: "Demo skill",
    });

    const cfg: CoreBlowConfig = {
      agents: {
        defaults: {
          sandbox: {
            mode: "all",
            scope: "session",
            workspaceAccess,
            workspaceRoot: path.join(bundledDir, "sandboxes"),
          },
        },
      },
    } as CoreBlowConfig;

    installSandboxMocks();
    const { resolveSandboxContext } = await import("./sandbox/context.js");
    const context = await resolveSandboxContext({
      config: cfg,
      sessionKey: "agent:main:main",
      workspaceDir,
    });

    return { context };
  };

  it.each(["ro", "none"] as const)(
    "copies skills into the sandbox when workspaceAccess is %s",
    async (workspaceAccess) => {
      const { context } = await runContext(workspaceAccess);

      expect(context?.enabled).toBe(true);
      const skillPath = path.join(context?.workspaceDir ?? "", "skills", "demo-skill", "SKILL.md");
      await expect(fs.readFile(skillPath, "utf-8")).resolves.toContain("demo-skill");
    },
    20_000,
  );
});
