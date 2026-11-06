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
 * Includes "candidate", "canary", "verified_active", "deprecated", "quarantined",
 * and supports "draft" as an accepted alias.
 */
export type SkillLifecycleStatus =
  | "candidate"
  | "canary"
  | "verified_active"
  | "deprecated"
  | "quarantined"
  | "draft";

/**
 * Execution trace of an individual tool call within an agent turn.
 * Native R1 fields + optional dual-compatibility fields.
 */
export interface TrajectoryToolStep {
  readonly toolName: string;
  readonly argsSummary?: string;
  readonly succeeded?: boolean;
  readonly errorMessage?: string;
  readonly outputSummary?: string;
  readonly durationMs?: number;

  // Dual-compatibility & legacy fields
  readonly input?: unknown;
  readonly output?: unknown;
  readonly isError?: boolean;
  readonly executionDurationMs?: number;
  readonly errorCode?: string;
}

/**
 * Complete immutable trace of an agent turn submitted for skill distillation.
 * Native R1 fields + optional dual-compatibility fields.
 */
export interface TurnTrajectoryRecord {
  // R1 native fields
  readonly sessionId?: string;
  readonly userScope?: string;
  readonly workspaceId?: string;
  readonly trustZone?: "operator" | "authenticated" | "public" | "internal" | "trusted_partner";
  readonly isPublicChannel?: boolean;
  readonly taskGoal?: string;
  readonly userCorrection?: string;
  readonly toolSteps?: readonly TrajectoryToolStep[];
  readonly verificationPassed?: boolean;
  readonly verificationCommand?: string;

  // Dual-compatibility & legacy fields
  readonly id?: string;
  readonly userGoal?: string;
  readonly steps?: readonly TrajectoryToolStep[];
  readonly finalOutcome?: "success" | "failure" | "aborted" | "partial" | boolean;
  readonly userCorrectionText?: string;
  readonly timestampMs?: number;
}

/**
 * Bayesian statistical telemetry associated with an evolving skill.
 * Native R1 fields + dual-compatibility aliases.
 */
export interface SkillFitnessMetrics {
  // R1 native fields
  readonly invocations: number;
  readonly successes: number;
  readonly failures: number;
  readonly consecutiveFailures: number;
  readonly wilsonScore: number;
  readonly avgTurnsSaved: number;
  readonly lastVerifiedAt: string;

  // Dual-compatibility & legacy aliases
  readonly totalInvocations: number;
  readonly successfulInvocations: number;
  readonly failedInvocations: number;
  readonly lastUpdatedMs: number;
}

/**
 * Canonical evolving skill record representation in memory and on disk.
 * Native R1 fields + dual-compatibility aliases.
 */
export interface EvolvingSkillRecord {
  readonly id: string;
  readonly name: string;
  readonly title: string;
  readonly slug: string;
  readonly version: string;
  readonly description: string;
  readonly status: SkillLifecycleStatus;
  readonly category: string;
  readonly triggers: readonly string[];
  readonly tools: readonly string[];
  readonly whenToUse: string;
  readonly verifiedProcedure: readonly string[];
  readonly executionStrategy: readonly string[];
  readonly pitfallsAndConstraints: readonly string[];
  readonly pitfallsConstraints: readonly string[];
  readonly verificationGate: string;
  readonly verificationCriteria: readonly string[];
  readonly fitness: SkillFitnessMetrics;
  readonly metrics: SkillFitnessMetrics;
  readonly workspaceId: string;
  readonly createdAtMs: number;
  readonly updatedAt: number;
  readonly updatedAtMs: number;
  readonly locked?: boolean;
}

/**
 * Input parameter shape for R1 distillTrajectoryToSkillCandidate.
 */
export interface DistillSkillCandidateParams {
  readonly trajectory: TurnTrajectoryRecord;
  readonly activeConstraints?: readonly string[];
  readonly existingSkill?: EvolvingSkillRecord;
}

/**
 * Result returned by distillTrajectoryToSkillCandidate in legacy positional mode.
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
 * Returns 0 if invocations === 0, rounded to 4 decimals.
 * If 3rd argument is < 1 (e.g. 0.95), maps confidence level to z. Default z = 1.28.
 */
