#!/usr/bin/env node

/**
 * CoreBlow — Safe Fleet Tool Dispatcher
 *
 * Resolves and invokes federated satellite tools (`corebar`, `corechat`, `trust`,
 * `coreblow-rtt`, `corebench`, `corebox`, `dolphin`) across:
 * 1. Installed binary on $PATH
 * 2. Sibling repository checkout (`../coreblow-split/<repo>`)
 * 3. Graceful fallback with actionable installation guidance
 *
 * Zero external dependencies — pure Node ESM.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_SPLIT_ROOT = path.resolve(REPO_ROOT, "../coreblow-split");

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

export const FLEET_TOOL_CONFIGS = {
  "corebar:build": {
    name: "corebar:build",
    alias: "corebar",
    binary: "corebar",
    siblingDir: "corebar",
    requiresDarwin: true,
    installHint: "corebar requires macOS and Swift toolchain (https://github.com/coreblow/corebar)",
    resolveCommand(res, userArgs) {
      if (process.platform !== "darwin") {
        throw new Error("corebar build requires macOS (darwin) with Swift/Xcode toolchain.");
      }
      if (!res.siblingPath) {
        throw new Error(
          `corebar repository not found at ${res.expectedSiblingPath}.\n` +
          `Clone it with: git clone https://github.com/coreblow/corebar ${res.expectedSiblingPath}`
        );
      }
      return {
        cmd: "swift",
        args: ["build", "-c", "release", ...userArgs],
        cwd: res.siblingPath,
      };
    },
  },
  "corebar:dev": {
    name: "corebar:dev",
    binary: "corebar",
    siblingDir: "corebar",
    requiresDarwin: true,
    installHint: "corebar requires macOS and Swift toolchain (https://github.com/coreblow/corebar)",
    resolveCommand(res, userArgs) {
      if (process.platform !== "darwin") {
        throw new Error("corebar dev requires macOS (darwin) with Swift/Xcode toolchain.");
      }
      if (!res.siblingPath) {
        throw new Error(
          `corebar repository not found at ${res.expectedSiblingPath}.\n` +
          `Clone it with: git clone https://github.com/coreblow/corebar ${res.expectedSiblingPath}`
        );
      }
      return {
        cmd: "swift",
        args: ["run", ...userArgs],
        cwd: res.siblingPath,
      };
    },
  },
  "chat:go": {
    name: "chat:go",
    alias: "corechat",
    binary: "corechat",
    siblingDir: "corechat",
    installHint: "Install corechat or build inside ../coreblow-split/corechat (https://github.com/coreblow/corechat)",
    resolveCommand(res, userArgs) {
      if (res.onPath) {
        return { cmd: res.onPath, args: userArgs, cwd: process.cwd() };
      }
      if (res.siblingPath) {
        const builtBin = path.join(res.siblingPath, process.platform === "win32" ? "corechat.exe" : "corechat");
        if (fs.existsSync(builtBin)) {
          return { cmd: builtBin, args: userArgs, cwd: res.siblingPath };
        }
        return {
          cmd: "go",
          args: ["run", "./cmd/corechat", ...userArgs],
          cwd: res.siblingPath,
        };
      }
      return null;
    },
  },
  "trust:eval": {
    name: "trust:eval",
    alias: "trust",
    binary: "coreblow-trust",
    altBinary: "trust",
    siblingDir: "trust",
    installHint: "Install CoreBlow Trust evaluator or clone https://github.com/coreblow/trust",
    resolveCommand(res, userArgs) {
      if (res.onPath) {
        return { cmd: res.onPath, args: userArgs, cwd: process.cwd() };
      }
      if (res.siblingPath) {
        const binScript = path.join(res.siblingPath, "bin/trust-eval.mjs");
        if (fs.existsSync(binScript)) {
          return { cmd: process.execPath, args: [binScript, ...userArgs], cwd: res.siblingPath };
        }
      }
      return null;
    },
  },
  "rtt:probe": {
    name: "rtt:probe",
    alias: "coreblow-rtt",
    binary: "coreblow-rtt",
    altBinary: "rtt",
    siblingDir: "coreblow-rtt",
    installHint: "Install coreblow-rtt or clone https://github.com/coreblow/coreblow-rtt",
    resolveCommand(res, userArgs) {
      if (res.onPath) {
        return { cmd: res.onPath, args: userArgs, cwd: process.cwd() };
      }
      if (res.siblingPath) {
        const binScript = path.join(res.siblingPath, "bin/coreblow-rtt.mjs");
        if (fs.existsSync(binScript)) {
          return { cmd: process.execPath, args: [binScript, ...userArgs], cwd: res.siblingPath };
        }
      }
      return null;
    },
  },
  "bench:run": {
    name: "bench:run",
    alias: "corebench",
    binary: "corebench",
    siblingDir: "corebench",
    installHint: "Install corebench or clone https://github.com/coreblow/corebench",
    resolveCommand(res, userArgs) {
      if (res.onPath) {
        return { cmd: res.onPath, args: userArgs, cwd: process.cwd() };
      }
      if (res.siblingPath) {
        const binScript = path.join(res.siblingPath, "bin/corebench.mjs");
        if (fs.existsSync(binScript)) {
          return { cmd: process.execPath, args: [binScript, ...userArgs], cwd: res.siblingPath };
        }
      }
      return null;
    },
  },
  "corebox:run": {
    name: "corebox:run",
    alias: "corebox",
    binary: "corebox",
    siblingDir: "corebox",
    installHint: "Install corebox or clone https://github.com/coreblow/corebox",
    resolveCommand(res, userArgs) {
      if (res.onPath) {
        return { cmd: res.onPath, args: userArgs, cwd: process.cwd() };
      }
      if (res.siblingPath) {
        const binScript = path.join(res.siblingPath, "src/cli.mjs");
        if (fs.existsSync(binScript)) {
          return { cmd: process.execPath, args: [binScript, ...userArgs], cwd: res.siblingPath };
        }
      }
      return null;
    },
  },
  "dolphin:run": {
    name: "dolphin:run",
    alias: "dolphin",
    binary: "dolphin",
    siblingDir: "dolphin",
    installHint: "Install dolphin or clone https://github.com/coreblow/dolphin",
    resolveCommand(res, userArgs) {
      if (res.onPath) {
        return { cmd: res.onPath, args: userArgs, cwd: process.cwd() };
      }
      if (res.siblingPath) {
        const binScript = path.join(res.siblingPath, "src/cli.mjs");
        if (fs.existsSync(binScript)) {
          return { cmd: process.execPath, args: [binScript, ...userArgs], cwd: res.siblingPath };
        }
      }
      return null;
    },
  },
};

/**
 * Resolve a tool by script name or alias.
 */
export function resolveFleetTool(toolKey, options = {}) {
  const splitRoot = options.splitRoot ?? process.env.COREBLOW_SPLIT_ROOT ?? DEFAULT_SPLIT_ROOT;
  const pathEnv = options.pathEnv ?? process.env.PATH;

  // Search by exact key or alias
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

  // 1. Check binary on PATH
  const onPath = findBinaryOnPath(config.binary, pathEnv) || (config.altBinary ? findBinaryOnPath(config.altBinary, pathEnv) : null);

  // 2. Check sibling checkout
  const expectedSiblingPath = path.join(splitRoot, config.siblingDir);
  const siblingExists = fs.existsSync(expectedSiblingPath);
  const siblingPath = siblingExists ? expectedSiblingPath : null;

  const resolution = {
    status: onPath ? "path" : siblingPath ? "sibling" : "missing",
    config,
    onPath,
    siblingPath,
    expectedSiblingPath,
    installHint: config.installHint,
  };

  return resolution;
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
    "Active Resolution"
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
    console.log(
      key.padEnd(16) +
      pathStr.padEnd(20) +
      sibStr.padEnd(22) +
      statusStr
    );
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
      `Hint: ${resolution.installHint}`
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
