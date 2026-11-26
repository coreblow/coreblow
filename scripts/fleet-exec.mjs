#!/usr/bin/env node

/**
 * CoreBlow — Safe Fleet Tool Dispatcher
 *
 * Resolves and invokes federated satellite tools from ./scripts/fleet/fleet-manifest.json
 * across:
 * 1. Installed binary on $PATH
 * 2. Sibling repository checkout (`../coreblow-split/<repo>`)
 * 3. Graceful fallback with actionable installation guidance
 *
 * Zero external dependencies — pure Node ESM.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_SPLIT_ROOT = path.resolve(REPO_ROOT, "../coreblow-split");
const MANIFEST_PATH = path.join(__dirname, "fleet/fleet-manifest.json");

/**
 * Check if a binary exists on PATH and is executable.
 */
export function findBinaryOnPath(name, envPath = process.env.PATH) {
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
            if (process.platform === "win32") {
              return fullPath;
            }
            if (Boolean(stat.mode & 0o111)) {
              return fullPath;
            }
          }
        }
      } catch {
        // Ignore permission or file system errors
      }
    }
  }
  return null;
}

function buildToolConfig(name, def, siblingDir) {
  const base = {
    name,
    ...(def.alias ? { alias: def.alias } : {}),
    binary: def.binary,
    ...(def.altBinary ? { altBinary: def.altBinary } : {}),
    siblingDir,
    ...(def.requiresDarwin ? { requiresDarwin: true } : {}),
    installHint: def.installHint,
  };

  if (def.runner === "swift-build" || def.runner === "swift-run") {
    const modeLabel = def.runner === "swift-build" ? "build" : "dev";
    return {
      ...base,
      resolveCommand(res, userArgs) {
        if (process.platform !== "darwin") {
          throw new Error(
            `${def.repo} ${modeLabel} requires macOS (darwin) with Swift/Xcode toolchain.`,
          );
        }
        if (!res.siblingPath) {
          throw new Error(
            `${def.repo} repository not found at ${res.expectedSiblingPath}.\n` +
              `Clone it with: git clone https://github.com/coreblow/${def.repo} ${res.expectedSiblingPath}`,
          );
        }
        const swiftArgs = def.runner === "swift-build" ? ["build", "-c", "release"] : ["run"];
        return {
          cmd: "swift",
          args: [...swiftArgs, ...userArgs],
          cwd: res.siblingPath,
        };
      },
    };
  }

  if (def.runner === "go") {
    return {
      ...base,
      resolveCommand(res, userArgs) {
        if (res.onPath) {
          return { cmd: res.onPath, args: userArgs, cwd: process.cwd() };
        }
        if (res.siblingPath) {
          const builtBin = path.join(
            res.siblingPath,
            process.platform === "win32" ? `${def.binary}.exe` : def.binary,
          );
          if (fs.existsSync(builtBin)) {
            return { cmd: builtBin, args: userArgs, cwd: res.siblingPath };
          }
          return {
            cmd: "go",
            args: ["run", def.entry, ...userArgs],
            cwd: res.siblingPath,
          };
        }
        return null;
      },
    };
  }

  const prefixArgs = Array.isArray(def.prefixArgs) ? def.prefixArgs : [];
  return {
    ...base,
    resolveCommand(res, userArgs) {
      if (res.onPath) {
        return { cmd: res.onPath, args: userArgs, cwd: process.cwd() };
      }
      if (res.siblingPath) {
        const binScript = path.join(res.siblingPath, def.entry);
        if (fs.existsSync(binScript)) {
          return {
            cmd: process.execPath,
            args: [binScript, ...prefixArgs, ...userArgs],
            cwd: res.siblingPath,
          };
        }
      }
      return null;
    },
  };
}

function loadFleetToolConfigs() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
  const repoByName = new Map((manifest.repositories ?? []).map((repo) => [repo.name, repo]));
  const configs = {};

  for (const [toolKey, def] of Object.entries(manifest.tools ?? {})) {
    const repo = repoByName.get(def.repo);
    if (repo && repo.status !== "active") continue;
    const siblingDir = repo?.siblingDir ?? def.repo;
    configs[toolKey] = buildToolConfig(toolKey, def, siblingDir);
  }
  return configs;
}