export function computeWilsonLowerBound(
  successes: number,
  invocations: number,
  z: number = 1.28,
): number {
  if (invocations <= 0 || successes <= 0) {
    return 0;
  }
  const n = invocations;
  const s = Math.min(successes, invocations);
  const pHat = s / n;

  let zVal = z;
  if (z < 1) {
    if (z === 0.99) zVal = 2.57583;
    else if (z === 0.95) zVal = 1.95996;
    else if (z === 0.9) zVal = 1.64485;
    else if (z === 0.85) zVal = 1.43953;
    else if (z === 0.8) zVal = 1.28155;
    else if (z === 0.7) zVal = 1.03643;
    else zVal = 1.95996;
  }

  const z2 = zVal * zVal;
  const denominator = 1 + z2 / n;
  const centerAdjustment = pHat + z2 / (2 * n);
  const varianceTerm = (pHat * (1 - pHat)) / n + z2 / (4 * n * n);
  const marginOfError = zVal * Math.sqrt(Math.max(0, varianceTerm));

  const lowerBound = (centerAdjustment - marginOfError) / denominator;
  return Math.max(0, Math.min(1, Number(lowerBound.toFixed(4))));
}

/**
 * Pure function that calculates updated fitness metrics for an evolving skill
 * given a new invocation outcome.
 *
 * Dual-compatible: accepts { succeeded, turnsSaved?, nowIso? } or "success" | "failure" | boolean.
 */
export function updateSkillFitnessMetrics(
  current: SkillFitnessMetrics | Partial<SkillFitnessMetrics>,
  outcome:
    | { readonly succeeded: boolean; readonly turnsSaved?: number; readonly nowIso?: string }
    | "success"
    | "failure"
    | boolean,
  timestampMs?: number,
): SkillFitnessMetrics {
  const isSuccess =
    typeof outcome === "object" && outcome !== null
      ? outcome.succeeded === true
      : outcome === "success" || outcome === true;

  const turnsSaved =
    typeof outcome === "object" && outcome !== null && typeof outcome.turnsSaved === "number"
      ? outcome.turnsSaved
      : undefined;

  const currentTotal = current.invocations ?? current.totalInvocations ?? 0;
  const currentSuccesses = current.successes ?? current.successfulInvocations ?? 0;
  const currentFailures = current.failures ?? current.failedInvocations ?? 0;
  const currentConsecutiveFailures = current.consecutiveFailures ?? 0;
  const currentAvgTurns = current.avgTurnsSaved ?? 0;

  const invocations = currentTotal + 1;
  const successes = currentSuccesses + (isSuccess ? 1 : 0);
  const failures = currentFailures + (isSuccess ? 0 : 1);
  const consecutiveFailures = isSuccess ? 0 : currentConsecutiveFailures + 1;
  const wilsonScore = computeWilsonLowerBound(successes, invocations, 1.28);

  const avgTurnsSaved =
    turnsSaved !== undefined
      ? currentTotal === 0
        ? turnsSaved
        : Number(((currentAvgTurns * currentTotal + turnsSaved) / invocations).toFixed(2))
      : currentAvgTurns;

  const nowIso =
    typeof outcome === "object" && outcome !== null && outcome.nowIso
      ? outcome.nowIso
      : timestampMs !== undefined
        ? new Date(timestampMs).toISOString()
        : new Date().toISOString();

  const nowMs =
    timestampMs !== undefined
      ? timestampMs
      : typeof outcome === "object" && outcome !== null && outcome.nowIso
        ? Date.parse(outcome.nowIso)
        : Date.now();

  return Object.freeze({
    invocations,
    successes,
    failures,
    consecutiveFailures,
    wilsonScore,
    avgTurnsSaved,
    lastVerifiedAt: nowIso,
    totalInvocations: invocations,
    successfulInvocations: successes,
    failedInvocations: failures,
    lastUpdatedMs: nowMs,
  });
}

/**
 * Pure circuit-breaker evaluator determining if a skill should be rolled back
 * due to runtime performance regression (consecutiveFailures >= 2 OR (invocations >= 3 && wilsonScore < 0.35)).
 */
