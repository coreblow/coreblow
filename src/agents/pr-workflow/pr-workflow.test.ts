import { describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  compilePullRequestMarkdown,
  evaluatePrPreFlightGates,
  extractAddedDiffLines,
  inspectGitWorkspace,
  isForbiddenPath,
  PrWorkflowOrchestratorService,
  scanAddedLinesForSecrets,
  type PullRequestDraftRecord,
} from "./index.js";

const execFileAsync = promisify(execFile);

describe("Autonomous Git & Pull Request Workflow Engine", () => {
  describe("Pure DOP Helpers: extractAddedDiffLines & scanAddedLinesForSecrets", () => {
    it("extracts only added lines and ignores diff header lines (+++)", () => {
      const diff = [
        "diff --git a/src/index.ts b/src/index.ts",
        "--- a/src/index.ts",
        "+++ b/src/index.ts",
        "@@ -1,4 +1,5 @@",
        " existing context line",
        "-removed line",
        "+added clean line 1",
        "+added clean line 2",
      ].join("\n");

      const added = extractAddedDiffLines(diff);
      expect(added).toEqual(["added clean line 1", "added clean line 2"]);
    });

    it("does not report secrets when deleted lines or context lines contain tokens", () => {
      const diff = [
        "--- a/src/config.ts",
        "+++ b/src/config.ts",
        "@@ -10,3 +10,3 @@",
        "-const oldKey = 'sk-12345678901234567890';",
        " const context = 'sk-12345678901234567890';",
        "+const newKey = process.env.API_KEY;",
      ].join("\n");

      const added = extractAddedDiffLines(diff);
      expect(added).toEqual(["const newKey = process.env.API_KEY;"]);
      const secrets = scanAddedLinesForSecrets(added);
      expect(secrets).toHaveLength(0);
    });

    it("detects Anthropic API keys in added lines", () => {
      const added = ['const anthropicKey = "sk-ant-api03-abcdef1234567890";'];
      const secrets = scanAddedLinesForSecrets(added);
      expect(secrets).toContain("Anthropic API Key");
    });

    it("detects OpenAI API keys in added lines", () => {
      const added = ['const openaiKey = "sk-proj-12345678901234567890";'];
      const secrets = scanAddedLinesForSecrets(added);
      expect(secrets).toContain("OpenAI API Key");
    });

    it("detects GitHub PATs (classic and fine-grained) in added lines", () => {
      const classic = scanAddedLinesForSecrets(['const token = "ghp_12345678901234567890";']);
      expect(classic).toContain("GitHub PAT");

      const fineGrained = scanAddedLinesForSecrets([
        'const token = "github_pat_12345678901234567890";',
      ]);
      expect(fineGrained).toContain("GitHub PAT");
    });

    it("detects Slack bot tokens in added lines", () => {
      const added = ['const slackToken = "xoxb-123456789012-123456789012";'];
      const secrets = scanAddedLinesForSecrets(added);
      expect(secrets).toContain("Slack Token");
    });

    it("detects Google Cloud / Firebase AIza keys in added lines", () => {
      const added = ['const apiKey = "AIzaSyD1234567890123456789";'];
      const secrets = scanAddedLinesForSecrets(added);
      expect(secrets).toContain("Google Cloud / AIza Key");
    });

    it("detects Private Key blocks in added lines", () => {
      const rsaKey = scanAddedLinesForSecrets(["+-----BEGIN RSA PRIVATE KEY-----"]);
      expect(rsaKey).toContain("Private Key");

      const inlineKey = scanAddedLinesForSecrets([
        'const key = "-----BEGIN PRIVATE KEY-----\\nMIIEvgIBADANBg...";',
      ]);
      expect(inlineKey).toContain("Private Key");
    });

    it("detects raw Bearer tokens in added lines", () => {
      const added = ['headers["Authorization"] = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";'];
      const secrets = scanAddedLinesForSecrets(added);
      expect(secrets).toContain("Bearer Token");
    });
  });

  describe("Pure DOP Helpers: isForbiddenPath", () => {
    it("flags root and nested .env files", () => {
      expect(isForbiddenPath(".env")).toBe(true);
      expect(isForbiddenPath("./.env")).toBe(true);
      expect(isForbiddenPath(".env.local")).toBe(true);
      expect(isForbiddenPath(".env.production")).toBe(true);
      expect(isForbiddenPath("packages/app/.env")).toBe(true);
      expect(isForbiddenPath("config/sub/.env.staging")).toBe(true);
    });

    it("does not flag non-.env files with env in the name", () => {
      expect(isForbiddenPath("src/environment.ts")).toBe(false);
      expect(isForbiddenPath("src/config/envelope.ts")).toBe(false);
    });

    it("flags .git/info/exclude", () => {
      expect(isForbiddenPath(".git/info/exclude")).toBe(true);
      expect(isForbiddenPath("./.git/info/exclude")).toBe(true);
    });

    it("flags .evidence/ and .agents/ private directories", () => {
      expect(isForbiddenPath(".evidence/audit.json")).toBe(true);
      expect(isForbiddenPath("./.evidence/test-run.log")).toBe(true);
      expect(isForbiddenPath(".agents/teamwork/plan.md")).toBe(true);
      expect(isForbiddenPath("./.agents/teamwork/progress.md")).toBe(true);
    });

    it("does not flag public source directories with agent in name", () => {
      expect(isForbiddenPath("src/agents/pr-workflow/pr-workflow-service.ts")).toBe(false);
      expect(isForbiddenPath("src/agents/war-room/war-room-service.ts")).toBe(false);
    });

    it("flags docs/ANTIGRAVITY_ and ANTIGRAVITY_ documents", () => {
      expect(isForbiddenPath("docs/ANTIGRAVITY_PRD.md")).toBe(true);
      expect(isForbiddenPath("docs/ANTIGRAVITY_ROADMAP.md")).toBe(true);
      expect(isForbiddenPath("ANTIGRAVITY_LOCAL_SPEC.md")).toBe(true);
    });

    it("flags custom forbidden patterns when provided", () => {
      expect(isForbiddenPath("id_rsa", ["id_rsa"])).toBe(true);
      expect(isForbiddenPath("secrets/database.yml", ["database.yml"])).toBe(true);
      expect(isForbiddenPath("src/clean.ts", ["database.yml"])).toBe(false);
    });
  });

  describe("evaluatePrPreFlightGates", () => {
    it("returns allPassed: true when diff and changed files are completely clean", () => {
      const result = evaluatePrPreFlightGates({
        changedFiles: ["src/agents/pr-workflow/pr-workflow-service.ts", "package.json"],
        diffText: [
          "--- a/package.json",
          "+++ b/package.json",
          "@@ -1,3 +1,4 @@",
          '+  "version": "1.0.1",',
        ].join("\n"),
        testPassed: true,
        typecheckPassed: true,
        lintPassed: true,
      });

      expect(result.allPassed).toBe(true);
      expect(result.blockingReasons).toHaveLength(0);
      expect(result.checks).toHaveLength(5);
      expect(result.checks.every((c) => c.passed)).toBe(true);
    });

    it("fails secret_scan gate and blocks PR when diff introduces a raw secret", () => {
      const result = evaluatePrPreFlightGates({
        changedFiles: ["src/config.ts"],
        diffText: [
          "--- a/src/config.ts",
          "+++ b/src/config.ts",
          "@@ -5,2 +5,3 @@",
          '+export const OPENAI_API_KEY = "sk-proj-abcdef12345678901234";',
        ].join("\n"),
      });

      expect(result.allPassed).toBe(false);
      const secretCheck = result.checks.find((c) => c.name === "secret_scan");
      expect(secretCheck?.passed).toBe(false);
      expect(secretCheck?.detail).toContain("OpenAI API Key");
      expect(result.blockingReasons.some((r) => r.includes("secret_scan"))).toBe(true);
    });

    it("fails forbidden_paths gate and blocks PR when a private file is staged", () => {
      const result = evaluatePrPreFlightGates({
        changedFiles: ["src/index.ts", ".env.local"],
        diffText: "+console.log('clean');",
      });

      expect(result.allPassed).toBe(false);
      const pathCheck = result.checks.find((c) => c.name === "forbidden_paths");
      expect(pathCheck?.passed).toBe(false);
      expect(pathCheck?.detail).toContain(".env.local");
      expect(result.blockingReasons.some((r) => r.includes("forbidden_paths"))).toBe(true);
    });

    it("fails typecheck, linter, and unit_tests gates when status flags indicate failure", () => {
      const result = evaluatePrPreFlightGates({
        changedFiles: ["src/index.ts"],
        diffText: "+console.log('clean');",
        typecheckPassed: false,
        lintPassed: false,
        testPassed: false,
      });

      expect(result.allPassed).toBe(false);
      expect(result.blockingReasons).toHaveLength(3);
      expect(result.checks.find((c) => c.name === "typecheck")?.passed).toBe(false);
      expect(result.checks.find((c) => c.name === "linter")?.passed).toBe(false);
      expect(result.checks.find((c) => c.name === "unit_tests")?.passed).toBe(false);
      // Secrets and forbidden paths are still clean
      expect(result.checks.find((c) => c.name === "secret_scan")?.passed).toBe(true);
      expect(result.checks.find((c) => c.name === "forbidden_paths")?.passed).toBe(true);
    });

    it("defaults omitted status flags to true", () => {
      const result = evaluatePrPreFlightGates({
        changedFiles: ["src/index.ts"],
        diffText: "+console.log('clean');",
      });

      expect(result.checks.find((c) => c.name === "typecheck")?.passed).toBe(true);
      expect(result.checks.find((c) => c.name === "linter")?.passed).toBe(true);
      expect(result.checks.find((c) => c.name === "unit_tests")?.passed).toBe(true);
      expect(result.allPassed).toBe(true);
    });
  });

  describe("compilePullRequestMarkdown", () => {
    it("produces deterministic PR body with Summary, Changed Files, and Verification Gate Scorecard", () => {
      const mockRecord: PullRequestDraftRecord = {
        prId: "pr_test_123",
        workspaceId: "ws_default",
        warRoomId: "room_stage8",
        sourceBranch: "feature/pr-workflow-engine",
        targetBranch: "main",
        title: "feat(agents): Autonomous Git & PR Workflow Engine",
        summaryMarkdown:
          "Adds pre-flight verification gates, secret scanning, and draft lifecycle.",
        changedFiles: [
          "src/agents/pr-workflow/pr-workflow-service.ts",
          "src/agents/pr-workflow/index.ts",
        ],
        verificationChecks: [
          {
            name: "typecheck",
            passed: true,
            detail: "TypeScript check clean with zero errors",
            durationMs: 12,
          },
          {
            name: "linter",
            passed: true,
            detail: "Linter clean with zero warnings",
            durationMs: 8,
          },
          {
            name: "unit_tests",
            passed: true,
            detail: "All unit test suites passed green",
            durationMs: 245,
          },
          {
            name: "secret_scan",
            passed: true,
            detail: "No raw secrets detected in diff",
            durationMs: 2,
          },
          {
            name: "forbidden_paths",
            passed: true,
            detail: "All changed files comply with repository boundary policies",
            durationMs: 1,
          },
        ],
        allChecksPassed: true,
        status: "ready_for_review",
        createdAtMs: 1700000000000,
        updatedAtMs: 1700000000000,
      };

      const md = compilePullRequestMarkdown(mockRecord);

      expect(md).toContain("# feat(agents): Autonomous Git & PR Workflow Engine");
      expect(md).toContain("## Summary");
      expect(md).toContain(
        "Adds pre-flight verification gates, secret scanning, and draft lifecycle.",
      );
      expect(md).toContain("- **Workspace**: `ws_default`");
      expect(md).toContain("- **War Room**: `room_stage8`");
      expect(md).toContain("- **Branches**: `feature/pr-workflow-engine` -> `main`");
      expect(md).toContain("- **Status**: `ready_for_review`");
      expect(md).toContain("## Changed Files");
      expect(md).toContain("- `src/agents/pr-workflow/pr-workflow-service.ts`");
      expect(md).toContain("- `src/agents/pr-workflow/index.ts`");
      expect(md).toContain("## Verification Gate Scorecard");
      expect(md).toContain("| Gate | Status | Detail | Duration |");
      expect(md).toContain(
        "| typecheck | ✅ PASSED | TypeScript check clean with zero errors | 12ms |",
      );
      expect(md).toContain("| secret_scan | ✅ PASSED | No raw secrets detected in diff | 2ms |");
    });

    it("displays _No files changed._ when changedFiles array is empty", () => {
      const mockRecord: PullRequestDraftRecord = {
        prId: "pr_empty",
        workspaceId: "ws_default",
        sourceBranch: "chore/empty",
        targetBranch: "main",
        title: "Empty PR",
        summaryMarkdown: "No modifications.",
        changedFiles: [],
        verificationChecks: [],
        allChecksPassed: true,
        status: "draft",
        createdAtMs: 1700000000000,
        updatedAtMs: 1700000000000,
      };

      const md = compilePullRequestMarkdown(mockRecord);
      expect(md).toContain("_No files changed._");
    });
  });

  describe("PrWorkflowOrchestratorService: OOP Lifecycle & Health", () => {
    it("reports 'down' before start, 'healthy' when started, and 'down' after stop", async () => {
      const service = new PrWorkflowOrchestratorService();
      expect(service.name).toBe("pr-workflow-orchestrator");

      // Before start
      expect(service.health().status).toBe("down");

      // After start
      await service.start();
      expect(service.health().status).toBe("healthy");
      expect(service.health().detail).toBe("Managing 0 pull request drafts");

      // After stop
      await service.stop();
      expect(service.health().status).toBe("down");
    });

    it("clears all stored drafts when stop() is called", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      service.createPullRequestDraft({
        sourceBranch: "feat/foo",
        title: "Feature Foo",
        description: "Draft 1",
        changedFiles: ["src/foo.ts"],
        diffText: "+const foo = 1;",
      });
      expect(service.listPullRequestDrafts()).toHaveLength(1);

      await service.stop();
      expect(service.listPullRequestDrafts()).toHaveLength(0);
    });
  });

  describe("PrWorkflowOrchestratorService: Zone 0 Security Defense", () => {
    it("rejects createPullRequestDraft when trustZone is 'public' with ZONE_0_BLOCKED", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      expect(() =>
        service.createPullRequestDraft({
          sourceBranch: "untrusted/feat",
          title: "Public PR",
          description: "Malicious PR from untrusted channel",
          changedFiles: ["src/index.ts"],
          diffText: "+const test = 1;",
          trustZone: "public",
        }),
      ).toThrowError(
        "ZONE_0_BLOCKED: Public channels cannot create or mutate pull request drafts.",
      );
    });

    it("rejects approvePullRequestDraft when trustZone is 'public' with ZONE_0_BLOCKED", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      const draft = service.createPullRequestDraft({
        sourceBranch: "feat/approved",
        title: "Clean Feature",
        description: "Valid PR",
        changedFiles: ["src/index.ts"],
        diffText: "+const test = 1;",
        trustZone: "authenticated",
      });

      expect(() =>
        service.approvePullRequestDraft({
          prId: draft.prId,
          approverId: "anon_public_user",
          trustZone: "public",
        }),
      ).toThrowError(
        "ZONE_0_BLOCKED: Public channels cannot create or mutate pull request drafts.",
      );
    });
  });

  describe("PrWorkflowOrchestratorService: Pre-Flight Gate Enforcement & Approval", () => {
    it("creates draft in 'ready_for_review' status when all gates pass", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      const draft = service.createPullRequestDraft({
        workspaceId: "workspace-alpha",
        warRoomId: "war-room-1",
        sourceBranch: "feature/engine",
        targetBranch: "main",
        title: "Engine Feature",
        description: "Comprehensive implementation",
        changedFiles: ["src/engine.ts"],
        diffText: "+export function run() { return 42; }",
        testPassed: true,
        typecheckPassed: true,
        lintPassed: true,
      });

      expect(draft.status).toBe("ready_for_review");
      expect(draft.allChecksPassed).toBe(true);
      expect(draft.workspaceId).toBe("workspace-alpha");
      expect(draft.warRoomId).toBe("war-room-1");
      expect(draft.sourceBranch).toBe("feature/engine");
      expect(draft.targetBranch).toBe("main");
      expect(draft.verificationChecks).toHaveLength(5);
    });

    it("creates draft in 'blocked' status when gates fail", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      const draft = service.createPullRequestDraft({
        sourceBranch: "feature/leak",
        title: "Leaked Token",
        description: "Accidental token commit",
        changedFiles: ["src/keys.ts"],
        diffText: '+const secret = "ghp_12345678901234567890";',
      });

      expect(draft.status).toBe("blocked");
      expect(draft.allChecksPassed).toBe(false);
      const secretCheck = draft.verificationChecks.find((c) => c.name === "secret_scan");
      expect(secretCheck?.passed).toBe(false);
    });

    it("refuses to approve draft if verification checks failed (PR_GATE_BLOCKED)", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      const blockedDraft = service.createPullRequestDraft({
        sourceBranch: "feature/blocked",
        title: "Blocked PR",
        description: "Failing unit tests",
        changedFiles: ["src/broken.ts"],
        diffText: "+const broken = true;",
        testPassed: false,
      });

      expect(blockedDraft.status).toBe("blocked");

      expect(() =>
        service.approvePullRequestDraft({
          prId: blockedDraft.prId,
          approverId: "lead_operator",
        }),
      ).toThrowError("PR_GATE_BLOCKED: Cannot approve PR draft with failing verification checks.");
    });

    it("throws not found error when approving a non-existent draft ID", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      expect(() =>
        service.approvePullRequestDraft({
          prId: "pr_non_existent",
          approverId: "lead_operator",
        }),
      ).toThrowError('Pull request draft "pr_non_existent" not found.');
    });

    it("successfully approves a verified draft, transitioning status to 'approved'", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      const draft = service.createPullRequestDraft({
        sourceBranch: "feature/certified",
        title: "Certified PR",
        description: "Ready to merge",
        changedFiles: ["src/certified.ts"],
        diffText: "+export const certified = true;",
      });

      expect(draft.status).toBe("ready_for_review");

      const approved = service.approvePullRequestDraft({
        prId: draft.prId,
        approverId: "operator_007",
      });

      expect(approved.status).toBe("approved");
      expect(approved.approverId).toBe("operator_007");
      expect(approved.updatedAtMs).toBeGreaterThanOrEqual(draft.createdAtMs);

      // Verify the persisted state in orchestrator
      const retrieved = service.getPullRequestDraft(draft.prId);
      expect(retrieved?.status).toBe("approved");
      expect(retrieved?.approverId).toBe("operator_007");
    });
  });

  describe("PrWorkflowOrchestratorService: Queries & Workspace Isolation", () => {
    it("lists and filters drafts by workspace ID", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      service.createPullRequestDraft({
        workspaceId: "ws_alpha",
        sourceBranch: "feat/1",
        title: "Alpha 1",
        description: "Desc",
        changedFiles: ["src/1.ts"],
        diffText: "+const a = 1;",
      });
      service.createPullRequestDraft({
        workspaceId: "ws_alpha",
        sourceBranch: "feat/2",
        title: "Alpha 2",
        description: "Desc",
        changedFiles: ["src/2.ts"],
        diffText: "+const b = 2;",
      });
      service.createPullRequestDraft({
        workspaceId: "ws_beta",
        sourceBranch: "feat/3",
        title: "Beta 1",
        description: "Desc",
        changedFiles: ["src/3.ts"],
        diffText: "+const c = 3;",
      });

      expect(service.listPullRequestDrafts()).toHaveLength(3);
      expect(service.listPullRequestDrafts("ws_alpha")).toHaveLength(2);
      expect(service.listPullRequestDrafts("ws_beta")).toHaveLength(1);
      expect(service.listPullRequestDrafts("ws_nonexistent")).toHaveLength(0);
    });
  });

  describe("PrWorkflowOrchestratorService: Real Git Execution & Approval Lifecycle (TB3.1, TB3.2, TB3.3)", () => {
    it("inspects real Git repository workspace, detects branch, changed files, and diff", async () => {
      const tempGitDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-git-test-"));
      try {
        await execFileAsync("git", ["init", "-q"], { cwd: tempGitDir });
        await execFileAsync("git", ["config", "user.name", "CoreBlow Tester"], { cwd: tempGitDir });
        await execFileAsync("git", ["config", "user.email", "test@coreblow.com"], { cwd: tempGitDir });

        // Initial commit
        const readmePath = path.join(tempGitDir, "README.md");
        await fs.writeFile(readmePath, "# Initial Repo\n", "utf8");
        await execFileAsync("git", ["add", "README.md"], { cwd: tempGitDir });
        await execFileAsync("git", ["commit", "-m", "Initial commit"], { cwd: tempGitDir });

        // Modify a file and add a new untracked file
        await fs.writeFile(readmePath, "# Initial Repo\n\nUpdated feature line\n", "utf8");
        const srcFile = path.join(tempGitDir, "feature.ts");
        await fs.writeFile(srcFile, "export const feature = 42;\n", "utf8");

        const service = new PrWorkflowOrchestratorService();
        await service.start();

        const status = await service.inspectGitWorkspace(tempGitDir);
        expect(status.isClean).toBe(false);
        expect(status.changedFiles).toContain("README.md");
        expect(status.changedFiles).toContain("feature.ts");
        expect(status.diffText).toContain("Updated feature line");
      } finally {
        await fs.rm(tempGitDir, { recursive: true, force: true });
      }
    });

    it("creates PR draft from workspace, evaluates 5 gates, approves, and commits to Git", async () => {
      const tempGitDir = await fs.mkdtemp(path.join(os.tmpdir(), "coreblow-pr-commit-"));
      try {
        await execFileAsync("git", ["init", "-q"], { cwd: tempGitDir });
        await execFileAsync("git", ["config", "user.name", "CoreBlow Tester"], { cwd: tempGitDir });
        await execFileAsync("git", ["config", "user.email", "test@coreblow.com"], { cwd: tempGitDir });

        const baseFile = path.join(tempGitDir, "service.ts");
        await fs.writeFile(baseFile, "export class Service {}\n", "utf8");
        await execFileAsync("git", ["add", "service.ts"], { cwd: tempGitDir });
        await execFileAsync("git", ["commit", "-m", "chore: base service"], { cwd: tempGitDir });

        // Make clean modifications
        await fs.writeFile(baseFile, "export class Service { run() { return true; } }\n", "utf8");

        const service = new PrWorkflowOrchestratorService();
        await service.start();

        // 1. Create PR draft by inspecting live workspace (TB3.1, TB3.3)
        const draft = await service.createPullRequestDraftFromWorkspace({
          cwd: tempGitDir,
          title: "feat(service): add run method",
          description: "Implements the core run loop on Service class.",
          typecheckPassed: true,
          lintPassed: true,
          testPassed: true,
        });

        expect(draft.allChecksPassed).toBe(true);
        expect(draft.status).toBe("ready_for_review");
        expect(draft.changedFiles).toContain("service.ts");
        expect(draft.verificationChecks).toHaveLength(5);

        // 2. Reject unapproved commit attempt (TB3.2)
        await expect(
          service.commitApprovedPullRequestDraft({
            prId: draft.prId,
            approverId: "operator-admin",
            cwd: tempGitDir,
          }),
        ).rejects.toThrow("PR_NOT_APPROVED");

        // 3. Approve draft (TB3.2)
        const approved = service.approvePullRequestDraft({
          prId: draft.prId,
          approverId: "operator-admin",
        });
        expect(approved.status).toBe("approved");

        // 4. Commit approved draft with new branch (TB3.1, TB3.2)
        const commitResult = await service.commitApprovedPullRequestDraft({
          prId: draft.prId,
          approverId: "operator-admin",
          cwd: tempGitDir,
          createBranch: true,
          branchName: "feature/service-run",
          commitMessage: "feat: add service run implementation",
        });

        expect(commitResult.success).toBe(true);
        expect(commitResult.commitHash).toMatch(/^[0-9a-f]{7,40}$/);
        expect(commitResult.branchCreated).toBe("feature/service-run");
        expect(commitResult.draft.status).toBe("merged");

        // Verify git log in the repo
        const logRes = await execFileAsync("git", ["log", "-1", "--oneline"], { cwd: tempGitDir });
        expect(logRes.stdout).toContain("feat: add service run implementation");
      } finally {
        await fs.rm(tempGitDir, { recursive: true, force: true });
      }
    });

    it("rejects draft when operator denies approval or blocks it", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      const draft = service.createPullRequestDraft({
        title: "Test PR",
        description: "Test description",
        sourceBranch: "feat/test",
        changedFiles: ["src/test.ts"],
        diffText: "+const x = 1;",
      });

      const rejected = service.rejectPullRequestDraft({
        prId: draft.prId,
        reason: "Does not meet security requirements",
        rejecterId: "auditor-01",
      });

      expect(rejected.status).toBe("blocked");
    });
  });
});
