#!/usr/bin/env node

/**
 * CoreBlow — CLI Launcher
 *
 * Production installs execute pre-built dist/entry.js directly in-process
 * (zero tsx JIT transpilation overhead).
 * Development checkouts with COREBLOW_DEV=1 (or when dist/entry.js is absent)
 * fall back to tsx with src/entry.ts.
 *
 * This file is the published CLI binary (`bin.coreblow` in package.json).
 * It must remain a plain .mjs file — no TypeScript, no build step.
 */

import { spawn } from "node:child_process";
import { existsSync, realpathSync } from "node:fs";
import module from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 12;
const MIN_NODE_VERSION = `${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}`;

// ─── Entrypoint & Child Environment Resolvers ───────────────────────

export const resolveDistEntry = (baseDir = __dirname) => {
    const candidate = resolve(baseDir, "dist", "entry.js");
    return existsSync(candidate) ? candidate : null;
};

export const resolveTsxBin = (baseDir = __dirname) => {
    const localBin = join(baseDir, "node_modules", ".bin", "tsx");
    if (existsSync(localBin)) return localBin;
    const hoistedBin = join(baseDir, "..", ".bin", "tsx");
    if (existsSync(hoistedBin)) return hoistedBin;
    return null;
};

export const resolveTsxEsmUrl = (specifier = "tsx/esm") => {
    try {
        return import.meta.resolve(specifier);
    } catch {
        return null;
    }
};

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

export const forwardSignalsToChild = (child) => {
    const forwardSignal = (signal) => {
        if (!child.killed && child.exitCode === null && child.signalCode === null) {
            try {
                child.kill(signal);
            } catch {
                // Ignore kill errors if child has already exited
            }
        }
    };

    const sigtermHandler = () => forwardSignal("SIGTERM");
    const sigintHandler = () => forwardSignal("SIGINT");

    process.on("SIGTERM", sigtermHandler);
    process.on("SIGINT", sigintHandler);

    const cleanup = () => {
        process.off("SIGTERM", sigtermHandler);
        process.off("SIGINT", sigintHandler);
    };

    child.on("exit", cleanup);
    child.on("error", cleanup);

    return cleanup;
};

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

async function run() {
    ensureSupportedNodeVersion();

    const useDevSource = process.env.COREBLOW_DEV === "1";
    const distEntry = useDevSource ? null : resolveDistEntry(__dirname);
    const isSourceCheckout =
        existsSync(resolve(__dirname, ".git")) || existsSync(resolve(__dirname, "src", "entry.ts"));

    // Enable V8 compile cache in packaged installs before loading dist/entry.js.
    if (!isSourceCheckout && module.enableCompileCache && !process.env.NODE_DISABLE_COMPILE_CACHE) {
        try {
            module.enableCompileCache();
        } catch {
            // Ignore errors — compile cache is a performance hint, not required
        }
    }

    if (distEntry) {
        // In-process warning filter inside dist/entry.js suppresses SQLite/DEP warnings
        // cleanly without spawning a redundant child process.
        if (!process.env.COREBLOW_NODE_OPTIONS_READY) {
            process.env.COREBLOW_NODE_OPTIONS_READY = "1";
        }
        try {
            await import(pathToFileURL(distEntry).href);
        } catch (err) {
            process.stderr.write(
                `coreblow: failed to run ${distEntry}: ${err instanceof Error ? err.message : String(err)}\n`,
            );
            process.exit(1);
        }
        return;
    }

    const entryFile = resolve(__dirname, "src", "entry.ts");

    if (!existsSync(entryFile)) {
        process.stderr.write(
            "coreblow: dist/entry.js and src/entry.ts not found.\n" +
            "This install appears to be incomplete.\n" +
            "Reinstall with: npm install -g coreblow\n",
        );
        process.exit(1);
    }

    const userArgs = process.argv.slice(2);
    const childEnv = buildChildEnv(process.env);

    // Strategy 1: local node_modules/.bin/tsx or hoisted ../.bin/tsx
    const tsxBin = resolveTsxBin(__dirname);
    const tsconfigPath = resolve(__dirname, "tsconfig.json");
    const tsxArgs = existsSync(tsconfigPath)
        ? ["--tsconfig", tsconfigPath, entryFile, ...userArgs]
        : [entryFile, ...userArgs];

    if (tsxBin) {
        const child = spawn(tsxBin, tsxArgs, {
            stdio: "inherit",
            env: childEnv,
            cwd: process.cwd(),
        });
        forwardSignalsToChild(child);

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
        // Strategy 2: try node --import <tsxEsmUrl> with resolved absolute file URL
        const tsxEsmUrl = resolveTsxEsmUrl("tsx/esm");

        if (tsxEsmUrl) {
            const child = spawn(process.execPath, ["--import", tsxEsmUrl, entryFile, ...userArgs], {
                stdio: "inherit",
                env: childEnv,
                cwd: process.cwd(),
            });
            forwardSignalsToChild(child);

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
    void run();
}
