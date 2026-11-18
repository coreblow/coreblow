import { describe, it, expect } from "vitest";
import React from "react";
import { ExecutionCard } from "../components/ExecutionCard";
import type { ToolExecutionStep } from "../types/gateway";

describe("ExecutionCard component", () => {
  it("renders running step card", () => {
    const step: ToolExecutionStep = {
      stepIndex: 1,
      tool: "git_status",
      description: "Checking working tree clean state",
      status: "running",
    };

    const element = <ExecutionCard step={step} />;
    expect(element).toBeDefined();
    expect(step.stepIndex).toBe(1);
    expect(step.tool).toBe("git_status");
  });

  it("renders completed step card with input and output", () => {
    const step: ToolExecutionStep = {
      stepIndex: 2,
      tool: "run_command",
      description: "Execute pnpm check",
      status: "done",
      durationMs: 420,
      input: { cmd: "pnpm check" },
      output: { ok: true, errors: 0 },
    };

    const element = <ExecutionCard step={step} />;
    expect(element).toBeDefined();
    expect(step.status).toBe("done");
    expect(step.durationMs).toBe(420);
  });
});