export function shouldAutoRollbackSkill(metrics: SkillFitnessMetrics): boolean {
  if (metrics.consecutiveFailures >= 2) {
    return true;
  }
  const total = metrics.invocations ?? metrics.totalInvocations ?? 0;
  if (total >= 3 && metrics.wilsonScore < 0.35) {
    return true;
  }
  return false;
}

/**
 * Distills an immutable turn trajectory into an evolving skill candidate.
 *
 * Supports both R1 object parameter:
 *   distillTrajectoryToSkillCandidate({ trajectory, activeConstraints?, existingSkill? })
 * and legacy positional parameters:
 *   distillTrajectoryToSkillCandidate(trajectory, existingSkill?, options?)
 */
export function distillTrajectoryToSkillCandidate(
  params: DistillSkillCandidateParams,
): EvolvingSkillRecord | null;
export function distillTrajectoryToSkillCandidate(
  trajectory: TurnTrajectoryRecord,
  existingSkill?: EvolvingSkillRecord,
  options?: {
    readonly initialStatus?: SkillLifecycleStatus;
    readonly timestampMs?: number;
    readonly activeConstraints?: readonly string[];
  },
): DistillTrajectoryResult;
export function distillTrajectoryToSkillCandidate(
  paramOrTrajectory: DistillSkillCandidateParams | TurnTrajectoryRecord,
  legacyExistingSkill?: EvolvingSkillRecord,
  legacyOptions?: {
    readonly initialStatus?: SkillLifecycleStatus;
    readonly timestampMs?: number;
    readonly activeConstraints?: readonly string[];
  },
): EvolvingSkillRecord | null | DistillTrajectoryResult {
  const isObjectParam = Boolean(
    paramOrTrajectory &&
    typeof paramOrTrajectory === "object" &&
    "trajectory" in paramOrTrajectory &&
    typeof (paramOrTrajectory as { trajectory?: unknown }).trajectory === "object" &&
    !("steps" in paramOrTrajectory) &&
    !("toolSteps" in paramOrTrajectory) &&
    !("userGoal" in paramOrTrajectory) &&
    !("taskGoal" in paramOrTrajectory),
  );

  const trajectory: TurnTrajectoryRecord = isObjectParam
    ? (paramOrTrajectory as DistillSkillCandidateParams).trajectory
    : (paramOrTrajectory as TurnTrajectoryRecord);

  const existingSkill: EvolvingSkillRecord | undefined = isObjectParam
    ? (paramOrTrajectory as DistillSkillCandidateParams).existingSkill
    : legacyExistingSkill;

  const activeConstraints: readonly string[] | undefined = isObjectParam
    ? (paramOrTrajectory as DistillSkillCandidateParams).activeConstraints
    : legacyOptions?.activeConstraints;

  // Gate 1: Zero-Trust Public Channel Rejection
  if (isZone0PublicTrajectory(trajectory)) {
    if (isObjectParam) {
      return null;
    }
    return {
      ok: false,
      reason: "Zone 0 public trajectory rejected",
      code: "ZONE_0_BLOCKED",
    };
  }

  // Trajectory Qualification Check
  const steps = trajectory.toolSteps ?? trajectory.steps ?? [];
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
  const isFinalSuccess =
    trajectory.verificationPassed === true ||
    normalizedOutcome === "success" ||
    trajectory.finalOutcome === true;

  const frictionRecovered = hasFailedStep && hasRecoveryStepAfterFailure && !lastStepFailed;
  const hasThreeOrMoreSteps = steps.length >= 3;

  const pathAQualified = isFinalSuccess && (frictionRecovered || hasThreeOrMoreSteps);

  const correctionText = (trajectory.userCorrection ?? trajectory.userCorrectionText ?? "").trim();
  const pathBQualified = correctionText.length >= 16;

  if (!pathAQualified && !pathBQualified) {
    if (isObjectParam) {
      return null;
    }
    return {
      ok: false,
      reason: "Trajectory not qualified for distillation",
      code: "NOT_QUALIFIED",
    };
  }

  // Slug & Goal derivation
  const rawGoal =
    (trajectory.taskGoal ?? trajectory.userGoal ?? "").trim() ||
    trajectory.id ||
    (trajectory.sessionId ? `session-${trajectory.sessionId}` : "unnamed-evolving-skill");

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

  // Synthesize Execution Strategy / Verified Procedure
  const successfulSteps = steps.filter(
    (s) => (s.succeeded === true || s.isError === false) && s.isError !== true && s.succeeded !== false,
  );
  const executionStrategy: string[] =
    successfulSteps.length > 0
      ? successfulSteps.map((s, idx) => {
          const inputPart = s.argsSummary
            ? ` with: ${s.argsSummary}`
            : s.input
              ? ` with: ${JSON.stringify(s.input)}`
              : "";
          return `${idx + 1}. Execute ${s.toolName}${inputPart}`;
        })
      : [`1. Execute verified recovery sequence for "${rawGoal}".`];

  // Synthesize Pitfalls & Active Constraints
  const pitfalls: string[] = [];
  for (const step of steps) {
    if (step.isError === true || step.succeeded === false) {
      const errOut =
        step.errorMessage ??
        (typeof step.outputSummary === "string"
          ? step.outputSummary
          : typeof step.output === "string"
            ? step.output
            : step.output
              ? JSON.stringify(step.output)
              : "unhandled error");
      pitfalls.push(`Avoid tool failure in ${step.toolName}: ${step.errorCode ?? errOut}`);
    }
  }
  if (pathBQualified) {
    pitfalls.push(`User Correction: ${correctionText}`);
  }
  if (activeConstraints && activeConstraints.length > 0) {
    for (const item of activeConstraints) {
      const rawContent = item.trim();
      const formatted = rawContent.startsWith("[CONSTRAINT]")
        ? rawContent
        : `[CONSTRAINT] ${rawContent}`;
      if (!pitfalls.includes(formatted)) {
        pitfalls.push(formatted);
      }
    }
  }
  const existingPitfalls =
    existingSkill?.pitfallsAndConstraints ?? existingSkill?.pitfallsConstraints;
  if (existingPitfalls) {
    for (const p of existingPitfalls) {
      if (!pitfalls.includes(p)) {
        pitfalls.push(p);
      }
    }
  }

  // Synthesize Verification Gate / Verification Criteria
  const verificationGate =
    trajectory.verificationCommand ??
    (isFinalSuccess
      ? "Confirm exit code 0 and parse the test/verification summary before reporting completion."
      : "Verify execution completes with 0 errors and clean output.");
  const verificationCriteria: string[] = [verificationGate];

  // Derive Triggers & Tools
  const rawWords = rawGoal
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9-]/g, ""))
    .filter((w) => w.length > 2);
  const candidateTriggers = Array.from(new Set([slug, ...rawWords.slice(0, 4)]));
  const triggers = existingSkill?.triggers ?? Object.freeze(candidateTriggers);

  const extractedTools = Array.from(new Set(steps.map((s) => s.toolName).filter(Boolean)));
  const tools = existingSkill?.tools ?? Object.freeze(extractedTools);

  const now = legacyOptions?.timestampMs ?? trajectory.timestampMs ?? Date.now();
  const nowIso = new Date(now).toISOString();

  const isOperator =
    trajectory.trustZone === "operator" ||
    (typeof trajectory.userScope === "string" &&
      trajectory.userScope.toLowerCase().includes("operator"));

  const defaultStatus: SkillLifecycleStatus = isOperator
    ? "canary"
    : trajectory.trustZone === "authenticated"
      ? "candidate"
      : "canary";

  const status: SkillLifecycleStatus =
    legacyOptions?.initialStatus ?? existingSkill?.status ?? defaultStatus;

  const metrics: SkillFitnessMetrics = Object.freeze({
    invocations: 0,
    successes: 0,
    failures: 0,
    consecutiveFailures: 0,
    wilsonScore: 0,
    avgTurnsSaved: 0,
    lastVerifiedAt: nowIso,
    totalInvocations: 0,
    successfulInvocations: 0,
    failedInvocations: 0,
    lastUpdatedMs: now,
  });

  const title = existingSkill?.name ?? existingSkill?.title ?? rawGoal;
  const description =
    existingSkill?.description ?? `Auto-synthesized evolving skill for: ${rawGoal}`;
  const whenToUse = existingSkill?.whenToUse ?? description;
  const workspaceId = trajectory.workspaceId ?? existingSkill?.workspaceId ?? "default";

  const candidate: EvolvingSkillRecord = Object.freeze({
    id,
    name: title,
    title,
    slug,
    version,
    description,
    status,
    category: existingSkill?.category ?? "workflow",
    triggers,
    tools,
    whenToUse,
    verifiedProcedure: Object.freeze(executionStrategy),
    executionStrategy: Object.freeze(executionStrategy),
    pitfallsAndConstraints: Object.freeze(pitfalls),
    pitfallsConstraints: Object.freeze(pitfalls),
    verificationGate,
    verificationCriteria: Object.freeze(verificationCriteria),
    fitness: metrics,
    metrics,
    workspaceId,
    createdAtMs: existingSkill?.createdAtMs ?? now,
    updatedAt: now,
    updatedAtMs: now,
    locked: existingSkill?.locked ?? false,
  });

  if (isObjectParam) {
    return candidate;
  }

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
export function serializeEvolvingSkillMarkdown(
  skill: EvolvingSkillRecord | (Partial<EvolvingSkillRecord> & { readonly id: string }),
): string {
  const title = skill.name ?? skill.title ?? "Evolving Skill";
  const slug = skill.slug ?? normalizeHyphenSlug(title);
  const whenToUse = skill.whenToUse ?? skill.description ?? "";
  const procedure = skill.verifiedProcedure ?? skill.executionStrategy ?? [];
  const pitfalls = skill.pitfallsAndConstraints ?? skill.pitfallsConstraints ?? [];
  const verificationGate =
    skill.verificationGate ??
    (skill.verificationCriteria && skill.verificationCriteria.length > 0
      ? skill.verificationCriteria.join("\n")
      : "Verify exit code 0 and clean output.");

  const totalInvocations =
    skill.fitness?.invocations ??
    skill.metrics?.totalInvocations ??
    skill.metrics?.invocations ??
    0;
  const successfulInvocations =
    skill.fitness?.successes ??
    skill.metrics?.successfulInvocations ??
    skill.metrics?.successes ??
    0;
  const failedInvocations =
    skill.fitness?.failures ?? skill.metrics?.failedInvocations ?? skill.metrics?.failures ?? 0;
  const consecutiveFailures =
    skill.fitness?.consecutiveFailures ?? skill.metrics?.consecutiveFailures ?? 0;
  const wilsonScore = skill.fitness?.wilsonScore ?? skill.metrics?.wilsonScore ?? 0;
  const avgTurnsSaved = skill.fitness?.avgTurnsSaved ?? skill.metrics?.avgTurnsSaved ?? 0;
  const lastUpdatedMs =
    skill.metrics?.lastUpdatedMs ??
    (skill.fitness?.lastVerifiedAt ? Date.parse(skill.fitness.lastVerifiedAt) : Date.now());
  const lastVerifiedAt = skill.fitness?.lastVerifiedAt ?? new Date(lastUpdatedMs).toISOString();

  const frontmatterData = {
    id: skill.id,
    name: title,
    title,
    slug,
    version: skill.version ?? "1.0.0",
    status: skill.status ?? "candidate",
    category: skill.category ?? "workflow",
    description: skill.description ?? whenToUse,
    triggers: Array.from(skill.triggers ?? []),
    tools: Array.from(skill.tools ?? []),
    fitness: {
      invocations: totalInvocations,
      successes: successfulInvocations,
      failures: failedInvocations,
      consecutiveFailures,
      wilsonScore,
      avgTurnsSaved,
      lastVerifiedAt,
    },
    metrics: {
      totalInvocations,
      successfulInvocations,
      failedInvocations,
      consecutiveFailures,
      wilsonScore,
      lastUpdatedMs,
    },
    workspaceId: skill.workspaceId ?? "default",
    createdAtMs: skill.createdAtMs ?? Date.now(),
    updatedAt: skill.updatedAt ?? skill.updatedAtMs ?? Date.now(),
    updatedAtMs: skill.updatedAtMs ?? skill.updatedAt ?? Date.now(),
    locked: skill.locked === true,
  };

  const yamlHeader = YAML.stringify(frontmatterData).trim();
  const pitfallsList =
    pitfalls.length > 0 ? pitfalls.map((p) => `- ${p}`).join("\n") : "- None recorded.";
  const verificationList = verificationGate.startsWith("- ")
    ? verificationGate
    : `- ${verificationGate.split("\n").join("\n- ")}`;

  return `---
${yamlHeader}
---

# ${title}

## When to Use
${whenToUse}

## Verified Procedure
${procedure.join("\n")}

## Pitfalls & Active Constraints
${pitfallsList}

## Verification Gate
${verificationList}
`;
}

