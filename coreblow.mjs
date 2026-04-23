#!/usr/bin/env node

/**
 * CoreBlow — CLI Launcher
 *
 * Entry-point wrapper that imports the compiled CLI from dist/.
 * Inspired by OpenClaw's openclaw.mjs pattern but written for CoreBlow's
 * consolidated source tree architecture:
 *
 * 1. Check Node.js version (22.12+ required)
 * 2. Enable compile cache (Node.js 22.1+)
 * 3. Install process warning filter
 * 4. Try to import dist/entry.js (compiled output)
 * 5. If dist/ is missing, provide helpful build instructions
 *
 * This file is the published CLI binary (`bin.coreblow` in package.json).
 * It must remain a plain .mjs file — no TypeScript, no build step.
 */

import { readFileSync } from "node:fs";
import { access } from "node:fs/promises";
import module from "node:module";
import { fileURLToPath } from "node:url";

const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR = 12;
const MIN_NODE_VERSION = `${MIN_NODE_MAJOR}.${MIN_NODE_MINOR}`;

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

ensureSupportedNodeVersion();

// ─── Compile Cache ───────────────────────────────────────────────
// https://nodejs.org/api/module.html#module-compile-cache

if (module.enableCompileCache && !process.env.NODE_DISABLE_COMPILE_CACHE) {
    try {
        module.enableCompileCache();
    } catch {
        // Ignore errors — compile cache is a performance hint, not required
    }
}

// ─── Module Resolution Helpers ───────────────────────────────────

const isModuleNotFoundError = (err) =>
    err && typeof err === "object" && "code" in err && err.code === "ERR_MODULE_NOT_FOUND";

const isDirectModuleNotFoundError = (err, specifier) => {
    if (!isModuleNotFoundError(err)) {
        return false;
    }

    const expectedUrl = new URL(specifier, import.meta.url);
    if ("url" in err && err.url === expectedUrl.href) {
        return true;
    }

    const message = "message" in err && typeof err.message === "string" ? err.message : "";
    const expectedPath = fileURLToPath(expectedUrl);
    return (
        message.includes(`Cannot find module '${expectedPath}'`) ||
        message.includes(`Cannot find module "${expectedPath}"`)
    );
};

// ─── Warning Filter ─────────────────────────────────────────────

const installProcessWarningFilter = async () => {
    // Suppress noisy Node.js deprecation/experimental warnings at startup.
    for (const specifier of ["./dist/infra/warning-filter.js", "./dist/infra/warning-filter.mjs"]) {
        try {
            const mod = await import(specifier);
            if (typeof mod.installProcessWarningFilter === "function") {
                mod.installProcessWarningFilter();
                return;
            }
        } catch (err) {
            if (isDirectModuleNotFoundError(err, specifier)) {
                continue;
            }
            // Swallow non-critical errors — warning filter is optional
        }
    }
};

// ─── Import Entry ────────────────────────────────────────────────

const tryImport = async (specifier) => {
    try {
        await import(specifier);
        return true;
    } catch (err) {
        // Only swallow direct entry misses; rethrow transitive resolution failures.
        if (isDirectModuleNotFoundError(err, specifier)) {
            return false;
        }
        throw err;
    }
};

const exists = async (specifier) => {
    try {
        await access(new URL(specifier, import.meta.url));
        return true;
    } catch {
        return false;
    }
};

const buildMissingEntryErrorMessage = async () => {
    const lines = ["coreblow: missing dist/entry.js (build output)."];
    if (!(await exists("./src/entry.ts"))) {
        return lines.join("\n");
    }

    lines.push("This install looks like an unbuilt source tree or GitHub source archive.");
    lines.push(
        "Build locally with `pnpm install && pnpm build`, or install a built package instead.",
    );
    lines.push("For releases, use `npm install -g coreblow@latest`.");
    return lines.join("\n");
};

// ─── Fast-path Helpers ───────────────────────────────────────────

const isBareRootHelpInvocation = (argv) =>
    argv.length === 3 && (argv[2] === "--help" || argv[2] === "-h");

const loadPrecomputedRootHelpText = () => {
    try {
        const raw = readFileSync(new URL("./dist/cli-startup-metadata.json", import.meta.url), "utf8");
        const parsed = JSON.parse(raw);
        return typeof parsed?.rootHelpText === "string" && parsed.rootHelpText.length > 0
            ? parsed.rootHelpText
            : null;
    } catch {
        return null;
    }
};

const tryOutputBareRootHelp = async () => {
    if (!isBareRootHelpInvocation(process.argv)) {
        return false;
    }
    const precomputed = loadPrecomputedRootHelpText();
    if (precomputed) {
        process.stdout.write(precomputed);
        return true;
    }
    return false;
};

// ─── Launch ──────────────────────────────────────────────────────

if (await tryOutputBareRootHelp()) {
    // OK — fast-path help text already printed
} else {
    await installProcessWarningFilter();
    if (await tryImport("./dist/entry.js")) {
        // OK — primary entry point loaded
    } else if (await tryImport("./dist/entry.mjs")) {
        // OK — alternative ESM entry loaded
    } else {
        throw new Error(await buildMissingEntryErrorMessage());
    }
}
