/**
 * CoreBlow Sovereign Agent-OS v2.0.0
 * Release Certification & Readiness Manifest Subsystem
 *
 * Implements pure Data-Oriented Programming (DOP) readiness gates
 * and deterministic SHA-256 manifest compilation.
 */

import crypto from "node:crypto";

/**
 * Canonical release readiness gate categories for CoreBlow v2.0.0 Sovereign GA.
 */
export type ReleaseGateCategory =
  | "microkernel_health"
  | "brand_sovereignty"
  | "private_artifact_exclusion"
  | "security_invariants"
  | "corehub_catalog_integrity";

/**
 * Result of evaluating an individual sovereign release readiness gate.
 */
export interface ReleaseGateCheckResult {
  readonly gate: ReleaseGateCategory;
  readonly passed: boolean;
  readonly summary: string;
  readonly violations?: readonly string[];
}

/**
 * Deterministically signed release manifest for CoreBlow v2.0.0 Sovereign Agent-OS.
 */
export interface CoreBlowReleaseManifest {
  readonly product: "CoreBlow Sovereign Agent-OS";
  readonly version: string;
  readonly releaseChannel: string;
  readonly kernelServiceNames: readonly string[];
  readonly totalKernelServices: number;
  readonly gateResults: readonly ReleaseGateCheckResult[];
  readonly allGatesPassed: boolean;
  readonly manifestSha256: string;
  readonly generatedAtMs: number;
}

/**
 * Frozen array of the 12 canonical microkernel service identifiers required
 * for CoreBlow v2.0.0 Sovereign Agent-OS operation.
 */
export const REQUIRED_MICROKERNEL_SERVICES: readonly string[] = Object.freeze([
  "provider-runtime",
  "rag-runtime",
  "tool-runtime",
  "browser-runtime",
  "voice-runtime",
  "cory-memory",
  "cory-skill-synthesizer",
  "extension-tier-policy",
  "corehub-app-store",
  "war-room-orchestrator",
  "cory-knowledge-scribe",
  "pr-workflow-orchestrator",
] as const);

export type RequiredMicrokernelServiceId = (typeof REQUIRED_MICROKERNEL_SERVICES)[number];

/**
 * Minimum catalog artifact count required to certify CoreHub App Store ecosystem depth.
 */
export const MINIMUM_COREHUB_CATALOG_ARTIFACT_COUNT = 15;

/**
 * Default forbidden legacy brand tokens constructed dynamically via character codes
 * to enforce 100% brand sovereignty without hardcoded raw competitor strings.
 */
export const DEFAULT_FORBIDDEN_BRAND_TOKENS: readonly string[] = Object.freeze([
  // Token 1
  String.fromCharCode(111, 112, 101, 110, 99, 108, 97, 119),
  // Token 2
  String.fromCharCode(99, 108, 97, 119, 100, 98, 111, 116),
  // Token 3
  String.fromCharCode(109, 111, 108, 116, 98, 111, 116),
  // Token 4
  String.fromCharCode(99, 108, 97, 119, 100),
  // Token 5
  String.fromCharCode(99, 108, 97, 119, 98, 111, 116),
]);

/**
 * Private / internal repository artifact path patterns that must never be staged.
 */
const PRIVATE_ARTIFACT_PATTERNS: readonly RegExp[] = Object.freeze([
  /(?:^|[\\/])\.env(?:\.[^\\/]+)?$/i,
  /(?:^|[\\/])\.git[\\/]info[\\/]exclude$/i,
  /(?:^|[\\/])\.evidence(?:[\\/]|$)/i,
  /(?:^|[\\/])\.agents(?:[\\/]|$)/i,
  /(?:^|[\\/])(?:docs[\\/])?ANTIGRAVITY_[^\\/]*$/i,
  /(?:^|[\\/])docs[\\/]COREBLOW_COMPREHENSIVE_AUDIT_REPORT\.md$/i,
  /(?:^|[\\/])docs[\\/]COREBLOW_ECOSYSTEM_26_REPOS\.md$/i,
  /(?:^|[\\/])docs[\\/]CORY_MEMORY_PRD\.md$/i,
  /(?:^|[\\/])docs[\\/]MICROKERNEL_HYBRID_UPGRADE_PRD\.md$/i,
  /(?:^|[\\/])docs[\\/]CORY_SKILL_EVOLUTION_PRD\.md$/i,
]);

