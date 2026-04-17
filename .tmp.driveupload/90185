/**
 * hooks/policy.ts — Hook invocation policy with precedence-based collision resolution.
 *
 * Mirrors CoreBlow's policy.ts: source-based precedence, enable/disable state
 * resolution, and deterministic hook deduplication across bundled, plugin,
 * managed, and workspace sources.
 */

import type { HookSource, HookEntry } from "./types.js";

// Re-export HookEntry as PolicyHookEntry for backwards compat with config.ts
export type PolicyHookEntry = HookEntry;

// ─── Types ──────────────────────────────────────────────────────────

export type { HookSource };

export type HookEnableStateReason = "disabled in config" | "workspace hook (disabled by default)";

export type HookEnableState = {
  enabled: boolean;
  reason?: HookEnableStateReason;
};

export type HookSourcePolicy = {
  precedence: number;
  trustedLocalCode: boolean;
  defaultEnableMode: "default-on" | "explicit-opt-in";
  canOverride: HookSource[];
  canBeOverriddenBy: HookSource[];
};

export type HookResolutionCollision = {
  name: string;
  kept: PolicyHookEntry;
  ignored: PolicyHookEntry;
};

export type HookConfig = {
  enabled?: boolean;
  env?: Record<string, string>;
};

export type CoreBlowHooksConfig = {
  hooks?: {
    internal?: {
      entries?: Record<string, HookConfig | undefined>;
    };
  };
};

// ─── Policy Definitions ─────────────────────────────────────────────

const HOOK_SOURCE_POLICIES: Record<HookSource, HookSourcePolicy> = {
  "coreblow-bundled": {
    precedence: 10,
    trustedLocalCode: true,
    defaultEnableMode: "default-on",
    canOverride: ["coreblow-bundled"],
    canBeOverriddenBy: ["coreblow-managed", "coreblow-plugin"],
  },
  "coreblow-plugin": {
    precedence: 20,
    trustedLocalCode: true,
    defaultEnableMode: "default-on",
    canOverride: ["coreblow-bundled", "coreblow-plugin"],
    canBeOverriddenBy: ["coreblow-managed"],
  },
  "coreblow-managed": {
    precedence: 30,
    trustedLocalCode: true,
    defaultEnableMode: "default-on",
    canOverride: ["coreblow-bundled", "coreblow-managed", "coreblow-plugin"],
    canBeOverriddenBy: ["coreblow-managed"],
  },
  "coreblow-workspace": {
    precedence: 40,
    trustedLocalCode: true,
    defaultEnableMode: "explicit-opt-in",
    canOverride: ["coreblow-workspace"],
    canBeOverriddenBy: ["coreblow-workspace"],
  },
};

/**
 * Get the source policy for a given hook source.
 */
export function getHookSourcePolicy(source: HookSource): HookSourcePolicy {
  return HOOK_SOURCE_POLICIES[source];
}

/**
 * Resolve the hook config entry for a given hook key from config.
 */
export function resolveHookConfig(
  config: CoreBlowHooksConfig | undefined,
  hookKey: string,
): HookConfig | undefined {
  const hooks = config?.hooks?.internal?.entries;
  if (!hooks || typeof hooks !== "object") return undefined;
  const entry = hooks[hookKey];
  if (!entry || typeof entry !== "object") return undefined;
  return entry;
}

/**
 * Determine whether a hook should be enabled based on its source policy and config.
 */
export function resolveHookEnableState(params: {
  entry: PolicyHookEntry;
  config?: CoreBlowHooksConfig;
  hookConfig?: HookConfig;
}): HookEnableState {
  const { entry, config } = params;
  const hookKey = entry.metadata?.hookKey ?? entry.hook.name;
  const hookConfig = params.hookConfig ?? resolveHookConfig(config, hookKey);

  // Plugin hooks are always enabled
  if (entry.hook.source === "coreblow-plugin") {
    return { enabled: true };
  }

  // Explicitly disabled in config
  if (hookConfig?.enabled === false) {
    return { enabled: false, reason: "disabled in config" };
  }

  // Workspace hooks require explicit opt-in
  const sourcePolicy = getHookSourcePolicy(entry.hook.source);
  if (sourcePolicy.defaultEnableMode === "explicit-opt-in" && hookConfig?.enabled !== true) {
    return { enabled: false, reason: "workspace hook (disabled by default)" };
  }

  return { enabled: true };
}

// ─── Collision Resolution ───────────────────────────────────────────

function canOverrideHook(candidate: PolicyHookEntry, existing: PolicyHookEntry): boolean {
  const candidatePolicy = getHookSourcePolicy(candidate.hook.source);
  const existingPolicy = getHookSourcePolicy(existing.hook.source);
  return (
    candidatePolicy.canOverride.includes(existing.hook.source) &&
    existingPolicy.canBeOverriddenBy.includes(candidate.hook.source)
  );
}

/**
 * Resolve hook entries by deduplicating based on source precedence.
 * When two hooks share the same name, the higher-precedence source wins
 * unless the lower one explicitly cannot be overridden.
 */
export function resolveHookEntries(
  entries: PolicyHookEntry[],
  opts?: {
    onCollisionIgnored?: (collision: HookResolutionCollision) => void;
  },
): PolicyHookEntry[] {
  const ordered = entries
    .map((entry, index) => ({ entry, index }))
    .slice()
    .sort((a, b) => {
      const precedenceDelta =
        getHookSourcePolicy(a.entry.hook.source).precedence -
        getHookSourcePolicy(b.entry.hook.source).precedence;
      return precedenceDelta !== 0 ? precedenceDelta : a.index - b.index;
    });

  const merged = new Map<string, PolicyHookEntry>();
  for (const { entry } of ordered) {
    const existing = merged.get(entry.hook.name);
    if (!existing) {
      merged.set(entry.hook.name, entry);
      continue;
    }
    if (canOverrideHook(entry, existing)) {
      merged.set(entry.hook.name, entry);
      continue;
    }
    opts?.onCollisionIgnored?.({
      name: entry.hook.name,
      kept: existing,
      ignored: entry,
    });
  }

  return Array.from(merged.values());
}