function toSafeFiniteNumber(val: unknown, fallback: number): number {
  if (val === undefined || val === null) return fallback;
  const num = typeof val === "number" ? val : Number(val);
  return Number.isFinite(num) ? num : fallback;
}

const VALID_STATUSES: ReadonlySet<SkillLifecycleStatus> = new Set([
  "candidate",
  "canary",
  "verified_active",
  "deprecated",
  "quarantined",
  "draft",
]);

/**
 * Parses a serialized SKILL.md Markdown string into an immutable EvolvingSkillRecord.
 * Supports both R1 and legacy frontmatter and markdown sections.
 */
export function parseEvolvingSkillMarkdown(
  markdown: string,
  workspaceIdOverride?: string,
): EvolvingSkillRecord {
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

  // Parse Verified Procedure / Execution Strategy
  const strategyRaw = sections["Verified Procedure"] ?? sections["Execution Strategy"] ?? "";
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

  // Parse Verification Gate / Verification Standard lines
  const verificationRaw = sections["Verification Gate"] ?? sections["Verification Standard"] ?? "";
  const verificationCriteria = verificationRaw
    .split("\n")
    .map((l) => l.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
  const verificationGate =
    verificationCriteria.length > 0
      ? verificationCriteria.join("; ")
      : "Confirm exit code 0 and clean output.";

  // When to Use / Intent & Trigger Heuristics
  const whenToUse = sections["When to Use"] ?? sections["Intent & Trigger Heuristics"] ?? "";

  const metricsRaw = (parsedFrontmatter.fitness ?? parsedFrontmatter.metrics ?? {}) as Record<
    string,
    unknown
  >;
  const now = Date.now();

  const totalInvocations = Math.max(
    0,
    toSafeFiniteNumber(metricsRaw.invocations ?? metricsRaw.totalInvocations, 0),
  );
  const successfulInvocations = Math.max(
    0,
    toSafeFiniteNumber(metricsRaw.successes ?? metricsRaw.successfulInvocations, 0),
  );
  const failedInvocations = Math.max(
    0,
    toSafeFiniteNumber(metricsRaw.failures ?? metricsRaw.failedInvocations, 0),
  );
  const consecutiveFailures = Math.max(0, toSafeFiniteNumber(metricsRaw.consecutiveFailures, 0));
  const wilsonScore = Math.min(1, Math.max(0, toSafeFiniteNumber(metricsRaw.wilsonScore, 0)));
  const avgTurnsSaved = toSafeFiniteNumber(metricsRaw.avgTurnsSaved, 0);
  const lastUpdatedMs = toSafeFiniteNumber(
    metricsRaw.lastUpdatedMs,
    metricsRaw.lastVerifiedAt ? Date.parse(String(metricsRaw.lastVerifiedAt)) : now,
  );
  const lastVerifiedAt =
    typeof metricsRaw.lastVerifiedAt === "string"
      ? metricsRaw.lastVerifiedAt
      : new Date(lastUpdatedMs).toISOString();

  const metrics: SkillFitnessMetrics = Object.freeze({
    invocations: totalInvocations,
    successes: successfulInvocations,
    failures: failedInvocations,
    consecutiveFailures,
    wilsonScore,
    avgTurnsSaved,
    lastVerifiedAt,
    totalInvocations,
    successfulInvocations,
    failedInvocations,
    lastUpdatedMs,
  });

  const triggersRaw = parsedFrontmatter.triggers;
  const triggers: readonly string[] = Array.isArray(triggersRaw)
    ? Object.freeze(triggersRaw.map(String))
    : Object.freeze([]);

  const toolsRaw = parsedFrontmatter.tools;
  const tools: readonly string[] = Array.isArray(toolsRaw)
    ? Object.freeze(toolsRaw.map(String))
    : Object.freeze([]);

  // Extract H1 title fallback if frontmatter title is omitted
  const h1Match = /^#\s+([^\n]+)$/m.exec(body);
  const titleFromBody = h1Match ? h1Match[1]?.trim() : undefined;

  const id = String(parsedFrontmatter.id ?? `skill_${parsedFrontmatter.slug ?? "unnamed"}`);
  const slug = String(
    parsedFrontmatter.slug ??
      normalizeHyphenSlug(String(parsedFrontmatter.name ?? parsedFrontmatter.title ?? "unnamed")),
  );
  const version = String(parsedFrontmatter.version ?? "1.0.0");
  const title = String(
    parsedFrontmatter.title ?? parsedFrontmatter.name ?? titleFromBody ?? "Evolving Skill",
  );
  const description = String(parsedFrontmatter.description ?? whenToUse ?? "");
  const rawStatus = String(parsedFrontmatter.status ?? "");
  const status: SkillLifecycleStatus = VALID_STATUSES.has(rawStatus as SkillLifecycleStatus)
    ? (rawStatus as SkillLifecycleStatus)
    : "canary";

  const category = String(parsedFrontmatter.category ?? "workflow");
  const workspaceId = String(workspaceIdOverride ?? parsedFrontmatter.workspaceId ?? "default");
  const createdAtMs = toSafeFiniteNumber(parsedFrontmatter.createdAtMs, now);
  const updatedAt = toSafeFiniteNumber(
    parsedFrontmatter.updatedAt ?? parsedFrontmatter.updatedAtMs,
    now,
  );
  const rawLocked = parsedFrontmatter.locked;
  const locked =
    rawLocked === true || rawLocked === "true" || rawLocked === 1 || rawLocked === "1";

  return Object.freeze({
    id,
    name: title,
    title,
    slug,
    version,
    description,
    status,
    category,
    triggers,
    tools,
    whenToUse: whenToUse || description,
    verifiedProcedure: Object.freeze(executionStrategy),
    executionStrategy: Object.freeze(executionStrategy),
    pitfallsAndConstraints: Object.freeze(pitfallsConstraints),
    pitfallsConstraints: Object.freeze(pitfallsConstraints),
    verificationGate,
    verificationCriteria: Object.freeze(verificationCriteria),
    fitness: metrics,
    metrics,
    workspaceId,
    createdAtMs,
    updatedAt,
    updatedAtMs: updatedAt,
    locked,
  });
}

// ---------------------------------------------------------------------------
// Pre-LLM Call Interceptor & Guardrails (Pure DOP)
// ---------------------------------------------------------------------------

export interface EvaluatePreLlmCallHookParams {
  readonly prompt: string;
  readonly trustZone?: string;
  readonly activeConstraints?: readonly string[];
  readonly maxPromptChars?: number;
}

export interface EvaluatePreLlmCallHookResult {
  readonly allowed: boolean;
  readonly blockedReason?: string;
  readonly injectedSkillsPrompt?: string;
  readonly sanitizedPrompt: string;
}

const CRITICAL_PROMPT_INJECTION_PATTERNS: readonly RegExp[] = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+(?:instructions?|prompts?|rules?)/i,
  /disregard\s+(?:all\s+)?(?:previous|prior|above)/i,
  /forget\s+(?:everything|all|your)\s+(?:instructions?|rules?|guidelines?)/i,
  /system\s*:?\s*(?:override|command|prompt\s*injection)/i,
  /<\/?system>/i,
  /\[\s*(?:System\s*Message|System\s*Override|JAILBREAK)\s*\]/i,
  /^\s*System:\s+/im,
  /you\s+are\s+now\s+(?:a|an|in)\s+(?:unrestricted|developer\s+mode|jailbreak|DAN\s+mode)/i,
  /\bjailbreak\b/i,
  /bypass\s+(?:all\s+)?(?:safety|guardrails|filters)/i,
];

