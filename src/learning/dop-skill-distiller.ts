/**
 * CoreBlow Cory EvoLoop — Pure DOP Trajectory Distiller & Bayesian Fitness Engine
 *
 * Implements pure Data-Oriented Programming (DOP) contracts and functional
 * transformations with zero stateful side effects.
 */

import YAML from "yaml";

// ---------------------------------------------------------------------------
// Immutable Data Contracts
// ---------------------------------------------------------------------------

/**
 * 5-state lifecycle model governing skill evolution and safety boundaries.
 */
export type SkillLifecycleStatus =
  | "quarantined"
  | "draft"
  | "canary"
  | "verified_active"
  | "deprecated";

/**
 * Execution trace of an individual tool call within an agent turn.
 */
export interface TrajectoryToolStep {
  readonly toolName: string;
  readonly input?: unknown;
  readonly output?: unknown;
  readonly isError: boolean;
  readonly executionDurationMs?: number;
  readonly errorCode?: string;
  readonly succeeded?: boolean;
}

/**
 * Complete immutable trace of an agent turn submitted for skill distillation.
 */
export interface TurnTrajectoryRecord {
  readonly id: string;
  readonly userGoal: string;
  readonly steps: readonly TrajectoryToolStep[];
  readonly finalOutcome: "success" | "failure" | "aborted" | "partial" | boolean;
  readonly trustZone?: "internal" | "trusted_partner" | "public" | "operator" | "authenticated";
  readonly isPublicChannel?: boolean;
  readonly userCorrectionText?: string;
  readonly workspaceId?: string;
  readonly userScope?: string;
  readonly sessionId?: string;
  readonly timestampMs?: number;
}

/**
 * Bayesian statistical telemetry associated with an evolving skill.
 */
export interface SkillFitnessMetrics {
  readonly totalInvocations: number;
  readonly successfulInvocations: number;
  readonly failedInvocations: number;
  readonly consecutiveFailures: number;
  readonly wilsonScore: number;
  readonly lastUpdatedMs: number;
}

/**
 * Canonical evolving skill record representation in memory and on disk.
 */
export interface EvolvingSkillRecord {
  readonly id: string;
  readonly slug: string;
  readonly version: string;
  readonly title: string;
  readonly description: string;
  readonly status: SkillLifecycleStatus;
  readonly triggers: readonly string[];
  readonly executionStrategy: readonly string[];
  readonly pitfallsConstraints: readonly string[];
  readonly verificationCriteria: readonly string[];
  readonly metrics: SkillFitnessMetrics;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
}

/**
 * Result returned by distillTrajectoryToSkillCandidate.
 */
export type DistillTrajectoryResult =
  | { readonly ok: true; readonly candidate: EvolvingSkillRecord }
  | {
      readonly ok: false;
      readonly reason: string;
      readonly code: "ZONE_0_BLOCKED" | "NOT_QUALIFIED";
    };

// ---------------------------------------------------------------------------
// Pure Helper Utilities
// ---------------------------------------------------------------------------

/**
 * Deterministically normalizes a string into a lower-case kebab slug.
 */
