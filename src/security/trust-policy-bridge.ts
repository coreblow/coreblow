import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { CoreBlowConfig } from "../config/config.js";
import type { SecurityAuditFinding, SecurityAuditSeverity } from "./audit.js";

const DEFAULT_TRUST_TIMEOUT_MS = 5_000;
const MAX_PAYLOAD_BYTES = 32_768;

export type TrustBundleInfo = {
  product?: string;
  framework: string;
  version: string;
  ruleCount: number;
  severities?: Record<string, number>;
  ruleIds?: string[];
};

export type TrustPolicyViolation = {
  id: string;
  category: string;
  severity: string;
  owner?: string;
  summary: string;
  remediation?: string;
};

export type TrustPolicyEvaluationSummary = {
  status: "evaluated" | "skipped" | "error";
  binary?: string;
  framework?: string;
  bundleVersion?: string;
  ruleCount?: number;
  pass?: boolean;
  highestSeverity?: string;
  violationCount?: number;
  reason?: string;
};

export type TrustPolicyBridgeResult = {
  summary: TrustPolicyEvaluationSummary;
  findings: SecurityAuditFinding[];
};

type ExecTrustResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  errorMessage?: string;
};

function isExecutableFile(filePath: string, platform: NodeJS.Platform): boolean {
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return false;
    }
    if (platform === "win32") {
      return true;
    }
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolves `coreblow-trust` from `COREBLOW_TRUST_BIN` or `$PATH`.
 * Returns `null` when unavailable so standalone npm installs degrade gracefully.
 */
export function resolveCoreBlowTrustBinary(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): string | null {
  const override = env.COREBLOW_TRUST_BIN?.trim();
  if (override) {
    return override;
  }

  const pathEnv = env.PATH ?? "";
  if (!pathEnv) {
    return null;
  }

  const candidates =
    platform === "win32"
      ? ["coreblow-trust.cmd", "coreblow-trust.exe", "coreblow-trust"]
      : ["coreblow-trust"];

  for (const dir of pathEnv.split(path.delimiter)) {
    const trimmedDir = dir.trim();
    if (!trimmedDir) {
      continue;
    }
    for (const binName of candidates) {
      const candidate = path.join(trimmedDir, binName);
      if (isExecutableFile(candidate, platform)) {
        return candidate;
      }
    }
  }

  return null;
}

function execTrustCli(
  binary: string,
  args: string[],
  timeoutMs: number,
  env: NodeJS.ProcessEnv,
): Promise<ExecTrustResult> {
  return new Promise((resolve) => {
    execFile(
      binary,
      args,
      {
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
        env,
        shell: false,
      },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({
            exitCode: 0,
            stdout: String(stdout ?? ""),
            stderr: String(stderr ?? ""),
            timedOut: false,
          });
          return;
        }
        const errObj = error as NodeJS.ErrnoException & {
          killed?: boolean;
          signal?: string;
          code?: string | number;
        };
        const timedOut = Boolean(errObj.killed) || errObj.signal === "SIGTERM";
        const exitCode = typeof errObj.code === "number" ? errObj.code : 1;
        resolve({
          exitCode,
          stdout: String(stdout ?? ""),
          stderr: String(stderr ?? ""),
          timedOut,
          errorMessage: errObj.message,
        });
      },
    );
  });
}

function mapTrustSeverity(raw: string): SecurityAuditSeverity {
  const normalized = raw.trim().toLowerCase();
  if (normalized === "critical") {
    return "critical";
  }
  if (normalized === "high" || normalized === "medium" || normalized === "warn") {
    return "warn";
  }
  return "info";
}

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function parseBundleInfo(raw: string): TrustBundleInfo | null {
  const obj = parseJsonObject(raw);
  if (!obj) {
    return null;
  }
  if (typeof obj.framework !== "string" || typeof obj.version !== "string") {
    return null;
  }
  const ruleCount = typeof obj.ruleCount === "number" && Number.isFinite(obj.ruleCount)
    ? obj.ruleCount
    : 0;
  return {
    product: typeof obj.product === "string" ? obj.product : undefined,
    framework: obj.framework,
    version: obj.version,
    ruleCount,
  };
}

export function buildTrustAuditPayload(params: {
  cfg: CoreBlowConfig;
  findings: SecurityAuditFinding[];
}): string {
  const compactFindings = params.findings.map((f) => ({
    checkId: f.checkId,
    severity: f.severity,
    title: f.title,
  }));
  const serialized = JSON.stringify({
    gatewayMode: params.cfg.gateway?.mode ?? "unset",
    findingCount: compactFindings.length,
    findings: compactFindings,
  });
  if (serialized.length <= MAX_PAYLOAD_BYTES) {
    return serialized;
  }
  return serialized.slice(0, MAX_PAYLOAD_BYTES);
}

/**
 * Runs optional `coreblow-trust` OWASP Agentic AI policy evaluation for `security audit`.
 * Never throws or fails standalone `coreblow` installs when `coreblow-trust` is absent.
 */
