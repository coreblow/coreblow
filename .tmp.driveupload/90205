/**
 * hooks/hooks-status.ts — Hook status report builder.
 *
 * Generates a comprehensive snapshot of all hooks in the workspace:
 * their enable state, requirements satisfaction, and blocked reasons.
 */

import * as path from "node:path";
import * as os from "node:os";
import {
  resolveHookConfig,
  resolveHookEnableState,
  resolveHookEntries,
  type CoreBlowHooksConfig,
  type HookEnableStateReason,
  type PolicyHookEntry,
} from "./policy.js";
import { type HookEligibilityContext, hasBinary } from "./config.js";

// ─── Types ──────────────────────────────────────────────────────────

export type HookStatusConfigCheck = {
  path: string;
  satisfied: boolean;
};

export type HookInstallOption = {
  id: string;
  kind: "bundled" | "npm" | "git";
  label: string;
  bins: string[];
};

export type HookStatusEntry = {
  name: string;
  description: string;
  source: string;
  pluginId?: string;
  filePath: string;
  baseDir: string;
  handlerPath: string;
  hookKey: string;
  emoji?: string;
  homepage?: string;
  events: string[];
  always: boolean;
  enabledByConfig: boolean;
  requirementsSatisfied: boolean;
  loadable: boolean;
  blockedReason?: HookEnableStateReason | "missing requirements";
  managedByPlugin: boolean;
};

export type HookStatusReport = {
  workspaceDir: string;
  managedHooksDir: string;
  hooks: HookStatusEntry[];
};

// ─── Builder ────────────────────────────────────────────────────────

function resolveHookKey(entry: PolicyHookEntry): string {
  return entry.metadata?.hookKey ?? entry.hook.name;
}

function buildHookStatus(
  entry: PolicyHookEntry,
  config?: CoreBlowHooksConfig,
): HookStatusEntry {
  const hookKey = resolveHookKey(entry);
  const hookConfig = resolveHookConfig(config, hookKey);
  const managedByPlugin = entry.hook.source === "coreblow-plugin";
  const enableState = resolveHookEnableState({ entry, config, hookConfig });
  const always = entry.metadata?.always === true;
  const events = entry.metadata?.events ?? [];

  // Check binary requirements
  const requires = (entry.metadata as Record<string, unknown> | undefined)?.requires as
    | { bins?: string[]; env?: string[] }
    | undefined;

  let requirementsSatisfied = true;
  if (requires?.bins) {
    for (const bin of requires.bins) {
      if (!hasBinary(bin)) {
        requirementsSatisfied = false;
        break;
      }
    }
  }
  if (requires?.env) {
    for (const envName of requires.env) {
      if (!process.env[envName] && !hookConfig?.env?.[envName]) {
        requirementsSatisfied = false;
        break;
      }
    }
  }

  const enabledByConfig = enableState.enabled;
  const loadable = enabledByConfig && requirementsSatisfied;
  const blockedReason =
    enableState.reason ?? (requirementsSatisfied ? undefined : "missing requirements");

  return {
    name: entry.hook.name,
    description: entry.hook.description,
    source: entry.hook.source,
    pluginId: entry.hook.pluginId,
    filePath: entry.hook.filePath,
    baseDir: entry.hook.baseDir,
    handlerPath: entry.hook.handlerPath,
    hookKey,
    emoji: entry.metadata?.emoji,
    homepage: entry.metadata?.homepage,
    events,
    always,
    enabledByConfig,
    requirementsSatisfied,
    loadable,
    blockedReason,
    managedByPlugin,
  };
}

/**
 * Build a hook status report for a workspace.
 */
export function buildWorkspaceHookStatus(
  workspaceDir: string,
  opts?: {
    config?: CoreBlowHooksConfig;
    managedHooksDir?: string;
    entries?: PolicyHookEntry[];
    eligibility?: HookEligibilityContext;
  },
): HookStatusReport {
  const configDir = process.env.COREBLOW_CONFIG_DIR ?? path.join(os.homedir(), ".coreblow");
  const managedHooksDir = opts?.managedHooksDir ?? path.join(configDir, "hooks");
  const hookEntries = resolveHookEntries(opts?.entries ?? []);

  return {
    workspaceDir,
    managedHooksDir,
    hooks: hookEntries.map((entry) => buildHookStatus(entry, opts?.config)),
  };
}
