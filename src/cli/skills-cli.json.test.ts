import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCliRuntimeCapture } from "./test-runtime-capture.js";

const { defaultRuntime, runtimeErrors, resetRuntimeCapture } = createCliRuntimeCapture();

vi.mock("../runtime.js", () => ({
  defaultRuntime,
}));

vi.mock("../config/config.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config/config.js")>();
  return {
    ...actual,
    loadConfig: () => ({}),
  };
});

vi.mock("../agents/agent-scope.js", () => ({
  resolveDefaultAgentId: () => "main",
  resolveAgentWorkspaceDir: () => "/tmp/workspace",
}));

vi.mock("../agents/skills-status.js", () => ({
  buildWorkspaceSkillStatus: vi.fn(async () => ({
    workspaceDir: "/tmp/workspace",
    managedSkillsDir: "/tmp/managed",
    skills: [
      {
        name: "qc-skill",
        description: "QC test skill",
        source: "coreblow-bundled",
        bundled: true,
        eligible: true,
        disabled: false,
        blockedByAllowlist: false,
        requirements: { bins: [], anyBins: [], env: [], config: [], os: [] },
        missing: { bins: [], anyBins: [], env: [], config: [], os: [] },
        configChecks: [],
        install: [],
      },
    ],
  })),
}));

const { registerSkillsCli } = await import("./skills-cli.js");

describe("skills cli --json output", () => {
  beforeEach(() => {
    resetRuntimeCapture();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("writes skills list --json through defaultRuntime.writeJson to keep stdout pure JSON", async () => {
    const program = new Command();
    program.exitOverride();
    registerSkillsCli(program);

    await program.parseAsync(["skills", "list", "--json"], { from: "user" });

    expect(defaultRuntime.writeJson).toHaveBeenCalledTimes(1);
    const payload = defaultRuntime.writeJson.mock.calls[0]?.[0] as {
      skills: Array<{ name: string }>;
    };
    expect(payload.skills).toHaveLength(1);
    expect(payload.skills[0]?.name).toBe("qc-skill");
    expect(runtimeErrors).toEqual([]);
  });
});
