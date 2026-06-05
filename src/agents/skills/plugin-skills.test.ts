import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CoreBlowConfig } from "../../config/config.js";
import type { PluginManifestRegistry } from "../../plugins/manifest-registry.js";
import { createTrackedTempDirs } from "../../test-utils/tracked-temp-dirs.js";

const hoisted = vi.hoisted(() => ({
  loadPluginManifestRegistry: vi.fn(),
}));

vi.mock("../../plugins/manifest-registry.js", () => ({
  loadPluginManifestRegistry: (...args: unknown[]) => hoisted.loadPluginManifestRegistry(...args),
}));

let resolvePluginSkillDirs: typeof import("./plugin-skills.js").resolvePluginSkillDirs;

async function loadFreshPluginSkillsModuleForTest() {
  vi.resetModules();
  vi.doMock("../../plugins/manifest-registry.js", () => ({
    loadPluginManifestRegistry: (...args: unknown[]) => hoisted.loadPluginManifestRegistry(...args),
  }));
  ({ resolvePluginSkillDirs } = await import("./plugin-skills.js"));
}

const tempDirs = createTrackedTempDirs();

function buildRegistry(params: { acpRoot: string; helperRoot: string }): PluginManifestRegistry {
  return {
    diagnostics: [],
    plugins: [
      {
        id: "acp",
        name: "ACP Runtime",
        channels: [],
        providers: [],
        cliBackends: [],
        skills: ["./skills"],
        hooks: [],
        origin: "workspace",
        rootDir: params.acpRoot,
        source: params.acpRoot,
        manifestPath: path.join(params.acpRoot, "coreblow.plugin.json"),
      },
      {
        id: "helper",
        name: "Helper",
        channels: [],
        providers: [],
        cliBackends: [],
        skills: ["./skills"],
        hooks: [],
        origin: "workspace",
        rootDir: params.helperRoot,
        source: params.helperRoot,
        manifestPath: path.join(params.helperRoot, "coreblow.plugin.json"),
      },
    ],
  };
}

function createSinglePluginRegistry(params: {
  pluginRoot: string;
  skills: string[];
  format?: "coreblow" | "bundle";
}): PluginManifestRegistry {
  return {
    diagnostics: [],
    plugins: [
      {
        id: "helper",
        name: "Helper",
        format: params.format,
        channels: [],
        providers: [],
        cliBackends: [],
        skills: params.skills,
        hooks: [],
        origin: "workspace",
        rootDir: params.pluginRoot,
        source: params.pluginRoot,
        manifestPath: path.join(params.pluginRoot, "coreblow.plugin.json"),
      },
    ],
  };
}

async function setupAcpAndHelperRegistry() {
  const workspaceDir = await tempDirs.make("coreblow-");
  const acpRoot = await tempDirs.make("coreblow-acp-plugin-");
  const helperRoot = await tempDirs.make("coreblow-helper-plugin-");
  await fs.mkdir(path.join(acpRoot, "skills"), { recursive: true });
  await fs.mkdir(path.join(helperRoot, "skills"), { recursive: true });
  hoisted.loadPluginManifestRegistry.mockReturnValue(buildRegistry({ acpRoot, helperRoot }));
  return { workspaceDir, acpRoot, helperRoot };
}

async function setupPluginOutsideSkills() {
  const workspaceDir = await tempDirs.make("coreblow-");
  const pluginRoot = await tempDirs.make("coreblow-plugin-");
  const outsideDir = await tempDirs.make("coreblow-outside-");
  const outsideSkills = path.join(outsideDir, "skills");
  return { workspaceDir, pluginRoot, outsideSkills };
}

afterEach(async () => {
  hoisted.loadPluginManifestRegistry.mockReset();
  await tempDirs.cleanup();
});

