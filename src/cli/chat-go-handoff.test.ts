import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildCorechatArgs,
  findExecutableOnPath,
  resolveCorechatCompanion,
  runChatGoHandoff,
  type CorechatResolution,
} from "./chat-go-handoff.js";

const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function createTempSiblingSource(): string {
  const splitRoot = createTempDir("coreblow-chat-handoff-");
  const mainGoDir = path.join(splitRoot, "corechat", "cmd", "corechat");
  fs.mkdirSync(mainGoDir, { recursive: true });
  fs.writeFileSync(path.join(mainGoDir, "main.go"), "package main\nfunc main() {}\n", "utf8");
  return splitRoot;
}

describe("corechat companion resolution", () => {
  afterEach(() => {
    while (tempDirs.length > 0) {
      const dir = tempDirs.pop();
      if (dir) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  it("prioritizes binary on PATH when present", () => {
    // Check that finding an existing system binary on PATH works
    const nodeDir = path.dirname(process.execPath);
    const nodeName = path.basename(process.execPath).replace(/\.exe$/i, "");

    const found = findExecutableOnPath(nodeName, nodeDir);
    expect(found).toBeTruthy();
  });

  it("returns missing when neither PATH nor sibling checkout exists", () => {
    const res = resolveCorechatCompanion({
      pathEnv: "/nonexistent-dir",
      splitRoot: "/nonexistent-split-dir",
    });

    expect(res.type).toBe("missing");
    expect(res.hint).toContain("https://github.com/coreblow/corechat");
  });

  it("detects sibling checkout when available", () => {
    const splitRoot = createTempSiblingSource();
    const res = resolveCorechatCompanion({
      pathEnv: "",
      splitRoot,
    });

    expect(res.type).toBe("sibling-source");
    expect(res.command).toBe("go");
    expect(res.argsPrefix).toEqual(["run", "./cmd/corechat"]);
    expect(res.cwd).toBe(path.join(splitRoot, "corechat"));
  });

  it("builds correct command-line flags for gateway and session handoff", () => {
    const resolution: CorechatResolution = {
      type: "path",
      command: "/usr/local/bin/corechat",
      argsPrefix: [],
    };

    const invocation = buildCorechatArgs(resolution, {
      gatewayUrl: "ws://127.0.0.1:18789",
      sessionKey: "test-session-42",
      token: "secret-token",
    });

    expect(invocation.cmd).toBe("/usr/local/bin/corechat");
    expect(invocation.args).toEqual([
      "-gateway",
      "ws://127.0.0.1:18789",
      "-session",
      "test-session-42",
      "-token",
      "secret-token",
    ]);
  });

  it("gracefully outputs missing error and hint without crashing", async () => {
    const errors: string[] = [];
    const mockRuntime = {
      log: vi.fn(),
      error: vi.fn((msg: string) => errors.push(msg)),
      exit: vi.fn(),
    };

    const success = await runChatGoHandoff(mockRuntime as any, {
      pathEnv: "/nonexistent-path",
      splitRoot: "/nonexistent-split-root",
    });

    expect(success).toBe(false);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]).toContain("corechat companion not found");
    expect(errors[0]).toContain("https://github.com/coreblow/corechat");
  });

  it("spawns child process when companion is resolved", async () => {
    const splitRoot = createTempSiblingSource();
    const mockEmitter = new EventEmitter() as any;
    const mockSpawn = vi.fn().mockReturnValue(mockEmitter);

    const promise = runChatGoHandoff(undefined as any, {
      pathEnv: "",
      splitRoot,
      spawnFn: mockSpawn,
    });

    expect(mockSpawn).toHaveBeenCalled();
    mockEmitter.emit("exit", 0);
    const result = await promise;
    expect(result).toBe(true);
  });
});
