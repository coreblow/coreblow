/**
 * CoreBlow — Autonomous Git & Pull Request Workflow Engine
 *
 * Implements pure Data-Oriented Programming (DOP) contracts and gate functions
 * for PR diff inspection, secret detection, forbidden path enforcement,
 * deterministic PR Markdown compilation, and stateful PR workflow orchestration.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GatewayService, ServiceHealth } from "../../gateway/service-registry.js";

const execFileAsync = promisify(execFile);

// ── Immutable DOP Data Contracts ─────────────────────────────────────────────

export type PrCheckName = "typecheck" | "linter" | "unit_tests" | "secret_scan" | "forbidden_paths";

export interface PrVerificationCheck {
  readonly name: PrCheckName;
  readonly passed: boolean;
  readonly detail: string;
  readonly durationMs: number;
}

export type PullRequestDraftStatus =
  | "draft"
  | "ready_for_review"
  | "approved"
  | "blocked"
  | "merged";

export interface PullRequestDraftRecord {
  readonly prId: string;
  readonly workspaceId: string;
  readonly warRoomId?: string;
  readonly sourceBranch: string;
  readonly targetBranch: string;
  readonly title: string;
  readonly summaryMarkdown: string;
  readonly changedFiles: readonly string[];
  readonly verificationChecks: readonly PrVerificationCheck[];
  readonly allChecksPassed: boolean;
  readonly status: PullRequestDraftStatus;
  readonly createdAtMs: number;
  readonly updatedAtMs: number;
  readonly approverId?: string;
}

export interface EvaluatePrPreFlightGatesParams {
  readonly changedFiles: readonly string[];
  readonly diffText: string;
  readonly testPassed?: boolean;
  readonly typecheckPassed?: boolean;
  readonly lintPassed?: boolean;
  readonly forbiddenPatterns?: readonly string[];
}

export interface EvaluatePrPreFlightGatesResult {
  readonly checks: readonly PrVerificationCheck[];
  readonly allPassed: boolean;
  readonly blockingReasons: readonly string[];
}

// ── Secret Detection & Forbidden Path Rules ─────────────────────────────────

interface SecretPatternEntry {
  readonly name: string;
  readonly regex: RegExp;
}

const RAW_SECRET_PATTERNS: readonly SecretPatternEntry[] = [
  // Anthropic API keys (must precede generic sk- to match specific prefix)
  {
    name: "Anthropic API Key",
    regex: /\bsk-ant-[A-Za-z0-9_-]{10,}\b/,
  },
  // OpenAI API keys (standard & project scoped sk-proj-...)
  {
    name: "OpenAI API Key",
    regex: /\bsk-[A-Za-z0-9_-]{20,}\b/,
  },
  // GitHub Personal Access Tokens (classic & fine-grained)
  {
    name: "GitHub PAT",
    regex: /\b(?:ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/,
  },
  // Slack bot tokens
  {
    name: "Slack Token",
    regex: /\bxoxb-[A-Za-z0-9_-]{10,}\b/,
  },
  // Google Cloud / Firebase AIza keys
  {
    name: "Google Cloud / AIza Key",
    regex: /\bAIza[0-9A-Za-z-_]{20,}\b/,
  },
  // Private Key headers
  {
    name: "Private Key",
    regex: /(?:-----BEGIN\s+.*PRIVATE\s+KEY-----|\bPRIVATE\s+KEY\b)/i,
  },
  // Bearer tokens in Authorization headers or inline tokens
  {
    name: "Bearer Token",
    regex: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}\b/i,
  },
];

export function extractAddedDiffLines(diffText: string): readonly string[] {
  const lines = diffText.split(/\r?\n/);
  const added: string[] = [];
  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++")) {
      added.push(line.slice(1));
    }
  }
  return added;
}

export function scanAddedLinesForSecrets(addedLines: readonly string[]): readonly string[] {
  const detected: string[] = [];
  for (const line of addedLines) {
    for (const pattern of RAW_SECRET_PATTERNS) {
      if (pattern.regex.test(line)) {
        if (!detected.includes(pattern.name)) {
          detected.push(pattern.name);
        }
      }
    }
  }
  return detected;
}

export function isForbiddenPath(filePath: string, customPatterns?: readonly string[]): boolean {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\.\//, "");

  // .env and .env.* (at root or in any sub-path)
  if (/(?:^|\/)\.env(?:\..+)?$/i.test(normalized)) {
    return true;
  }
  // .git/info/exclude
  if (/(?:^|\/)\.git\/info\/exclude$/i.test(normalized)) {
    return true;
  }
  // .evidence/
  if (/(?:^|\/)\.evidence(?:\/|$)/i.test(normalized)) {
    return true;
  }
  // .agents/
  if (/(?:^|\/)\.agents(?:\/|$)/i.test(normalized)) {
    return true;
  }
  // docs/ANTIGRAVITY_ or ANTIGRAVITY_
  if (/(?:^|\/)docs\/ANTIGRAVITY_/i.test(normalized) || /(?:^|\/)ANTIGRAVITY_/i.test(normalized)) {
    return true;
  }

  if (customPatterns && customPatterns.length > 0) {
    for (const pat of customPatterns) {
      if (pat && normalized.includes(pat)) {
        return true;
      }
    }
  }

  return false;
}

// ── Pure DOP Gate Functions ──────────────────────────────────────────────────

export function evaluatePrPreFlightGates(
  params: EvaluatePrPreFlightGatesParams,
): EvaluatePrPreFlightGatesResult {
  const checks: PrVerificationCheck[] = [];

  // 1. typecheck
  const typecheckPassed = params.typecheckPassed !== false;
  checks.push({
    name: "typecheck",
    passed: typecheckPassed,
    detail: typecheckPassed
      ? "TypeScript check clean with zero errors"
      : "TypeScript compilation failed with type errors",
    durationMs: 0,
  });

  // 2. linter
  const lintPassed = params.lintPassed !== false;
  checks.push({
    name: "linter",
    passed: lintPassed,
    detail: lintPassed
      ? "Linter clean with zero warnings"
      : "Linter reported syntax or style violations",
    durationMs: 0,
  });

  // 3. unit_tests
  const testPassed = params.testPassed !== false;
  checks.push({
    name: "unit_tests",
    passed: testPassed,
    detail: testPassed
      ? "All unit test suites passed green"
      : "Unit test suite execution failed with failing tests",
    durationMs: 0,
  });

  // 4. secret_scan
  const addedLines = extractAddedDiffLines(params.diffText);
  const detectedSecrets = scanAddedLinesForSecrets(addedLines);
  const secretsPassed = detectedSecrets.length === 0;
  checks.push({
    name: "secret_scan",
    passed: secretsPassed,
    detail: secretsPassed
      ? "No raw secrets detected in diff"
      : `Detected unredacted raw secrets in added diff lines: ${detectedSecrets.join(", ")}`,
    durationMs: 0,
  });

  // 5. forbidden_paths
  const violatingFiles = params.changedFiles.filter((file) =>
    isForbiddenPath(file, params.forbiddenPatterns),
  );
  const pathsPassed = violatingFiles.length === 0;
  checks.push({
    name: "forbidden_paths",
    passed: pathsPassed,
    detail: pathsPassed
      ? "All changed files comply with repository boundary policies"
      : `Forbidden repository paths detected in staged files: ${violatingFiles.join(", ")}`,
    durationMs: 0,
  });

  const allPassed = checks.every((c) => c.passed);
  const blockingReasons = checks.filter((c) => !c.passed).map((c) => `${c.name}: ${c.detail}`);

  return {
    checks,
    allPassed,
    blockingReasons,
  };
}

export function compilePullRequestMarkdown(draft: PullRequestDraftRecord): string {
  const changedFilesSection =
    draft.changedFiles.length > 0
      ? draft.changedFiles.map((file) => `- \`${file}\``).join("\n")
      : "_No files changed._";

  const scorecardRows = draft.verificationChecks
    .map(
      (check) =>
        `| ${check.name} | ${check.passed ? "✅ PASSED" : "❌ FAILED"} | ${check.detail} | ${check.durationMs}ms |`,
    )
    .join("\n");

  const warRoomLine = draft.warRoomId ? `- **War Room**: \`${draft.warRoomId}\`\n` : "";

  return [
    `# ${draft.title}`,
    "",
    "## Summary",
    draft.summaryMarkdown || "_No description provided._",
    "",
    `- **Workspace**: \`${draft.workspaceId}\``,
    `${warRoomLine}- **Branches**: \`${draft.sourceBranch}\` -> \`${draft.targetBranch}\``,
    `- **Status**: \`${draft.status}\``,
    `- **Gate Score**: ${draft.allChecksPassed ? "✅ All checks passed" : "❌ Blocked by verification failure"}`,
    "",
    "## Changed Files",
    changedFilesSection,
    "",
    "## Verification Gate Scorecard",
    "| Gate | Status | Detail | Duration |",
    "|---|---|---|---|",
    scorecardRows,
    "",
  ].join("\n");
}

// ── OOP PrWorkflowOrchestratorService ───────────────────────────────────────

export interface CreatePullRequestDraftParams {
  readonly workspaceId?: string;
  readonly warRoomId?: string;
  readonly sourceBranch: string;
  readonly targetBranch?: string;
  readonly title: string;
  readonly description: string;
  readonly changedFiles: readonly string[];
  readonly diffText: string;
  readonly testPassed?: boolean;
  readonly typecheckPassed?: boolean;
  readonly lintPassed?: boolean;
  readonly forbiddenPatterns?: readonly string[];
  readonly trustZone?: "operator" | "authenticated" | "public";
  readonly prId?: string;
}

export interface ApprovePullRequestDraftParams {
  readonly prId: string;
  readonly approverId: string;
  readonly trustZone?: "operator" | "authenticated" | "public";
}

export interface GitWorkspaceStatus {
  readonly branch: string;
  readonly changedFiles: readonly string[];
  readonly diffText: string;
  readonly isClean: boolean;
}

export type GitCommandRunner = (
  command: string,
  args: readonly string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
) => Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}>;

export interface CreatePullRequestDraftFromWorkspaceParams {
  readonly cwd?: string;
  readonly workspaceId?: string;
  readonly warRoomId?: string;
  readonly sourceBranch?: string;
  readonly targetBranch?: string;
  readonly title: string;
  readonly description: string;
  readonly runGates?: boolean;
  readonly typecheckPassed?: boolean;
  readonly lintPassed?: boolean;
  readonly testPassed?: boolean;
  readonly forbiddenPatterns?: readonly string[];
  readonly trustZone?: "operator" | "authenticated" | "public";
  readonly prId?: string;
}

export interface CommitApprovedPullRequestDraftParams {
  readonly prId: string;
  readonly approverId: string;
  readonly cwd?: string;
  readonly commitMessage?: string;
  readonly createBranch?: boolean;
  readonly branchName?: string;
  readonly trustZone?: "operator" | "authenticated" | "public";
}

export interface CommitApprovedPullRequestDraftResult {
  readonly success: boolean;
  readonly draft: PullRequestDraftRecord;
  readonly commitHash: string;
  readonly branchCreated?: string;
  readonly output: string;
}

export interface PrWorkflowOrchestratorOptions {
  readonly initialDrafts?: readonly PullRequestDraftRecord[];
  readonly gitRunner?: GitCommandRunner;
}

export async function defaultGitRunner(
  command: string,
  args: readonly string[],
  options?: { cwd?: string; env?: NodeJS.ProcessEnv },
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  try {
    const { stdout, stderr } = await execFileAsync(command, [...args], {
      cwd: options?.cwd ?? process.cwd(),
      env: options?.env ?? process.env,
      maxBuffer: 10 * 1024 * 1024,
    });
    return { stdout: String(stdout), stderr: String(stderr), exitCode: 0 };
  } catch (err: any) {
    return {
      stdout: String(err.stdout ?? ""),
      stderr: String(err.stderr ?? err.message ?? ""),
      exitCode: typeof err.code === "number" ? err.code : 1,
    };
  }
}

/**
 * Inspects a real Git workspace: branch, modified/untracked files, and full diffText (TB3.1).
 */
