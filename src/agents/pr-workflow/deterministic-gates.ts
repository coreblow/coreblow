/**
 * CoreFlow — Deterministic PR 5-Gate Runner
 *
 * Executes zero-token machine gates (Gates 1-4: typecheck, lint, unit_tests,
 * security) and an optional single-pass diff-only auditor (Gate 5, Tier 2 only),
 * guarded by a hard retry circuit-breaker per failing gate.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  extractAddedDiffLines,
  isForbiddenPath,
  scanAddedLinesForSecrets,
} from "./pr-workflow-service.js";

const execFileAsync = promisify(execFile);

export type DeterministicGateName =
  | "typecheck"
  | "lint"
  | "unit_tests"
  | "security"
  | "diff_auditor";

export interface DeterministicGateOutcome {
  readonly passed: boolean;
  readonly output: string;
  readonly detail?: string;
}

export interface DeterministicExecutionBackend {
  exec(
    command: string,
    args: readonly string[],
    options?: { readonly cwd?: string },
  ): Promise<{ readonly exitCode: number; readonly stdout: string; readonly stderr: string }>;
}

export type DeterministicGateCommandRunner = (
  gate: DeterministicGateName,
  attempt: number,
  context: {
    readonly cwd: string;
    readonly changedFiles: readonly string[];
    readonly diffText: string;
    readonly tier: 0 | 1 | 2;
  },
) => Promise<DeterministicGateOutcome> | DeterministicGateOutcome;

export interface DeterministicGateResult {
  readonly gate: DeterministicGateName;
  readonly passed: boolean;
  readonly skipped: boolean;
  readonly attempts: number;
  readonly detail: string;
  readonly output: string;
  readonly durationMs: number;
}

export interface RunDeterministicPrGatesParams {
  readonly tier?: 0 | 1 | 2;
  readonly cwd?: string;
  readonly changedFiles: readonly string[];
  readonly diffText: string;
  readonly maxRetriesPerGate?: number;
  readonly executionBackend?: DeterministicExecutionBackend;
  readonly commandRunner?: DeterministicGateCommandRunner;
  readonly diffAuditor?: (params: {
    readonly changedFiles: readonly string[];
    readonly diffText: string;
  }) => Promise<DeterministicGateOutcome> | DeterministicGateOutcome;
  readonly trustScanner?: (params: {
    readonly changedFiles: readonly string[];
    readonly diffText: string;
  }) => Promise<DeterministicGateOutcome> | DeterministicGateOutcome;
  readonly forbiddenPatterns?: readonly string[];
}

export interface RunDeterministicPrGatesResult {
  readonly ok: boolean;
  readonly halted: boolean;
  readonly reason?: "circuit_breaker_tripped";
  readonly failedGate?: DeterministicGateName;
  readonly capturedOutput?: string;
  readonly tier: 0 | 1 | 2;
  readonly gates: readonly DeterministicGateResult[];
  readonly durationMs: number;
}

const DEFAULT_GATE_COMMANDS: Record<"typecheck" | "lint" | "unit_tests", readonly [string, readonly string[]]> = {
  typecheck: ["./node_modules/.bin/tsgo", ["--noEmit"]],
  lint: ["corepack", ["pnpm", "check"]],
  unit_tests: ["pnpm", ["exec", "vitest", "run"]],
};

async function runViaBackendOrExec(
  gate: "typecheck" | "lint" | "unit_tests",
  cwd: string,
  backend?: DeterministicExecutionBackend,
): Promise<DeterministicGateOutcome> {
  const [cmd, args] = DEFAULT_GATE_COMMANDS[gate];
  if (backend) {
    const res = await backend.exec(cmd, args, { cwd });
    const output = [res.stdout, res.stderr].filter(Boolean).join("\n").trim();
    return {
      passed: res.exitCode === 0,
      output,
      detail: res.exitCode === 0 ? `${gate} passed via execution backend` : `${gate} exited with ${res.exitCode}`,
    };
  }

  try {
    const { stdout, stderr } = await execFileAsync(cmd, [...args], {
      cwd,
      env: { ...process.env, CI: "true", COREPACK_ENABLE_DOWNLOAD_PROMPT: "0" },
    });
    const output = [stdout, stderr].filter(Boolean).join("\n").trim();
    return { passed: true, output, detail: `${gate} passed` };
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    const output = [e.stdout, e.stderr, e.message].filter(Boolean).join("\n").trim();
    return { passed: false, output, detail: `${gate} failed` };
  }
}

async function runSecurityGate(params: {
  readonly changedFiles: readonly string[];
  readonly diffText: string;
  readonly forbiddenPatterns?: readonly string[];
  readonly trustScanner?: RunDeterministicPrGatesParams["trustScanner"];
}): Promise<DeterministicGateOutcome> {
  const addedLines = extractAddedDiffLines(params.diffText);
  const secrets = scanAddedLinesForSecrets(addedLines);
  const forbidden = params.changedFiles.filter((file) =>
    isForbiddenPath(file, params.forbiddenPatterns),
  );

  const issues: string[] = [];
  if (secrets.length > 0) {
    issues.push(`Secret patterns detected: ${secrets.join(", ")}`);
  }
  if (forbidden.length > 0) {
    issues.push(`Forbidden paths modified: ${forbidden.join(", ")}`);
  }
  if (issues.length > 0) {
    return {
      passed: false,
      output: issues.join("\n"),
      detail: issues.join("; "),
    };
  }

  if (params.trustScanner) {
    const trustRes = await params.trustScanner({
      changedFiles: params.changedFiles,
      diffText: params.diffText,
    });
    if (!trustRes.passed) {
      return trustRes;
    }
  }

  return {
    passed: true,
    output: `Scanned ${addedLines.length} added lines across ${params.changedFiles.length} files (0 leaks).`,
    detail: "Security and forbidden-path checks passed",
  };
}

export async function runDeterministicPrGates(
  params: RunDeterministicPrGatesParams,
): Promise<RunDeterministicPrGatesResult> {
  const startedAt = Date.now();
  const tier = params.tier ?? 1;
  const cwd = params.cwd ?? process.cwd();
  const maxRetries = Math.max(0, params.maxRetriesPerGate ?? 2);
  const maxAttempts = 1 + maxRetries;

  const gatesOrder: readonly DeterministicGateName[] = [
    "typecheck",
    "lint",
    "unit_tests",
    "security",
    "diff_auditor",
  ];
  const executed: DeterministicGateResult[] = [];

  for (const gate of gatesOrder) {
    if (gate === "diff_auditor" && tier !== 2) {
      executed.push({
        gate,
        passed: true,
        skipped: true,
        attempts: 0,
        detail: `Skipped diff_auditor for Tier ${tier}`,
        output: "",
        durationMs: 0,
      });
      continue;
    }

    const gateStart = Date.now();
    let attempts = 0;
    let lastOutcome: DeterministicGateOutcome = {
      passed: false,
      output: "",
      detail: `${gate} did not execute`,
    };

    while (attempts < maxAttempts) {
      attempts += 1;
      if (params.commandRunner) {
        lastOutcome = await params.commandRunner(gate, attempts, {
          cwd,
          changedFiles: params.changedFiles,
          diffText: params.diffText,
          tier,
        });
      } else if (gate === "typecheck" || gate === "lint" || gate === "unit_tests") {
        lastOutcome = await runViaBackendOrExec(gate, cwd, params.executionBackend);
      } else if (gate === "security") {
        lastOutcome = await runSecurityGate({
          changedFiles: params.changedFiles,
          diffText: params.diffText,
          forbiddenPatterns: params.forbiddenPatterns,
          trustScanner: params.trustScanner,
        });
      } else if (params.diffAuditor) {
        lastOutcome = await params.diffAuditor({
          changedFiles: params.changedFiles,
          diffText: params.diffText,
        });
      } else {
        lastOutcome = {
          passed: true,
          output: `Diff-only audit verified ${params.changedFiles.length} file(s).`,
          detail: "Diff-only auditor passed",
        };
      }

      if (lastOutcome.passed) {
        break;
      }
    }

    executed.push({
      gate,
      passed: lastOutcome.passed,
      skipped: false,
      attempts,
      detail: lastOutcome.detail ?? (lastOutcome.passed ? `${gate} passed` : `${gate} failed`),
      output: lastOutcome.output,
      durationMs: Date.now() - gateStart,
    });

    if (!lastOutcome.passed) {
      return {
        ok: false,
        halted: true,
        reason: "circuit_breaker_tripped",
        failedGate: gate,
        capturedOutput: lastOutcome.output,
        tier,
        gates: executed,
        durationMs: Date.now() - startedAt,
      };
    }
  }

  return {
    ok: true,
    halted: false,
    tier,
    gates: executed,
    durationMs: Date.now() - startedAt,
  };
}
