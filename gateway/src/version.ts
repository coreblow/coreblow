/**
 * CoreBlow — Version Resolution
 *
 * Single source of truth for the current CoreBlow version.
 * Follows OpenClaw's multi-source version resolution chain:
 *
 * 1. Bundled define (__COREBLOW_VERSION__) — injected at build time
 * 2. package.json — traverses parent directories to find name="coreblow"
 * 3. build-info.json — CI/CD generated artifact
 * 4. COREBLOW_BUNDLED_VERSION env — Docker/runtime override
 * 5. Fallback: "0.0.0"
 *
 * @packageDocumentation
 */

import { createRequire } from 'node:module';

declare const __COREBLOW_VERSION__: string | undefined;
const CORE_PACKAGE_NAME = 'coreblow';

const PACKAGE_JSON_CANDIDATES = [
    '../package.json',
    '../../package.json',
    '../../../package.json',
    './package.json',
] as const;

const BUILD_INFO_CANDIDATES = [
    '../build-info.json',
    '../../build-info.json',
    './build-info.json',
] as const;

// ─── Internal Helpers ────────────────────────────────────────────

function readVersionFromJsonCandidates(
    moduleUrl: string,
    candidates: readonly string[],
    opts: { requirePackageName?: boolean } = {},
): string | null {
    try {
        const require = createRequire(moduleUrl);
        for (const candidate of candidates) {
            try {
                const parsed = require(candidate) as { name?: string; version?: string };
                const version = parsed.version?.trim();
                if (!version) {
                    continue;
                }
                if (opts.requirePackageName && parsed.name !== CORE_PACKAGE_NAME) {
                    continue;
                }
                return version;
            } catch {
                // ignore missing or unreadable candidate
            }
        }
        return null;
    } catch {
        return null;
    }
}

function firstNonEmpty(...values: Array<string | undefined>): string | undefined {
    for (const value of values) {
        const trimmed = value?.trim();
        if (trimmed) {
            return trimmed;
        }
    }
    return undefined;
}

// ─── Public API ──────────────────────────────────────────────────

/**
 * Read version from the closest package.json that has name="coreblow".
 */
export function readVersionFromPackageJsonForModuleUrl(moduleUrl: string): string | null {
    return readVersionFromJsonCandidates(moduleUrl, PACKAGE_JSON_CANDIDATES, {
        requirePackageName: true,
    });
}

/**
 * Read version from build-info.json (CI artifact).
 */
export function readVersionFromBuildInfoForModuleUrl(moduleUrl: string): string | null {
    return readVersionFromJsonCandidates(moduleUrl, BUILD_INFO_CANDIDATES);
}

/**
 * Resolve version from module URL — tries package.json then build-info.json.
 */
export function resolveVersionFromModuleUrl(moduleUrl: string): string | null {
    return (
        readVersionFromPackageJsonForModuleUrl(moduleUrl) ||
        readVersionFromBuildInfoForModuleUrl(moduleUrl)
    );
}

/**
 * Resolve the binary version using a priority chain.
 * Follows OpenClaw's resolveBinaryVersion pattern.
 */
export function resolveBinaryVersion(params: {
    moduleUrl: string;
    injectedVersion?: string;
    bundledVersion?: string;
    fallback?: string;
}): string {
    return (
        firstNonEmpty(params.injectedVersion) ||
        resolveVersionFromModuleUrl(params.moduleUrl) ||
        firstNonEmpty(params.bundledVersion) ||
        params.fallback ||
        '0.0.0'
    );
}

// ─── Runtime Version (for health endpoints / Docker) ─────────────

export type RuntimeVersionEnv = {
    [key: string]: string | undefined;
};

export const RUNTIME_SERVICE_VERSION_FALLBACK = 'unknown';

/**
 * Check if a version string is usable (not "0.0.0" / empty).
 */
export function resolveUsableRuntimeVersion(version: string | undefined): string | undefined {
    const trimmed = version?.trim();
    // "0.0.0" is the resolver's hard fallback when module metadata cannot be read.
    if (!trimmed || trimmed === '0.0.0') {
        return undefined;
    }
    return trimmed;
}

/**
 * Resolve the runtime service version.
 * Used by health endpoints, Docker monitoring, and version headers.
 */
export function resolveRuntimeServiceVersion(
    env: RuntimeVersionEnv = process.env as RuntimeVersionEnv,
    fallback = RUNTIME_SERVICE_VERSION_FALLBACK,
): string {
    return (
        firstNonEmpty(
            env['COREBLOW_VERSION'],
            resolveUsableRuntimeVersion(VERSION),
            env['COREBLOW_SERVICE_VERSION'],
            env['npm_package_version'],
        ) ?? fallback
    );
}

// ─── Singleton Export ────────────────────────────────────────────

/**
 * The resolved current CoreBlow version.
 *
 * Priority:
 *   1. __COREBLOW_VERSION__ define (build-time injection)
 *   2. package.json (npm install)
 *   3. build-info.json (CI artifact)
 *   4. COREBLOW_BUNDLED_VERSION env (Docker override)
 *   5. "0.0.0" fallback
 */
export const VERSION = resolveBinaryVersion({
    moduleUrl: import.meta.url,
    injectedVersion: typeof __COREBLOW_VERSION__ === 'string' ? __COREBLOW_VERSION__ : undefined,
    bundledVersion: process.env.COREBLOW_BUNDLED_VERSION,
});