export function normalizeHyphenSlug(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Pure predicate evaluating whether a trajectory originated from an untrusted
 * public channel or Zone 0 ingress.
 *
 * Normalizes casing, whitespace, aliases (e.g. "public", "zone0", "zone_0", "zone-0", "0"),
 * and boolean coercions (e.g. true, "true", 1, "1").
 */
export function isZone0PublicTrajectory(
  trajectory:
    | TurnTrajectoryRecord
    | Record<string, unknown>
    | { readonly trustZone?: unknown; readonly isPublicChannel?: unknown }
    | null
    | undefined,
): boolean {
  if (!trajectory || typeof trajectory !== "object") {
    return false;
  }

  // 1. Evaluate trustZone
  const rawTz = (trajectory as Record<string, unknown>).trustZone;
  if (rawTz === 0) {
    return true;
  }
  if (typeof rawTz === "string" || typeof rawTz === "number") {
    const tz = String(rawTz).toLowerCase().trim();
    const tzStripped = tz.replace(/[\s_-]+/g, "");
    if (
      tz === "public" ||
      tz === "zone0" ||
      tz === "zone_0" ||
      tz === "zone-0" ||
      tz === "0" ||
      tz === "untrusted" ||
      tzStripped === "zone0"
    ) {
      return true;
    }
  }

  // 2. Evaluate isPublicChannel
  const pub = (trajectory as Record<string, unknown>).isPublicChannel;
  if (pub === true) {
    return true;
  }
  if (typeof pub === "number") {
    return Number.isFinite(pub) && pub !== 0;
  }
  if (typeof pub === "string") {
    const pubTrimmed = pub.toLowerCase().trim();
    if (
      pubTrimmed === "true" ||
      pubTrimmed === "1" ||
      pubTrimmed === "yes" ||
      pubTrimmed === "y" ||
      pubTrimmed === "on" ||
      pubTrimmed === "public"
    ) {
      return true;
    }
  }

  return false;
}

// ---------------------------------------------------------------------------
// Pure Mathematical & Evolutionary Transformations
// ---------------------------------------------------------------------------

/**
 * Computes the Wilson lower bound of the binomial proportion confidence interval.
 *
 * Formula:
 *   (p + z^2/(2n) - z * sqrt((p(1-p) + z^2/(4n)) / n)) / (1 + z^2/n)
 *
 * Penalizes small sample sizes gracefully, ensuring a single fluke doesn't
 * skew confidence scores inappropriately.
 */
export function computeWilsonLowerBound(
  successes: number,
  total: number,
  confidence = 0.95,
): number {
  if (total <= 0 || successes <= 0) {
    return 0;
  }
  const n = total;
  const s = Math.min(successes, total);
  const pHat = s / n;

  let z = 1.95996;
  if (confidence === 0.99) z = 2.57583;
  else if (confidence === 0.9) z = 1.64485;
  else if (confidence === 0.85) z = 1.43953;
  else if (confidence === 0.8) z = 1.28155;
  else if (confidence === 0.7) z = 1.03643;

  const z2 = z * z;
  const denominator = 1 + z2 / n;
  const centerAdjustment = pHat + z2 / (2 * n);
  const varianceTerm = (pHat * (1 - pHat)) / n + z2 / (4 * n * n);
  const marginOfError = z * Math.sqrt(Math.max(0, varianceTerm));

  const lowerBound = (centerAdjustment - marginOfError) / denominator;
  return Math.max(0, Math.min(1, Number(lowerBound.toFixed(4))));
}

/**
 * Pure function that calculates updated fitness metrics for an evolving skill
 * given a new invocation outcome.
 */
export function updateSkillFitnessMetrics(
  current: SkillFitnessMetrics,
  outcome: "success" | "failure" | boolean,
  timestampMs?: number,
): SkillFitnessMetrics {
  const isSuccess = outcome === "success" || outcome === true;
  const totalInvocations = current.totalInvocations + 1;
  const successfulInvocations = current.successfulInvocations + (isSuccess ? 1 : 0);
  const failedInvocations = current.failedInvocations + (isSuccess ? 0 : 1);
  const consecutiveFailures = isSuccess ? 0 : current.consecutiveFailures + 1;
  const wilsonScore = computeWilsonLowerBound(successfulInvocations, totalInvocations, 0.95);

  return Object.freeze({
    totalInvocations,
    successfulInvocations,
    failedInvocations,
    consecutiveFailures,
    wilsonScore,
    lastUpdatedMs: timestampMs ?? Date.now(),
  });
}

/**
 * Pure circuit-breaker evaluator determining if a skill should be rolled back
 * due to runtime performance regression (consecutive failures >= 2).
 */
export function shouldAutoRollbackSkill(metrics: SkillFitnessMetrics): boolean {
  return metrics.consecutiveFailures >= 2;
}

/**
 * Distills an immutable turn trajectory into an evolving skill candidate.
 *
 * Zero-Trust Gate 1: Trajectories marked with trustZone === "public" or
 * isPublicChannel === true are immediately rejected.
 *
 * Qualification Criteria:
 *   a) Overcome Friction: At least one step with isError === true followed later
 *      by a step with isError === false AND finalOutcome === "success", OR
 *   b) Explicit User Correction: userCorrectionText is present and >= 16 chars.
 */
export function distillTrajectoryToSkillCandidate(
  trajectory: TurnTrajectoryRecord,
  existingSkill?: EvolvingSkillRecord,
  options?: { initialStatus?: SkillLifecycleStatus; timestampMs?: number },
): DistillTrajectoryResult {
  // Gate 1: Zero-Trust Public Channel Rejection
  if (isZone0PublicTrajectory(trajectory)) {
    return {
      ok: false,
      reason: "Zone 0 public trajectory rejected",
      code: "ZONE_0_BLOCKED",
    };
  }

  // Trajectory Qualification Check
  const steps = trajectory.steps ?? [];
  let hasFailedStep = false;
  let hasRecoveryStepAfterFailure = false;
  let lastStepFailed = false;

  for (const step of steps) {
    const isErr = step.isError === true || step.succeeded === false;
    if (isErr) {
      hasFailedStep = true;
      hasRecoveryStepAfterFailure = false;
      lastStepFailed = true;
    } else if (hasFailedStep && (step.isError === false || step.succeeded === true)) {
      hasRecoveryStepAfterFailure = true;
      lastStepFailed = false;
    }
  }

  const normalizedOutcome = String(trajectory.finalOutcome ?? "")
    .trim()
    .toLowerCase();
  const isFinalSuccess = normalizedOutcome === "success" || trajectory.finalOutcome === true;
  const pathAQualified =
    hasFailedStep && hasRecoveryStepAfterFailure && !lastStepFailed && isFinalSuccess;

  const correctionText = (trajectory.userCorrectionText ?? "").trim();
  const pathBQualified = correctionText.length >= 16;

  if (!pathAQualified && !pathBQualified) {
    return {
      ok: false,
      reason: "Trajectory not qualified for distillation",
      code: "NOT_QUALIFIED",
    };
  }

  // Slug derivation
  const rawGoal = trajectory.userGoal.trim() || trajectory.id || "unnamed-evolving-skill";
  const slug = existingSkill?.slug ?? (normalizeHyphenSlug(rawGoal) || "unnamed-evolving-skill");
  const id = existingSkill?.id ?? `skill_${slug}`;

  // Version management: bump minor version if refining an existing skill
  let version = "1.0.0";
  if (existingSkill?.version) {
    const parts = existingSkill.version.split(".").map((n) => parseInt(n, 10) || 0);
    const major = parts[0] ?? 1;
    const minor = (parts[1] ?? 0) + 1;
    version = `${major}.${minor}.0`;
  }

  // Synthesize Execution Strategy
  const successfulSteps = steps.filter((s) => s.isError === false && s.succeeded !== false);
  const executionStrategy: string[] =
    successfulSteps.length > 0
      ? successfulSteps.map((s, idx) => {
          const inputPart = s.input ? ` with: ${JSON.stringify(s.input)}` : "";
          return `${idx + 1}. Execute ${s.toolName}${inputPart}`;
        })
      : [`1. Execute verified recovery sequence for "${rawGoal}".`];

  // Synthesize Pitfalls & Active Constraints
  const pitfalls: string[] = [];
  for (const step of steps) {
    if (step.isError === true || step.succeeded === false) {
      const errOut =
        typeof step.output === "string"
          ? step.output
          : step.output
            ? JSON.stringify(step.output)
            : "unhandled error";
      pitfalls.push(`Avoid tool failure in ${step.toolName}: ${step.errorCode ?? errOut}`);
    }
  }
  if (pathBQualified) {
    pitfalls.push(`User Correction: ${correctionText}`);
  }
  if (existingSkill?.pitfallsConstraints) {
    for (const p of existingSkill.pitfallsConstraints) {
      if (!pitfalls.includes(p)) {
        pitfalls.push(p);
      }
    }
  }

  // Synthesize Verification Standard
  const verificationCriteria: string[] = [
    isFinalSuccess
      ? "Confirm exit code 0 and parse the test/verification summary before reporting completion."
      : "Verify execution completes with 0 errors and clean output.",
  ];

  // Derive Triggers
  const rawWords = rawGoal
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9-]/g, ""))
    .filter((w) => w.length > 2);
  const candidateTriggers = Array.from(new Set([slug, ...rawWords.slice(0, 4)]));
  const triggers = existingSkill?.triggers ?? Object.freeze(candidateTriggers);

  const now = options?.timestampMs ?? trajectory.timestampMs ?? Date.now();
  const status: SkillLifecycleStatus = options?.initialStatus ?? existingSkill?.status ?? "canary";

  const metrics: SkillFitnessMetrics = Object.freeze({
    totalInvocations: 0,
    successfulInvocations: 0,
    failedInvocations: 0,
    consecutiveFailures: 0,
    wilsonScore: 0,
    lastUpdatedMs: now,
  });

  const candidate: EvolvingSkillRecord = Object.freeze({
    id,
    slug,
    version,
    title: existingSkill?.title ?? rawGoal,
    description: existingSkill?.description ?? `Auto-synthesized evolving skill for: ${rawGoal}`,
    status,
    triggers,
    executionStrategy: Object.freeze(executionStrategy),
    pitfallsConstraints: Object.freeze(pitfalls),
    verificationCriteria: Object.freeze(verificationCriteria),
    metrics,
    createdAtMs: existingSkill?.createdAtMs ?? now,
    updatedAtMs: now,
  });

  return {
    ok: true,
    candidate,
  };
}

