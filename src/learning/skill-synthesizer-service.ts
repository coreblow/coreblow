/**
 * CoreBlow Cory EvoLoop — Skill Synthesizer Gateway Service
 *
 * Implements the stateful Object-Oriented Programming (OOP) lifecycle supervisor
 * and 3-Gate Zero-Trust security boundary for autonomous skill synthesis and evolution.
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { GatewayService, ServiceHealth } from "../gateway/service-registry.js";
import type { CoryBootstrapService } from "../memory/cory.js";
import { scanSource, type SkillScanFinding } from "../security/skill-scanner.js";
import {
  distillTrajectoryToSkillCandidate,
  isZone0PublicTrajectory,
  parseEvolvingSkillMarkdown,
  serializeEvolvingSkillMarkdown,
  shouldAutoRollbackSkill,
  updateSkillFitnessMetrics,
  type EvolvingSkillRecord,
  type SkillFitnessMetrics,
  type SkillLifecycleStatus,
  type TurnTrajectoryRecord,
} from "./dop-skill-distiller.js";

// ---------------------------------------------------------------------------
// Types & Options
// ---------------------------------------------------------------------------

export interface SkillIngestOptions {
  readonly syncConstraints?: boolean;
  readonly targetStatus?: SkillLifecycleStatus;
  readonly activeConstraints?: readonly string[];
}

export interface SkillSynthesizerServiceOptions {
  readonly stateDir?: string;
  readonly coryService?: CoryBootstrapService;
  readonly cory?: CoryBootstrapService;
  readonly approvalPolicy?: "auto" | "prompt";
  readonly autoPromoteMinInvocations?: number;
  readonly autoPromoteWilsonScoreThreshold?: number;
  readonly autoRollbackConsecutiveFailures?: number;
}

export interface EvaluateSkillSecurityParams {
  readonly markdown: string;
  readonly skillId: string;
  readonly trajectory?: TurnTrajectoryRecord;
}

export interface SecurityEvaluationResult {
  readonly allowed: boolean;
  readonly findings: readonly SkillScanFinding[];
  readonly reason?: string;
  readonly error?: string;
}

export interface IngestSkillResult {
  readonly ok: boolean;
  readonly success: boolean;
  readonly status?: SkillLifecycleStatus | "rejected";
  readonly skill?: EvolvingSkillRecord;
  readonly reason?: string;
  readonly error?: string;
  readonly quarantineReason?: string;
  readonly findings?: readonly SkillScanFinding[];
  readonly markdown?: string;
}

export interface SkillOutcomeResult {
  readonly skillId: string;
  readonly previousStatus: SkillLifecycleStatus;
  readonly currentStatus: SkillLifecycleStatus;
  readonly previousVersion: string;
  readonly currentVersion: string;
  readonly metrics: SkillFitnessMetrics;
  readonly autoPromoted: boolean;
  readonly autoRolledBack: boolean;
}

export interface RollbackResult {
  readonly success: boolean;
  readonly rolledBack: boolean;
  readonly restoredVersion?: string;
  readonly skill?: EvolvingSkillRecord;
  readonly error?: string;
}

export interface PrepareAheadCompactionOptions {
  readonly maxRevisionsPerSkill?: number;
  readonly workspaceId?: string;
}

export interface PrepareAheadCompactionResult {
  readonly compactedSkillsCount: number;
  readonly prunedRevisionsCount: number;
  readonly precomputedPromptLength: number;
  readonly activeSkillsPrompt: string;
}

interface FitnessLedgerData {
  version: number;
  skills: Record<string, SkillFitnessMetrics>;
  updatedAtMs: number;
}

// ---------------------------------------------------------------------------
// Security Constants
// ---------------------------------------------------------------------------

const RAW_SECRET_PATTERNS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "openai-api-key", pattern: /sk-[A-Za-z0-9_-]{20,}/ },
  { name: "github-pat", pattern: /ghp_[A-Za-z0-9]{20,}/ },
  { name: "anthropic-api-key", pattern: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  {
    name: "generic-api-key",
    pattern: /(?:\\?["']?(?:api[_-]?key|secret|token)\\?["']?)\s*[:=]\s*\\?["'][A-Za-z0-9_-]{20,}\\?["']/i,
  },
];

const CRITICAL_RULE_IDS = new Set([
  "dangerous-exec",
  "dynamic-code-execution",
  "crypto-mining",
  "env-harvesting",
  "secret-leak-detected",
]);

// ---------------------------------------------------------------------------
// Helper Utilities
// ---------------------------------------------------------------------------

function compareSemver(v1: string, v2: string): number {
  const p1 = v1.split(".").map((n) => parseInt(n, 10) || 0);
  const p2 = v2.split(".").map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(p1.length, p2.length);
  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] ?? 0;
    const num2 = p2[i] ?? 0;
    if (num1 !== num2) {
      return num1 - num2;
    }
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Service Implementation
// ---------------------------------------------------------------------------

export class CorySkillSynthesizerService implements GatewayService {
  public readonly name = "cory-skill-synthesizer";

  private readonly stateDir: string;
  private readonly learnedDir: string;
  private readonly revisionsDir: string;
  private readonly quarantineDir: string;
  private readonly ledgerPath: string;
  private readonly options: SkillSynthesizerServiceOptions;
  private readonly coryBootstrap: CoryBootstrapService | undefined;
  public readonly approvalPolicy: "auto" | "prompt";

  private isStarted = false;
  private readonly skills = new Map<string, EvolvingSkillRecord>();
  private ledger: FitnessLedgerData = {
    version: 1,
    skills: {},
    updatedAtMs: Date.now(),
  };

  constructor(options: SkillSynthesizerServiceOptions = {}) {
    this.options = options;
    const defaultStateDir = path.join(os.homedir(), ".coreblow", "skills");
    const rawDir = options.stateDir ?? defaultStateDir;
    this.stateDir = rawDir.startsWith("~/") ? path.join(os.homedir(), rawDir.slice(2)) : rawDir;

    this.learnedDir = path.join(this.stateDir, "learned");
    this.revisionsDir = path.join(this.stateDir, ".revisions");
    this.quarantineDir = path.join(this.stateDir, "quarantine");
    this.ledgerPath = path.join(this.stateDir, "fitness-ledger.json");
    this.coryBootstrap = options.coryService ?? options.cory;
    this.approvalPolicy = options.approvalPolicy ?? "auto";
  }

  public get cory(): CoryBootstrapService | undefined {
    return this.coryBootstrap;
  }

  // -------------------------------------------------------------------------
  // Lifecycle Methods
  // -------------------------------------------------------------------------

  public async start(): Promise<void> {
    await fs.mkdir(this.learnedDir, { recursive: true });
    await fs.mkdir(this.revisionsDir, { recursive: true });
    await fs.mkdir(this.quarantineDir, { recursive: true });

    // Load persisted fitness ledger
    try {
      const ledgerContent = await fs.readFile(this.ledgerPath, "utf-8");
      const parsed = JSON.parse(ledgerContent) as FitnessLedgerData;
      if (parsed && typeof parsed === "object" && parsed.skills) {
        this.ledger = parsed;
      }
    } catch {
      this.ledger = {
        version: 1,
        skills: {},
        updatedAtMs: Date.now(),
      };
    }

    // Load all active learned skills
    try {
      const entries = await fs.readdir(this.learnedDir);
      for (const entry of entries) {
        if (!entry.endsWith(".md")) continue;
        const filePath = path.join(this.learnedDir, entry);
        try {
          const content = await fs.readFile(filePath, "utf-8");
          const skill = parseEvolvingSkillMarkdown(content);
          this.skills.set(skill.id, skill);

          // Update ledger entry if not present
          if (!this.ledger.skills[skill.id]) {
            this.ledger.skills[skill.id] = skill.metrics;
          }

          // Index into search index if active
          if (skill.status === "verified_active" || skill.status === "canary") {
            this.indexSkill(skill, content);
          }
        } catch {
          // Skip corrupt or unparsable files
        }
      }
    } catch {
      // Directory read issues handled gracefully
    }

    this.isStarted = true;
  }

  public async stop(): Promise<void> {
    await this.persistLedger();
    this.isStarted = false;
  }

  public health(): ServiceHealth {
    if (!this.isStarted) {
      return {
        status: "down",
        detail: "Cory Skill Synthesizer service is stopped",
      };
    }

    return {
      status: "healthy",
      detail: `Managing ${this.skills.size} learned skills in ${this.stateDir}`,
    };
  }

  // -------------------------------------------------------------------------
  // 3-Gate Zero-Trust Security Check
  // -------------------------------------------------------------------------

  /**
   * Evaluates a skill and its execution context through the 3-Gate Zero-Trust security boundary.
   * Gate 1: Rejects Zone 0 / public channels.
   * Gate 2: Runs AST scanner + checks raw secret patterns.
   * Gate 3: Verifies semantic and markdown structure integrity.
   */
  public evaluateSkillSecurity(
    params: EvaluateSkillSecurityParams | string,
    maybeId?: string,
  ): SecurityEvaluationResult {
    const isParamObject = typeof params === "object" && params !== null;
    const markdown = isParamObject ? params.markdown : params;
    const skillId = isParamObject ? params.skillId : (maybeId ?? "skill_eval");
    const trajectory = isParamObject ? params.trajectory : undefined;

    // Gate 1: Zero-Trust Zone 0 Defense
    if (trajectory && isZone0PublicTrajectory(trajectory)) {
      return {
        allowed: false,
        findings: [],
        reason: "Zone 0 public trajectory rejected",
        error: "ZONE_0_BLOCKED",
      };
    }

    // Gate 2: AST Rule Scanning & Secret Redaction
    const findings: SkillScanFinding[] = [...scanSource(markdown, `${skillId}.md`)];

    // Scan raw trajectory step inputs/outputs if trajectory provided
    if (trajectory) {
      const steps = trajectory.toolSteps ?? trajectory.steps ?? [];
      for (const step of steps) {
        if (step.argsSummary) {
          findings.push(...scanSource(step.argsSummary, `step_${step.toolName}_args.js`));
        }
        if (typeof step.input === "string") {
          findings.push(...scanSource(step.input, `step_${step.toolName}_input.js`));
        } else if (step.input) {
          findings.push(...scanSource(JSON.stringify(step.input), `step_${step.toolName}_input.js`));
        }

        if (typeof step.outputSummary === "string") {
          findings.push(...scanSource(step.outputSummary, `step_${step.toolName}_outsummary.js`));
        }
        if (typeof step.output === "string") {
          findings.push(...scanSource(step.output, `step_${step.toolName}_output.js`));
        } else if (step.output) {
          findings.push(...scanSource(JSON.stringify(step.output), `step_${step.toolName}_output.js`));
        }
      }
    }

    // Check for hardcoded raw secret patterns
    const corpusToCheck: string[] = [markdown];
    if (trajectory) {
      if (trajectory.taskGoal) corpusToCheck.push(trajectory.taskGoal);
      if (trajectory.userCorrection) corpusToCheck.push(trajectory.userCorrection);
      if (trajectory.userCorrectionText) corpusToCheck.push(trajectory.userCorrectionText);
      const steps = trajectory.toolSteps ?? trajectory.steps ?? [];
      for (const s of steps) {
        if (s.argsSummary) corpusToCheck.push(s.argsSummary);
        if (typeof s.input === "string") {
          corpusToCheck.push(s.input);
        }
        if (s.input) {
          corpusToCheck.push(JSON.stringify(s.input));
        }
        if (s.outputSummary) corpusToCheck.push(s.outputSummary);
        if (typeof s.output === "string") {
          corpusToCheck.push(s.output);
        }
        if (s.output) {
          corpusToCheck.push(JSON.stringify(s.output));
        }
        if (s.errorMessage) corpusToCheck.push(s.errorMessage);
      }
    }

    for (const text of corpusToCheck) {
      for (const { name, pattern } of RAW_SECRET_PATTERNS) {
        if (pattern.test(text)) {
          findings.push({
            ruleId: "secret-leak-detected",
            severity: "critical",
            file: `${skillId}.md`,
            line: 1,
            message: `Hardcoded secret pattern detected (${name})`,
            evidence: "[REDACTED_SECRET]",
          });
        }
      }
    }

    const hasCritical = findings.some(
      (f) => f.severity === "critical" || CRITICAL_RULE_IDS.has(f.ruleId),
    );

    if (hasCritical) {
      const reason = findings
        .filter((f) => f.severity === "critical" || CRITICAL_RULE_IDS.has(f.ruleId))
        .map((f) => f.message)
        .join("; ");
      return {
        allowed: false,
        findings,
        reason: `Security violation: ${reason}`,
        error: "SECURITY_QUARANTINED",
      };
    }

    // Gate 3: Semantic & Markdown Integrity Verification
    try {
      const parsed = parseEvolvingSkillMarkdown(markdown);
      const procedure = parsed.verifiedProcedure ?? parsed.executionStrategy ?? [];
      if (!parsed.version || (!parsed.slug && !parsed.id) || procedure.length === 0) {
        return {
          allowed: false,
          findings,
          reason:
            "Missing mandatory skill structural sections (version, slug, or verified procedure)",
          error: "GATE_3_INTEGRITY_FAILED",
        };
      }
    } catch (err) {
      return {
        allowed: false,
        findings,
        reason: `Gate 3 integrity verification failed: ${err instanceof Error ? err.message : String(err)}`,
        error: "GATE_3_INTEGRITY_FAILED",
      };
    }

    return {
      allowed: true,
      findings: Object.freeze(findings),
    };
  }

  // -------------------------------------------------------------------------
  // Skill Ingestion Pipeline (3-Gate Security & Evolution)
  // -------------------------------------------------------------------------

  public async ingestTrajectory(
    trajectory: TurnTrajectoryRecord,
    options?: SkillIngestOptions,
  ): Promise<IngestSkillResult> {
    // ─── GATE 1: Zero-Trust Zone 0 Defense ──────────────────────────────────
    if (isZone0PublicTrajectory(trajectory)) {
      return {
        ok: false,
        success: false,
        status: "rejected",
        reason: "Zone 0 public trajectory rejected",
        error: "ZONE_0_BLOCKED",
      };
    }

    // Resolve existing skill candidate if updating an established procedure
    const existingSkill = this.findExistingSkillForTrajectory(trajectory);

    if (existingSkill?.locked === true) {
      return {
        ok: false,
        success: false,
        status: "rejected",
        reason: "Skill is locked against autonomous writes",
        error: "SKILL_LOCKED",
        skill: existingSkill,
      };
    }

    // ─── Fetch Active Constraints from Cory Memory ──────────────────────────
    const fetchedConstraints: string[] = [];
    if (options?.syncConstraints !== false && this.coryBootstrap?.memoryStore) {
      try {
        const scope = {
          workspaceId: trajectory.workspaceId ?? "default",
          userScope: trajectory.userScope ?? "default",
        };
        const items = this.coryBootstrap.memoryStore.listLayerItems("constraint", scope);
        for (const item of items) {
          fetchedConstraints.push(item.content);
        }
      } catch {
        // Memory constraint sync is non-fatal
      }
    }

    const mergedConstraints = Array.from(
      new Set([...(options?.activeConstraints ?? []), ...fetchedConstraints]),
    );

    // ─── DOP Distillation ──────────────────────────────────────────────────
    const defaultStatus =
      trajectory.trustZone === "operator" ||
      (typeof trajectory.userScope === "string" &&
        trajectory.userScope.toLowerCase().includes("operator"))
        ? "canary"
        : trajectory.trustZone === "authenticated"
          ? "candidate"
          : "canary";

    const targetStatus = options?.targetStatus ?? defaultStatus;
    const distillResult = distillTrajectoryToSkillCandidate(trajectory, existingSkill, {
      initialStatus: targetStatus,
      activeConstraints: mergedConstraints,
    });

    if (!distillResult.ok) {
      return {
        ok: false,
        success: false,
        status: "rejected",
        reason: distillResult.reason,
        error: distillResult.code,
      };
    }

    let candidate = distillResult.candidate;
    if (options?.targetStatus && candidate.status !== options.targetStatus) {
      candidate = Object.freeze({ ...candidate, status: options.targetStatus });
    }

    const markdownText = serializeEvolvingSkillMarkdown(candidate);

    // ─── GATE 2 & 3: 3-Gate Zero-Trust Security Boundary ─────────────────────
    const securityCheck = this.evaluateSkillSecurity({
      markdown: markdownText,
      skillId: candidate.id,
      trajectory,
    });

    if (!securityCheck.allowed) {
      if (securityCheck.error === "ZONE_0_BLOCKED") {
        return {
          ok: false,
          success: false,
          status: "rejected",
          reason: securityCheck.reason ?? "Zone 0 public trajectory rejected",
          error: "ZONE_0_BLOCKED",
        };
      }

      if (securityCheck.error === "SECURITY_QUARANTINED") {
        const quarantinedRecord: EvolvingSkillRecord = Object.freeze({
          ...candidate,
          status: "quarantined",
        });

        const quarantinedMarkdown = serializeEvolvingSkillMarkdown(quarantinedRecord);
        const quarantinePath = path.join(this.quarantineDir, `${quarantinedRecord.id}.md`);
        await fs.writeFile(quarantinePath, quarantinedMarkdown, "utf-8");

        this.skills.set(quarantinedRecord.id, quarantinedRecord);
        this.ledger.skills[quarantinedRecord.id] = quarantinedRecord.metrics;
        await this.persistLedger();

        return {
          ok: false,
          success: false,
          status: "quarantined",
          skill: quarantinedRecord,
          reason: "Security violation: quarantined",
          quarantineReason: securityCheck.reason,
          findings: securityCheck.findings,
          markdown: quarantinedMarkdown,
        };
      }

      return {
        ok: false,
        success: false,
        status: "rejected",
        reason: securityCheck.reason ?? "Gate 3 integrity verification failed",
        error: securityCheck.error ?? "GATE_3_INTEGRITY_FAILED",
      };
    }

    // ─── Revision Snapshotting ──────────────────────────────────────────────
    const learnedFilePath = path.join(this.learnedDir, `${candidate.id}.md`);
    try {
      const existingMarkdown = await fs.readFile(learnedFilePath, "utf-8");
      const existingRecord = parseEvolvingSkillMarkdown(existingMarkdown);
      const snapshotPath = path.join(
        this.revisionsDir,
        `${candidate.id}@${existingRecord.version}.md`,
      );
      await fs.writeFile(snapshotPath, existingMarkdown, "utf-8");
    } catch {
      // Existing skill did not exist on disk, no snapshot needed
    }

    // ─── Persistence & Ledger Update ────────────────────────────────────────
    await fs.writeFile(learnedFilePath, markdownText, "utf-8");
    this.skills.set(candidate.id, candidate);
    this.ledger.skills[candidate.id] = candidate.metrics;
    await this.persistLedger();

    // Index into Cory memory store AND search index
    this.indexSkill(candidate, markdownText);

    return {
      ok: true,
      success: true,
      status: candidate.status,
      skill: candidate,
      markdown: markdownText,
    };
  }

  // -------------------------------------------------------------------------
  // Lock Management
  // -------------------------------------------------------------------------

  public async setSkillLock(skillId: string, locked: boolean): Promise<EvolvingSkillRecord> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`SKILL_NOT_FOUND: Skill with id '${skillId}' does not exist.`);
    }

    const now = Date.now();
    const updatedSkill: EvolvingSkillRecord = Object.freeze({
      ...skill,
      locked: Boolean(locked),
      updatedAt: now,
      updatedAtMs: now,
    });

    this.skills.set(skillId, updatedSkill);
    this.ledger.skills[skillId] = updatedSkill.metrics;
    await this.persistLedger();

    const markdown = serializeEvolvingSkillMarkdown(updatedSkill);
    const learnedPath = path.join(this.learnedDir, `${skillId}.md`);
    await fs.writeFile(learnedPath, markdown, "utf-8");

    this.indexSkill(updatedSkill, markdown);

    return updatedSkill;
  }

  // -------------------------------------------------------------------------
  // Skill Toggle & Direct Patching
  // -------------------------------------------------------------------------

  public async toggleSkill(skillId: string, enabled?: boolean): Promise<EvolvingSkillRecord> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`SKILL_NOT_FOUND: Skill with id '${skillId}' does not exist.`);
    }

    const nextStatus: SkillLifecycleStatus =
      enabled !== undefined
        ? (enabled ? "verified_active" : "deprecated")
        : skill.status === "verified_active"
          ? "deprecated"
          : "verified_active";

    const updatedSkill: EvolvingSkillRecord = Object.freeze({
      ...skill,
      status: nextStatus,
      updatedAt: Date.now(),
      updatedAtMs: Date.now(),
    });

    this.skills.set(skillId, updatedSkill);
    this.ledger.skills[skillId] = updatedSkill.metrics;
    await this.persistLedger();

    const markdown = serializeEvolvingSkillMarkdown(updatedSkill);
    await fs.writeFile(path.join(this.learnedDir, `${skillId}.md`), markdown, "utf-8");
    if (updatedSkill.slug) {
      const slugDir = path.join(this.stateDir, "skills", updatedSkill.slug);
      try {
        await fs.mkdir(slugDir, { recursive: true });
        await fs.writeFile(path.join(slugDir, "SKILL.md"), markdown, "utf-8");
      } catch {}
    }

    if (nextStatus === "verified_active") {
      this.indexSkill(updatedSkill, markdown);
    } else if (this.coryBootstrap?.searchIndex) {
      try {
        this.coryBootstrap.searchIndex.removeItem(`skill:${skillId}`);
      } catch {}
    }

    return updatedSkill;
  }

  public async patchSkill(
    skillId: string,
    updates: {
      instructions?: string;
      description?: string;
      triggers?: string[];
      procedure?: string[];
    },
  ): Promise<EvolvingSkillRecord> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`SKILL_NOT_FOUND: Skill with id '${skillId}' does not exist.`);
    }

    const versionParts = (skill.version || "1.0.0").split(".").map((n) => parseInt(n, 10) || 0);
    const newVersion = `${versionParts[0] || 1}.${versionParts[1] || 0}.${(versionParts[2] || 0) + 1}`;

    const updatedProcedure = updates.procedure
      ? Object.freeze([...updates.procedure])
      : (skill.verifiedProcedure ?? skill.executionStrategy);

    const updatedSkill: EvolvingSkillRecord = Object.freeze({
      ...skill,
      version: newVersion,
      description: updates.description ?? skill.description,
      triggers: updates.triggers ? Object.freeze([...updates.triggers]) : skill.triggers,
      verifiedProcedure: updatedProcedure,
      executionStrategy: updatedProcedure,
      updatedAt: Date.now(),
      updatedAtMs: Date.now(),
    });

    this.skills.set(skillId, updatedSkill);
    this.ledger.skills[skillId] = updatedSkill.metrics;
    await this.persistLedger();

    const markdown = serializeEvolvingSkillMarkdown(updatedSkill);
    await fs.writeFile(path.join(this.learnedDir, `${skillId}.md`), markdown, "utf-8");
    if (updatedSkill.slug) {
      const slugDir = path.join(this.stateDir, "skills", updatedSkill.slug);
      try {
        await fs.mkdir(slugDir, { recursive: true });
        await fs.writeFile(path.join(slugDir, "SKILL.md"), markdown, "utf-8");
      } catch {}
    }

    this.indexSkill(updatedSkill, markdown);
    return updatedSkill;
  }

  /**
   * EvoLoop Closed-Loop Auto-Distill & Auto-Patch:
   * When steps >= 3 and finalOutcome === "success":
   * - If an existing skill matches the goal, auto-patch SKILL.md with new tool patterns (incrementing patch version)
   * - If no skill matches and trajectory is reusable, auto-distill a new verified SKILL.md into ~/.coreblow/skills/<slug>/SKILL.md
   */
  public async autoDistillOrPatchFromTurn(
    trajectory: TurnTrajectoryRecord,
  ): Promise<{
    ok: boolean;
    action?: "distilled" | "patched";
    skill?: EvolvingSkillRecord;
    reason?: string;
  }> {
    const steps = trajectory.steps ?? trajectory.toolSteps ?? [];
    if (steps.length < 3 || trajectory.finalOutcome !== "success") {
      return {
        ok: false,
        reason: "Turn does not qualify for auto-distill/patch (requires steps.length >= 3 and success outcome)",
      };
    }

    if (isZone0PublicTrajectory(trajectory)) {
      return {
        ok: false,
        reason: "Zone 0 public trajectory blocked from mutating skills",
      };
    }

    const goal = (trajectory.userGoal ?? trajectory.taskGoal ?? "").trim();
    if (!goal) {
      return { ok: false, reason: "Missing goal in trajectory" };
    }

    const existingSkill = this.findExistingSkillForTrajectory(trajectory);
    if (existingSkill?.locked === true) {
      return { ok: false, reason: "Skill is locked against auto-patching", skill: existingSkill };
    }

    const distillResult = distillTrajectoryToSkillCandidate(trajectory, existingSkill, {
      initialStatus: "verified_active",
    });

    if (!distillResult.ok) {
      return { ok: false, reason: distillResult.reason };
    }

    const candidate = distillResult.candidate;
    this.skills.set(candidate.id, candidate);
    this.ledger.skills[candidate.id] = candidate.metrics;
    await this.persistLedger();

    const markdown = serializeEvolvingSkillMarkdown(candidate);
    await fs.writeFile(path.join(this.learnedDir, `${candidate.id}.md`), markdown, "utf-8");
    if (candidate.slug) {
      const slugDir = path.join(this.stateDir, "skills", candidate.slug);
      try {
        await fs.mkdir(slugDir, { recursive: true });
        await fs.writeFile(path.join(slugDir, "SKILL.md"), markdown, "utf-8");
      } catch {}
    }

    this.indexSkill(candidate, markdown);
    return {
      ok: true,
      action: existingSkill ? "patched" : "distilled",
      skill: candidate,
    };
  }

  // -------------------------------------------------------------------------
  // Outcome Telemetry & Bayesian Evolution
  // -------------------------------------------------------------------------

  public async recordSkillOutcome(
    skillId: string,
    outcome:
      | { readonly succeeded: boolean; readonly turnsSaved?: number; readonly nowIso?: string }
      | "success"
      | "failure"
      | boolean,
  ): Promise<EvolvingSkillRecord> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`SKILL_NOT_FOUND: Skill with id '${skillId}' does not exist.`);
    }

    const prevStatus = skill.status;
    const updatedMetrics = updateSkillFitnessMetrics(skill.metrics, outcome);

    // Auto-promotion logic: canary/candidate/draft -> verified_active
    let newStatus = prevStatus;
    const minInvocations = this.options.autoPromoteMinInvocations ?? 3;
    const minWilson = this.options.autoPromoteWilsonScoreThreshold ?? 0.65;
    const totalInvocations = updatedMetrics.invocations ?? updatedMetrics.totalInvocations ?? 0;
    const consecutiveFailures = updatedMetrics.consecutiveFailures;
    const failedInvocations = updatedMetrics.failures ?? updatedMetrics.failedInvocations ?? 0;

    if (
      (prevStatus === "canary" || prevStatus === "candidate" || prevStatus === "draft") &&
      totalInvocations >= minInvocations &&
      (updatedMetrics.wilsonScore >= minWilson ||
        (totalInvocations >= minInvocations &&
          consecutiveFailures === 0 &&
          failedInvocations === 0)) &&
      consecutiveFailures === 0
    ) {
      newStatus = "verified_active";
    }

    // Auto-rollback regression circuit breaker
    const maxConsecutiveFailures = this.options.autoRollbackConsecutiveFailures ?? 2;
    if (consecutiveFailures >= maxConsecutiveFailures || shouldAutoRollbackSkill(updatedMetrics)) {
      if (skill.locked === true) {
        // Locked skills must NEVER auto-rollback or deprecate!
      } else {
        const rollbackRecord = await this.rollbackSkill(skillId);
        return rollbackRecord;
      }
    }

    const updatedSkill: EvolvingSkillRecord = Object.freeze({
      ...skill,
      status: skill.locked === true ? skill.status : newStatus,
      fitness: updatedMetrics,
      metrics: updatedMetrics,
      updatedAt: Date.now(),
      updatedAtMs: Date.now(),
    });

    this.skills.set(skillId, updatedSkill);
    this.ledger.skills[skillId] = updatedMetrics;
    await this.persistLedger();

    const markdown = serializeEvolvingSkillMarkdown(updatedSkill);
    const learnedPath = path.join(this.learnedDir, `${skillId}.md`);
    await fs.writeFile(learnedPath, markdown, "utf-8");

    this.indexSkill(updatedSkill, markdown);

    return updatedSkill;
  }

  // -------------------------------------------------------------------------
  // Atomic Rollback Mechanism
  // -------------------------------------------------------------------------

  public async rollbackSkill(
    skillId: string,
    targetVersion?: string,
  ): Promise<EvolvingSkillRecord> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`SKILL_NOT_FOUND: Skill with id '${skillId}' does not exist.`);
    }

    if (skill.locked === true) {
      throw new Error(`SKILL_LOCKED: Cannot rollback locked skill '${skillId}'.`);
    }

    try {
      const prefix = `${skillId}@`;
      const entries = await fs.readdir(this.revisionsDir);
      const matchingRevisions = entries
        .filter((f) => f.startsWith(prefix) && f.endsWith(".md"))
        .map((f) => {
          const versionStr = f.slice(prefix.length, -3);
          return { filename: f, version: versionStr };
        });

      if (matchingRevisions.length > 0) {
        let target = matchingRevisions.find((r) => r.version === targetVersion);
        if (!target) {
          // Sort descending by semver to pick latest prior snapshot
          matchingRevisions.sort((a, b) => compareSemver(b.version, a.version));
          target = matchingRevisions[0]!;
        }

        const revisionPath = path.join(this.revisionsDir, target.filename);
        const restoredMarkdown = await fs.readFile(revisionPath, "utf-8");
        const restoredSkill = parseEvolvingSkillMarkdown(restoredMarkdown);

        // Reset consecutive failures counter on restored skill
        const restoredMetrics: SkillFitnessMetrics = Object.freeze({
          ...restoredSkill.metrics,
          consecutiveFailures: 0,
          lastVerifiedAt: new Date().toISOString(),
          lastUpdatedMs: Date.now(),
        });

        const cleanRestoredSkill: EvolvingSkillRecord = Object.freeze({
          ...restoredSkill,
          fitness: restoredMetrics,
          metrics: restoredMetrics,
          updatedAt: Date.now(),
          updatedAtMs: Date.now(),
        });

        const cleanMarkdown = serializeEvolvingSkillMarkdown(cleanRestoredSkill);
        const learnedPath = path.join(this.learnedDir, `${skillId}.md`);
        await fs.writeFile(learnedPath, cleanMarkdown, "utf-8");

        this.skills.set(skillId, cleanRestoredSkill);
        this.ledger.skills[skillId] = cleanRestoredSkill.metrics;
        await this.persistLedger();

        this.indexSkill(cleanRestoredSkill, cleanMarkdown);
        return cleanRestoredSkill;
      }
    } catch {
      // Revisions read failed, fallback to deprecation
    }

    // If no prior revision snapshots exist, deprecate the current skill
    const deprecatedSkill: EvolvingSkillRecord = Object.freeze({
      ...skill,
      status: "deprecated",
      updatedAt: Date.now(),
      updatedAtMs: Date.now(),
    });

    this.skills.set(skillId, deprecatedSkill);
    this.ledger.skills[skillId] = deprecatedSkill.metrics;
    await this.persistLedger();

    const depMarkdown = serializeEvolvingSkillMarkdown(deprecatedSkill);
    const learnedPath = path.join(this.learnedDir, `${skillId}.md`);
    await fs.writeFile(learnedPath, depMarkdown, "utf-8");

    // Remove deprecated skill from search index
    if (this.coryBootstrap?.searchIndex) {
      try {
        this.coryBootstrap.searchIndex.removeItem(`skill:${skillId}`);
      } catch {
        // Search index removal is non-fatal
      }
    }

    return deprecatedSkill;
  }

  // -------------------------------------------------------------------------
  // Sub-2ms Retrieval & Prompt Assembly
  // -------------------------------------------------------------------------

  public async matchSkillsForQuery(
    query: string,
    workspaceIdOrLimit?: string | number,
    topK?: number,
  ): Promise<EvolvingSkillRecord[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const limit = typeof workspaceIdOrLimit === "number" ? workspaceIdOrLimit : (topK ?? 5);

    const targetWorkspace = typeof workspaceIdOrLimit === "string" ? workspaceIdOrLimit : undefined;

    const queryTokens = trimmed.split(/\s+/).filter((t) => t.length > 1);
    const candidateScores = new Map<string, number>();

    // Fast-path in-memory matching (< 1ms)
    for (const skill of this.skills.values()) {
      if (skill.status !== "verified_active" && skill.status !== "canary") {
        continue;
      }

      if (
        targetWorkspace &&
        skill.workspaceId &&
        skill.workspaceId !== targetWorkspace &&
        skill.workspaceId !== "default"
      ) {
        continue;
      }

      let score = 0;
      const triggersLower = skill.triggers.map((t) => t.toLowerCase());

      // 1. Exact trigger match
      for (const t of triggersLower) {
        if (trimmed.includes(t) || t.includes(trimmed)) {
          score += 10;
        }
      }

      // 2. Token overlap in title, slug, and description
      const corpus =
        `${skill.title ?? skill.name} ${skill.slug} ${skill.description}`.toLowerCase();
      for (const token of queryTokens) {
        if (corpus.includes(token)) {
          score += 2;
        }
      }

      // 3. Wilson score confidence weighting
      score += skill.metrics.wilsonScore * 3;

      if (score > 0) {
        candidateScores.set(skill.id, score);
      }
    }

    // Optional BM25 boost from Cory search index if available
    if (this.coryBootstrap?.searchIndex) {
      try {
        const searchResults = this.coryBootstrap.searchIndex.searchLexical({
          query: trimmed,
          userScope: "default",
          workspaceId: targetWorkspace ?? "default",
          layers: ["durable"],
          topK: limit * 2,
        });

        for (const res of searchResults) {
          if (res.item.id.startsWith("skill:")) {
            const id = res.item.id.slice("skill:".length);
            const s = this.skills.get(id);
            if (s && (s.status === "verified_active" || s.status === "canary")) {
              candidateScores.set(s.id, (candidateScores.get(s.id) ?? 0) + res.score * 5);
            }
          }
        }
      } catch {
        // Fallback gracefully to purely in-memory scores
      }
    }

    const sorted = Array.from(candidateScores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => this.skills.get(id)!)
      .filter(Boolean);

    return sorted.slice(0, limit);
  }

  public async buildActiveSkillsPrompt(
    queryOrSkills?: string | EvolvingSkillRecord[],
    workspaceId?: string,
    topK?: number,
  ): Promise<string> {
    let targetSkills: EvolvingSkillRecord[];

    if (typeof queryOrSkills === "string") {
      targetSkills = await this.matchSkillsForQuery(queryOrSkills, workspaceId, topK);
    } else if (Array.isArray(queryOrSkills)) {
      targetSkills = queryOrSkills;
    } else {
      targetSkills = await this.listSkills({ status: "verified_active" });
    }

    if (!targetSkills || targetSkills.length === 0) {
      return "";
    }

    const lines: string[] = [
      "<learned_skills>",
      "# Active Learned Skills",
      "The following procedural skills have been synthesized from verified execution traces and workspace constraints. Apply them when relevant to your current task:",
      "",
    ];

    for (const skill of targetSkills) {
      const title = skill.name ?? skill.title ?? "Evolving Skill";
      lines.push(`## Skill: ${title} (v${skill.version}, ${skill.status})`);
      if (skill.triggers.length > 0) {
        lines.push(`Triggers: ${skill.triggers.join(", ")}`);
      }
      lines.push(skill.description);
      lines.push("");
      lines.push("### Verified Procedure");
      const procedure = skill.verifiedProcedure ?? skill.executionStrategy ?? [];
      lines.push(procedure.join("\n"));
      lines.push("");
      lines.push("### Pitfalls & Active Constraints");
      const pitfalls = skill.pitfallsAndConstraints ?? skill.pitfallsConstraints ?? [];
      if (pitfalls.length > 0) {
        for (const p of pitfalls) {
          lines.push(`- ${p}`);
        }
      } else {
        lines.push("- None recorded.");
      }
      lines.push("");
      lines.push("### Verification Standard");
      const criteria =
        skill.verificationCriteria ?? (skill.verificationGate ? [skill.verificationGate] : []);
      if (criteria.length > 0) {
        for (const v of criteria) {
          lines.push(`- ${v}`);
        }
      } else {
        lines.push("- Confirm exit code 0 and clean output.");
      }
      lines.push("");
      lines.push("---");
      lines.push("");
    }

    lines.push("</learned_skills>");
    return lines.join("\n").trim();
  }

  // -------------------------------------------------------------------------
  // Ahead-of-Time Background Compaction
  // -------------------------------------------------------------------------

  public async prepareAheadCompaction(
    options?: PrepareAheadCompactionOptions,
  ): Promise<PrepareAheadCompactionResult> {
    const maxRevisions = options?.maxRevisionsPerSkill ?? 5;
    let prunedRevisionsCount = 0;

    try {
      const entries = await fs.readdir(this.revisionsDir);
      const skillRevisions = new Map<
        string,
        Array<{ filename: string; version: string; fullPath: string }>
      >();

      for (const entry of entries) {
        if (!entry.endsWith(".md") || !entry.includes("@")) {
          continue;
        }
        const atIdx = entry.lastIndexOf("@");
        const skillId = entry.slice(0, atIdx);
        const version = entry.slice(atIdx + 1, -3);
        const fullPath = path.join(this.revisionsDir, entry);

        let list = skillRevisions.get(skillId);
        if (!list) {
          list = [];
          skillRevisions.set(skillId, list);
        }
        list.push({ filename: entry, version, fullPath });
      }

      for (const revisions of skillRevisions.values()) {
        if (revisions.length > maxRevisions) {
          // Sort descending by semver: latest versions first
          revisions.sort((a, b) => compareSemver(b.version, a.version));
          const toPrune = revisions.slice(maxRevisions);
          for (const item of toPrune) {
            try {
              await fs.unlink(item.fullPath);
              prunedRevisionsCount++;
            } catch {
              // Non-fatal unlinking error
            }
          }
        }
      }
    } catch {
      // Revisions reading error is non-fatal
    }

    await this.persistLedger();

    const activeSkillsPrompt = await this.buildActiveSkillsPrompt(undefined, options?.workspaceId);
    const precomputedPromptLength = activeSkillsPrompt.length;
    const compactedSkillsCount = this.skills.size;

    return {
      compactedSkillsCount,
      prunedRevisionsCount,
      precomputedPromptLength,
      activeSkillsPrompt,
    };
  }

  // -------------------------------------------------------------------------
  // Utility Queries
  // -------------------------------------------------------------------------

  public async listSkills(filter?: {
    status?: SkillLifecycleStatus;
  }): Promise<EvolvingSkillRecord[]> {
    const all = Array.from(this.skills.values());
    if (filter?.status) {
      return all.filter((s) => s.status === filter.status);
    }
    return all;
  }

  public async getSkill(skillId: string): Promise<EvolvingSkillRecord | null> {
    return this.skills.get(skillId) ?? null;
  }

  // -------------------------------------------------------------------------
  // Internal Helpers
  // -------------------------------------------------------------------------

  private findExistingSkillForTrajectory(
    trajectory: TurnTrajectoryRecord,
  ): EvolvingSkillRecord | undefined {
    if (trajectory.id && this.skills.has(trajectory.id)) {
      return this.skills.get(trajectory.id);
    }
    const rawGoal = (trajectory.taskGoal ?? trajectory.userGoal ?? "").trim().toLowerCase();
    if (!rawGoal) return undefined;

    for (const skill of this.skills.values()) {
      const skillTitle = (skill.name ?? skill.title ?? "").toLowerCase();
      if (skillTitle === rawGoal || skill.slug === rawGoal) {
        return skill;
      }
    }
    return undefined;
  }

  private async persistLedger(): Promise<void> {
    this.ledger.updatedAtMs = Date.now();
    try {
      await fs.writeFile(this.ledgerPath, JSON.stringify(this.ledger, null, 2), "utf-8");
    } catch {
      // Non-fatal ledger write error
    }
  }

  private indexSkill(skill: EvolvingSkillRecord, markdown?: string): void {
    const md = markdown ?? serializeEvolvingSkillMarkdown(skill);
    const title = skill.name ?? skill.title ?? "Evolving Skill";
    const procedure = (skill.verifiedProcedure ?? skill.executionStrategy ?? []).join("\n");

    // Index into SQLite WAL BM25 search index
    if (this.coryBootstrap?.searchIndex) {
      try {
        this.coryBootstrap.searchIndex.upsertItem({
          id: `skill:${skill.id}`,
          layer: "durable",
          content: `${title}\n${skill.description}\n${skill.triggers.join(" ")}\n${procedure}\n${md}`,
          userScope: "default",
          workspaceId: skill.workspaceId ?? "default",
          createdAt: skill.createdAtMs ?? Date.now(),
          updatedAt: skill.updatedAt ?? skill.updatedAtMs ?? Date.now(),
          tags: ["learned-skill", skill.status, ...skill.triggers],
        });
      } catch {
        // Search index upsert is non-fatal
      }
    }

    // Index into Cory durable memory store
    if (this.coryBootstrap?.memoryStore) {
      try {
        this.coryBootstrap.memoryStore.remember({
          layer: "durable",
          content: `[LEARNED_SKILL] ${title} (v${skill.version}): ${skill.description}`,
          scope: {
            workspaceId: skill.workspaceId ?? "default",
            userScope: "default",
          },
          tags: ["skill", skill.id, skill.status],
        });
      } catch {
        // Memory store remember is non-fatal
      }
    }
  }
}