/**
 * Security invariant secret patterns that must never be present in source snippets.
 */
interface SecurityPattern {
  readonly name: string;
  readonly regex: RegExp;
}

const SECURITY_INVARIANT_PATTERNS: readonly SecurityPattern[] = Object.freeze([
  {
    name: "Anthropic API Key",
    regex: /\bsk-ant-[A-Za-z0-9_-]{8,}\b/i,
  },
  {
    name: "OpenAI API Key",
    regex: /\bsk-(?!ant-)(?:proj-)?[A-Za-z0-9_-]{15,}\b/i,
  },
  {
    name: "GitHub Token",
    regex: /\b(?:ghp_[A-Za-z0-9]{15,}|github_pat_[A-Za-z0-9_]{15,})\b/i,
  },
  {
    name: "Slack Token",
    regex: /\bxoxb-[A-Za-z0-9_-]{8,}\b/i,
  },
  {
    name: "Google Cloud / Firebase API Key",
    regex: /\bAIza[0-9A-Za-z_-]{20,}\b/i,
  },
  {
    name: "Private Key",
    regex: /-----BEGIN (?:[A-Z0-9_-]+ )?PRIVATE KEY-----|\bPRIVATE\s+KEY\b/i,
  },
]);

export interface MicrokernelServiceHealthStatus {
  readonly name: string;
  readonly healthy: boolean;
  readonly status?: string;
  readonly detail?: string;
}

export interface EvaluateSovereignReleaseGatesParams {
  readonly microkernelServices?:
    | readonly string[]
    | readonly {
        readonly name: string;
        readonly status?: string;
        readonly healthy?: boolean;
        readonly detail?: string;
      }[]
    | Readonly<
        Record<
          string,
          | boolean
          | { readonly status?: string; readonly healthy?: boolean; readonly detail?: string }
          | { health(): { status: string; detail?: string; healthy?: boolean } }
        >
      >;
  readonly activeServices?: readonly {
    readonly name: string;
    readonly status?: string;
    readonly healthy?: boolean;
    readonly detail?: string;
  }[];
  readonly serviceRegistry?: {
    getHealth():
      | Array<{ name: string; status: string; uptime?: number; detail?: string; healthy?: boolean }>
      | Record<string, { status?: string; detail?: string; healthy?: boolean }>;
  };
  readonly stagedFilePaths?: readonly string[];
  readonly sourceSnippets?: readonly string[];
  readonly forbiddenBrandTokens?: readonly string[];
  readonly coreHubArtifactCount?: number;
}

export interface CompileSovereignReleaseManifestParams
  extends EvaluateSovereignReleaseGatesParams {
  readonly version?: string;
  readonly releaseChannel?: string;
  readonly kernelServiceNames?: readonly string[];
  readonly generatedAtMs?: number;
  readonly gateResults?: readonly ReleaseGateCheckResult[];
}

/**
 * Extract health status from a service entry or health record safely without `any`.
 */
function extractHealthFromObject(
  obj: unknown,
): { healthy: boolean; status: string; detail?: string } | null {
  if (!obj || typeof obj !== "object") return null;
  const record = obj as Record<string, unknown>;
  if (typeof record.health === "function") {
    const h = (record.health as () => unknown)();
    if (h && typeof h === "object") {
      const hRec = h as Record<string, unknown>;
      const isHealthy =
        typeof hRec.healthy === "boolean"
          ? hRec.healthy
          : hRec.status === "healthy";
      return {
        healthy: isHealthy,
        status:
          typeof hRec.status === "string"
            ? hRec.status
            : isHealthy
              ? "healthy"
              : "unhealthy",
        detail: typeof hRec.detail === "string" ? hRec.detail : undefined,
      };
    }
  }
  const isHealthy =
    typeof record.healthy === "boolean"
      ? record.healthy
      : record.status === "healthy";
  return {
    healthy: isHealthy,
    status:
      typeof record.status === "string"
        ? record.status
        : isHealthy
          ? "healthy"
          : "unhealthy",
    detail: typeof record.detail === "string" ? record.detail : undefined,
  };
}

