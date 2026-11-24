import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import type { Command } from "commander";
import { resolveCoreBlowPackageRootSync } from "../infra/coreblow-root.js";

export interface LaunchDesktopOptions {
  repoRoot?: string;
  platform?: string;
  spawnFn?: typeof spawn;
  sessionId?: string;
  existsFn?: (path: string) => boolean;
}

export interface LaunchDesktopResult {
  launched: boolean;
  strategy: "app" | "packaged" | "dev" | "start";
  target: string;
}

export function launchDesktopApp(options: LaunchDesktopOptions = {}): LaunchDesktopResult {
  const platform = options.platform ?? process.platform;
  const spawnFn = options.spawnFn ?? spawn;
  const existsFn = options.existsFn ?? fs.existsSync;
  const repoRoot =
    options.repoRoot ??
    resolveCoreBlowPackageRootSync({ cwd: process.cwd() }) ??
    process.cwd();

  const childEnv = {
    ...process.env,
    ...(options.sessionId ? { COREBLOW_SESSION_ID: options.sessionId } : {}),
  };

  if (platform === "darwin") {
    const candidatePaths = [
      "/Applications/CoreBlow.app",
      path.join(repoRoot, "apps", "desktop", "release", "mac-arm64", "CoreBlow.app"),
      path.join(repoRoot, "apps", "desktop", "release", "mac", "CoreBlow.app"),
    ];

    for (const appPath of candidatePaths) {
      if (existsFn(appPath)) {
        const openArgs = ["-a", appPath];
        if (options.sessionId) {
          openArgs.push("--args", "--session", options.sessionId);
        }
        const child = spawnFn("open", openArgs, {
          detached: true,
          stdio: "ignore",
          env: childEnv,
        });
        child.unref();
        return { launched: true, strategy: "app", target: appPath };
      }
    }

    const desktopPkg = path.join(repoRoot, "apps", "desktop", "package.json");
    if (existsFn(desktopPkg)) {
      const child = spawnFn("pnpm", ["--filter", "@coreblow/desktop", "dev"], {
        detached: true,
        stdio: "ignore",
        cwd: repoRoot,
        env: childEnv,
      });
      child.unref();
      return { launched: true, strategy: "dev", target: "pnpm --filter @coreblow/desktop dev" };
    }

    // ponytail: fallback if apps/desktop not checked out; upgrade path: show download link
    return { launched: false, strategy: "app", target: candidatePaths[0] };
  }

  const candidateBinaries =
    platform === "win32"
      ? [
          path.join(repoRoot, "apps", "desktop", "release", "win-unpacked", "CoreBlow.exe"),
          path.join(process.env.LOCALAPPDATA ?? "", "Programs", "CoreBlow", "CoreBlow.exe"),
        ]
      : [
          path.join(repoRoot, "apps", "desktop", "release", "linux-unpacked", "coreblow"),
          "/usr/bin/coreblow-desktop",
          "/usr/local/bin/coreblow-desktop",
        ];

  for (const binPath of candidateBinaries) {
    if (binPath && existsFn(binPath)) {
      const args = options.sessionId ? ["--session", options.sessionId] : [];
      const child = spawnFn(binPath, args, {
        detached: true,
        stdio: "ignore",
        env: childEnv,
      });
      child.unref();
      return { launched: true, strategy: "packaged", target: binPath };
    }
  }

  const child = spawnFn("pnpm", ["--filter", "@coreblow/desktop", "start"], {
    detached: true,
    stdio: "ignore",
    cwd: repoRoot,
    env: childEnv,
  });
  child.unref();
  return { launched: true, strategy: "start", target: "pnpm --filter @coreblow/desktop start" };
}

export function registerDesktopCli(program: Command) {
  program
    .command("desktop")
    .description("Launch the CoreBlow Studio desktop application")
    .option("--session <id>", "Handoff session ID to desktop app")
    .action(async (opts: { session?: string }) => {
      console.log("Launching CoreBlow Studio desktop...");
      const result = launchDesktopApp({ sessionId: opts.session });
      if (result.launched) {
        console.log(`CoreBlow Studio started via ${result.strategy} (${result.target}).`);
      } else {
        console.error("Unable to find or launch CoreBlow Studio desktop.");
        process.exitCode = 1;
      }
    });
}