const SECRET_EXFILTRATION_PATTERNS: readonly RegExp[] = [
  /(?:cat|head|tail|grep)\s+.*(?:\.ssh\/(?:id_rsa|id_ed25519)|[\/\\]etc[\/\\](?:shadow|passwd)|\.env\b)/i,
  /(?:cat|head|tail|grep|strings)\s+.*(?:id_rsa|\.ssh)/i,
  /\bprintenv\b/i,
  /(?:printenv|env)\b.*(?:\||>|curl|wget|nc)/i,
  /(?:curl|wget|fetch|nc)\b.*(?:\bwebhook\.site\b|\brequestbin\b|\bngrok\b|\bpipedream\b|\bpastebin\b|\btransfer\.sh\b|\battacker\b)/i,
  /(?:exfiltrate|leak|steal|dump|transmit)\s+(?:all\s+)?(?:secrets?|tokens?|api[_-]?keys?|credentials?)/i,
  /-----BEGIN\s+.*PRIVATE\s+KEY-----/i,
];

const ZONE_0_PRIVILEGE_ESCALATION_PATTERNS: readonly RegExp[] = [
  /elevated\s*=\s*true/i,
  /role:\s*operator/i,
  /\bsudo\b/i,
  /grant\s+operator/i,
  /assume\s+role/i,
  /trustZone:\s*(?:operator|internal|admin)/i,
];