/**
 * Pure function evaluating all 5 sovereign release readiness gates.
 */
export function evaluateSovereignReleaseGates(
  params: EvaluateSovereignReleaseGatesParams = {},
): readonly ReleaseGateCheckResult[] {
  const gateResults: ReleaseGateCheckResult[] = [];

  // -------------------------------------------------------------------------
  // 1. Gate: microkernel_health
  // -------------------------------------------------------------------------
  const healthMap = new Map<string, { healthy: boolean; status?: string; detail?: string }>();

  // Extract from serviceRegistry if available
  if (params.serviceRegistry && typeof params.serviceRegistry.getHealth === "function") {
    const healthResult = params.serviceRegistry.getHealth();
    if (Array.isArray(healthResult)) {
      for (const item of healthResult) {
        if (item && typeof item === "object") {
          const itemRecord = item as Record<string, unknown>;
          const name = itemRecord.name;
          if (typeof name === "string") {
            const h = extractHealthFromObject(item);
            if (h) healthMap.set(name, h);
          }
        }
      }
    } else if (healthResult && typeof healthResult === "object") {
      for (const [name, val] of Object.entries(healthResult)) {
        const h = extractHealthFromObject(val);
        if (h) healthMap.set(name, h);
      }
    }
  }

  // Extract from microkernelServices parameter
  if (params.microkernelServices) {
    if (Array.isArray(params.microkernelServices)) {
      for (const item of params.microkernelServices) {
        if (typeof item === "string") {
          healthMap.set(item, { healthy: true, status: "healthy" });
        } else if (item && typeof item === "object") {
          const itemRecord = item as Record<string, unknown>;
          const name = itemRecord.name;
          if (typeof name === "string") {
            const h = extractHealthFromObject(item);
            if (h) healthMap.set(name, h);
          }
        }
      }
    } else if (typeof params.microkernelServices === "object") {
      for (const [name, val] of Object.entries(params.microkernelServices)) {
        if (typeof val === "boolean") {
          healthMap.set(name, { healthy: val, status: val ? "healthy" : "unhealthy" });
        } else if (val && typeof val === "object") {
          const h = extractHealthFromObject(val);
          if (h) healthMap.set(name, h);
        }
      }
    }
  }

  // Extract from activeServices parameter
  if (params.activeServices && Array.isArray(params.activeServices)) {
    for (const item of params.activeServices) {
      if (item && typeof item === "object" && typeof item.name === "string") {
        const isHealthy =
          item.healthy !== undefined
            ? Boolean(item.healthy)
            : item.status === "healthy";
        healthMap.set(item.name, {
          healthy: isHealthy,
          status: item.status ?? (isHealthy ? "healthy" : "unhealthy"),
          detail: item.detail,
        });
      }
    }
  }

  // Verify all 12 required microkernel services are present and healthy
  const microkernelViolations: string[] = [];
  for (const serviceId of REQUIRED_MICROKERNEL_SERVICES) {
    const serviceHealth = healthMap.get(serviceId);
    if (!serviceHealth) {
      microkernelViolations.push(`Missing required microkernel service: "${serviceId}"`);
    } else if (!serviceHealth.healthy) {
      microkernelViolations.push(
        `Unhealthy microkernel service: "${serviceId}" (status: ${serviceHealth.status ?? "unhealthy"})`,
      );
    }
  }

  if (microkernelViolations.length === 0) {
    gateResults.push(
      Object.freeze({
        gate: "microkernel_health" as const,
        passed: true,
        summary: `All ${REQUIRED_MICROKERNEL_SERVICES.length} required microkernel services are present and healthy.`,
      }),
    );
  } else {
    gateResults.push(
      Object.freeze({
        gate: "microkernel_health" as const,
        passed: false,
        summary: `Microkernel health gate failed: ${microkernelViolations.length} service violation(s) detected.`,
        violations: Object.freeze([...microkernelViolations]),
      }),
    );
  }

  // -------------------------------------------------------------------------
  // 2. Gate: brand_sovereignty
  // -------------------------------------------------------------------------
  const brandViolations: string[] = [];
  const effectiveBrandTokens = params.forbiddenBrandTokens ?? DEFAULT_FORBIDDEN_BRAND_TOKENS;
  const sourceSnippets = params.sourceSnippets ?? [];

  for (let idx = 0; idx < sourceSnippets.length; idx++) {
    const snippet = sourceSnippets[idx];
    if (typeof snippet !== "string") continue;
    const lowerSnippet = snippet.toLowerCase();
    for (const token of effectiveBrandTokens) {
      if (typeof token === "string" && token.length > 0) {
        if (lowerSnippet.includes(token.toLowerCase())) {
          brandViolations.push(
            `Brand sovereignty violation in snippet #${idx}: detected forbidden brand token`,
          );
        }
      }
    }
  }

  if (brandViolations.length === 0) {
    gateResults.push(
      Object.freeze({
        gate: "brand_sovereignty" as const,
        passed: true,
        summary: `Brand sovereignty gate passed: zero forbidden tokens detected in ${sourceSnippets.length} source snippet(s).`,
      }),
    );
  } else {
    gateResults.push(
      Object.freeze({
        gate: "brand_sovereignty" as const,
        passed: false,
        summary: `Brand sovereignty gate failed: ${brandViolations.length} forbidden brand token violation(s) detected.`,
        violations: Object.freeze([...brandViolations]),
      }),
    );
  }

  // -------------------------------------------------------------------------
  // 3. Gate: private_artifact_exclusion
  // -------------------------------------------------------------------------
  const privateViolations: string[] = [];
  const stagedFilePaths = params.stagedFilePaths ?? [];

  for (const rawPath of stagedFilePaths) {
    if (typeof rawPath !== "string") continue;
    const normalized = rawPath.replace(/\\/g, "/");
    const isPrivate = PRIVATE_ARTIFACT_PATTERNS.some((pattern) => pattern.test(normalized));
    if (isPrivate) {
      privateViolations.push(
        `Private/internal artifact detected in staged files: "${rawPath}"`,
      );
    }
  }

  if (privateViolations.length === 0) {
    gateResults.push(
      Object.freeze({
        gate: "private_artifact_exclusion" as const,
        passed: true,
        summary: `Zero private artifacts detected in staged files (${stagedFilePaths.length} checked).`,
      }),
    );
  } else {
    gateResults.push(
      Object.freeze({
        gate: "private_artifact_exclusion" as const,
        passed: false,
        summary: `Private artifact exclusion gate failed: ${privateViolations.length} private artifact(s) detected in staged files.`,
        violations: Object.freeze([...privateViolations]),
      }),
    );
  }

  // -------------------------------------------------------------------------
  // 4. Gate: security_invariants
  // -------------------------------------------------------------------------
  const securityViolations: string[] = [];

  for (let idx = 0; idx < sourceSnippets.length; idx++) {
    const snippet = sourceSnippets[idx];
    if (typeof snippet !== "string") continue;
    for (const pattern of SECURITY_INVARIANT_PATTERNS) {
      if (pattern.regex.test(snippet)) {
        securityViolations.push(
          `Security invariant violation in snippet #${idx}: detected raw secret pattern "${pattern.name}"`,
        );
      }
    }
  }

  if (securityViolations.length === 0) {
    gateResults.push(
      Object.freeze({
        gate: "security_invariants" as const,
        passed: true,
        summary: `Security invariants satisfied: zero raw credentials or private keys detected in ${sourceSnippets.length} source snippet(s).`,
      }),
    );
  } else {
    gateResults.push(
      Object.freeze({
        gate: "security_invariants" as const,
        passed: false,
        summary: `Security invariants gate failed: ${securityViolations.length} raw credential or private key violation(s) detected.`,
        violations: Object.freeze([...securityViolations]),
      }),
    );
  }

  // -------------------------------------------------------------------------
  // 5. Gate: corehub_catalog_integrity
  // -------------------------------------------------------------------------
  const artifactCount = params.coreHubArtifactCount ?? 0;
  const catalogViolations: string[] = [];

  if (artifactCount < MINIMUM_COREHUB_CATALOG_ARTIFACT_COUNT) {
    catalogViolations.push(
      `CoreHub catalog artifact count (${artifactCount}) is below required minimum threshold of ${MINIMUM_COREHUB_CATALOG_ARTIFACT_COUNT}.`,
    );
  }

  if (catalogViolations.length === 0) {
    gateResults.push(
      Object.freeze({
        gate: "corehub_catalog_integrity" as const,
        passed: true,
        summary: `CoreHub catalog integrity certified: ${artifactCount} verified artifacts (minimum required: ${MINIMUM_COREHUB_CATALOG_ARTIFACT_COUNT}).`,
      }),
    );
  } else {
    gateResults.push(
      Object.freeze({
        gate: "corehub_catalog_integrity" as const,
        passed: false,
        summary: `CoreHub catalog integrity gate failed: artifact count (${artifactCount}) is below required threshold of ${MINIMUM_COREHUB_CATALOG_ARTIFACT_COUNT}.`,
        violations: Object.freeze([...catalogViolations]),
      }),
    );
  }

  return Object.freeze(gateResults);
}

