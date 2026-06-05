import { describe, expect, it, vi } from "vitest";

const { spawnAndCollectMock } = vi.hoisted(() => ({
  spawnAndCollectMock: vi.fn(),
}));

vi.mock("./process.js", () => ({
  spawnAndCollect: spawnAndCollectMock,
}));

import { __testing, resolveAcpAgentCommand } from "./mcp-agent-command.js";

describe("resolveAcpAgentCommand", () => {
  it.each([
    ["cursor", "cursor-agent acp"],
    ["gemini", "gemini --acp"],
    ["coreblow", "coreblow acp"],
    ["copilot", "copilot --acp --stdio"],
    ["pi", "npx -y pi-acp@0.0.22"],
    ["codex", "npx -y @zed-industries/codex-acp@0.9.5"],
    ["claude", "npx -y @zed-industries/claude-agent-acp@0.21.0"],
  ])("uses the current acp built-in for %s by default", async (agent, expected) => {
    spawnAndCollectMock.mockResolvedValueOnce({
      stdout: JSON.stringify({ agents: {} }),
      stderr: "",
      code: 0,
      error: null,
    });

    const command = await resolveAcpAgentCommand({
      acpCommand: "/plugin/node_modules/.bin/acp",
      cwd: "/plugin",
      agent,
    });

    expect(command).toBe(expected);
  });

  it("returns null for unknown agent ids instead of falling back to raw commands", async () => {
    spawnAndCollectMock.mockResolvedValueOnce({
      stdout: JSON.stringify({ agents: {} }),
      stderr: "",
      code: 0,
      error: null,
    });

    const command = await resolveAcpAgentCommand({
      acpCommand: "/plugin/node_modules/.bin/acp",
      cwd: "/plugin",
      agent: "sh -c whoami",
    });

    expect(command).toBeNull();
  });

  it("threads stripProviderAuthEnvVars through the config show probe", async () => {
    spawnAndCollectMock.mockResolvedValueOnce({
      stdout: JSON.stringify({
        agents: {
          codex: {
            command: "custom-codex",
          },
        },
      }),
      stderr: "",
      code: 0,
      error: null,
    });

    const command = await resolveAcpAgentCommand({
      acpCommand: "/plugin/node_modules/.bin/acp",
      cwd: "/plugin",
      agent: "codex",
      stripProviderAuthEnvVars: true,
    });

    expect(command).toBe("custom-codex");
    expect(spawnAndCollectMock).toHaveBeenCalledWith(
      {
        command: "/plugin/node_modules/.bin/acp",
        args: ["--cwd", "/plugin", "config", "show"],
        cwd: "/plugin",
        stripProviderAuthEnvVars: true,
      },
      undefined,
    );
  });
});

describe("buildMcpProxyAgentCommand", () => {
  it("escapes Windows-style proxy paths without double-escaping backslashes", () => {
    const quoted = __testing.quoteCommandPart(
      "C:\\repo\\extensions\\acp\\src\\runtime-internals\\mcp-proxy.mjs",
    );

    expect(quoted).toBe(
      '"C:\\\\repo\\\\extensions\\\\acp\\\\src\\\\runtime-internals\\\\mcp-proxy.mjs"',
    );
    expect(quoted).not.toContain("\\\\\\");
  });
});