describe("resolvePluginSkillDirs", () => {
  beforeEach(async () => {
    await loadFreshPluginSkillsModuleForTest();
  });

  it.each([
    {
      name: "keeps acp plugin skills when ACP is enabled",
      acpEnabled: true,
      expectedDirs: ({ acpRoot, helperRoot }: { acpRoot: string; helperRoot: string }) => [
        path.resolve(acpRoot, "skills"),
        path.resolve(helperRoot, "skills"),
      ],
    },
    {
      name: "skips acp plugin skills when ACP is disabled",
      acpEnabled: false,
      expectedDirs: ({ helperRoot }: { acpRoot: string; helperRoot: string }) => [
        path.resolve(helperRoot, "skills"),
      ],
    },
  ])("$name", async ({ acpEnabled, expectedDirs }) => {
    const { workspaceDir, acpRoot, helperRoot } = await setupAcpAndHelperRegistry();

    const dirs = resolvePluginSkillDirs({
      workspaceDir,
      config: {
        acp: { enabled: acpEnabled },
        plugins: {
          entries: {
            acp: { enabled: true },
            helper: { enabled: true },
          },
        },
      } as CoreBlowConfig,
    });

    expect(dirs).toEqual(expectedDirs({ acpRoot, helperRoot }));
  });

  it("rejects plugin skill paths that escape the plugin root", async () => {
    const { workspaceDir, pluginRoot, outsideSkills } = await setupPluginOutsideSkills();
    await fs.mkdir(path.join(pluginRoot, "skills"), { recursive: true });
    await fs.mkdir(outsideSkills, { recursive: true });
    const escapePath = path.relative(pluginRoot, outsideSkills);

    hoisted.loadPluginManifestRegistry.mockReturnValue(
      createSinglePluginRegistry({
        pluginRoot,
        skills: ["./skills", escapePath],
      }),
    );

    const dirs = resolvePluginSkillDirs({
      workspaceDir,
      config: {
        plugins: {
          entries: {
            helper: { enabled: true },
          },
        },
      } as CoreBlowConfig,
    });

    expect(dirs).toEqual([path.resolve(pluginRoot, "skills")]);
  });

  it("rejects plugin skill symlinks that resolve outside plugin root", async () => {
    const { workspaceDir, pluginRoot, outsideSkills } = await setupPluginOutsideSkills();
    const linkPath = path.join(pluginRoot, "skills-link");
    await fs.mkdir(outsideSkills, { recursive: true });
    await fs.symlink(
      outsideSkills,
      linkPath,
      process.platform === "win32" ? ("junction" as const) : ("dir" as const),
    );

    hoisted.loadPluginManifestRegistry.mockReturnValue(
      createSinglePluginRegistry({
        pluginRoot,
        skills: ["./skills-link"],
      }),
    );

    const dirs = resolvePluginSkillDirs({
      workspaceDir,
      config: {
        plugins: {
          entries: {
            helper: { enabled: true },
          },
        },
      } as CoreBlowConfig,
    });

    expect(dirs).toEqual([]);
  });

  it("resolves Claude bundle command roots through the normal plugin skill path", async () => {
    const workspaceDir = await tempDirs.make("coreblow-");
    const pluginRoot = await tempDirs.make("coreblow-claude-bundle-");
    await fs.mkdir(path.join(pluginRoot, "commands"), { recursive: true });
    await fs.mkdir(path.join(pluginRoot, "skills"), { recursive: true });

    hoisted.loadPluginManifestRegistry.mockReturnValue(
      createSinglePluginRegistry({
        pluginRoot,
        format: "bundle",
        skills: ["./skills", "./commands"],
      }),
    );

    const dirs = resolvePluginSkillDirs({
      workspaceDir,
      config: {
        plugins: {
          entries: {
            helper: { enabled: true },
          },
        },
      } as CoreBlowConfig,
    });

    expect(dirs).toEqual([
      path.resolve(pluginRoot, "skills"),
      path.resolve(pluginRoot, "commands"),
    ]);
  });
});
