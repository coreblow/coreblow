/**
 * CoreBlow Stage 8 — Autonomous Git & PR Workflow Engine Adversarial Stress Test Suite
 *
 * Empirical verification suite by Teamwork Challenger 1 (Stage 8 Phase 2).
 * Stress-tests:
 * 1. evaluatePrPreFlightGates:
 *    - Secret scan bypass attempts in diff added lines (whitespace padding, line breaks,
 *      multi-line secrets, secrets in removed lines '-' (no false positive),
 *      diff headers '+++' (no false positive), multiple secrets on one line).
 *    - Forbidden paths bypass attempts: nested paths, trailing slashes,
 *      relative path traversals ('../.env', 'foo/../../.git/info/exclude').
 *    - Gate boolean combinations: all 5 passed, each individual check failing, all failing.
 * 2. compilePullRequestMarkdown:
 *    - Empty changed files, massive diff lists (1000 files), special characters,
 *      markdown injections, XSS vectors in title and summary.
 * 3. PrWorkflowOrchestratorService:
 *    - Zone 0 bypass attempts: trustZone: "public" vs undefined vs "operator".
 *    - Gate bypass attempts in approvePullRequestDraft: approving unverified draft,
 *      approving non-existent PR, re-approving already approved draft.
 *    - Concurrent drafts and workspace isolation.
 */

import { describe, expect, it } from "vitest";
import {
  compilePullRequestMarkdown,
  evaluatePrPreFlightGates,
  extractAddedDiffLines,
  isForbiddenPath,
  PrWorkflowOrchestratorService,
  scanAddedLinesForSecrets,
  type PullRequestDraftRecord,
} from "./index.js";

