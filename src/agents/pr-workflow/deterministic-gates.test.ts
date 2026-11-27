import { describe, expect, it, vi } from "vitest";
import {
  runDeterministicPrGates,
  type DeterministicExecutionBackend,
  type DeterministicGateName,
} from "./index.js";

describe("CoreFlow Deterministic PR 5-Gate Runner", () => {
  it("runs Gates 1-4 and skips Gate 5 (diff_auditor) for Tier 1", async () => {
    const executed: DeterministicGateName[] = [];
    const result = await runDeterministicPrGates({
      tier: 1,
      changedFiles: ["src/a.ts", "src/b.ts", "src/c.ts"],
      diffText: "+export const ok = true;\n",
      commandRunner: (gate) => {
        executed.push(gate);
        return { passed: true, output: `${gate} ok` };
      },
    });

    expect(result.ok).toBe(true);
    expect(result.halted).toBe(false);
    expect(executed).toEqual(["typecheck", "lint", "unit_tests", "security"]);
    const gate5 = result.gates.find((g) => g.gate === "diff_auditor");
    expect(gate5?.skipped).toBe(true);
  });

  it("runs Gates 1-4 and single-pass diff_auditor Gate 5 for Tier 2", async () => {
    const backendCalls: string[] = [];
    const backend: DeterministicExecutionBackend = {
      exec: vi.fn(async (cmd, args) => {
        backendCalls.push(`${cmd} ${args.join(" ")}`);
        return { exitCode: 0, stdout: "ok", stderr: "" };
      }),
    };
    const diffAuditor = vi.fn(async () => ({
      passed: true,
      detail: "Diff-only audit clean",
      output: "0 findings",
    }));

    const result = await runDeterministicPrGates({
      tier: 2,
      changedFiles: ["src/security/audit.ts"],
      diffText: "+export const hardened = true;\n",
      executionBackend: backend,
      diffAuditor,
    });

    expect(result.ok).toBe(true);
    expect(result.halted).toBe(false);
    expect(backendCalls).toHaveLength(3);
    expect(diffAuditor).toHaveBeenCalledTimes(1);
    const gate5 = result.gates.find((g) => g.gate === "diff_auditor");
    expect(gate5?.skipped).toBe(false);
    expect(gate5?.passed).toBe(true);
  });

  it("recovers when a gate passes within the 2-retry allowance", async () => {
    let lintAttempts = 0;
    const result = await runDeterministicPrGates({
      tier: 1,
      changedFiles: ["src/a.ts"],
      diffText: "+const x = 1;\n",
      maxRetriesPerGate: 2,
      commandRunner: (gate, attempt) => {
        if (gate === "lint") {
          lintAttempts = attempt;
          if (attempt < 3) {
            return { passed: false, output: `lint transient error attempt ${attempt}` };
          }
        }
        return { passed: true, output: "ok" };
      },
    });

    expect(result.ok).toBe(true);
    expect(lintAttempts).toBe(3);
  });

  it("trips hard 2-retry circuit-breaker and halts before later gates", async () => {
    const executed: DeterministicGateName[] = [];
    const result = await runDeterministicPrGates({
      tier: 2,
      changedFiles: ["src/a.ts"],
      diffText: "+const x = 1;\n",
      maxRetriesPerGate: 2,
      commandRunner: (gate) => {
        executed.push(gate);
        if (gate === "lint") {
          return { passed: false, output: "oxlint: unexpected any on line 12" };
        }
        return { passed: true, output: "ok" };
      },
    });

    expect(result.ok).toBe(false);
    expect(result.halted).toBe(true);
    expect(result.reason).toBe("circuit_breaker_tripped");
    expect(result.failedGate).toBe("lint");
    expect(result.capturedOutput).toContain("unexpected any");
    // 1 typecheck + 3 lint attempts (initial + 2 retries); unit_tests, security, diff_auditor must NOT run
    expect(executed).toEqual(["typecheck", "lint", "lint", "lint"]);
  });

  it("blocks secret leaks in Gate 4 security scan", async () => {
    const result = await runDeterministicPrGates({
      tier: 1,
      changedFiles: ["src/config.ts"],
      diffText: "+const token = \"ghp_1234567890abcdefghijklmnop\";\n",
      maxRetriesPerGate: 0,
      executionBackend: {
        exec: async () => ({ exitCode: 0, stdout: "ok", stderr: "" }),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.halted).toBe(true);
    expect(result.failedGate).toBe("security");
    expect(result.capturedOutput).toContain("GitHub PAT");
  });
});