// ---------------------------------------------------------------------------
// Markdown Serialization & Parsing (SKILL.md V2)
// ---------------------------------------------------------------------------

/**
 * Serializes an EvolvingSkillRecord into standard SKILL.md Markdown format
 * with YAML frontmatter and 4 canonical H2 sections.
 */
export function serializeEvolvingSkillMarkdown(skill: EvolvingSkillRecord): string {
  const frontmatterData = {
    id: skill.id,
    slug: skill.slug,
    version: skill.version,
    status: skill.status,
    title: skill.title,
    description: skill.description,
    triggers: Array.from(skill.triggers),
    metrics: {
      totalInvocations: skill.metrics.totalInvocations,
      successfulInvocations: skill.metrics.successfulInvocations,
      failedInvocations: skill.metrics.failedInvocations,
      consecutiveFailures: skill.metrics.consecutiveFailures,
      wilsonScore: skill.metrics.wilsonScore,
      lastUpdatedMs: skill.metrics.lastUpdatedMs,
    },
    createdAtMs: skill.createdAtMs,
    updatedAtMs: skill.updatedAtMs,
  };

  const yamlHeader = YAML.stringify(frontmatterData).trim();
  const pitfallsList =
    skill.pitfallsConstraints.length > 0
      ? skill.pitfallsConstraints.map((p) => `- ${p}`).join("\n")
      : "- None recorded.";
  const verificationList =
    skill.verificationCriteria.length > 0
      ? skill.verificationCriteria.map((v) => (v.startsWith("- ") ? v : `- ${v}`)).join("\n")
      : "- Verify exitCode === 0 and clean output.";

  return `---
${yamlHeader}
---

# ${skill.title}

## Intent & Trigger Heuristics
${skill.description}

## Execution Strategy
${skill.executionStrategy.join("\n")}

## Pitfalls & Active Constraints
${pitfallsList}

## Verification Standard
${verificationList}
`;
}