export async function evaluateTrustPolicyForAudit(params: {
  cfg: CoreBlowConfig;
  findings: SecurityAuditFinding[];
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  timeoutMs?: number;
}): Promise<TrustPolicyBridgeResult> {
  const env = params.env ?? process.env;
  const platform = params.platform ?? process.platform;
  const timeoutMs = params.timeoutMs ?? DEFAULT_TRUST_TIMEOUT_MS;
  const binary = resolveCoreBlowTrustBinary(env, platform);

  if (!binary) {
    const reason =
      "coreblow-trust is not installed on PATH; optional OWASP Agentic AI bundle skipped.";
    return {
      summary: { status: "skipped", reason },
      findings: [
        {
          checkId: "trust.policy_bundle.skipped",
          severity: "info",
          title: "OWASP Agentic AI policy check skipped",
          detail: reason,
        },
      ],
    };
  }

  const bundleRes = await execTrustCli(binary, ["--bundle-info", "--json"], timeoutMs, env);
  if (bundleRes.timedOut) {
    const reason = `coreblow-trust --bundle-info timed out after ${timeoutMs}ms.`;
    return {
      summary: { status: "error", binary, reason },
      findings: [
        {
          checkId: "trust.policy_bundle.error",
          severity: "info",
          title: "OWASP Agentic AI policy check unavailable",
          detail: reason,
        },
      ],
    };
  }
  if (bundleRes.exitCode !== 0) {
    const reason =
      bundleRes.errorMessage ||
      bundleRes.stderr.trim() ||
      `coreblow-trust --bundle-info exited with code ${bundleRes.exitCode}.`;
    return {
      summary: { status: "error", binary, reason },
      findings: [
        {
          checkId: "trust.policy_bundle.error",
          severity: "info",
          title: "OWASP Agentic AI policy check unavailable",
          detail: reason,
        },
      ],
    };
  }

  const bundleInfo = parseBundleInfo(bundleRes.stdout);
  if (!bundleInfo) {
    const reason = "coreblow-trust --bundle-info returned malformed JSON.";
    return {
      summary: { status: "error", binary, reason },
      findings: [
        {
          checkId: "trust.policy_bundle.error",
          severity: "info",
          title: "OWASP Agentic AI policy check unavailable",
          detail: reason,
        },
      ],
    };
  }

  const payload = buildTrustAuditPayload({ cfg: params.cfg, findings: params.findings });
  const evalRes = await execTrustCli(
    binary,
    ["--payload", payload, "--json"],
    timeoutMs,
    env,
  );
  if (evalRes.timedOut) {
    const reason = `coreblow-trust policy evaluation timed out after ${timeoutMs}ms.`;
    return {
      summary: {
        status: "error",
        binary,
        framework: bundleInfo.framework,
        bundleVersion: bundleInfo.version,
        ruleCount: bundleInfo.ruleCount,
        reason,
      },
      findings: [
        {
          checkId: "trust.policy_bundle.error",
          severity: "info",
          title: "OWASP Agentic AI policy evaluation timed out",
          detail: reason,
        },
      ],
    };
  }

  // coreblow-trust exits 0 on pass and 1 on policy violations, both emitting JSON on stdout.
  if (evalRes.exitCode !== 0 && evalRes.exitCode !== 1) {
    const reason =
      evalRes.errorMessage ||
      evalRes.stderr.trim() ||
      `coreblow-trust exited with code ${evalRes.exitCode}.`;
    return {
      summary: {
        status: "error",
        binary,
        framework: bundleInfo.framework,
        bundleVersion: bundleInfo.version,
        ruleCount: bundleInfo.ruleCount,
        reason,
      },
      findings: [
        {
          checkId: "trust.policy_bundle.error",
          severity: "info",
          title: "OWASP Agentic AI policy evaluation failed",
          detail: reason,
        },
      ],
    };
  }

  const evalObj = parseJsonObject(evalRes.stdout);
  if (!evalObj || typeof evalObj.pass !== "boolean") {
    const reason = "coreblow-trust --json returned malformed evaluation output.";
    return {
      summary: {
        status: "error",
        binary,
        framework: bundleInfo.framework,
        bundleVersion: bundleInfo.version,
        ruleCount: bundleInfo.ruleCount,
        reason,
      },
      findings: [
        {
          checkId: "trust.policy_bundle.error",
          severity: "info",
          title: "OWASP Agentic AI policy evaluation returned invalid JSON",
          detail: reason,
        },
      ],
    };
  }

  const rawFindings = Array.isArray(evalObj.findings) ? evalObj.findings : [];
  const violations: TrustPolicyViolation[] = rawFindings
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : "unknown",
      category: typeof item.category === "string" ? item.category : "Agentic AI Policy",
      severity: typeof item.severity === "string" ? item.severity : "medium",
      owner: typeof item.owner === "string" ? item.owner : undefined,
      summary: typeof item.summary === "string" ? item.summary : "Policy violation detected.",
      remediation: typeof item.remediation === "string" ? item.remediation : undefined,
    }));

  const violationCount =
    typeof evalObj.violationCount === "number" ? evalObj.violationCount : violations.length;
  const highestSeverity =
    typeof evalObj.highestSeverity === "string" ? evalObj.highestSeverity : "none";

  const outFindings: SecurityAuditFinding[] = [
    {
      checkId: "trust.policy_bundle.evaluated",
      severity: "info",
      title: `${bundleInfo.framework} v${bundleInfo.version} (${bundleInfo.ruleCount} rules)`,
      detail: evalObj.pass
        ? "OWASP Agentic AI policy evaluation passed with 0 violations."
        : `OWASP Agentic AI policy evaluation detected ${violationCount} violation(s) (highest: ${highestSeverity}).`,
    },
  ];

  for (const violation of violations) {
    const safeId = violation.id.toLowerCase().replace(/[^a-z0-9._-]+/g, "_");
    outFindings.push({
      checkId: `trust.owasp_agentic.${safeId}`,
      severity: mapTrustSeverity(violation.severity),
      title: `[${violation.id}] ${violation.category}`,
      detail: violation.summary,
      ...(violation.remediation ? { remediation: violation.remediation } : {}),
    });
  }

  return {
    summary: {
      status: "evaluated",
      binary,
      framework: bundleInfo.framework,
      bundleVersion: bundleInfo.version,
      ruleCount: bundleInfo.ruleCount,
      pass: evalObj.pass,
      highestSeverity,
      violationCount,
    },
    findings: outFindings,
  };
}
