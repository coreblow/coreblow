// @ts-nocheck — structural test type mismatches (vitest mock compat)
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACP_LOCAL_INSTALL_COMMAND,
  ACP_PINNED_VERSION,
  buildAcpLocalInstallCommand,
} from "./config.js";

const { resolveSpawnFailureMock, spawnAndCollectMock } = vi.hoisted(() => ({
  resolveSpawnFailureMock: vi.fn(() => null),
  spawnAndCollectMock: vi.fn(),
}));

vi.mock("./runtime-internals/process.js", () => ({
  resolveSpawnFailure: resolveSpawnFailureMock,
  spawnAndCollect: spawnAndCollectMock,
}));

import { checkAcpVersion, ensureAcp } from "./ensure.js";

describe("acp ensure", () => {
  const tempDirs: string[] = [];

  beforeEach(() => {
    resolveSpawnFailureMock.mockReset();
    resolveSpawnFailureMock.mockReturnValue(null);
    spawnAndCollectMock.mockReset();
  });

  function makeTempAcpInstall(version: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "acp-ensure-test-"));
    tempDirs.push(root);
    const packageRoot = path.join(root, "node_modules", "acp");
    fs.mkdirSync(path.join(packageRoot, "dist"), { recursive: true });
    fs.mkdirSync(path.join(root, "node_modules", ".bin"), { recursive: true });
    fs.writeFileSync(
      path.join(packageRoot, "package.json"),
      JSON.stringify({ name: "acp", version }, null, 2),
      "utf8",
    );
    fs.writeFileSync(path.join(packageRoot, "dist", "cli.js"), "#!/usr/bin/env node\n", "utf8");
    const binPath = path.join(root, "node_modules", ".bin", "acp");
    fs.symlinkSync(path.join(packageRoot, "dist", "cli.js"), binPath);
    return binPath;
  }

  afterEach(() => {
    for (const dir of tempDirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  function mockEnsureInstallFlow() {
    spawnAndCollectMock
      .mockResolvedValueOnce({
        stdout: "acp 0.0.9\n",
        stderr: "",
        code: 0,
        error: null,
      })
      .mockResolvedValueOnce({
        stdout: "added 1 package\n",
        stderr: "",
        code: 0,
        error: null,
      })
      .mockResolvedValueOnce({
        stdout: `acp ${ACP_PINNED_VERSION}\n`,
        stderr: "",
        code: 0,
        error: null,
      });
  }

  function expectEnsureInstallCalls(stripProviderAuthEnvVars?: boolean) {
    expect(spawnAndCollectMock.mock.calls[0]?.[0]).toMatchObject({
      command: "/plugin/node_modules/.bin/acp",
      args: ["--version"],
      cwd: "/plugin",
      stripProviderAuthEnvVars,
    });
    expect(spawnAndCollectMock.mock.calls[1]?.[0]).toMatchObject({
      command: "npm",
      args: [
        "install",
        "--omit=dev",
        "--no-save",
        "--package-lock=false",
        `acp@${ACP_PINNED_VERSION}`,
      ],
      cwd: "/plugin",
      stripProviderAuthEnvVars,
    });
    expect(spawnAndCollectMock.mock.calls[2]?.[0]).toMatchObject({
      command: "/plugin/node_modules/.bin/acp",
      args: ["--version"],
      cwd: "/plugin",
      stripProviderAuthEnvVars,
    });
  }

  it("accepts the pinned acp version", async () => {
    spawnAndCollectMock.mockResolvedValueOnce({
      stdout: `acp ${ACP_PINNED_VERSION}\n`,
      stderr: "",
      code: 0,
      error: null,
    });

    const result = await checkAcpVersion({
      command: "/plugin/node_modules/.bin/acp",
      cwd: "/plugin",
      expectedVersion: ACP_PINNED_VERSION,
    });

    expect(result).toEqual({
      ok: true,
      version: ACP_PINNED_VERSION,
      expectedVersion: ACP_PINNED_VERSION,
    });
    expect(spawnAndCollectMock).toHaveBeenCalledWith({
      command: "/plugin/node_modules/.bin/acp",
      args: ["--version"],
      cwd: "/plugin",
      stripProviderAuthEnvVars: undefined,
    });
  });

  it("reports version mismatch", async () => {
    spawnAndCollectMock.mockResolvedValueOnce({
      stdout: "acp 0.0.9\n",
      stderr: "",
      code: 0,
      error: null,
    });

    const result = await checkAcpVersion({
      command: "/plugin/node_modules/.bin/acp",
      cwd: "/plugin",
      expectedVersion: ACP_PINNED_VERSION,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "version-mismatch",
      expectedVersion: ACP_PINNED_VERSION,
      installedVersion: "0.0.9",
      installCommand: ACP_LOCAL_INSTALL_COMMAND,
    });
  });

  it("falls back to package.json version when --version is unsupported", async () => {
    const command = makeTempAcpInstall(ACP_PINNED_VERSION);
    spawnAndCollectMock.mockResolvedValueOnce({
      stdout: "",
      stderr: "error: unknown option '--version'",
      code: 2,
      error: null,
    });

    const result = await checkAcpVersion({
      command,
      cwd: path.dirname(path.dirname(command)),
      expectedVersion: ACP_PINNED_VERSION,
    });

    expect(result).toEqual({
      ok: true,
      version: ACP_PINNED_VERSION,
      expectedVersion: ACP_PINNED_VERSION,
    });
  });

  it("accepts command availability when expectedVersion is unset", async () => {
    spawnAndCollectMock.mockResolvedValueOnce({
      stdout: "Usage: acp [options]\n",
      stderr: "",
      code: 0,
      error: null,
    });

    const result = await checkAcpVersion({
      command: "/custom/acp",
      cwd: "/custom",
      expectedVersion: undefined,
    });

    expect(result).toEqual({
      ok: true,
      version: "unknown",
      expectedVersion: undefined,
    });
    expect(spawnAndCollectMock).toHaveBeenCalledWith({
      command: "/custom/acp",
      args: ["--help"],
      cwd: "/custom",
      stripProviderAuthEnvVars: undefined,
    });
  });

  it("forwards stripProviderAuthEnvVars to version checks", async () => {
    spawnAndCollectMock.mockResolvedValueOnce({
      stdout: "Usage: acp [options]\n",
      stderr: "",
      code: 0,
      error: null,
    });

    await checkAcpVersion({
      command: "/plugin/node_modules/.bin/acp",
      cwd: "/plugin",
      expectedVersion: undefined,
      stripProviderAuthEnvVars: true,
    });

    expect(spawnAndCollectMock).toHaveBeenCalledWith({
      command: "/plugin/node_modules/.bin/acp",
      args: ["--help"],
      cwd: "/plugin",
      stripProviderAuthEnvVars: true,
    });
  });

  it("installs and verifies pinned acp when precheck fails", async () => {
    mockEnsureInstallFlow();

    await ensureAcp({
      command: "/plugin/node_modules/.bin/acp",
      pluginRoot: "/plugin",
      expectedVersion: ACP_PINNED_VERSION,
    });

    expect(spawnAndCollectMock).toHaveBeenCalledTimes(3);
    expectEnsureInstallCalls();
  });

  it("threads stripProviderAuthEnvVars through version probes and install", async () => {
    mockEnsureInstallFlow();

    await ensureAcp({
      command: "/plugin/node_modules/.bin/acp",
      pluginRoot: "/plugin",
      expectedVersion: ACP_PINNED_VERSION,
      stripProviderAuthEnvVars: true,
    });

    expectEnsureInstallCalls(true);
  });

  it("fails with actionable error when npm install fails", async () => {
    spawnAndCollectMock
      .mockResolvedValueOnce({
        stdout: "acp 0.0.9\n",
        stderr: "",
        code: 0,
        error: null,
      })
      .mockResolvedValueOnce({
        stdout: "",
        stderr: "network down",
        code: 1,
        error: null,
      });

    await expect(
      ensureAcp({
        command: "/plugin/node_modules/.bin/acp",
        pluginRoot: "/plugin",
        expectedVersion: ACP_PINNED_VERSION,
      }),
    ).rejects.toThrow("failed to install plugin-local acp");
  });

  it("skips install path when allowInstall=false", async () => {
    spawnAndCollectMock.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
      code: 0,
      error: new Error("not found"),
    });
    resolveSpawnFailureMock.mockReturnValue("missing-command");

    await expect(
      ensureAcp({
        command: "/custom/acp",
        pluginRoot: "/plugin",
        expectedVersion: undefined,
        allowInstall: false,
      }),
    ).rejects.toThrow("acp command not found at /custom/acp");

    expect(spawnAndCollectMock).toHaveBeenCalledTimes(1);
  });

  it("uses expectedVersion for install command metadata", async () => {
    spawnAndCollectMock.mockResolvedValueOnce({
      stdout: "acp 0.0.9\n",
      stderr: "",
      code: 0,
      error: null,
    });

    const result = await checkAcpVersion({
      command: "/plugin/node_modules/.bin/acp",
      cwd: "/plugin",
      expectedVersion: "0.2.0",
    });

    expect(result).toMatchObject({
      ok: false,
      installCommand: buildAcpLocalInstallCommand("0.2.0"),
    });
  });
});
