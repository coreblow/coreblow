import { describe, expect, it } from "vitest";
import {
  mockNodeBuiltinModule,
  mockNodeChildProcessExecFile,
  mockNodeChildProcessSpawnSync,
  withMockedPlatform,
  withMockedWindowsPlatform,
  withRestoredMocks,
} from "./test-node-mocks.js";

describe("test-node-mocks public facade", () => {
  it("re-exports working node builtin mock helpers", async () => {
    const actual = { readFileSync: () => "actual" };
    const mocked = await mockNodeBuiltinModule(async () => actual, {
      readFileSync: () => "mock",
    });
    expect(mocked.readFileSync()).toBe("mock");
  });

  it("re-exports a working spawnSync mock helper", async () => {
    const result = await mockNodeChildProcessSpawnSync(() => "spawned");
    expect(typeof result.spawnSync).toBe("function");
  });

  it("re-exports a working execFile mock helper", async () => {
    const execFile = (() => "exec") as unknown as typeof import("node:child_process").execFile;
    const result = await mockNodeChildProcessExecFile(execFile);
    expect(result.execFile).toBe(execFile);
  });

  it("re-exports working platform-mocking helpers", () => {
    const value = withMockedPlatform("linux", () => process.platform);
    expect(value).toBe("linux");
    expect(process.platform).not.toBe("linux");
  });

  it("re-exports a working windows-platform helper", () => {
    const value = withMockedWindowsPlatform(() => process.platform);
    expect(value).toBe("win32");
  });

  it("re-exports a working restore-mocks helper", () => {
    let restored = false;
    const result = withRestoredMocks(
      [{ mockRestore: () => (restored = true) }],
      () => "done",
    );
    expect(result).toBe("done");
    expect(restored).toBe(true);
  });
});
