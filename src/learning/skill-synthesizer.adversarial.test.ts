/**
 * CoreBlow Cory EvoLoop — Adversarial Stress Test Suite
 *
 * Empirical verification suite by Challenger R2.2.
 * Stress-tests Gate 1 Zone 0 bypass resilience, Gate 2 dangerous code & secret quarantine,
 * Revision snapshot preservation & multi-step rollback, and Cory memory & search integration.
 */

import * as fsSync from "node:fs";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { CoryBootstrapService } from "../memory/cory.js";
import {
  CorySkillSynthesizerService,
  distillTrajectoryToSkillCandidate,
  isZone0PublicTrajectory,
  parseEvolvingSkillMarkdown,
  serializeEvolvingSkillMarkdown,
  type TurnTrajectoryRecord,
  type TrajectoryToolStep,
} from "./index.js";

function createTempDir(prefix: string): string {
  return fsSync.mkdtempSync(path.join(os.tmpdir(), `coreblow-challenge-${prefix}-`));
}

function cleanupTempDir(dir: string): void {
  try {
    fsSync.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

describe("Challenger R2.2: Empirical Stress Test Suite", () => {
  let stateDir: string;
  let coryDir: string;
  let cory: CoryBootstrapService;
  let synthesizer: CorySkillSynthesizerService;

  beforeEach(async () => {
    stateDir = createTempDir("synth-state");
    coryDir = createTempDir("cory-state");

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

  // =========================================================================
  // Gate 1 Stress-Testing: Zone 0 Rejection & Bypass Attempts
  // =========================================================================
  describe("Gate 1: Zone 0 Bypass & Coercion Resistance", () => {
    const trickyZone0Payloads: Array<{
      name: string;
      patch: Record<string, unknown>;
    }> = [
      { name: 'trustZone: "public"', patch: { trustZone: "public" } },
      { name: 'trustZone: "PUBLIC"', patch: { trustZone: "PUBLIC" } },
      { name: 'trustZone: " public "', patch: { trustZone: " public " } },
      { name: 'trustZone: "Public"', patch: { trustZone: "Public" } },
      { name: 'trustZone: "\\tPUBLIC\\n"', patch: { trustZone: "\tPUBLIC\n" } },
      { name: 'trustZone: "zone-0"', patch: { trustZone: "zone-0" } },
      { name: 'trustZone: "ZONE_0"', patch: { trustZone: "ZONE_0" } },
      { name: 'trustZone: "zone 0"', patch: { trustZone: "zone 0" } },
      { name: 'trustZone: "ZONE0"', patch: { trustZone: "ZONE0" } },
      { name: "trustZone: 0", patch: { trustZone: 0 } },
      { name: 'trustZone: "0"', patch: { trustZone: "0" } },
      { name: 'trustZone: "untrusted"', patch: { trustZone: "untrusted" } },
      { name: "isPublicChannel: true", patch: { isPublicChannel: true } },
      { name: 'isPublicChannel: "true"', patch: { isPublicChannel: "true" } },
      { name: 'isPublicChannel: "TRUE"', patch: { isPublicChannel: "TRUE" } },
      { name: 'isPublicChannel: " true "', patch: { isPublicChannel: " true " } },
      { name: "isPublicChannel: 1", patch: { isPublicChannel: 1 } },
      { name: 'isPublicChannel: "1"', patch: { isPublicChannel: "1" } },
      { name: 'isPublicChannel: "yes"', patch: { isPublicChannel: "yes" } },
      { name: 'isPublicChannel: "YES"', patch: { isPublicChannel: "YES" } },
      { name: 'isPublicChannel: "y"', patch: { isPublicChannel: "y" } },
      { name: 'isPublicChannel: "on"', patch: { isPublicChannel: "on" } },
      { name: 'isPublicChannel: "public"', patch: { isPublicChannel: "public" } },
      {
        name: 'trustZone: "operator" but isPublicChannel: true',
        patch: { trustZone: "operator", isPublicChannel: true },
      },
      {
        name: 'trustZone: "public" but isPublicChannel: false',
        patch: { trustZone: "public", isPublicChannel: false },
      },
      {
        name: 'trustZone: "authenticated" but isPublicChannel: "1"',
        patch: { trustZone: "authenticated", isPublicChannel: "1" },
      },
      {
        name: 'trustZone: "operator" but isPublicChannel: 1',
        patch: { trustZone: "operator", isPublicChannel: 1 },
      },
    ];

    for (const { name, patch } of trickyZone0Payloads) {
      it(`blocks Zone 0 bypass attempt: ${name}`, async () => {
        const baseSteps: TrajectoryToolStep[] = [
          {
            toolName: "run_command",
            argsSummary: '{"cmd":"test"}',
            succeeded: false,
            errorMessage: "failed initial step",
          },
          {
            toolName: "run_command",
            argsSummary: '{"cmd":"test --recover"}',
            succeeded: true,
            outputSummary: "recovered successfully",
          },
        ];

        const trajectory: TurnTrajectoryRecord = {
          sessionId: "sess-zone0-bypass",
          workspaceId: "ws-test",
          taskGoal: "adversarial bypass test goal",
          verificationPassed: true,
          toolSteps: baseSteps,
          ...patch,
        } as unknown as TurnTrajectoryRecord;

        // 1. Check pure predicate
        expect(isZone0PublicTrajectory(trajectory), `Predicate failed for ${name}`).toBe(true);

        // 2. Check distillTrajectoryToSkillCandidate
        const distillRes = distillTrajectoryToSkillCandidate({ trajectory });
        expect(distillRes, `DOP Distiller did not block ${name}`).toBeNull();

        // 3. Check evaluateSkillSecurity
        const secEval = synthesizer.evaluateSkillSecurity({
          markdown: "## Dummy Markdown",
          skillId: "test_bypass",
          trajectory,
        });
        expect(secEval.allowed, `evaluateSkillSecurity allowed ${name}`).toBe(false);
        expect(secEval.error).toBe("ZONE_0_BLOCKED");

        // 4. Check full ingestTrajectory
        const ingestRes = await synthesizer.ingestTrajectory(trajectory);
        expect(ingestRes.ok, `ingestTrajectory accepted ${name}`).toBe(false);
        expect(ingestRes.error).toBe("ZONE_0_BLOCKED");
        expect(ingestRes.status).toBe("rejected");

        // 5. Verify zero files in learned/ or quarantine/
        const learnedFiles = await fs.readdir(path.join(stateDir, "learned"));
        expect(learnedFiles.filter((f) => f.endsWith(".md"))).toHaveLength(0);

        const quarantineFiles = await fs.readdir(path.join(stateDir, "quarantine"));
        expect(quarantineFiles.filter((f) => f.endsWith(".md"))).toHaveLength(0);

        // 6. Verify zero search results
        const searchMatches = await synthesizer.matchSkillsForQuery("adversarial bypass test goal");
        expect(searchMatches).toHaveLength(0);
      });
    }
  });

  // =========================================================================
  // Gate 2 Stress-Testing: Dangerous Execution & Secret Scanner
  // =========================================================================
  describe("Gate 2: Dangerous Execution & Secret Scanner Quarantine", () => {
    const dangerousExecutionCases: Array<{
      name: string;
      codeSnippet: string;
      expectedPatternInReason: RegExp;
    }> = [
      {
        name: "child_process.exec call",
        codeSnippet: 'const cp = require("child_process"); cp.exec("cat /etc/passwd");',
        expectedPatternInReason: /child_process|Shell command execution/i,
      },
      {
        name: "eval(...) dynamic code execution",
        codeSnippet: 'eval("const stolen = process.env.API_KEY;");',
        expectedPatternInReason: /Dynamic code execution/i,
      },
      {
        name: "new Function(...) constructor execution",
        codeSnippet: 'const fn = new Function("return process.mainModule.require");',
        expectedPatternInReason: /Dynamic code execution/i,
      },
      {
        name: "Function(...) constructor execution without new",
        codeSnippet: 'const fn = Function("return process.mainModule.require")();',
        expectedPatternInReason: /Dynamic code execution|Security violation/i,
      },
      {
        name: "child_process spawnSync call",
        codeSnippet: 'const { spawnSync } = require("child_process"); spawnSync("rm", ["-rf", "/"]);',
        expectedPatternInReason: /child_process|Shell command execution/i,
      },
      {
        name: "standalone spawnSync with node:child_process",
        codeSnippet: 'import { spawnSync } from "node:child_process"; spawnSync("whoami");',
        expectedPatternInReason: /child_process|Shell command execution/i,
      },
    ];

    for (const tc of dangerousExecutionCases) {
      it(`quarantines dangerous execution payload: ${tc.name}`, async () => {
        const trajectory: TurnTrajectoryRecord = {
          sessionId: `sess-danger-${Date.now()}`,
          workspaceId: "ws-danger",
          trustZone: "operator",
          isPublicChannel: false,
          taskGoal: `test dangerous payload ${tc.name}`,
          verificationPassed: true,
          toolSteps: [
            {
              toolName: "run_command",
              argsSummary: JSON.stringify({ script: "initial fail step" }),
              succeeded: false,
              errorMessage: "syntax error",
            },
            {
              toolName: "run_command",
              argsSummary: JSON.stringify({ script: tc.codeSnippet }),
              succeeded: true,
              outputSummary: "success output",
            },
          ],
        };

        const result = await synthesizer.ingestTrajectory(trajectory);

        // Must NOT be ok, must be quarantined
        expect(result.ok, `Expected quarantine for ${tc.name}`).toBe(false);
        expect(result.status).toBe("quarantined");
        expect(result.quarantineReason).toBeDefined();
        expect(result.quarantineReason).toMatch(tc.expectedPatternInReason);

        const skillId = result.skill!.id;

        // Written to quarantine/<id>.md
        const quarantinePath = path.join(stateDir, "quarantine", `${skillId}.md`);
        expect(fsSync.existsSync(quarantinePath)).toBe(true);

        const quarantinedContent = await fs.readFile(quarantinePath, "utf-8");
        expect(quarantinedContent).toContain("status: quarantined");

        // NOT written to learned/<id>.md
        const learnedPath = path.join(stateDir, "learned", `${skillId}.md`);
        expect(fsSync.existsSync(learnedPath)).toBe(false);

        // NOT returned in search
        const matches = await synthesizer.matchSkillsForQuery(`test dangerous payload ${tc.name}`);
        expect(matches).toHaveLength(0);

        // NOT in buildActiveSkillsPrompt
        const prompt = await synthesizer.buildActiveSkillsPrompt(`test dangerous payload ${tc.name}`);
        expect(prompt).not.toContain(skillId);

        // NOT in memory store
        const durableSkills = cory.memoryStore.listLayerItems("durable", {
          workspaceId: "ws-danger",
        });
        const foundInMemory = durableSkills.find((item) => item.tags?.includes(skillId));
        expect(foundInMemory).toBeUndefined();
      });
    }

    const secretLeakCases: Array<{
      name: string;
      secretSnippet: string;
      expectedPattern: RegExp;
    }> = [
      {
        name: "OpenAI project API key (sk-proj-...)",
        secretSnippet: "sk-proj-abc1234567890abcdef1234567890",
        expectedPattern: /Hardcoded secret pattern detected/i,
      },
      {
        name: "GitHub personal access token (ghp_...)",
        secretSnippet: "ghp_1234567890abcdefghij1234567890abcdef",
        expectedPattern: /Hardcoded secret pattern detected/i,
      },
      {
        name: "Anthropic API key (sk-ant-api03-...)",
        secretSnippet: "sk-ant-api03-abcdef1234567890abcdef1234567890",
        expectedPattern: /Hardcoded secret pattern detected/i,
      },
      {
        name: "Generic API token assignment (api_key = ...)",
        secretSnippet: 'api_key: "abcdef1234567890abcdef1234567890"',
        expectedPattern: /Hardcoded secret pattern detected/i,
      },
    ];

    for (const sc of secretLeakCases) {
      it(`quarantines secret leak pattern: ${sc.name}`, async () => {
        const trajectory: TurnTrajectoryRecord = {
          sessionId: `sess-secret-${Date.now()}`,
          workspaceId: "ws-secret",
          trustZone: "operator",
          isPublicChannel: false,
          taskGoal: `authenticate with service using ${sc.name}`,
          verificationPassed: true,
          toolSteps: [
            {
              toolName: "run_command",
              argsSummary: JSON.stringify({ token: "invalid_key" }),
              succeeded: false,
              errorMessage: "401 Unauthorized",
            },
            {
              toolName: "run_command",
              argsSummary: JSON.stringify({ auth: sc.secretSnippet }),
              succeeded: true,
              outputSummary: "200 OK Authenticated",
            },
          ],
        };

        const result = await synthesizer.ingestTrajectory(trajectory);

        expect(result.ok, `Expected quarantine for ${sc.name}`).toBe(false);
        expect(result.status).toBe("quarantined");
        expect(result.quarantineReason).toMatch(sc.expectedPattern);

        const skillId = result.skill!.id;
        const quarantinePath = path.join(stateDir, "quarantine", `${skillId}.md`);
        expect(fsSync.existsSync(quarantinePath)).toBe(true);
        expect(fsSync.existsSync(path.join(stateDir, "learned", `${skillId}.md`))).toBe(false);

        const matches = await synthesizer.matchSkillsForQuery("authenticate with service");
        expect(matches.find((m) => m.id === skillId)).toBeUndefined();
      });
    }
  });

  // =========================================================================
  // Revision & Rollback Stress-Testing
  // =========================================================================
  describe("Revision History & Multi-Step Rollback", () => {
    it("evolves 1.0.0 -> 1.1.0 -> 1.2.0, preserves snapshots, auto-rolls back to 1.1.0 on 2 failures, and manual rollbacks to 1.0.0", async () => {
      const workspaceId = "ws-revision-test";

      // 1. Ingest v1.0.0
      const traj1: TurnTrajectoryRecord = {
        workspaceId,
        taskGoal: "multi version lifecycle procedure",
        trustZone: "operator",
        isPublicChannel: false,
        verificationPassed: true,
        toolSteps: [
          { toolName: "run_command", argsSummary: "step1-v1-fail", isError: true, succeeded: false },
          { toolName: "run_command", argsSummary: "step1-v1-ok: procedure alpha v1", isError: false, succeeded: true },
        ],
      };

      const res1 = await synthesizer.ingestTrajectory(traj1);
      expect(res1.ok).toBe(true);
      const skillId = res1.skill!.id;
      expect(res1.skill!.version).toBe("1.0.0");
      expect(res1.skill!.status).toBe("canary");

      const learned1 = await fs.readFile(path.join(stateDir, "learned", `${skillId}.md`), "utf-8");
      expect(learned1).toContain("procedure alpha v1");

      // Verify no snapshot yet for 1.0.0 since it was initial
      const revsAfter1 = (await fs.readdir(path.join(stateDir, ".revisions"))).filter((f) =>
        f.startsWith(`${skillId}@`),
      );
      expect(revsAfter1).toHaveLength(0);

      // 2. Ingest v1.1.0 refinement
      const traj2: TurnTrajectoryRecord = {
        id: skillId,
        workspaceId,
        taskGoal: "multi version lifecycle procedure",
        trustZone: "operator",
        isPublicChannel: false,
        verificationPassed: true,
        toolSteps: [
          { toolName: "run_command", argsSummary: "step2-v1.1-fail", isError: true, succeeded: false },
          { toolName: "run_command", argsSummary: "step2-v1.1-ok: procedure beta v1.1", isError: false, succeeded: true },
        ],
      };

      const res2 = await synthesizer.ingestTrajectory(traj2);
      expect(res2.ok).toBe(true);
      expect(res2.skill!.version).toBe("1.1.0");

      // Verify .revisions/<id>@1.0.0.md exists and contains v1.0.0 code
      const snap100Path = path.join(stateDir, ".revisions", `${skillId}@1.0.0.md`);
      expect(fsSync.existsSync(snap100Path)).toBe(true);
      const snap100Content = await fs.readFile(snap100Path, "utf-8");
      expect(snap100Content).toContain("version: 1.0.0");
      expect(snap100Content).toContain("procedure alpha v1");

      // 3. Ingest v1.2.0 refinement
      const traj3: TurnTrajectoryRecord = {
        id: skillId,
        workspaceId,
        taskGoal: "multi version lifecycle procedure",
        trustZone: "operator",
        isPublicChannel: false,
        verificationPassed: true,
        toolSteps: [
          { toolName: "run_command", argsSummary: "step3-v1.2-fail", isError: true, succeeded: false },
          { toolName: "run_command", argsSummary: "step3-v1.2-ok: procedure gamma v1.2", isError: false, succeeded: true },
        ],
      };

      const res3 = await synthesizer.ingestTrajectory(traj3);
      expect(res3.ok).toBe(true);
      expect(res3.skill!.version).toBe("1.2.0");

      // Verify BOTH .revisions exist: 1.0.0 and 1.1.0
      const snap110Path = path.join(stateDir, ".revisions", `${skillId}@1.1.0.md`);
      expect(fsSync.existsSync(snap110Path)).toBe(true);
      const snap110Content = await fs.readFile(snap110Path, "utf-8");
      expect(snap110Content).toContain("version: 1.1.0");
      expect(snap110Content).toContain("procedure beta v1.1");

      // 4. Test 1st failure on v1.2.0 (should NOT trigger rollback yet)
      const fail1 = await synthesizer.recordSkillOutcome(skillId, "failure");
      expect(fail1.version).toBe("1.2.0");
      expect(fail1.metrics.consecutiveFailures).toBe(1);

      // 5. Test 2nd consecutive failure on v1.2.0 -> AUTOMATIC ROLLBACK to 1.1.0
      const fail2 = await synthesizer.recordSkillOutcome(skillId, "failure");
      expect(fail2.version).toBe("1.1.0");
      expect(fail2.metrics.consecutiveFailures).toBe(0);

      // Verify disk content in learned/ is accurately restored to 1.1.0 with procedure beta
      const restored110Markdown = await fs.readFile(
        path.join(stateDir, "learned", `${skillId}.md`),
        "utf-8",
      );
      const parsed110 = parseEvolvingSkillMarkdown(restored110Markdown);
      expect(parsed110.version).toBe("1.1.0");
      const proc110Str = parsed110.verifiedProcedure.join(" ");
      expect(proc110Str).toContain("procedure beta v1.1");

      // 6. Test TARGET VERSION ROLLBACK to 1.0.0: rollbackSkill(id, "1.0.0")
      const targetRollback = await synthesizer.rollbackSkill(skillId, "1.0.0");
      expect(targetRollback.version).toBe("1.0.0");
      expect(targetRollback.metrics.consecutiveFailures).toBe(0);

      // Verify disk content in learned/ is now restored to 1.0.0 with procedure alpha
      const restored100Markdown = await fs.readFile(
        path.join(stateDir, "learned", `${skillId}.md`),
        "utf-8",
      );
      const parsed100 = parseEvolvingSkillMarkdown(restored100Markdown);
      expect(parsed100.version).toBe("1.0.0");
      const proc100Str = parsed100.verifiedProcedure.join(" ");
      expect(proc100Str).toContain("procedure alpha v1");
    });
  });

  // =========================================================================
  // Cory Memory Bridge & Search Index Stress-Testing
  // =========================================================================
  describe("Cory Memory Bridge & Search Index Integration", () => {
    it("merges active constraints from cory.memoryStore into pitfalls and indexes skill into remember and searchIndex", async () => {
      const workspaceId = "ws-memory-bridge";
      const userScope = "default";

      // 1. Seed active constraints in cory memory store
      cory.memoryStore.remember({
        layer: "constraint",
        content: "[CONSTRAINT] Strict TypeScript strictNullChecks must remain enabled",
        scope: { workspaceId, userScope },
      });
      cory.memoryStore.remember({
        layer: "constraint",
        content: "[CONSTRAINT] Zero external network requests in unit test runner",
        scope: { workspaceId, userScope },
      });

      // 2. Ingest qualified trajectory
      const traj: TurnTrajectoryRecord = {
        sessionId: "sess-memory-bridge-1",
        workspaceId,
        userScope,
        taskGoal: "enforce strict type checking and isolate unit tests",
        trustZone: "operator",
        isPublicChannel: false,
        verificationPassed: true,
        toolSteps: [
          {
            toolName: "typecheck",
            argsSummary: "tsgo --strict",
            succeeded: false,
            errorMessage: "strictNullChecks violated in file.ts",
          },
          {
            toolName: "typecheck",
            argsSummary: "tsgo --strict --fix",
            succeeded: true,
            outputSummary: "0 type errors found",
          },
        ],
      };

      const result = await synthesizer.ingestTrajectory(traj);
      expect(result.ok).toBe(true);
      const skill = result.skill!;

      // 3. Verify constraints were merged into pitfallsAndConstraints
      const pitfalls = skill.pitfallsAndConstraints;
      expect(pitfalls).toContain(
        "[CONSTRAINT] Strict TypeScript strictNullChecks must remain enabled",
      );
      expect(pitfalls).toContain(
        "[CONSTRAINT] Zero external network requests in unit test runner",
      );
      // Also contains failed tool step hint
      expect(pitfalls.some((p) => p.includes("typecheck"))).toBe(true);

      // Verify disk markdown contains constraints
      const learnedFile = path.join(stateDir, "learned", `${skill.id}.md`);
      const diskMarkdown = await fs.readFile(learnedFile, "utf-8");
      expect(diskMarkdown).toContain(
        "[CONSTRAINT] Strict TypeScript strictNullChecks must remain enabled",
      );

      // 4. Verify skill indexed into Cory durable memory store
      const durableItems = cory.memoryStore.listLayerItems("durable", { workspaceId });
      const skillDurableItem = durableItems.find((item) =>
        item.tags?.includes(skill.id),
      );
      expect(skillDurableItem).toBeDefined();
      expect(skillDurableItem!.content).toContain("[LEARNED_SKILL]");
      expect(skillDurableItem!.content).toContain(skill.version);
      expect(skillDurableItem!.tags).toContain("skill");
      expect(skillDurableItem!.tags).toContain(skill.id);

      // 5. Verify skill indexed into SQLite WAL BM25 search index
      const searchResults = cory.searchIndex.searchLexical({
        query: "strictNullChecks strict type checking",
        userScope: "default",
        workspaceId,
        layers: ["durable"],
        topK: 5,
      });

      expect(searchResults.length).toBeGreaterThan(0);
      const matchedSkillItem = searchResults.find((r) => r.item.id === `skill:${skill.id}`);
      expect(matchedSkillItem).toBeDefined();

      // 6. Verify prompt assembly
      const prompt = await synthesizer.buildActiveSkillsPrompt(
        "strictNullChecks",
        workspaceId,
      );
      expect(prompt).toContain(skill.name ?? skill.title);
      expect(prompt).toContain("[CONSTRAINT] Strict TypeScript strictNullChecks must remain enabled");
    });

    it("deprecates skill and purges it from search index when rolling back without existing revisions", async () => {
      const workspaceId = "ws-no-rev-rollback";
      const traj: TurnTrajectoryRecord = {
        workspaceId,
        taskGoal: "single revision deprecation test",
        trustZone: "operator",
        isPublicChannel: false,
        verificationPassed: true,
        toolSteps: [
          { toolName: "run_command", argsSummary: "step1-fail", isError: true, succeeded: false },
          { toolName: "run_command", argsSummary: "step1-ok", isError: false, succeeded: true },
        ],
      };

      const res = await synthesizer.ingestTrajectory(traj);
      expect(res.ok).toBe(true);
      const skillId = res.skill!.id;

      // 1st failure -> still canary
      const fail1 = await synthesizer.recordSkillOutcome(skillId, "failure");
      expect(fail1.status).toBe("canary");
      expect(fail1.metrics.consecutiveFailures).toBe(1);

      // 2nd failure -> since no revisions exist, auto-rolls back to "deprecated"
      const fail2 = await synthesizer.recordSkillOutcome(skillId, "failure");
      expect(fail2.status).toBe("deprecated");

      // Verify learned disk file reflects deprecated status
      const diskContent = await fs.readFile(
        path.join(stateDir, "learned", `${skillId}.md`),
        "utf-8",
      );
      expect(diskContent).toContain("status: deprecated");

      // Verify search index exclusion
      const matches = await synthesizer.matchSkillsForQuery("single revision deprecation test");
      expect(matches).toHaveLength(0);

      // Verify buildActiveSkillsPrompt excludes deprecated skill
      const prompt = await synthesizer.buildActiveSkillsPrompt("single revision deprecation test");
      expect(prompt).not.toContain(skillId);
    });

    it("handles target version rollback to unknown version by safely falling back to latest revision", async () => {
      const workspaceId = "ws-fallback-rollback";
      const traj1: TurnTrajectoryRecord = {
        workspaceId,
        taskGoal: "fallback version test procedure",
        trustZone: "operator",
        isPublicChannel: false,
        verificationPassed: true,
        toolSteps: [
          { toolName: "run_command", argsSummary: "v1-fail", isError: true, succeeded: false },
          { toolName: "run_command", argsSummary: "v1-ok", isError: false, succeeded: true },
        ],
      };
      const res1 = await synthesizer.ingestTrajectory(traj1);
      const skillId = res1.skill!.id;

      const traj2: TurnTrajectoryRecord = {
        id: skillId,
        workspaceId,
        taskGoal: "fallback version test procedure",
        trustZone: "operator",
        isPublicChannel: false,
        verificationPassed: true,
        toolSteps: [
          { toolName: "run_command", argsSummary: "v2-fail", isError: true, succeeded: false },
          { toolName: "run_command", argsSummary: "v2-ok", isError: false, succeeded: true },
        ],
      };
      await synthesizer.ingestTrajectory(traj2);

      // Request rollback to non-existent version "9.9.9"
      const fallbackRollback = await synthesizer.rollbackSkill(skillId, "9.9.9");
      // Safely falls back to latest existing revision (1.0.0)
      expect(fallbackRollback.version).toBe("1.0.0");
    });
  });

  // =========================================================================
  // Gate 3 & Scanner Edge Case Challenges
  // =========================================================================
  describe("Gate 3 & Scanner Edge Cases", () => {
    it("verifies spawnSync without child_process in context is quarantined by dangerous-exec rule in skill-scanner", async () => {
      const trajectory: TurnTrajectoryRecord = {
        workspaceId: "ws-scanner-gap",
        trustZone: "operator",
        isPublicChannel: false,
        taskGoal: "bypass child process check",
        verificationPassed: true,
        toolSteps: [
          { toolName: "run_command", argsSummary: "init fail", isError: true, succeeded: false },
          {
            toolName: "run_command",
            argsSummary: 'spawnSync("cat", ["/etc/shadow"])',
            isError: false,
            succeeded: true,
          },
        ],
      };

      const result = await synthesizer.ingestTrajectory(trajectory);
      expect(result.ok).toBe(false);
      expect(result.status).toBe("quarantined");
      expect(result.quarantineReason).toMatch(/child_process|Shell command execution/i);
    });

    it("verifies pure R1 TrajectoryToolStep with only succeeded: true successfully extracts procedure into verifiedProcedure", () => {
      const r1Trajectory: TurnTrajectoryRecord = {
        taskGoal: "pure r1 contract step extraction",
        trustZone: "operator",
        isPublicChannel: false,
        verificationPassed: true,
        toolSteps: [
          { toolName: "run_command", argsSummary: "fail step", succeeded: false },
          { toolName: "run_command", argsSummary: "pure r1 success step", succeeded: true },
        ],
      };

      const distilled = distillTrajectoryToSkillCandidate({ trajectory: r1Trajectory });
      expect(distilled).not.toBeNull();
      const proc = distilled!.verifiedProcedure.join(" ");
      expect(proc).toContain("pure r1 success step");
    });

    it("verifies Gate 3 rejects malformed or incomplete markdown structures and documents version defaulting", () => {
      // 1. Malformed YAML frontmatter (syntax error)
      const malformedYaml = `---
id: [unterminated list
slug: test
---
# Skill
## Verified Procedure
1. Step 1
`;
      const res1 = synthesizer.evaluateSkillSecurity({
        markdown: malformedYaml,
        skillId: "skill_test",
      });
      expect(res1.allowed).toBe(false);
      expect(res1.error).toBe("GATE_3_INTEGRITY_FAILED");

      // 2. Missing verified procedure section
      const missingProcedure = `---
id: skill_test
slug: skill-test
version: 1.0.0
---
# Skill
## Pitfalls & Active Constraints
- None
`;
      const res2 = synthesizer.evaluateSkillSecurity({
        markdown: missingProcedure,
        skillId: "skill_test",
      });
      expect(res2.allowed).toBe(false);
      expect(res2.error).toBe("GATE_3_INTEGRITY_FAILED");

      // 3. Missing version in frontmatter:
      // Notice: parseEvolvingSkillMarkdown line 924 defaults missing version to "1.0.0".
      // Therefore, Gate 3's `!parsed.version` check never triggers on parsed markdown!
      const missingVersion = `---
id: skill_test
slug: skill-test
---
# Skill
## Verified Procedure
1. Step 1
`;
      const res3 = synthesizer.evaluateSkillSecurity({
        markdown: missingVersion,
        skillId: "skill_test",
      });
      // It is allowed because parser auto-supplies "1.0.0"
      expect(res3.allowed).toBe(true);
    });
  });
});

