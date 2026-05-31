import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildCoreBlowCompileCacheRespawnPlan,
  isSourceCheckoutInstallRoot,
  resolveCoreBlowCompileCacheDirectory,
  resolveEntryInstallRoot,
  runCoreBlowCompileCacheRespawnPlan,
  shouldEnableCoreBlowCompileCache,
} from "./entry.compile-cache.js";

const tempDirs: string[] = [];

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function requireFirstMockCall(mock: { mock: { calls: unknown[][] } }, label: string): unknown[] {
  const [call] = mock.mock.calls;
  if (!call) {
    throw new Error(`expected ${label} call`);
  }
  return call;
}

describe("entry compile cache", () => {
  afterEach(async () => {
    vi.useRealTimers();
    await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
  });

  it("resolves install roots from source and dist entry paths", () => {
    expect(resolveEntryInstallRoot("/repo/coreblow/src/entry.ts")).toBe("/repo/coreblow");
    expect(resolveEntryInstallRoot("/repo/coreblow/dist/entry.js")).toBe("/repo/coreblow");
    expect(resolveEntryInstallRoot("/pkg/coreblow/entry.js")).toBe("/pkg/coreblow");
  });

  it("treats git and source entry markers as source checkouts", async () => {
    const gitRoot = await makeTempDir("coreblow-compile-cache-git-");
    await fs.writeFile(path.join(gitRoot, ".git"), "gitdir: .git/worktrees/coreblow\n", "utf8");

    const sourceRoot = await makeTempDir("coreblow-compile-cache-src-");
    await fs.mkdir(path.join(sourceRoot, "src"), { recursive: true });
    await fs.writeFile(path.join(sourceRoot, "src", "entry.ts"), "export {};\n", "utf8");

    expect(isSourceCheckoutInstallRoot(gitRoot)).toBe(true);
    expect(isSourceCheckoutInstallRoot(sourceRoot)).toBe(true);
  });

  it("disables compile cache for source-checkout installs", async () => {
    const root = await makeTempDir("coreblow-compile-cache-src-entry-");
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "entry.ts"), "export {};\n", "utf8");

    expect(
      shouldEnableCoreBlowCompileCache({
        env: {},
        installRoot: root,
      }),
    ).toBe(false);
  });

  it("keeps compile cache enabled for packaged installs unless disabled by env", async () => {
    const root = await makeTempDir("coreblow-compile-cache-package-");

    expect(shouldEnableCoreBlowCompileCache({ env: {}, installRoot: root })).toBe(true);
    expect(
      shouldEnableCoreBlowCompileCache({
        env: { NODE_DISABLE_COMPILE_CACHE: "1" },
        installRoot: root,
      }),
    ).toBe(false);
  });

  it("scopes packaged compile cache by package install metadata", async () => {
    const root = await makeTempDir("coreblow-compile-cache-package-key-");
    const packageJsonPath = path.join(root, "package.json");
    await fs.writeFile(packageJsonPath, '{"version":"2026.4.29"}\n', "utf8");

    const directory = resolveCoreBlowCompileCacheDirectory({
      env: { NODE_COMPILE_CACHE: path.join(root, ".node-cache") },
      installRoot: root,
    });

    expect(directory).toContain(path.join(".node-cache", "coreblow"));
    expect(directory).toContain("2026.4.29");
    expect(path.basename(directory)).toMatch(/^\d+-\d+$/);
  });

  it("builds a one-shot no-cache respawn plan when source checkout inherits NODE_COMPILE_CACHE", async () => {
    const root = await makeTempDir("coreblow-compile-cache-respawn-");
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "entry.ts"), "export {};\n", "utf8");

    const plan = buildCoreBlowCompileCacheRespawnPlan({
      currentFile: path.join(root, "dist", "entry.js"),
      env: { NODE_COMPILE_CACHE: "/tmp/coreblow-cache" },
      execArgv: ["--no-warnings"],
      execPath: "/usr/bin/node",
      installRoot: root,
      argv: ["/usr/bin/node", path.join(root, "dist", "entry.js"), "status", "--json"],
    });

    expect(plan).toEqual({
      command: "/usr/bin/node",
      args: ["--no-warnings", path.join(root, "dist", "entry.js"), "status", "--json"],
      env: {
        NODE_DISABLE_COMPILE_CACHE: "1",
        COREBLOW_SOURCE_COMPILE_CACHE_RESPAWNED: "1",
      },
    });
  });

  it("does not respawn packaged installs when NODE_COMPILE_CACHE is configured", async () => {
    const root = await makeTempDir("coreblow-compile-cache-package-respawn-");

    expect(
      buildCoreBlowCompileCacheRespawnPlan({
        currentFile: path.join(root, "dist", "entry.js"),
        env: { NODE_COMPILE_CACHE: "/tmp/coreblow-cache" },
        installRoot: root,
      }),
    ).toBeUndefined();
  });

  it("does not respawn source checkouts twice", async () => {
    const root = await makeTempDir("coreblow-compile-cache-respawn-once-");
    await fs.mkdir(path.join(root, "src"), { recursive: true });
    await fs.writeFile(path.join(root, "src", "entry.ts"), "export {};\n", "utf8");

    expect(
      buildCoreBlowCompileCacheRespawnPlan({
        currentFile: path.join(root, "dist", "entry.js"),
        env: {
          NODE_COMPILE_CACHE: "/tmp/coreblow-cache",
          COREBLOW_SOURCE_COMPILE_CACHE_RESPAWNED: "1",
        },
        installRoot: root,
      }),
    ).toBeUndefined();
  });

  it("runs compile-cache respawn plans with the child-process bridge", () => {
    const child = new EventEmitter() as ChildProcess;
    const spawn = vi.fn(() => child);
    const attachChildProcessBridge = vi.fn();
    const exit = vi.fn();
    const writeError = vi.fn();

    runCoreBlowCompileCacheRespawnPlan(
      {
        command: "/usr/bin/node",
        args: ["/repo/coreblow/dist/entry.js", "status"],
        env: { NODE_DISABLE_COMPILE_CACHE: "1" },
      },
      {
        spawn: spawn as unknown as typeof import("node:child_process").spawn,
        attachChildProcessBridge,
        exit: exit as unknown as (code?: number) => never,
        writeError,
      },
    );

    expect(spawn).toHaveBeenCalledWith(
      "/usr/bin/node",
      ["/repo/coreblow/dist/entry.js", "status"],
      {
        stdio: "inherit",
        env: { NODE_DISABLE_COMPILE_CACHE: "1" },
      },
    );
    const [bridgeChild, bridgeOptions] = requireFirstMockCall(
      attachChildProcessBridge,
      "child process bridge attach",
    );
    expect(bridgeChild).toBe(child);
    expect(bridgeOptions).toEqual({ onSignal: expect.any(Function) });

    child.emit("exit", 0, null);

    expect(exit).toHaveBeenCalledWith(0);
    expect(writeError).not.toHaveBeenCalled();
  });

  it("marks signal-terminated compile-cache respawn children as failed", () => {
    const child = new EventEmitter() as ChildProcess;
    const spawn = vi.fn(() => child);
    const exit = vi.fn();

    runCoreBlowCompileCacheRespawnPlan(
      {
        command: "/usr/bin/node",
        args: ["/repo/coreblow/dist/entry.js"],
        env: {},
      },
      {
        spawn: spawn as unknown as typeof import("node:child_process").spawn,
        attachChildProcessBridge: vi.fn(),
        exit: exit as unknown as (code?: number) => never,
        writeError: vi.fn(),
      },
    );

    child.emit("exit", null, "SIGTERM");

    expect(exit).toHaveBeenCalledWith(1);
  });

  it("terminates before force-killing a signaled compile-cache respawn child", () => {
    vi.useFakeTimers();
    const child = new EventEmitter() as ChildProcess;
    const kill = vi.fn<(signal?: NodeJS.Signals) => boolean>(() => true);
    child.kill = kill as ChildProcess["kill"];
    const spawn = vi.fn(() => child);
    const exit = vi.fn();
    let onSignal: ((signal: NodeJS.Signals) => void) | undefined;

    runCoreBlowCompileCacheRespawnPlan(
      {
        command: "/usr/bin/node",
        args: ["/repo/coreblow/dist/entry.js"],
        env: {},
      },
      {
        spawn: spawn as unknown as typeof import("node:child_process").spawn,
        attachChildProcessBridge: vi.fn((_child, options) => {
          onSignal = options?.onSignal;
          return { detach: vi.fn() };
        }),
        exit: exit as unknown as (code?: number) => never,
        writeError: vi.fn(),
      },
    );

    onSignal?.("SIGTERM");
    vi.advanceTimersByTime(1_000);

    expect(kill).toHaveBeenCalledWith("SIGTERM");
    expect(exit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);

    expect(kill).toHaveBeenCalledWith(process.platform === "win32" ? "SIGTERM" : "SIGKILL");
    expect(exit).toHaveBeenCalledWith(1);
  });
});
