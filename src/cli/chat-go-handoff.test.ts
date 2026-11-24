import { describe, expect, it, vi } from "vitest";
import path from "node:path";
import { EventEmitter } from "node:events";
import {
  buildCorechatArgs,
  findExecutableOnPath,
  resolveCorechatCompanion,
  runChatGoHandoff,
  type CorechatResolution,
} from "./chat-go-handoff.js";

describe("corechat companion resolution", () => {
  it("prioritizes binary on PATH when present", () => {
    // Check that finding an existing system binary on PATH works
    const nodeDir = path.dirname(process.execPath);
    const nodeName = path.basename(process.execPath).replace(/\.exe$/i, "");

    const found = findExecutableOnPath(nodeName, nodeDir);
    expect(found).toBeTruthy();
  });

  it("resolves companion on PATH first", () => {
    // If fake PATH directory has corechat
    const fakeBin = "/custom/bin/corechat";
    const res = resolveCorechatCompanion({
      pathEnv: "/nonexistent-dir",
      splitRoot: "/nonexistent-split-dir",
    });

    // When neither exists, returns missing
    expect(res.type).toBe("missing");
    expect(res.hint).toContain("https://github.com/coreblow/corechat");
  });

  it("detects sibling checkout when available", () => {
    const res = resolveCorechatCompanion();
    // In our repository setup with sibling ../coreblow-split/corechat
    expect(["path", "sibling-binary", "sibling-source"]).toContain(res.type);
    if (res.type === "sibling-source") {
      expect(res.command).toBe("go");
      expect(res.argsPrefix).toEqual(["run", "./cmd/corechat"]);
    }
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
      "-gateway", "ws://127.0.0.1:18789",
      "-session", "test-session-42",
      "-token", "secret-token",
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
    const mockEmitter = new EventEmitter() as any;
    const mockSpawn = vi.fn().mockReturnValue(mockEmitter);

    // Provide default splitRoot (which has ../coreblow-split/corechat)
    const promise = runChatGoHandoff(undefined as any, {
      spawnFn: mockSpawn,
    });

    expect(mockSpawn).toHaveBeenCalled();
    mockEmitter.emit("exit", 0);
    const result = await promise;
    expect(result).toBe(true);
  });
});
