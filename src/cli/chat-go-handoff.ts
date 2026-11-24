/**
 * CoreBlow — Safe Go Companion (corechat) Handoff
 *
 * Resolves the `corechat` Go companion cleanly across:
 * 1. $PATH (`corechat`)
 * 2. Sibling checkout (`../coreblow-split/corechat`)
 * 3. Graceful fallback with actionable installation guidance
 *
 * ZERO cross-repo relative imports: strictly standalone safe.
 */

import { spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RuntimeEnv } from "../runtime.js";
import { defaultRuntime } from "../runtime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_SPLIT_ROOT = path.resolve(REPO_ROOT, "../coreblow-split");

export interface ChatGoHandoffOptions {
  gatewayUrl?: string;
  sessionKey?: string;
  token?: string;
  prompt?: string;
  splitRoot?: string;
  pathEnv?: string;
  spawnFn?: (command: string, args: string[], options: Record<string, unknown>) => ChildProcess;
}

export interface CorechatResolution {
  type: "path" | "sibling-binary" | "sibling-source" | "missing";
  command?: string;
  argsPrefix?: string[];
  cwd?: string;
  hint?: string;
}

export function findExecutableOnPath(name: string, envPath: string = process.env.PATH || ""): string | null {
  if (!name || !envPath) return null;
  const pathDirs = envPath.split(path.delimiter);
  const extensions = process.platform === "win32" ? [".exe", ".cmd", ".bat", ""] : [""];

  for (const dir of pathDirs) {
    if (!dir) continue;
    for (const ext of extensions) {
      const fullPath = path.join(dir, `${name}${ext}`);
      try {
        if (fs.existsSync(fullPath)) {
          const stat = fs.statSync(fullPath);
          if (stat.isFile()) {
            if (process.platform === "win32" || Boolean(stat.mode & 0o111)) {
              return fullPath;
            }
          }
        }
      } catch {
        // ignore access errors
      }
    }
  }
  return null;
}

export function resolveCorechatCompanion(options: ChatGoHandoffOptions = {}): CorechatResolution {
  const pathEnv = options.pathEnv ?? process.env.PATH ?? "";
  const splitRoot = options.splitRoot ?? process.env.COREBLOW_SPLIT_ROOT ?? DEFAULT_SPLIT_ROOT;

  // 1. Check binary on $PATH
  const onPath = findExecutableOnPath("corechat", pathEnv);
  if (onPath) {
    return {
      type: "path",
      command: onPath,
      argsPrefix: [],
      cwd: process.cwd(),
    };
  }

  // 2. Check sibling checkout
  const siblingDir = path.join(splitRoot, "corechat");
  if (fs.existsSync(siblingDir)) {
    const builtBinary = path.join(siblingDir, process.platform === "win32" ? "corechat.exe" : "corechat");
    if (fs.existsSync(builtBinary)) {
      return {
        type: "sibling-binary",
        command: builtBinary,
        argsPrefix: [],
        cwd: siblingDir,
      };
    }

    const mainGo = path.join(siblingDir, "cmd", "corechat", "main.go");
    if (fs.existsSync(mainGo)) {
      return {
        type: "sibling-source",
        command: "go",
        argsPrefix: ["run", "./cmd/corechat"],
        cwd: siblingDir,
      };
    }
  }

  // 3. Fallback: missing with actionable install guidance
  return {
    type: "missing",
    hint:
      "corechat companion not found.\n" +
      "Install corechat or build inside ../coreblow-split/corechat:\n" +
      "  git clone https://github.com/coreblow/corechat\n" +
      "  cd corechat && go build ./cmd/corechat",
  };
}

export function buildCorechatArgs(
  resolution: CorechatResolution,
  options: ChatGoHandoffOptions = {}
): { cmd: string; args: string[]; cwd?: string } {
  const args = [...(resolution.argsPrefix || [])];

  if (options.gatewayUrl) {
    args.push("-gateway", options.gatewayUrl);
  }
  if (options.sessionKey) {
    args.push("-session", options.sessionKey);
  }
  if (options.token) {
    args.push("-token", options.token);
  }
  if (options.prompt) {
    args.push("-prompt", options.prompt);
  }

  return {
    cmd: resolution.command || "corechat",
    args,
    cwd: resolution.cwd,
  };
}

export async function runChatGoHandoff(
  runtime: RuntimeEnv = defaultRuntime,
  options: ChatGoHandoffOptions = {}
): Promise<boolean> {
  const resolution = resolveCorechatCompanion(options);

  if (resolution.type === "missing") {
    runtime.error(
      `[coreblow] ${resolution.hint ?? "corechat companion not found. See https://github.com/coreblow/corechat"}`
    );
    return false;
  }

  const { cmd, args, cwd } = buildCorechatArgs(resolution, options);
  const spawnFunc = options.spawnFn ?? spawn;

  return new Promise((resolvePromise) => {
    try {
      const child = spawnFunc(cmd, args, {
        cwd: cwd ?? process.cwd(),
        stdio: "inherit",
        env: process.env,
      });

      child.on("error", (err) => {
        runtime.error(`[coreblow] Failed to spawn corechat (${cmd}): ${err.message}`);
        resolvePromise(false);
      });

      child.on("exit", (code) => {
        resolvePromise(code === 0);
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      runtime.error(`[coreblow] Failed to launch corechat: ${message}`);
      resolvePromise(false);
    }
  });
}