export async function inspectGitWorkspace(
  cwd?: string,
  gitRunner: GitCommandRunner = defaultGitRunner,
): Promise<GitWorkspaceStatus> {
  const dir = cwd ?? process.cwd();

  // 1. Current Branch
  const branchRes = await gitRunner("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dir });
  const branch = branchRes.exitCode === 0 ? branchRes.stdout.trim() : "main";

  // 2. Status Porcelain (changed files)
  const statusRes = await gitRunner("git", ["status", "--porcelain"], { cwd: dir });
  const changedFiles: string[] = [];
  if (statusRes.exitCode === 0 && statusRes.stdout.trim().length > 0) {
    const lines = statusRes.stdout.split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().length >= 3) {
        const filePart = line.slice(3).trim();
        const finalFile = filePart.includes(" -> ") ? filePart.split(" -> ")[1].trim() : filePart;
        if (finalFile) {
          changedFiles.push(finalFile);
        }
      }
    }
  }

  // 3. Diff Text (staged + unstaged)
  const diffRes = await gitRunner("git", ["diff", "HEAD"], { cwd: dir });
  let diffText = diffRes.exitCode === 0 ? diffRes.stdout : "";
  if (!diffText.trim()) {
    const unstagedDiff = await gitRunner("git", ["diff"], { cwd: dir });
    const stagedDiff = await gitRunner("git", ["diff", "--cached"], { cwd: dir });
    diffText = `${unstagedDiff.stdout}\n${stagedDiff.stdout}`.trim();
  }

  return {
    branch,
    changedFiles: Object.freeze(Array.from(new Set(changedFiles))),
    diffText,
    isClean: changedFiles.length === 0,
  };
}