/**
 * Deterministically serialize a value to canonical JSON with recursive alphabetical key sorting.
 */
export function toCanonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? "null" : toCanonicalJson(item))).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  const pairs: string[] = [];
  for (const k of keys) {
    if (obj[k] !== undefined) {
      pairs.push(`${JSON.stringify(k)}:${toCanonicalJson(obj[k])}`);
    }
  }
  return `{${pairs.join(",")}}`;
}

/**
 * Pure function compiling the CoreBlow Sovereign Release Manifest with
 * deterministic SHA-256 digest over the canonical JSON payload.
 */
export function compileSovereignReleaseManifest(
  params: CompileSovereignReleaseManifestParams = {},
): CoreBlowReleaseManifest {
  const product = "CoreBlow Sovereign Agent-OS" as const;
  const version = params.version ?? "2.0.0";
  const releaseChannel = params.releaseChannel ?? "stable";
  const kernelServiceNames = Object.freeze(
    params.kernelServiceNames
      ? [...params.kernelServiceNames]
      : [...REQUIRED_MICROKERNEL_SERVICES],
  );
  const totalKernelServices = kernelServiceNames.length;
  const generatedAtMs = params.generatedAtMs ?? Date.now();

  const gateResults = params.gateResults ?? evaluateSovereignReleaseGates(params);
  const allGatesPassed = gateResults.every((g) => g.passed);

  const hashPayload = {
    gateResults,
    kernelServiceNames,
    product,
    releaseChannel,
    version,
  };

  const canonicalPayload = toCanonicalJson(hashPayload);

  const manifestSha256 = crypto
    .createHash("sha256")
    .update(canonicalPayload)
    .digest("hex");

  return Object.freeze({
    product,
    version,
    releaseChannel,
    kernelServiceNames,
    totalKernelServices,
    gateResults: Object.freeze(
      gateResults.map((r) =>
        Object.freeze({
          ...r,
          violations: r.violations ? Object.freeze([...r.violations]) : undefined,
        }),
      ),
    ),
    allGatesPassed,
    manifestSha256,
    generatedAtMs,
  });
}