/**
 * Pure DOP pre-LLM call gate.
 * Blocks inference on hard budget violations, critical prompt injections,
 * secret exfiltrations, and Zone 0 privilege escalations.
 * Sanitizes allowed prompts and injects <active_constraints>.
 */
export function evaluatePreLlmCallHook(
  params: EvaluatePreLlmCallHookParams,
): EvaluatePreLlmCallHookResult {
  const prompt = typeof params?.prompt === "string" ? params.prompt : "";
  const maxPromptChars =
    typeof params?.maxPromptChars === "number" ? params.maxPromptChars : 250_000;

  // 1. Hard Budget Violation
  if (prompt.length > maxPromptChars) {
    return {
      allowed: false,
      blockedReason: `Hard prompt budget exceeded: ${prompt.length} chars exceeds limit of ${maxPromptChars}`,
      sanitizedPrompt: prompt,
    };
  }

  // 2. Critical Prompt Injection
  for (const pattern of CRITICAL_PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(prompt)) {
      return {
        allowed: false,
        blockedReason: "Critical prompt injection detected: instruction override or jailbreak pattern",
        sanitizedPrompt: prompt,
      };
    }
  }

  // 3. Secret Exfiltration
  for (const pattern of SECRET_EXFILTRATION_PATTERNS) {
    if (pattern.test(prompt)) {
      return {
        allowed: false,
        blockedReason: "Secret exfiltration trigger detected: unauthorized credential/system access pattern",
        sanitizedPrompt: prompt,
      };
    }
  }

  // 4. Zone 0 Privilege Escalation
  const trustZone =
    typeof params?.trustZone === "string" ? params.trustZone.trim().toLowerCase() : "";
  if (
    trustZone === "public" ||
    trustZone === "0" ||
    trustZone === "zone0" ||
    trustZone === "untrusted"
  ) {
    for (const pattern of ZONE_0_PRIVILEGE_ESCALATION_PATTERNS) {
      if (pattern.test(prompt)) {
        return {
          allowed: false,
          blockedReason: "Zone 0 untrusted channel privilege escalation attempt blocked",
          sanitizedPrompt: prompt,
        };
      }
    }
  }

  // 5. Prompt Sanitization
  const sanitizedPrompt = prompt
    .replace(/\0/g, "")
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(/\b(sk-[A-Za-z0-9_-]{20,})\b/g, "[REDACTED_API_KEY]");

  // 6. Injected Constraints
  let injectedSkillsPrompt: string | undefined;
  if (params?.activeConstraints && params.activeConstraints.length > 0) {
    injectedSkillsPrompt = [
      "<active_constraints>",
      ...params.activeConstraints.map((c) => `- ${c}`),
      "</active_constraints>",
    ].join("\n");
  }

  return {
    allowed: true,
    injectedSkillsPrompt,
    sanitizedPrompt,
  };
}

