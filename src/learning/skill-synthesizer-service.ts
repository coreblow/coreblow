/**
 * CoreBlow Cory EvoLoop — Skill Synthesizer Gateway Service
 *
 * Implements the stateful Object-Oriented Programming (OOP) lifecycle supervisor
 * and 3-Gate Zero-Trust security boundary for autonomous skill synthesis and evolution.
 */

import fs from "node:fs/promises";
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
}

export interface SkillSynthesizerServiceOptions {
  readonly stateDir: string;
  readonly coryService?: CoryBootstrapService;
  readonly cory?: CoryBootstrapService;
  readonly autoPromoteMinInvocations?: number;
  readonly autoPromoteWilsonScoreThreshold?: number;
  readonly autoRollbackConsecutiveFailures?: number;
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
    pattern: /(?:api[_-]?key|secret|token)\s*[:=]\s*["'][A-Za-z0-9_-]{20,}["']/i,
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

  private isStarted = false;
  private readonly skills = new Map<string, EvolvingSkillRecord>();
  private ledger: FitnessLedgerData = {
    version: 1,
    skills: {},
    updatedAtMs: Date.now(),
  };

  constructor(options: SkillSynthesizerServiceOptions) {
    this.options = options;
    this.stateDir = options.stateDir;
    this.learnedDir = path.join(this.stateDir, "learned");
    this.revisionsDir = path.join(this.stateDir, ".revisions");
    this.quarantineDir = path.join(this.stateDir, "quarantine");
    this.ledgerPath = path.join(this.stateDir, "fitness-ledger.json");
    this.coryBootstrap = options.coryService ?? options.cory;
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

    // ─── DOP Distillation ──────────────────────────────────────────────────
    const targetStatus = options?.targetStatus ?? "canary";
    const distillResult = distillTrajectoryToSkillCandidate(trajectory, existingSkill, {
      initialStatus: targetStatus,
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

    // ─── Sync Active Constraints from Cory Memory ──────────────────────────
    if (options?.syncConstraints !== false && this.coryBootstrap?.memoryStore) {
      try {
        const scope = {
          workspaceId: trajectory.workspaceId ?? "default",
          userScope: trajectory.userScope ?? "default",
        };
        const constraints = this.coryBootstrap.memoryStore.listLayerItems("constraint", scope);
        if (constraints.length > 0) {
          const mergedPitfalls = [...candidate.pitfallsConstraints];
          for (const item of constraints) {
            const rawContent = item.content.trim();
            const formatted = rawContent.startsWith("[CONSTRAINT]")
              ? rawContent
              : `[CONSTRAINT] ${rawContent}`;
            if (!mergedPitfalls.includes(formatted)) {
              mergedPitfalls.push(formatted);
            }
          }
          candidate = Object.freeze({
            ...candidate,
            pitfallsConstraints: Object.freeze(mergedPitfalls),
          });
        }
      } catch {
        // Memory constraint sync is non-fatal
      }
    }

    const markdownText = serializeEvolvingSkillMarkdown(candidate);

    // ─── GATE 2: Security & Secret Scanning ─────────────────────────────────
    const findings: SkillScanFinding[] = [...scanSource(markdownText, `${candidate.slug}.md`)];

    // Scan raw trajectory step inputs/outputs
    for (const step of trajectory.steps ?? []) {
      const inputStr =
        typeof step.input === "string" ? step.input : step.input ? JSON.stringify(step.input) : "";
      if (inputStr) {
        findings.push(...scanSource(inputStr, `step_${step.toolName}.js`));
      }

      const outputStr =
        typeof step.output === "string"
          ? step.output
          : step.output
            ? JSON.stringify(step.output)
            : "";
      if (outputStr) {
        findings.push(...scanSource(outputStr, `step_${step.toolName}_out.js`));
      }
    }

    // Check for hardcoded secrets
    const corpusToCheck: string[] = [
      markdownText,
      ...trajectory.steps.map((s) => JSON.stringify(s.input ?? "")),
      ...trajectory.steps.map((s) => JSON.stringify(s.output ?? "")),
    ];

    for (const text of corpusToCheck) {
      for (const { name, pattern } of RAW_SECRET_PATTERNS) {
        if (pattern.test(text)) {
          findings.push({
            ruleId: "secret-leak-detected",
            severity: "critical",
            file: `${candidate.slug}.md`,
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

      const quarantineReason = findings
        .filter((f) => f.severity === "critical" || CRITICAL_RULE_IDS.has(f.ruleId))
        .map((f) => f.message)
        .join("; ");

      return {
        ok: false,
        success: false,
        status: "quarantined",
        skill: quarantinedRecord,
        reason: "Security violation: quarantined",
        quarantineReason,
        findings,
        markdown: quarantinedMarkdown,
      };
    }

    // ─── GATE 3: Semantic & Markdown Integrity Verification ────────────────
    try {
      const parsed = parseEvolvingSkillMarkdown(markdownText);
      if (!parsed.version || !parsed.slug || parsed.executionStrategy.length === 0) {
        throw new Error("Missing mandatory skill structural sections");
      }
    } catch (err) {
      return {
        ok: false,
        success: false,
        status: "rejected",
        reason: `Gate 3 integrity verification failed: ${err instanceof Error ? err.message : String(err)}`,
        error: "GATE_3_INTEGRITY_FAILED",
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

    // Index into Cory search index
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
  // Outcome Telemetry & Bayesian Evolution
  // -------------------------------------------------------------------------

  public async recordSkillOutcome(
    skillId: string,
    outcome: "success" | "failure",
  ): Promise<EvolvingSkillRecord> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`SKILL_NOT_FOUND: Skill with id '${skillId}' does not exist.`);
    }

    const prevStatus = skill.status;
    const updatedMetrics = updateSkillFitnessMetrics(skill.metrics, outcome);

    // Auto-promotion logic: canary -> verified_active
    let newStatus = prevStatus;
    const minInvocations = this.options.autoPromoteMinInvocations ?? 3;
    const minWilson = this.options.autoPromoteWilsonScoreThreshold ?? 0.65;

    if (
      (prevStatus === "canary" || prevStatus === "draft") &&
      updatedMetrics.totalInvocations >= minInvocations &&
      (updatedMetrics.wilsonScore >= minWilson ||
        (updatedMetrics.totalInvocations >= minInvocations &&
          updatedMetrics.consecutiveFailures === 0 &&
          updatedMetrics.failedInvocations === 0)) &&
      updatedMetrics.consecutiveFailures === 0
    ) {
      newStatus = "verified_active";
    }

    // Auto-rollback regression circuit breaker
    const maxConsecutiveFailures = this.options.autoRollbackConsecutiveFailures ?? 2;
    if (
      updatedMetrics.consecutiveFailures >= maxConsecutiveFailures ||
      shouldAutoRollbackSkill(updatedMetrics)
    ) {
      const rollbackRecord = await this.rollbackSkill(skillId);
      return rollbackRecord;
    }

    const updatedSkill: EvolvingSkillRecord = Object.freeze({
      ...skill,
      status: newStatus,
      metrics: updatedMetrics,
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

  public async rollbackSkill(skillId: string): Promise<EvolvingSkillRecord> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`SKILL_NOT_FOUND: Skill with id '${skillId}' does not exist.`);
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
        // Sort descending by semver to pick latest prior snapshot
        matchingRevisions.sort((a, b) => compareSemver(b.version, a.version));
        const target = matchingRevisions[0]!;
        const revisionPath = path.join(this.revisionsDir, target.filename);
        const restoredMarkdown = await fs.readFile(revisionPath, "utf-8");
        const restoredSkill = parseEvolvingSkillMarkdown(restoredMarkdown);

        // Reset consecutive failures counter on restored skill
        const cleanRestoredSkill: EvolvingSkillRecord = Object.freeze({
          ...restoredSkill,
          metrics: Object.freeze({
            ...restoredSkill.metrics,
            consecutiveFailures: 0,
            lastUpdatedMs: Date.now(),
          }),
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

  public async matchSkillsForQuery(query: string, limit = 5): Promise<EvolvingSkillRecord[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return [];

    const queryTokens = trimmed.split(/\s+/).filter((t) => t.length > 1);
    const candidateScores = new Map<string, number>();

    // Fast-path in-memory matching (< 1ms)
    for (const skill of this.skills.values()) {
      if (skill.status !== "verified_active" && skill.status !== "canary") {
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
      const corpus = `${skill.title} ${skill.slug} ${skill.description}`.toLowerCase();
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
          workspaceId: "default",
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

  public async buildActiveSkillsPrompt(skills?: EvolvingSkillRecord[]): Promise<string> {
    const targetSkills = skills ?? (await this.listSkills({ status: "verified_active" }));

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
      lines.push(`## Skill: ${skill.title} (v${skill.version}, ${skill.status})`);
      if (skill.triggers.length > 0) {
        lines.push(`Triggers: ${skill.triggers.join(", ")}`);
      }
      lines.push(skill.description);
      lines.push("");
      lines.push("### Verified Procedure");
      lines.push(skill.executionStrategy.join("\n"));
      lines.push("");
      lines.push("### Pitfalls & Active Constraints");
      if (skill.pitfallsConstraints.length > 0) {
        for (const p of skill.pitfallsConstraints) {
          lines.push(`- ${p}`);
        }
      } else {
        lines.push("- None recorded.");
      }
      lines.push("");
      lines.push("### Verification Standard");
      if (skill.verificationCriteria.length > 0) {
        for (const v of skill.verificationCriteria) {
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
    const cleanGoal = trajectory.userGoal.trim().toLowerCase();
    for (const skill of this.skills.values()) {
      if (skill.title.toLowerCase() === cleanGoal || skill.slug === cleanGoal) {
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
    if (!this.coryBootstrap?.searchIndex) return;
    try {
      const md = markdown ?? serializeEvolvingSkillMarkdown(skill);
      this.coryBootstrap.searchIndex.upsertItem({
        id: `skill:${skill.id}`,
        layer: "durable",
        content: `${skill.title}\n${skill.description}\n${skill.triggers.join(" ")}\n${skill.executionStrategy.join("\n")}\n${md}`,
        userScope: "default",
        workspaceId: "default",
        createdAt: skill.createdAtMs,
        updatedAt: skill.updatedAtMs,
        tags: ["learned-skill", skill.status, ...skill.triggers],
      });
    } catch {
      // Search index upsert is non-fatal
    }
  }
}
