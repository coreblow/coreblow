/**
 * hooks/loader.ts — Dynamic hook loader.
 *
 * Mirrors CoreBlow's hooks/loader.ts:
 * - loadInternalHooks() — main entry point for loading all hooks
 * - Boundary-safe file loading
 * - Legacy config handler support
 * - Cache-busting for mutable (workspace/managed) hooks
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import { createChildLogger } from "../utils/logger.js";
import { shouldIncludeHook } from "./config.js";
import type { InternalHookHandler } from "./internal-hooks.js";
import { registerInternalHook } from "./internal-hooks.js";
import { loadWorkspaceHookEntries } from "./workspace.js";

const log = createChildLogger("hooks:loader");

/**
 * Resolve a module export as a function, matching CoreBlow's module-loader.ts.
 */
export function resolveFunctionModuleExport<T extends (...args: never[]) => unknown>(params: {
    mod: Record<string, unknown>;
    exportName?: string;
    fallbackExportNames?: string[];
}): T | undefined {
    const explicitExport = params.exportName?.trim();
    if (explicitExport) {
        const candidate = params.mod[explicitExport];
        return typeof candidate === "function" ? (candidate as T) : undefined;
    }
    const fallbacks = params.fallbackExportNames ?? ["default"];
    for (const exportName of fallbacks) {
        const candidate = params.mod[exportName];
        if (typeof candidate === "function") {
            return candidate as T;
        }
    }
    return undefined;
}

/**
 * Build an import URL for a handler module.
 * Mutable sources (workspace, managed) get cache-busting timestamps.
 */
export function buildImportUrl(
    handlerPath: string,
    source: string,
): string {
    const url = pathToFileURL(handlerPath).href;
    const mutableSources = ["coreblow-workspace", "coreblow-managed"];
    if (mutableSources.includes(source)) {
        return `${url}?t=${Date.now()}`;
    }
    return url;
}

/**
 * Safely resolve a real path, returning null if it doesn't exist.
 */
function resolveExistingRealpath(value: string): string | null {
    try {
        return fs.realpathSync(value);
    } catch {
        return null;
    }
}

/**
 * Load and register all hook handlers from directory-based discovery.
 *
 * @param workspaceDir - Workspace directory for hook discovery
 * @param opts - Optional overrides for managed/bundled hook directories
 * @returns Number of handlers successfully loaded
 */
export async function loadInternalHooks(
    workspaceDir: string,
    opts?: {
        managedHooksDir?: string;
        bundledHooksDir?: string;
        hooksEnabled?: boolean;
    },
): Promise<number> {
    if (opts?.hooksEnabled === false) {
        return 0;
    }

    let loadedCount = 0;

    try {
        const hookEntries = loadWorkspaceHookEntries(workspaceDir, {
            managedHooksDir: opts?.managedHooksDir,
            bundledHooksDir: opts?.bundledHooksDir,
        });

        // Filter by eligibility
        const eligible = hookEntries.filter((entry) => shouldIncludeHook({ entry }));

        for (const entry of eligible) {
            try {
                const hookBaseDir = resolveExistingRealpath(entry.hook.baseDir);
                if (!hookBaseDir) {
                    log.error(
                        { hookName: entry.hook.name, dir: entry.hook.baseDir },
                        "Hook base directory is no longer readable",
                    );
                    continue;
                }

                // Verify handler exists
                if (!fs.existsSync(entry.hook.handlerPath)) {
                    log.error(
                        { hookName: entry.hook.name, handler: entry.hook.handlerPath },
                        "Hook handler file not found",
                    );
                    continue;
                }

                // Import handler module — cache-bust mutable hooks
                const importUrl = buildImportUrl(entry.hook.handlerPath, entry.hook.source);
                const mod = (await import(importUrl)) as Record<string, unknown>;

                // Get handler function
                const exportName = entry.metadata?.export ?? "default";
                const handler = resolveFunctionModuleExport<InternalHookHandler>({
                    mod,
                    exportName,
                });

                if (!handler) {
                    log.error(
                        { hookName: entry.hook.name, exportName },
                        "Handler export is not a function",
                    );
                    continue;
                }

                // Register for all events
                const events = entry.metadata?.events ?? [];
                if (events.length === 0) {
                    log.warn({ hookName: entry.hook.name }, "Hook has no events defined");
                    continue;
                }

                for (const event of events) {
                    registerInternalHook(event, handler);
                }

                log.info(
                    { hookName: entry.hook.name, events, source: entry.hook.source },
                    "Registered hook",
                );
                loadedCount++;
            } catch (err) {
                log.error(
                    { hookName: entry.hook.name, err: err instanceof Error ? err.message : String(err) },
                    "Failed to load hook",
                );
            }
        }
    } catch (err) {
        log.error(
            { err: err instanceof Error ? err.message : String(err) },
            "Failed to load directory-based hooks",
        );
    }

    return loadedCount;
}