export const FLEET_TOOL_CONFIGS = loadFleetToolConfigs();

/**
 * Resolve a tool by script name or alias.
 */
export function resolveFleetTool(toolKey, options = {}) {
  const splitRoot = options.splitRoot ?? process.env.COREBLOW_SPLIT_ROOT ?? DEFAULT_SPLIT_ROOT;
  const pathEnv = options.pathEnv ?? process.env.PATH;

  let config = FLEET_TOOL_CONFIGS[toolKey];
  if (!config) {
    for (const item of Object.values(FLEET_TOOL_CONFIGS)) {
      if (item.alias === toolKey) {
        config = item;
        break;
      }
    }
  }

  if (!config) {
    return {
      status: "unknown",
      toolKey,
      error: `Unknown fleet tool '${toolKey}'. Run with --list to see available tools.`,
    };
  }

  const onPath =
    findBinaryOnPath(config.binary, pathEnv) ||
    (config.altBinary ? findBinaryOnPath(config.altBinary, pathEnv) : null);

  const expectedSiblingPath = path.join(splitRoot, config.siblingDir);
  const siblingExists = fs.existsSync(expectedSiblingPath);
  const siblingPath = siblingExists ? expectedSiblingPath : null;

  return {
    status: onPath ? "path" : siblingPath ? "sibling" : "missing",
    config,
    onPath,
    siblingPath,
    expectedSiblingPath,
    installHint: config.installHint,
  };
}

/**
 * Print fleet tools status table.
 */
export function listFleetTools(options = {}) {
  console.log("=== CoreBlow Fleet Tool Resolution ===");
  console.log(
    "Target".padEnd(16) +
      "Binary on $PATH".padEnd(20) +
      "Sibling Checkout".padEnd(22) +
      "Active Resolution",
  );
  console.log("─".repeat(76));

  for (const [key, config] of Object.entries(FLEET_TOOL_CONFIGS)) {
    const res = resolveFleetTool(key, options);
    const pathStr = res.onPath ? "[found]" : "[missing]";
    const sibStr = res.siblingPath ? "[found]" : "[missing]";
    let statusStr = "Missing";
    if (res.status === "path") {
      statusStr = `PATH (${path.basename(res.onPath)})`;
    } else if (res.status === "sibling") {
      statusStr = `Sibling (../coreblow-split/${config.siblingDir})`;
    }
    console.log(key.padEnd(16) + pathStr.padEnd(20) + sibStr.padEnd(22) + statusStr);
  }
}

/**
 * Execute fleet tool CLI invocation.
 */
export async function executeFleetTool(toolKey, userArgs = [], options = {}) {
  const resolution = resolveFleetTool(toolKey, options);

  if (resolution.status === "unknown") {
    console.error(`Error: ${resolution.error}`);
    return 1;
  }

  let command;
  try {
    command = resolution.config.resolveCommand(resolution, userArgs);
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return 1;
  }

  if (!command) {
    console.error(
      `Error: Fleet tool '${toolKey}' is not installed on $PATH and sibling checkout was not found at ../coreblow-split/${resolution.config.siblingDir}.\n` +
        `Hint: ${resolution.installHint}`,
    );
    return 1;
  }

  return new Promise((resolvePromise) => {
    const child = spawn(command.cmd, command.args, {
      cwd: command.cwd ?? process.cwd(),
      stdio: "inherit",
      env: { ...process.env, ...(options.env ?? {}) },
    });

    child.on("error", (err) => {
      console.error(`Failed to execute '${command.cmd}': ${err.message}`);
      resolvePromise(1);
    });

    child.on("exit", (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
      }
      resolvePromise(code ?? 0);
    });
  });
}

// ─── Direct CLI Entrypoint ───────────────────────────────────────────────────

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0 || rawArgs.includes("--list") || rawArgs.includes("-l")) {
    listFleetTools();
    process.exit(0);
  }

  const [toolKey, ...forwardArgs] = rawArgs;
  const exitCode = await executeFleetTool(toolKey, forwardArgs);
  process.exit(exitCode);
}
