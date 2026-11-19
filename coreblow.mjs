#!/usr/bin/env node

/**
 * CoreBlow — CLI Launcher
 *
 * Spawns tsx to run the TypeScript entry point directly from src/.
 * CoreBlow ships source .ts files and runs them via tsx at runtime.
 * No build step / dist/ directory is required.
 *
 * 1. Check Node.js version (22.12+ required)
 * 2. Enable compile cache (Node.js 22.1+)
 * 3. Spawn tsx with src/entry.ts, forwarding all arguments
 *
 * This file is the published CLI binary (`bin.coreblow` in package.json).
 * It must remain a plain .mjs file — no TypeScript, no build step.
 */

import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import module from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 12;
const MIN_NODE_VERSION = `${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}`;

// ─── Child Environment Builder ─────────────────────────────────────

export const buildChildEnv = (baseEnv = process.env) => {
    const childEnv = { ...baseEnv };
    const currentOptions = childEnv.NODE_OPTIONS || "";
    if (!currentOptions.includes("DEP0040") && !currentOptions.includes("--no-deprecation")) {
        childEnv.NODE_OPTIONS = currentOptions
            ? `${currentOptions} --disable-warning=DEP0040`
            : "--disable-warning=DEP0040";
    }
    const tsconfigPath = resolve(__dirname, "tsconfig.json");
    if (!childEnv.TSX_TSCONFIG_PATH && existsSync(tsconfigPath)) {
        childEnv.TSX_TSCONFIG_PATH = tsconfigPath;
    }
    return childEnv;
};

// ─── Direct Run Check ──────────────────────────────────────────────

export const isDirectRun = (argv1 = process.argv[1]) => {
    if (!argv1 || process.env.VITEST) return false;
    try {
        if (resolve(argv1) === resolve(__filename)) return true;
        return realpathSync(argv1) === realpathSync(__filename);
    } catch {
        return false;
    }
};

// ─── Node Version Check ──────────────────────────────────────────

const parseNodeVersion = (rawVersion) => {
    const [majorRaw = "0", minorRaw = "0"] = rawVersion.split(".");
    return {
        major: Number(majorRaw),
        minor: Number(minorRaw),
    };
};

const isSupportedNodeVersion = (version) =>
    version.major > MIN_NODE_MAJOR ||
    (version.major === MIN_NODE_MAJOR && version.minor >= MIN_NODE_MINOR);

const ensureSupportedNodeVersion = () => {
    if (isSupportedNodeVersion(parseNodeVersion(process.versions.node))) {
        return;
    }

    process.stderr.write(
        `coreblow: Node.js v${MIN_NODE_VERSION}+ is required (current: v${process.versions.node}).\n` +
        "If you use nvm, run:\n" +
        `  nvm install ${MIN_NODE_MAJOR}\n` +
        `  nvm use ${MIN_NODE_MAJOR}\n` +
        `  nvm alias default ${MIN_NODE_MAJOR}\n`,
    );
    process.exit(1);
};

// ─── Launcher Main ────────────────────────────────────────────────

function run() {
    ensureSupportedNodeVersion();

    // Enable Compile Cache (Node.js 22.1+)
    if (module.enableCompileCache && !process.env.NODE_DISABLE_COMPILE_CACHE) {
        try {
            module.enableCompileCache();
        } catch {
            // Ignore errors — compile cache is a performance hint, not required
        }
    }

    const entryFile = resolve(__dirname, "src", "entry.ts");

    if (!existsSync(entryFile)) {
        process.stderr.write(
            "coreblow: src/entry.ts not found.\n" +
            "This install appears to be incomplete.\n" +
            "Reinstall with: pnpm install\n",
        );
        process.exit(1);
    }

    const userArgs = process.argv.slice(2);
    const childEnv = buildChildEnv(process.env);

    // Strategy 1: local node_modules/.bin/tsx
    const tsxBin = join(__dirname, "node_modules", ".bin", "tsx");
    const tsconfigPath = resolve(__dirname, "tsconfig.json");
    const tsxArgs = existsSync(tsconfigPath)
        ? ["--tsconfig", tsconfigPath, entryFile, ...userArgs]
        : [entryFile, ...userArgs];

    if (existsSync(tsxBin)) {
        const child = spawn(tsxBin, tsxArgs, {
            stdio: "inherit",
            env: childEnv,
            cwd: process.cwd(),
        });

        child.on("error", (err) => {
            process.stderr.write(`coreblow: failed to spawn tsx: ${err.message}\n`);
            process.exit(1);
        });

        child.on("exit", (code, signal) => {
            if (signal) {
                process.kill(process.pid, signal);
            } else {
                process.exit(code ?? 1);
            }
        });
    } else {
        // Strategy 2: try node --import tsx/esm (works when tsx is resolvable)
        let tsxResolvable = false;
        try {
            import.meta.resolve("tsx/esm");
            tsxResolvable = true;
        } catch {
            // tsx/esm not resolvable
        }

        if (tsxResolvable) {
            const child = spawn(process.execPath, ["--import", "tsx/esm", entryFile, ...userArgs], {
                stdio: "inherit",
                env: childEnv,
                cwd: process.cwd(),
            });

            child.on("error", (err) => {
                process.stderr.write(`coreblow: failed to spawn node with tsx: ${err.message}\n`);
                process.exit(1);
            });

            child.on("exit", (code, signal) => {
                if (signal) {
                    process.kill(process.pid, signal);
                } else {
                    process.exit(code ?? 1);
                }
            });
        } else {
            process.stderr.write(
                "coreblow: tsx not found.\n" +
                "tsx is required to run CoreBlow from source.\n" +
                "\n" +
                "Install it with:\n" +
                "  pnpm install\n" +
                "\n" +
                "Or install tsx globally:\n" +
                "  npm install -g tsx\n",
            );
            process.exit(1);
        }
    }
}

if (isDirectRun()) {
    run();
}
