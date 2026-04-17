/**
 * hooks/config.ts — Hook configuration resolution and runtime eligibility.
 *
 * Determines whether a hook should be included at runtime based on:
 *   - Configuration enable/disable state
 *   - OS platform requirements
 *   - Environment variable requirements
 *   - Binary availability
 */

import {
  resolveHookConfig,
  resolveHookEnableState,
  type CoreBlowHooksConfig,
  type HookConfig,
  type PolicyHookEntry,
} from "./policy.js";

export { resolveHookConfig };

// ─── Runtime Eligibility ────────────────────────────────────────────

export type HookEligibilityContext = {
  remote?: {
    platforms: string[];
    hasBin: (bin: string) => boolean;
    hasAnyBin: (bins: string[]) => boolean;
    note?: string;
  };
};

/**
 * Check if a binary is available on the local system (PATH lookup).
 */
export function hasBinary(bin: string): boolean {
  try {
    const { execSync } = require("node:child_process");
    execSync(`which ${bin}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Evaluate whether a hook meets all runtime prerequisites:
 *   - OS platform match
 *   - Required environment variables present
 *   - Required binaries available
 */
function evaluateHookRuntimeEligibility(params: {
  entry: PolicyHookEntry;
  config?: CoreBlowHooksConfig;
  hookConfig?: HookConfig;
  eligibility?: HookEligibilityContext;
}): boolean {
  const { entry, hookConfig } = params;
  const meta = entry.metadata;

  // OS check
  if (meta?.os && meta.os.length > 0) {
    if (!meta.os.includes(process.platform)) {
      return false;
    }
  }

  // Environment variable check (config env can supplement process.env)
  const requires = (meta as Record<string, unknown> | undefined)?.requires as
    | { bins?: string[]; anyBins?: string[]; env?: string[]; config?: string[] }
    | undefined;

  if (requires?.env) {
    for (const envName of requires.env) {
      if (!process.env[envName] && !hookConfig?.env?.[envName]) {
        return false;
      }
    }
  }

  // Binary check
  if (requires?.bins) {
    for (const bin of requires.bins) {
      if (!hasBinary(bin)) return false;
    }
  }

  if (requires?.anyBins && requires.anyBins.length > 0) {
    if (!requires.anyBins.some(hasBinary)) return false;
  }

  return true;
}

/**
 * Determine if a hook should be included (both enabled and eligible).
 */
export function shouldIncludeHook(params: {
  entry: PolicyHookEntry;
  config?: CoreBlowHooksConfig;
  eligibility?: HookEligibilityContext;
}): boolean {
  const { entry, config, eligibility } = params;
  const hookConfig = resolveHookConfig(
    config,
    entry.metadata?.hookKey ?? entry.hook.name,
  );

  if (!resolveHookEnableState({ entry, config, hookConfig }).enabled) {
    return false;
  }

  return evaluateHookRuntimeEligibility({
    entry,
    config,
    hookConfig,
    eligibility,
  });
}
