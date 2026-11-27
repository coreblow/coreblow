/**
 * CoreFlow — 3-Tier Auto-Bypass Execution Router
 *
 * Classifies turn complexity so lightweight Q&A and small non-sensitive edits
 * bypass CoreFlow multi-agent overhead completely (Tier 0), medium edits run
 * verified single-agent with Gates 1-4 (Tier 1), and large/sensitive/untrusted
 * edits run isolated CoreFlow with Gates 1-4 + Gate 5 diff auditor (Tier 2).
 */

export type ExecutionTier = 0 | 1 | 2;

export type ExecutionTierMode =
  | "auto_bypass_single_agent"
  | "verified_single_agent"
  | "isolated_coreflow";

export interface ClassifyExecutionTierParams {
  readonly touchedFiles?: readonly string[];
  readonly totalLocChanged?: number;
  readonly isQuestionOnly?: boolean;
  readonly untrustedExecution?: boolean;
}

export interface ClassifyExecutionTierResult {
  readonly tier: ExecutionTier;
  readonly mode: ExecutionTierMode;
  readonly skipCoreFlow: boolean;
  readonly runDeterministicGates: boolean;
  readonly runDiffAuditorGate5: boolean;
  readonly sensitivePathsMatched: readonly string[];
  readonly reason: string;
}

const SENSITIVE_PATH_PREFIXES = [
  "src/security/",
  "src/auth/",
  ".github/workflows/",
] as const;

const SENSITIVE_EXACT_PATHS = new Set<string>(["package.json"]);

function normalizeRepoPath(filePath: string): string {
  return filePath.replaceAll("\\", "/").replace(/^\.\//, "").trim();
}

export function isSensitiveExecutionPath(filePath: string): boolean {
  const normalized = normalizeRepoPath(filePath);
  if (SENSITIVE_EXACT_PATHS.has(normalized) || normalized.endsWith("/package.json")) {
    return true;
  }
  return SENSITIVE_PATH_PREFIXES.some(
    (prefix) => normalized.startsWith(prefix) || normalized.includes(`/${prefix}`),
  );
}

export function classifyExecutionTier(
  params: ClassifyExecutionTierParams,
): ClassifyExecutionTierResult {
  const touchedFiles = (params.touchedFiles ?? []).map(normalizeRepoPath).filter(Boolean);
  const totalLocChanged = Math.max(0, params.totalLocChanged ?? 0);
  const isQuestionOnly = params.isQuestionOnly === true;
  const untrustedExecution = params.untrustedExecution === true;
  const sensitivePathsMatched = touchedFiles.filter((file) => isSensitiveExecutionPath(file));

  if (isQuestionOnly) {
    return {
      tier: 0,
      mode: "auto_bypass_single_agent",
      skipCoreFlow: true,
      runDeterministicGates: false,
      runDiffAuditorGate5: false,
      sensitivePathsMatched,
      reason: "Question-only turn bypasses CoreFlow and deterministic PR gates.",
    };
  }

  if (untrustedExecution || sensitivePathsMatched.length > 0 || touchedFiles.length > 8) {
    const reasons: string[] = [];
    if (untrustedExecution) reasons.push("untrusted execution");
    if (sensitivePathsMatched.length > 0) {
      reasons.push(`sensitive path(s): ${sensitivePathsMatched.join(", ")}`);
    }
    if (touchedFiles.length > 8) reasons.push(`${touchedFiles.length} files (> 8)`);
    return {
      tier: 2,
      mode: "isolated_coreflow",
      skipCoreFlow: false,
      runDeterministicGates: true,
      runDiffAuditorGate5: true,
      sensitivePathsMatched,
      reason: `Escalated to Tier 2 isolated CoreFlow (${reasons.join("; ")}).`,
    };
  }

  if (touchedFiles.length <= 2 && totalLocChanged < 50) {
    return {
      tier: 0,
      mode: "auto_bypass_single_agent",
      skipCoreFlow: true,
      runDeterministicGates: false,
      runDiffAuditorGate5: false,
      sensitivePathsMatched,
      reason: `Lightweight edit (${touchedFiles.length} file(s), ${totalLocChanged} LOC < 50) bypasses CoreFlow.`,
    };
  }

  return {
    tier: 1,
    mode: "verified_single_agent",
    skipCoreFlow: false,
    runDeterministicGates: true,
    runDiffAuditorGate5: false,
    sensitivePathsMatched,
    reason: `Medium edit (${touchedFiles.length} file(s), ${totalLocChanged} LOC) runs Tier 1 verified single-agent (Gates 1-4).`,
  };
}