describe("Autonomous Git & PR Workflow Engine: Adversarial Stress Test Suite", () => {
  // ── 1. evaluatePrPreFlightGates: Secret Detection Stress ───────────────────
  describe("evaluatePrPreFlightGates: Secret Detection & Evasion Resistance", () => {
    it("detects secrets padded with leading/trailing whitespace, tabs, and inside expressions", () => {
      const paddedInputs = [
        '+   const key = "sk-proj-12345678901234567890";   ',
        '+\t\tconst key = "sk-ant-api03-abcdef1234567890";\t\t',
        '+API_KEY=ghp_12345678901234567890',
        '+process.env.SLACK_BOT_TOKEN = "xoxb-123456789012-123456789012";',
        '+const gcp = "AIzaSyD1234567890123456789";',
        '+Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token;',
      ];

      for (const input of paddedInputs) {
        const added = extractAddedDiffLines(input);
        const secrets = scanAddedLinesForSecrets(added);
        expect(secrets.length).toBeGreaterThan(0);
      }
    });

    it("detects multi-line private key headers across various formats", () => {
      const privateKeys = [
        "+-----BEGIN RSA PRIVATE KEY-----",
        "+-----BEGIN EC PRIVATE KEY-----",
        "+-----BEGIN OPENSSH PRIVATE KEY-----",
        "+-----BEGIN PRIVATE KEY-----",
        "+PRIVATE KEY block embedded",
      ];

      for (const pk of privateKeys) {
        const added = extractAddedDiffLines(pk);
        const secrets = scanAddedLinesForSecrets(added);
        expect(secrets).toContain("Private Key");
      }
    });

    it("does NOT trigger false positives for secrets in removed lines (-)", () => {
      const diffWithRemovals = [
        "--- a/config.ts",
        "+++ b/config.ts",
        "@@ -1,6 +1,6 @@",
        '-const oldOpenAi = "sk-proj-12345678901234567890";',
        '-const oldAnthropic = "sk-ant-api03-abcdef1234567890";',
        '-const oldGhp = "ghp_12345678901234567890";',
        '-const oldSlack = "xoxb-123456789012-123456789012";',
        '-const oldAiza = "AIzaSyD1234567890123456789";',
        "-const oldPk = '-----BEGIN RSA PRIVATE KEY-----';",
        '-const oldBearer = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";',
        "+// Removed hardcoded keys; now reading from environment variables safely",
        "+const openAiKey = process.env.OPENAI_API_KEY;",
      ].join("\n");

      const result = evaluatePrPreFlightGates({
        changedFiles: ["config.ts"],
        diffText: diffWithRemovals,
      });

      expect(result.checks.find((c) => c.name === "secret_scan")?.passed).toBe(true);
      expect(result.allPassed).toBe(true);
    });

    it("does NOT trigger false positives for diff headers containing secret-like strings", () => {
      const diffHeaders = [
        "+++ /dev/null",
        "+++ b/src/key-sk-proj-12345678901234567890.ts",
        "+++ b/src/ghp_12345678901234567890.ts",
        "+++ b/src/xoxb-123456789012-123456789012.ts",
      ].join("\n");

      const added = extractAddedDiffLines(diffHeaders);
      expect(added).toHaveLength(0);
      const secrets = scanAddedLinesForSecrets(added);
      expect(secrets).toHaveLength(0);
    });

    it("detects and captures multiple distinct secrets on a single line", () => {
      const multiSecretLine =
        '+const k1 = "sk-proj-12345678901234567890"; const k2 = "ghp_12345678901234567890"; const k3 = "xoxb-123456789012-123456789012";';

      const result = evaluatePrPreFlightGates({
        changedFiles: ["src/keys.ts"],
        diffText: multiSecretLine,
      });

      const secretCheck = result.checks.find((c) => c.name === "secret_scan");
      expect(secretCheck?.passed).toBe(false);
      expect(secretCheck?.detail).toContain("OpenAI API Key");
      expect(secretCheck?.detail).toContain("GitHub PAT");
      expect(secretCheck?.detail).toContain("Slack Token");
    });

    it("does NOT flag short non-secret strings that merely share prefixes", () => {
      const benignInputs = [
        '+const prefix1 = "sk-short";',
        '+const prefix2 = "ghp_short";',
        '+const prefix3 = "xoxb-short";',
        '+const prefix4 = "AIzaShort";',
      ].join("\n");

      const result = evaluatePrPreFlightGates({
        changedFiles: ["src/utils.ts"],
        diffText: benignInputs,
      });

      expect(result.checks.find((c) => c.name === "secret_scan")?.passed).toBe(true);
    });
  });

  // ── 2. evaluatePrPreFlightGates: Forbidden Paths Stress ─────────────────────
  describe("evaluatePrPreFlightGates: Forbidden Paths & Traversal Resistance", () => {
    it("flags nested .env files in arbitrary subdirectories", () => {
      const paths = [
        "sub/dir/.env",
        "nested/level/three/.env.local",
        "packages/app/config/.env.staging",
        "services/auth/.env.production",
      ];

      for (const p of paths) {
        expect(isForbiddenPath(p)).toBe(true);
      }
    });

    it("flags relative path traversals resolving to protected paths", () => {
      const traversalPaths = [
        "../.env",
        "../../.env.production",
        "src/../../.env",
        "foo/bar/../../.git/info/exclude",
        "foo/bar/../../.evidence/audit.json",
        "foo/bar/../../.agents/teamwork/plan.md",
      ];

      for (const p of traversalPaths) {
        expect(isForbiddenPath(p)).toBe(true);
      }
    });

    it("flags protected directory prefixes with trailing slashes", () => {
      expect(isForbiddenPath(".agents/")).toBe(true);
      expect(isForbiddenPath(".evidence/")).toBe(true);
      expect(isForbiddenPath("sub/dir/.agents/")).toBe(true);
      expect(isForbiddenPath("sub/dir/.evidence/")).toBe(true);
    });

    it("normalizes Windows backslashes in paths", () => {
      expect(isForbiddenPath("sub\\dir\\.env")).toBe(true);
      expect(isForbiddenPath(".git\\info\\exclude")).toBe(true);
      expect(isForbiddenPath(".agents\\teamwork\\plan.md")).toBe(true);
      expect(isForbiddenPath("docs\\ANTIGRAVITY_PRD.md")).toBe(true);
    });

    it("flags docs/ANTIGRAVITY_ and root ANTIGRAVITY_ specifications", () => {
      expect(isForbiddenPath("docs/ANTIGRAVITY_PRD.md")).toBe(true);
      expect(isForbiddenPath("docs/ANTIGRAVITY_ARCHITECTURE.md")).toBe(true);
      expect(isForbiddenPath("ANTIGRAVITY_LOCAL_SPEC.md")).toBe(true);
      expect(isForbiddenPath("deep/docs/ANTIGRAVITY_TEST.md")).toBe(true);
    });

    it("does NOT flag legitimate paths with similar tokens", () => {
      expect(isForbiddenPath("src/environment.ts")).toBe(false);
      expect(isForbiddenPath("src/config/envelope.ts")).toBe(false);
      expect(isForbiddenPath("src/agents/pr-workflow/pr-workflow-service.ts")).toBe(false);
      expect(isForbiddenPath("docs/PRD.md")).toBe(false);
      expect(isForbiddenPath("test/evidence-helper.ts")).toBe(false);
    });

    it("enforces custom forbidden patterns alongside built-ins", () => {
      const custom = ["id_rsa", "credentials.json", "private_token"];
      expect(isForbiddenPath("id_rsa", custom)).toBe(true);
      expect(isForbiddenPath("config/credentials.json", custom)).toBe(true);
      expect(isForbiddenPath("auth/private_token.key", custom)).toBe(true);
      expect(isForbiddenPath("src/safe.ts", custom)).toBe(false);
    });
  });

  // ── 3. evaluatePrPreFlightGates: Boolean Truth Table Matrix ────────────────
  describe("evaluatePrPreFlightGates: Boolean Truth Table Matrix", () => {
    it("case 1: all 5 checks pass", () => {
      const result = evaluatePrPreFlightGates({
        changedFiles: ["src/index.ts"],
        diffText: "+const ok = true;",
        testPassed: true,
        typecheckPassed: true,
        lintPassed: true,
      });

      expect(result.allPassed).toBe(true);
      expect(result.blockingReasons).toHaveLength(0);
      expect(result.checks).toHaveLength(5);
      expect(result.checks.every((c) => c.passed)).toBe(true);
    });

    it("case 2: exactly ONE check fails — typecheck", () => {
      const result = evaluatePrPreFlightGates({
        changedFiles: ["src/index.ts"],
        diffText: "+const ok = true;",
        typecheckPassed: false,
      });

      expect(result.allPassed).toBe(false);
      expect(result.blockingReasons).toHaveLength(1);
      expect(result.blockingReasons[0]).toContain("typecheck");
      expect(result.checks.find((c) => c.name === "typecheck")?.passed).toBe(false);
      expect(result.checks.filter((c) => c.passed)).toHaveLength(4);
    });

    it("case 3: exactly ONE check fails — linter", () => {
      const result = evaluatePrPreFlightGates({
        changedFiles: ["src/index.ts"],
        diffText: "+const ok = true;",
        lintPassed: false,
      });

      expect(result.allPassed).toBe(false);
      expect(result.blockingReasons).toHaveLength(1);
      expect(result.blockingReasons[0]).toContain("linter");
      expect(result.checks.find((c) => c.name === "linter")?.passed).toBe(false);
      expect(result.checks.filter((c) => c.passed)).toHaveLength(4);
    });

    it("case 4: exactly ONE check fails — unit_tests", () => {
      const result = evaluatePrPreFlightGates({
        changedFiles: ["src/index.ts"],
        diffText: "+const ok = true;",
        testPassed: false,
      });

      expect(result.allPassed).toBe(false);
      expect(result.blockingReasons).toHaveLength(1);
      expect(result.blockingReasons[0]).toContain("unit_tests");
      expect(result.checks.find((c) => c.name === "unit_tests")?.passed).toBe(false);
      expect(result.checks.filter((c) => c.passed)).toHaveLength(4);
    });

    it("case 5: exactly ONE check fails — secret_scan", () => {
      const result = evaluatePrPreFlightGates({
        changedFiles: ["src/index.ts"],
        diffText: '+const secret = "ghp_12345678901234567890";',
      });

      expect(result.allPassed).toBe(false);
      expect(result.blockingReasons).toHaveLength(1);
      expect(result.blockingReasons[0]).toContain("secret_scan");
      expect(result.checks.find((c) => c.name === "secret_scan")?.passed).toBe(false);
      expect(result.checks.filter((c) => c.passed)).toHaveLength(4);
    });

    it("case 6: exactly ONE check fails — forbidden_paths", () => {
      const result = evaluatePrPreFlightGates({
        changedFiles: ["src/index.ts", ".env"],
        diffText: "+const ok = true;",
      });

      expect(result.allPassed).toBe(false);
      expect(result.blockingReasons).toHaveLength(1);
      expect(result.blockingReasons[0]).toContain("forbidden_paths");
      expect(result.checks.find((c) => c.name === "forbidden_paths")?.passed).toBe(false);
      expect(result.checks.filter((c) => c.passed)).toHaveLength(4);
    });

    it("case 7: all 5 checks fail simultaneously", () => {
      const result = evaluatePrPreFlightGates({
        changedFiles: ["src/index.ts", ".env", ".evidence/audit.json"],
        diffText: '+const secret = "sk-proj-12345678901234567890";',
        typecheckPassed: false,
        lintPassed: false,
        testPassed: false,
      });

      expect(result.allPassed).toBe(false);
      expect(result.blockingReasons).toHaveLength(5);
      expect(result.checks.every((c) => !c.passed)).toBe(true);
    });
  });

  // ── 4. compilePullRequestMarkdown: Stress & Edge Cases ──────────────────────
  describe("compilePullRequestMarkdown: Stress & Adversarial Inputs", () => {
    it("handles empty changedFiles gracefully", () => {
      const draft: PullRequestDraftRecord = {
        prId: "pr_empty_test",
        workspaceId: "ws_default",
        sourceBranch: "chore/empty",
        targetBranch: "main",
        title: "Empty Changes",
        summaryMarkdown: "No files touched.",
        changedFiles: [],
        verificationChecks: [],
        allChecksPassed: true,
        status: "draft",
        createdAtMs: 1700000000000,
        updatedAtMs: 1700000000000,
      };

      const md = compilePullRequestMarkdown(draft);
      expect(md).toContain("_No files changed._");
      expect(md).toContain("# Empty Changes");
    });

    it("handles massive file lists (1000 changed files) deterministically", () => {
      const massiveFiles = Array.from({ length: 1000 }, (_, i) => `src/module_${i}/file_${i}.ts`);
      const draft: PullRequestDraftRecord = {
        prId: "pr_massive",
        workspaceId: "ws_large",
        sourceBranch: "feat/massive-refactor",
        targetBranch: "main",
        title: "Massive Refactor",
        summaryMarkdown: "Touched 1000 files across the repo.",
        changedFiles: massiveFiles,
        verificationChecks: [
          {
            name: "typecheck",
            passed: true,
            detail: "Clean",
            durationMs: 500,
          },
        ],
        allChecksPassed: true,
        status: "ready_for_review",
        createdAtMs: 1700000000000,
        updatedAtMs: 1700000000000,
      };

      const md = compilePullRequestMarkdown(draft);
      expect(md).toContain("- `src/module_0/file_0.ts`");
      expect(md).toContain("- `src/module_999/file_999.ts`");
      expect(md.split("\n").filter((l) => l.startsWith("- `src/module_"))).toHaveLength(1000);
    });

    it("handles special characters, Markdown injection, and XSS vectors in title and summary", () => {
      const draft: PullRequestDraftRecord = {
        prId: "pr_special_chars",
        workspaceId: "ws_adversarial",
        sourceBranch: 'feat/"quotes"-\'single\'-`backticks`',
        targetBranch: "main",
        title: 'Fix: "<script>alert(1)</script>" & [Link](javascript:void(0)) | Table Break',
        summaryMarkdown:
          "## Injection Attempt\n| Col 1 | Col 2 |\n|---|---|\n| Value | `code` |\n<img src=x onerror=alert(2)>",
        changedFiles: ["src/special.ts"],
        verificationChecks: [
          {
            name: "typecheck",
            passed: true,
            detail: "TypeScript check clean | no table escape corruption",
            durationMs: 10,
          },
        ],
        allChecksPassed: true,
        status: "ready_for_review",
        createdAtMs: 1700000000000,
        updatedAtMs: 1700000000000,
      };

      const md = compilePullRequestMarkdown(draft);
      expect(md).toContain(draft.title);
      expect(md).toContain(draft.summaryMarkdown);
      expect(md).toContain("## Verification Gate Scorecard");
      expect(md).toContain("| typecheck | ✅ PASSED |");
    });
  });

  // ── 5. PrWorkflowOrchestratorService: Zone 0 & Approval Lifecycle ───────────
  describe("PrWorkflowOrchestratorService: Zone 0 Defense & Lifecycle Enforcement", () => {
    it("blocks createPullRequestDraft when trustZone is 'public'", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      expect(() =>
        service.createPullRequestDraft({
          sourceBranch: "untrusted/feat",
          title: "Public Draft",
          description: "From public channel",
          changedFiles: ["src/foo.ts"],
          diffText: "+const x = 1;",
          trustZone: "public",
        }),
      ).toThrowError("ZONE_0_BLOCKED");
    });

    it("allows createPullRequestDraft when trustZone is undefined, 'operator', or 'authenticated'", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      const d1 = service.createPullRequestDraft({
        sourceBranch: "feat/1",
        title: "D1",
        description: "Undefined trustZone",
        changedFiles: ["src/1.ts"],
        diffText: "+const a = 1;",
      });
      expect(d1.status).toBe("ready_for_review");

      const d2 = service.createPullRequestDraft({
        sourceBranch: "feat/2",
        title: "D2",
        description: "Operator trustZone",
        changedFiles: ["src/2.ts"],
        diffText: "+const b = 2;",
        trustZone: "operator",
      });
      expect(d2.status).toBe("ready_for_review");

      const d3 = service.createPullRequestDraft({
        sourceBranch: "feat/3",
        title: "D3",
        description: "Authenticated trustZone",
        changedFiles: ["src/3.ts"],
        diffText: "+const c = 3;",
        trustZone: "authenticated",
      });
      expect(d3.status).toBe("ready_for_review");
    });

    it("blocks approvePullRequestDraft when trustZone is 'public'", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      const draft = service.createPullRequestDraft({
        sourceBranch: "feat/clean",
        title: "Clean Draft",
        description: "Valid PR",
        changedFiles: ["src/clean.ts"],
        diffText: "+export const ok = true;",
      });

      expect(() =>
        service.approvePullRequestDraft({
          prId: draft.prId,
          approverId: "public_user",
          trustZone: "public",
        }),
      ).toThrowError("ZONE_0_BLOCKED");
    });

    it("refuses to approve draft if verification checks failed (PR_GATE_BLOCKED)", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      const blockedDraft = service.createPullRequestDraft({
        sourceBranch: "feat/leak",
        title: "Leaked Token",
        description: "Leaked OpenAI key",
        changedFiles: ["src/leak.ts"],
        diffText: '+const key = "sk-proj-12345678901234567890";',
      });
      expect(blockedDraft.status).toBe("blocked");

      expect(() =>
        service.approvePullRequestDraft({
          prId: blockedDraft.prId,
          approverId: "operator_lead",
        }),
      ).toThrowError("PR_GATE_BLOCKED");
    });

    it("throws clear error when approving a non-existent draft ID", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      expect(() =>
        service.approvePullRequestDraft({
          prId: "pr_does_not_exist_999",
          approverId: "operator_lead",
        }),
      ).toThrowError('Pull request draft "pr_does_not_exist_999" not found.');
    });

    it("allows re-approving an already approved draft and updates the approver", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      const draft = service.createPullRequestDraft({
        sourceBranch: "feat/certified",
        title: "Certified Feature",
        description: "Clean PR",
        changedFiles: ["src/certified.ts"],
        diffText: "+export const cert = true;",
      });

      const firstApproval = service.approvePullRequestDraft({
        prId: draft.prId,
        approverId: "first_approver",
      });
      expect(firstApproval.status).toBe("approved");
      expect(firstApproval.approverId).toBe("first_approver");

      // Second approval by lead operator updates approverId
      const secondApproval = service.approvePullRequestDraft({
        prId: draft.prId,
        approverId: "lead_operator",
      });
      expect(secondApproval.status).toBe("approved");
      expect(secondApproval.approverId).toBe("lead_operator");
    });

    it("handles concurrent draft creation across multiple workspaces without data bleeding", async () => {
      const service = new PrWorkflowOrchestratorService();
      await service.start();

      const numDrafts = 50;
      for (let i = 0; i < numDrafts; i++) {
        const ws = i % 2 === 0 ? "workspace_even" : "workspace_odd";
        service.createPullRequestDraft({
          workspaceId: ws,
          sourceBranch: `feat/${i}`,
          title: `Draft ${i}`,
          description: `Description ${i}`,
          changedFiles: [`src/file_${i}.ts`],
          diffText: `+const val_${i} = ${i};`,
        });
      }

      expect(service.listPullRequestDrafts()).toHaveLength(50);
      expect(service.listPullRequestDrafts("workspace_even")).toHaveLength(25);
      expect(service.listPullRequestDrafts("workspace_odd")).toHaveLength(25);
      expect(service.listPullRequestDrafts("workspace_other")).toHaveLength(0);
    });
  });
});