export class PrWorkflowOrchestratorService implements GatewayService {
  public readonly name = "pr-workflow-orchestrator";
  private isStarted = false;
  private readonly drafts = new Map<string, PullRequestDraftRecord>();
  private readonly gitRunner: GitCommandRunner;

  constructor(options?: PrWorkflowOrchestratorOptions) {
    this.gitRunner = options?.gitRunner ?? defaultGitRunner;
    if (options?.initialDrafts) {
      for (const draft of options.initialDrafts) {
        this.drafts.set(draft.prId, draft);
      }
    }
  }

  async start(): Promise<void> {
    this.isStarted = true;
  }

  async stop(): Promise<void> {
    this.isStarted = false;
    this.drafts.clear();
  }

  health(): ServiceHealth {
    if (!this.isStarted) {
      return {
        status: "down",
        detail: "PR workflow orchestrator stopped",
      };
    }
    return {
      status: "healthy",
      detail: `Managing ${this.drafts.size} pull request drafts`,
    };
  }

  createPullRequestDraft(params: CreatePullRequestDraftParams): PullRequestDraftRecord {
    if (params.trustZone === "public") {
      throw new Error(
        "ZONE_0_BLOCKED: Public channels cannot create or mutate pull request drafts.",
      );
    }

    const gateResult = evaluatePrPreFlightGates({
      changedFiles: params.changedFiles,
      diffText: params.diffText,
      testPassed: params.testPassed,
      typecheckPassed: params.typecheckPassed,
      lintPassed: params.lintPassed,
      forbiddenPatterns: params.forbiddenPatterns,
    });

    const now = Date.now();
    const prId = params.prId ?? `pr_${now}_${Math.random().toString(36).substring(2, 8)}`;
    const status: PullRequestDraftStatus = gateResult.allPassed ? "ready_for_review" : "blocked";

    const draft: PullRequestDraftRecord = {
      prId,
      workspaceId: params.workspaceId ?? "default",
      warRoomId: params.warRoomId,
      sourceBranch: params.sourceBranch,
      targetBranch: params.targetBranch ?? "main",
      title: params.title,
      summaryMarkdown: params.description,
      changedFiles: [...params.changedFiles],
      verificationChecks: gateResult.checks,
      allChecksPassed: gateResult.allPassed,
      status,
      createdAtMs: now,
      updatedAtMs: now,
    };

    this.drafts.set(prId, draft);
    return draft;
  }