function toSafeFiniteNumber(val: unknown, fallback: number): number {
  if (val === undefined || val === null) return fallback;
  const num = typeof val === "number" ? val : Number(val);
  return Number.isFinite(num) ? num : fallback;
}

const VALID_STATUSES: ReadonlySet<SkillLifecycleStatus> = new Set([
  "quarantined",
  "draft",
  "canary",
  "verified_active",
  "deprecated",
]);

/**
 * Parses a serialized SKILL.md Markdown string into an immutable EvolvingSkillRecord.
 */
export function parseEvolvingSkillMarkdown(markdown: string): EvolvingSkillRecord {
  if (typeof markdown !== "string") {
    throw new Error("INVALID_SKILL_FORMAT: Input markdown must be a string");
  }

  const normalized = markdown
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  if (!normalized.startsWith("---")) {
    throw new Error("INVALID_SKILL_FORMAT: Missing leading frontmatter delimiter");
  }

  const endHeaderIdx = normalized.indexOf("\n---", 3);
  if (endHeaderIdx === -1) {
    throw new Error("INVALID_SKILL_FORMAT: Missing closing frontmatter delimiter");
  }

  const frontmatterRaw = normalized.slice(4, endHeaderIdx);
  let parsedRaw: unknown;
  try {
    parsedRaw = YAML.parse(frontmatterRaw);
  } catch (err) {
    const details = err instanceof Error ? err.message : String(err);
    throw new Error(`INVALID_SKILL_FORMAT: Malformed YAML frontmatter: ${details}`);
  }

  if (
    parsedRaw !== null &&
    parsedRaw !== undefined &&
    (typeof parsedRaw !== "object" || Array.isArray(parsedRaw))
  ) {
    throw new Error("INVALID_SKILL_FORMAT: YAML frontmatter must be a key-value mapping");
  }

  const parsedFrontmatter = (parsedRaw ?? {}) as Record<string, unknown>;
  const body = normalized.slice(endHeaderIdx + 4).trim();

  // Extract sections line-by-line with code-block awareness
  const lines = body.split("\n");
  const sectionLines: Record<string, string[]> = {};
  let currentSection: string | null = null;
  let inCodeBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("```") || trimmed.startsWith("~~~")) {
      inCodeBlock = !inCodeBlock;
      if (currentSection) {
        sectionLines[currentSection].push(line);
      }
      continue;
    }

    if (!inCodeBlock && line.startsWith("## ")) {
      const headerName = line.slice(3).trim();
      currentSection = headerName;
      if (!sectionLines[currentSection]) {
        sectionLines[currentSection] = [];
      }
      continue;
    }

    if (currentSection) {
      sectionLines[currentSection].push(line);
    }
  }

  const sections: Record<string, string> = {};
  for (const [sec, sLines] of Object.entries(sectionLines)) {
    sections[sec] = sLines.join("\n").trim();
  }

  // Parse Execution Strategy lines
  const strategyRaw = sections["Execution Strategy"] ?? "";
  const executionStrategy = strategyRaw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  // Parse Pitfalls & Active Constraints lines
  const pitfallsRaw = sections["Pitfalls & Active Constraints"] ?? "";
  const pitfallsConstraints = pitfallsRaw
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter((l) => l.length > 0 && l !== "None recorded.");

  // Parse Verification Standard lines
  const verificationRaw = sections["Verification Standard"] ?? "";
  const verificationCriteria = verificationRaw
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);

  const metricsRaw = (parsedFrontmatter.metrics ?? {}) as Record<string, unknown>;
  const now = Date.now();
  const metrics: SkillFitnessMetrics = Object.freeze({
    totalInvocations: Math.max(0, toSafeFiniteNumber(metricsRaw.totalInvocations, 0)),
    successfulInvocations: Math.max(0, toSafeFiniteNumber(metricsRaw.successfulInvocations, 0)),
    failedInvocations: Math.max(0, toSafeFiniteNumber(metricsRaw.failedInvocations, 0)),
    consecutiveFailures: Math.max(0, toSafeFiniteNumber(metricsRaw.consecutiveFailures, 0)),
    wilsonScore: Math.min(1, Math.max(0, toSafeFiniteNumber(metricsRaw.wilsonScore, 0))),
    lastUpdatedMs: toSafeFiniteNumber(metricsRaw.lastUpdatedMs, now),
  });

  const triggersRaw = parsedFrontmatter.triggers;
  const triggers: readonly string[] = Array.isArray(triggersRaw)
    ? Object.freeze(triggersRaw.map(String))
    : Object.freeze([]);

  // Extract H1 title fallback if frontmatter title is omitted
  const h1Match = /^#\s+([^\n]+)$/m.exec(body);
  const titleFromBody = h1Match ? h1Match[1]?.trim() : undefined;

  const id = String(parsedFrontmatter.id ?? `skill_${parsedFrontmatter.slug ?? "unnamed"}`);
  const slug = String(parsedFrontmatter.slug ?? "unnamed");
  const version = String(parsedFrontmatter.version ?? "1.0.0");
  const title = String(parsedFrontmatter.title ?? titleFromBody ?? "Evolving Skill");
  const description = String(
    parsedFrontmatter.description ?? sections["Intent & Trigger Heuristics"] ?? "",
  );
  const rawStatus = String(parsedFrontmatter.status ?? "");
  const status: SkillLifecycleStatus = VALID_STATUSES.has(rawStatus as SkillLifecycleStatus)
    ? (rawStatus as SkillLifecycleStatus)
    : "canary";
  const createdAtMs = toSafeFiniteNumber(parsedFrontmatter.createdAtMs, now);
  const updatedAtMs = toSafeFiniteNumber(parsedFrontmatter.updatedAtMs, now);

  return Object.freeze({
    id,
    slug,
    version,
    title,
    description,
    status,
    triggers,
    executionStrategy: Object.freeze(executionStrategy),
    pitfallsConstraints: Object.freeze(pitfallsConstraints),
    verificationCriteria: Object.freeze(verificationCriteria),
    metrics,
    createdAtMs,
    updatedAtMs,
  });
}
