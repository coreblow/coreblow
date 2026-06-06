import type { ConfigFileSnapshot, ConfigValidationIssue, LegacyConfigIssue } from "./types.js";

const PLUGIN_ENTRY_PATH_PREFIX = "plugins.entries.";
const PLUGIN_POLICY_PATHS = new Set(["plugins.allow", "plugins.deny"]);

function isPluginEntryIssue(issue: ConfigValidationIssue): boolean {
  const path = issue.path.trim();
  if (!path.startsWith(PLUGIN_ENTRY_PATH_PREFIX)) {
    return false;
  }
  return path.slice(PLUGIN_ENTRY_PATH_PREFIX.length).trim().length > 0;
}

function isPluginPolicyIssue(issue: ConfigValidationIssue): boolean {
  return (
    PLUGIN_POLICY_PATHS.has(issue.path.trim()) &&
    issue.message.trim().startsWith("plugin not found:")
  );
}

type RecoveryPolicySnapshot = Pick<ConfigFileSnapshot, "valid" | "issues"> & {
  legacyIssues?: LegacyConfigIssue[];
};

export function isPluginLocalInvalidConfigSnapshot(snapshot: RecoveryPolicySnapshot): boolean {
  if (snapshot.valid || (snapshot.legacyIssues?.length ?? 0) > 0 || snapshot.issues.length === 0) {
    return false;
  }
  return snapshot.issues.every((issue) => isPluginEntryIssue(issue) || isPluginPolicyIssue(issue));
}

export function shouldAttemptLastKnownGoodRecovery(snapshot: RecoveryPolicySnapshot): boolean {
  if (snapshot.valid) {
    return false;
  }
  return !isPluginLocalInvalidConfigSnapshot(snapshot);
}