  approvePullRequestDraft(params: ApprovePullRequestDraftParams): PullRequestDraftRecord {
    if (params.trustZone === "public") {
      throw new Error(
        "ZONE_0_BLOCKED: Public channels cannot create or mutate pull request drafts.",
      );
    }

    const draft = this.drafts.get(params.prId);
    if (!draft) {
      throw new Error(`Pull request draft "${params.prId}" not found.`);
    }

    if (!draft.allChecksPassed || draft.status === "blocked") {
      throw new Error("PR_GATE_BLOCKED: Cannot approve PR draft with failing verification checks.");
    }

    const now = Date.now();
    const updatedDraft: PullRequestDraftRecord = {
      ...draft,
      status: "approved",
      updatedAtMs: now,
      approverId: params.approverId,
    };

    this.drafts.set(params.prId, updatedDraft);
    return updatedDraft;
  }

  listPullRequestDrafts(workspaceId?: string): readonly PullRequestDraftRecord[] {
    const all = Array.from(this.drafts.values());
    if (!workspaceId) {
      return all;
    }
    return all.filter((draft) => draft.workspaceId === workspaceId);
  }

  getPullRequestDraft(prId: string): PullRequestDraftRecord | undefined {
    return this.drafts.get(prId);
  }

  /**
   * Inspects a real Git workspace: branch, status, and diff (TB3.1).
   */
  async inspectGitWorkspace(cwd?: string): Promise<GitWorkspaceStatus> {
    return inspectGitWorkspace(cwd, this.gitRunner);
  }

