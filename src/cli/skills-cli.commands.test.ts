import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "../infra/i18n/index.js";
import { createCliRuntimeCapture } from "./test-runtime-capture.js";

const loadConfigMock = vi.fn(() => ({}));
const resolveDefaultAgentIdMock = vi.fn(() => "main");
const resolveAgentWorkspaceDirMock = vi.fn(() => "/tmp/workspace");
const searchSkillsFromCoreHubMock = vi.fn();
const installSkillFromCoreHubMock = vi.fn();
const updateSkillsFromCoreHubMock = vi.fn();
const readTrackedCoreHubSkillSlugsMock = vi.fn();

const { defaultRuntime, runtimeLogs, runtimeErrors, resetRuntimeCapture } =
  createCliRuntimeCapture();

vi.mock("../runtime.js", () => ({
  defaultRuntime,
}));

vi.mock("../config/config.js", () => ({
  loadConfig: () => loadConfigMock(),
}));

vi.mock("../agents/agent-scope.js", () => ({
  resolveDefaultAgentId: () => resolveDefaultAgentIdMock(),
  resolveAgentWorkspaceDir: () => resolveAgentWorkspaceDirMock(),
}));

vi.mock("../agents/skills-corehub.js", () => ({
  searchSkillsFromCoreHub: (...args: unknown[]) => searchSkillsFromCoreHubMock(...args),
  installSkillFromCoreHub: (...args: unknown[]) => installSkillFromCoreHubMock(...args),
  updateSkillsFromCoreHub: (...args: unknown[]) => updateSkillsFromCoreHubMock(...args),
  readTrackedCoreHubSkillSlugs: (...args: unknown[]) => readTrackedCoreHubSkillSlugsMock(...args),
}));

const { registerSkillsCli } = await import("./skills-cli.js");

describe("skills cli commands", () => {
  const createProgram = () => {
    const program = new Command();
    program.exitOverride();
    registerSkillsCli(program);
    return program;
  };

  const runCommand = (argv: string[]) => createProgram().parseAsync(argv, { from: "user" });

  beforeEach(() => {
    resetRuntimeCapture();
    loadConfigMock.mockReset();
    resolveDefaultAgentIdMock.mockReset();
    resolveAgentWorkspaceDirMock.mockReset();
    searchSkillsFromCoreHubMock.mockReset();
    installSkillFromCoreHubMock.mockReset();
    updateSkillsFromCoreHubMock.mockReset();
    readTrackedCoreHubSkillSlugsMock.mockReset();

    loadConfigMock.mockReturnValue({});
    resolveDefaultAgentIdMock.mockReturnValue("main");
    resolveAgentWorkspaceDirMock.mockReturnValue("/tmp/workspace");
    searchSkillsFromCoreHubMock.mockResolvedValue([]);
    installSkillFromCoreHubMock.mockResolvedValue({
      ok: false,
      error: "install disabled in test",
    });
    updateSkillsFromCoreHubMock.mockResolvedValue([]);
    readTrackedCoreHubSkillSlugsMock.mockResolvedValue([]);
  });

  afterEach(async () => {
    await i18n.setLocale("en");
  });

  it("searches CoreHub skills from the native CLI", async () => {
    searchSkillsFromCoreHubMock.mockResolvedValue([
      {
        slug: "calendar",
        displayName: "Calendar",
        summary: "CalDAV helpers",
        version: "1.2.3",
      },
    ]);

    await runCommand(["skills", "search", "calendar"]);

    expect(searchSkillsFromCoreHubMock).toHaveBeenCalledWith({
      query: "calendar",
      limit: undefined,
    });
    expect(runtimeLogs.some((line) => line.includes("calendar v1.2.3  Calendar"))).toBe(true);
  });

  it("installs a skill from CoreHub into the active workspace", async () => {
    installSkillFromCoreHubMock.mockResolvedValue({
      ok: true,
      slug: "calendar",
      version: "1.2.3",
      targetDir: "/tmp/workspace/skills/calendar",
    });

    await runCommand(["skills", "install", "calendar", "--version", "1.2.3"]);

    expect(installSkillFromCoreHubMock).toHaveBeenCalledWith({
      workspaceDir: "/tmp/workspace",
      slug: "calendar",
      version: "1.2.3",
      force: false,
      logger: expect.any(Object),
    });
    expect(
      runtimeLogs.some((line) =>
        line.includes('Skill "calendar@1.2.3" installed -> /tmp/workspace/skills/calendar'),
      ),
    ).toBe(true);
  });

  it("localizes installed skill output", async () => {
    await i18n.setLocale("id");
    installSkillFromCoreHubMock.mockResolvedValue({
      ok: true,
      slug: "calendar",
      version: "1.2.3",
      targetDir: "/tmp/workspace/skills/calendar",
    });

    await runCommand(["skills", "install", "calendar", "--version", "1.2.3"]);

    expect(
      runtimeLogs.some((line) =>
        line.includes('Keahlian "calendar@1.2.3" terpasang -> /tmp/workspace/skills/calendar'),
      ),
    ).toBe(true);
  });

  it("updates all tracked CoreHub skills", async () => {
    readTrackedCoreHubSkillSlugsMock.mockResolvedValue(["calendar"]);
    updateSkillsFromCoreHubMock.mockResolvedValue([
      {
        ok: true,
        slug: "calendar",
        previousVersion: "1.2.2",
        version: "1.2.3",
        changed: true,
        targetDir: "/tmp/workspace/skills/calendar",
      },
    ]);

    await runCommand(["skills", "update", "--all"]);

    expect(readTrackedCoreHubSkillSlugsMock).toHaveBeenCalledWith("/tmp/workspace");
    expect(updateSkillsFromCoreHubMock).toHaveBeenCalledWith({
      workspaceDir: "/tmp/workspace",
      slug: undefined,
      logger: expect.any(Object),
    });
    expect(runtimeLogs.some((line) => line.includes("Updated calendar: 1.2.2 -> 1.2.3"))).toBe(
      true,
    );
    expect(runtimeErrors).toEqual([]);
  });
});
