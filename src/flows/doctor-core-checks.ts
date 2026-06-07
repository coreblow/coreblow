import { resolveAgentWorkspaceDir, resolveDefaultAgentId } from "../agents/agent-scope.js";
import { buildWorkspaceSkillStatus, type SkillStatusEntry } from "../agents/skills-status.js";
import type { ConfigValidationIssue, CoreBlowConfig } from "../config/config.js";
import { hasAmbiguousGatewayAuthModeConfig } from "../gateway/auth-mode-policy.js";
import { registerHealthCheck } from "./health-check-registry.js";
import type { HealthCheck, HealthFinding } from "./health-checks.js";

const FINAL_CONFIG_VALIDATION_CHECK_ID = "core/doctor/final-config-validation";

export function configValidationIssuesToHealthFindings(
  issues: readonly ConfigValidationIssue[],
): readonly HealthFinding[] {
  return issues.map((issue) => ({
    checkId: FINAL_CONFIG_VALIDATION_CHECK_ID,
    severity: "error",
    message: issue.message,
    path: issue.path || "<root>",
  }));
}

const gatewayConfigCheck: HealthCheck = {
  id: "core/doctor/gateway-config",
  kind: "core",
  description: "coreblow.json gateway block is set and unambiguous.",
  source: "doctor",
  async detect(ctx) {
    const findings: HealthFinding[] = [];
    if (!ctx.cfg.gateway?.mode) {
      findings.push({
        checkId: "core/doctor/gateway-config",
        severity: "warning",
        message: "gateway.mode is unset; gateway start will be blocked.",
        path: "gateway.mode",
        fixHint:
          "Run `coreblow configure` and set Gateway mode, or `coreblow config set gateway.mode local`.",
      });
    }
    if (ctx.cfg.gateway?.mode !== "remote" && hasAmbiguousGatewayAuthModeConfig(ctx.cfg)) {
      findings.push({
        checkId: "core/doctor/gateway-config",
        severity: "warning",
        message:
          "gateway.auth.token and gateway.auth.password are both configured while gateway.auth.mode is unset; auth selection is ambiguous.",
        path: "gateway.auth.mode",
        fixHint:
          "Set an explicit mode: `coreblow config set gateway.auth.mode token` or `coreblow config set gateway.auth.mode password`.",
      });
    }
    return findings;
  },
};

const workspaceStatusCheck: HealthCheck = {
  id: "core/doctor/workspace-status",
  kind: "core",
  description: "Workspace directory exists and has no legacy duplicates.",
  source: "doctor",
  async detect(ctx) {
    const { detectLegacyWorkspaceDirs } = await import("../commands/doctor-workspace.js");
    const workspaceDir = resolveAgentWorkspaceDir(ctx.cfg, resolveDefaultAgentId(ctx.cfg));
    const legacy = detectLegacyWorkspaceDirs({ workspaceDir });
    if (legacy.legacyDirs.length === 0) {
      return [];
    }
    return [
      {
        checkId: "core/doctor/workspace-status",
        severity: "info",
        message: `Detected ${legacy.legacyDirs.length} legacy workspace director${
          legacy.legacyDirs.length === 1 ? "y" : "ies"
        } alongside the active workspace.`,
        path: workspaceDir,
        fixHint: "Inspect the legacy directories and migrate or remove them.",
      },
    ];
  },
};

const skillsReadinessCheck: HealthCheck = {
  id: "core/doctor/skills-readiness",
  kind: "core",
  description: "Allowed skills are usable in the current runtime environment.",
  source: "doctor",
  async detect(ctx, scope) {
    const unavailable = filterUnavailableSkillsForScope(
      detectUnavailableSkills(ctx.cfg),
      scope?.paths,
    );
    return unavailable.map(unavailableSkillToFinding);
  },
};

const finalConfigValidationCheck: HealthCheck = {
  id: FINAL_CONFIG_VALIDATION_CHECK_ID,
  kind: "core",
  description: "Active coreblow.json parses and conforms to the config schema.",
  source: "doctor",
  async detect() {
    const { readConfigFileSnapshot } = await import("../config/config.js");
    const snap = await readConfigFileSnapshot();
    if (!snap.exists || snap.valid) {
      return [];
    }
    return configValidationIssuesToHealthFindings(snap.issues);
  },
};

let registered = false;

export function registerCoreHealthChecks(): void {
  if (registered) {
    return;
  }
  for (const check of CORE_HEALTH_CHECKS) {
    registerHealthCheck(check);
  }
  registered = true;
}

export function resetCoreHealthChecksForTest(): void {
  registered = false;
}

export const CORE_HEALTH_CHECKS: readonly HealthCheck[] = [
  gatewayConfigCheck,
  workspaceStatusCheck,
  skillsReadinessCheck,
  finalConfigValidationCheck,
];

function detectUnavailableSkills(cfg: CoreBlowConfig): SkillStatusEntry[] {
  const agentId = resolveDefaultAgentId(cfg);
  const workspaceDir = resolveAgentWorkspaceDir(cfg, agentId);
  const report = buildWorkspaceSkillStatus(workspaceDir, { config: cfg });
  return report.skills.filter(
    (skill) => !skill.eligible && !skill.disabled && !skill.blockedByAllowlist,
  );
}

function unavailableSkillToFinding(skill: SkillStatusEntry): HealthFinding {
  return {
    checkId: "core/doctor/skills-readiness",
    severity: "warning",
    message: `${skill.name} is allowed but unavailable: ${formatMissingSkillSummary(skill)}.`,
    path: `skills.entries.${skill.skillKey}.enabled`,
    fixHint: "Install/configure the missing requirement, or disable the unavailable skill.",
  };
}

function filterUnavailableSkillsForScope(
  unavailable: readonly SkillStatusEntry[],
  paths: readonly (string | undefined)[] | undefined,
): SkillStatusEntry[] {
  const scopedPaths = new Set(paths?.filter((path): path is string => path !== undefined) ?? []);
  if (scopedPaths.size === 0) {
    return [...unavailable];
  }
  return unavailable.filter((skill) => scopedPaths.has(`skills.entries.${skill.skillKey}.enabled`));
}

function formatMissingSkillSummary(skill: SkillStatusEntry): string {
  const missing: string[] = [];
  if (skill.missing.bins.length > 0) {
    missing.push(`bins: ${skill.missing.bins.join(", ")}`);
  }
  if (skill.missing.anyBins.length > 0) {
    missing.push(`any bins: ${skill.missing.anyBins.join(", ")}`);
  }
  if (skill.missing.env.length > 0) {
    missing.push(`env: ${skill.missing.env.join(", ")}`);
  }
  if (skill.missing.config.length > 0) {
    missing.push(`config: ${skill.missing.config.join(", ")}`);
  }
  if (skill.missing.os.length > 0) {
    missing.push(`os: ${skill.missing.os.join(", ")}`);
  }
  return missing.join("; ") || "unknown requirement";
}