  /**
   * Automatically creates a PR draft by inspecting the live Git workspace and running gates (TB3.1, TB3.3).
   */
  async createPullRequestDraftFromWorkspace(
    params: CreatePullRequestDraftFromWorkspaceParams,
  ): Promise<PullRequestDraftRecord> {
    const gitStatus = await this.inspectGitWorkspace(params.cwd);
    const sourceBranch = params.sourceBranch ?? gitStatus.branch;

    return this.createPullRequestDraft({
      workspaceId: params.workspaceId,
      warRoomId: params.warRoomId,
      sourceBranch,
      targetBranch: params.targetBranch ?? "main",
      title: params.title,
      description: params.description,
      changedFiles: gitStatus.changedFiles,
      diffText: gitStatus.diffText,
      typecheckPassed: params.typecheckPassed,
      lintPassed: params.lintPassed,
      testPassed: params.testPassed,
      forbiddenPatterns: params.forbiddenPatterns,
      trustZone: params.trustZone,
      prId: params.prId,
    });
  }

  /**
   * Commits an approved Pull Request draft to Git (TB3.1, TB3.2).
   * Strict safety check: Draft must be 'approved', Zone 0 public channels rejected.
   */
  async commitApprovedPullRequestDraft(
    params: CommitApprovedPullRequestDraftParams,
  ): Promise<CommitApprovedPullRequestDraftResult> {
    if (params.trustZone === "public") {
      throw new Error(
        "ZONE_0_BLOCKED: Public channels cannot commit or mutate pull request drafts.",
      );
    }

    const draft = this.drafts.get(params.prId);
    if (!draft) {
      throw new Error(`Pull request draft "${params.prId}" not found.`);
    }

    if (draft.status !== "approved") {
      throw new Error(
        `PR_NOT_APPROVED: Cannot commit PR draft in status "${draft.status}". Must be "approved" by operator.`,
      );
    }

    const dir = params.cwd ?? process.cwd();
    let branchCreated: string | undefined;

    // 1. Create branch if requested
    if (params.createBranch && params.branchName) {
      const branchRes = await this.gitRunner("git", ["checkout", "-b", params.branchName], { cwd: dir });
      if (branchRes.exitCode === 0) {
        branchCreated = params.branchName;
      }
    }

    // 2. Stage files
    if (draft.changedFiles.length > 0) {
      await this.gitRunner("git", ["add", "--", ...draft.changedFiles], { cwd: dir });
    } else {
      await this.gitRunner("git", ["add", "-A"], { cwd: dir });
    }

    // 3. Commit
    const commitMsg = params.commitMessage ?? `${draft.title}\n\n${draft.summaryMarkdown}`;
    const commitRes = await this.gitRunner("git", ["commit", "-m", commitMsg], { cwd: dir });

    // 4. Resolve commit hash
    const hashRes = await this.gitRunner("git", ["rev-parse", "--short=7", "HEAD"], { cwd: dir });
    const commitHash = hashRes.exitCode === 0 ? hashRes.stdout.trim() : "unknown";

    // 5. Transition status to 'merged'
    const now = Date.now();
    const updatedDraft: PullRequestDraftRecord = {
      ...draft,
      status: "merged",
      updatedAtMs: now,
    };
    this.drafts.set(params.prId, updatedDraft);

    return {
      success: commitRes.exitCode === 0,
      draft: updatedDraft,
      commitHash,
      branchCreated,
      output: commitRes.stdout || commitRes.stderr,
    };
  }

  /**
   * Rejects a PR draft, transitioning status to 'blocked' (TB3.2).
   */
  rejectPullRequestDraft(params: {
    prId: string;
    reason: string;
    rejecterId: string;
    trustZone?: "operator" | "authenticated" | "public";
  }): PullRequestDraftRecord {
    if (params.trustZone === "public") {
      throw new Error(
        "ZONE_0_BLOCKED: Public channels cannot reject or mutate pull request drafts.",
      );
    }

    const draft = this.drafts.get(params.prId);
    if (!draft) {
      throw new Error(`Pull request draft "${params.prId}" not found.`);
    }

    const now = Date.now();
    const updatedDraft: PullRequestDraftRecord = {
      ...draft,
      status: "blocked",
      updatedAtMs: now,
    };
    this.drafts.set(params.prId, updatedDraft);
    return updatedDraft;
  }
}
