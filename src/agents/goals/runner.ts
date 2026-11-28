import type { GoalContract, GoalContractStore } from "./store.js";

export const GOAL_GATE_OUTPUT_TAIL_CHARS = 3000;
export const GOAL_JUDGE_MAX_TOKENS = 4096;
export const GOAL_MAX_PARSE_FAILURES = 3;
export const GOAL_MAX_TRANSPORT_FAILURES = 5;

export type ParsedGoalSubcommand =
  | { action: "status" }
  | { action: "cancel" }
  | { action: "wait"; pid: number }
  | { action: "draft"; objective: string }
  | { action: "set"; objective: string }
  | { action: "error"; message: string };

export function parseGoalCommand(rawArgs: string): ParsedGoalSubcommand {
  const trimmed = rawArgs.trim();
  if (!trimmed || trimmed === "status") {
    return { action: "status" };
  }
  if (trimmed === "cancel" || trimmed === "clear" || trimmed === "stop") {
    return { action: "cancel" };
  }
  if (trimmed.startsWith("wait")) {
    const pidRaw = trimmed.slice(4).trim();
    const pid = Number.parseInt(pidRaw, 10);
    if (!Number.isInteger(pid) || pid <= 0) {
      return { action: "error", message: "Usage: /goal wait <pid>" };
    }
    return { action: "wait", pid };
  }
  if (trimmed.startsWith("draft")) {
    const objective = trimmed.slice(5).trim();
    if (!objective) {
      return { action: "error", message: "Usage: /goal draft <objective>" };
    }
    return { action: "draft", objective };
  }
  if (trimmed.startsWith("-- ")) {
    const objective = trimmed.slice(3).trim();
    return objective
      ? { action: "set", objective }
      : { action: "error", message: "Usage: /goal -- <objective>" };
  }
  return { action: "set", objective: trimmed };
}

export function draftGoalContractText(objective: string): {
  objective: string;
  acceptanceCriteria: string[];
  gateCommands: string[];
} {
  const clean = objective.trim();
  return {
    objective: clean,
    acceptanceCriteria: [
      `Complete objective: ${clean}`,
      "Verify all CoreFlow deterministic checks pass before declaring completion.",
    ],
    gateCommands: ["corepack pnpm check"],
  };
}

export type GateCommandResult = {
  command: string;
  exitCode: number;
  output: string;
};

export type GoalJudgeVerdict = {
  verdict: "done" | "continue" | "wait";
  reason?: string;
  nextStep?: string;
};

export type GoalTurnEvaluation = {
  action: "continue" | "complete" | "pause" | "wait";
  contract: GoalContract;
  /** Delivered strictly as a normal user message so system prompt & toolset stay immutable for prompt caching. */
  continuationUserMessage?: string;
  bypassedJudgeViaCoreFlowGate?: boolean;
  reason?: string;
};

function tailOutput(text: string, maxChars = GOAL_GATE_OUTPUT_TAIL_CHARS): string {
  if (text.length <= maxChars) {
    return text;
  }
  return text.slice(text.length - maxChars);
}

function buildGoalContinuationUserMessage(params: {
  contract: GoalContract;
  gateFailure?: { command: string; outputTail: string };
  judgeNextStep?: string;
}): string {
  const lines = [
    "[Continuing toward your standing CoreFlow goal]",
    `Goal: ${params.contract.objective}`,
  ];
  if (params.contract.acceptanceCriteria.length > 0) {
    lines.push(
      "Acceptance criteria:",
      ...params.contract.acceptanceCriteria.map((item) => `- ${item}`),
    );
  }
  if (params.gateFailure) {
    lines.push(
      `CoreFlow deterministic gate failed (${params.gateFailure.command}). Fix the errors below before finishing:`,
      "```",
      params.gateFailure.outputTail,
      "```",
    );
  } else if (params.judgeNextStep) {
    lines.push(`Next concrete step: ${params.judgeNextStep}`);
  } else {
    lines.push("Take the next concrete step and provide verification evidence when done.");
  }
  return lines.join("\n");
}

/**
 * Evaluates one turn of a persistent `/goal` loop.
 * - Never mutates system prompt or toolset (cache-safe continuation via user message).
 * - Short-circuits to CoreFlow Gates 1-4 deterministic verification before calling the judge LLM.
 * - Separates parse failures (max 3) from transport failures (max 5).
 */
export async function evaluateGoalTurn(params: {
  store: GoalContractStore;
  contractId: string;
  assistantResponse: string;
  runGateCommand?: (command: string) => Promise<GateCommandResult>;
  invokeJudge?: (input: {
    objective: string;
    acceptanceCriteria: string[];
    assistantResponse: string;
    maxTokens: number;
  }) => Promise<string>;
}): Promise<GoalTurnEvaluation> {
  const current = params.store.getById(params.contractId);
  if (!current) {
    throw new Error(`Goal contract "${params.contractId}" not found.`);
  }
  if (current.status !== "active") {
    return {
      action: current.status === "waiting" ? "wait" : current.status === "completed" ? "complete" : "pause",
      contract: current,
      reason: current.pauseReason ?? `Goal is ${current.status}.`,
    };
  }

  const nextIteration = current.iterations + 1;
  if (nextIteration > current.maxIterations) {
    const paused = params.store.update(current.id, {
      status: "paused",
      pauseReason: `Reached max iterations (${current.maxIterations}).`,
    })!;
    return { action: "pause", contract: paused, reason: paused.pauseReason ?? undefined };
  }

  // 1. CoreFlow deterministic gates (0-token short-circuit)
  if (current.gateCommands.length > 0 && params.runGateCommand) {
    for (const command of current.gateCommands) {
      const gateResult = await params.runGateCommand(command);
      if (gateResult.exitCode !== 0) {
        const outputTail = tailOutput(gateResult.output, GOAL_GATE_OUTPUT_TAIL_CHARS);
        const updated = params.store.update(current.id, {
          iterations: nextIteration,
          lastGateOutput: outputTail,
          consecutiveParseFailures: 0,
          consecutiveTransportFailures: 0,
        })!;
        return {
          action: "continue",
          contract: updated,
          bypassedJudgeViaCoreFlowGate: true,
          continuationUserMessage: buildGoalContinuationUserMessage({
            contract: updated,
            gateFailure: { command, outputTail },
          }),
          reason: `CoreFlow gate "${command}" exited with ${gateResult.exitCode}.`,
        };
      }
    }
  }

  // 2. If no judge callback is provided, deterministic gates passing completes the turn.
  if (!params.invokeJudge) {
    const completed = params.store.update(current.id, {
      status: "completed",
      iterations: nextIteration,
      consecutiveParseFailures: 0,
      consecutiveTransportFailures: 0,
    })!;
    return { action: "complete", contract: completed };
  }

  // 3. Lightweight judge pass with 4,096 output-token budget and separate parse/transport circuit breakers.
  let rawJudgeText: string;
  try {
    rawJudgeText = await params.invokeJudge({
      objective: current.objective,
      acceptanceCriteria: current.acceptanceCriteria,
      assistantResponse: params.assistantResponse,
      maxTokens: GOAL_JUDGE_MAX_TOKENS,
    });
  } catch (transportErr) {
    const transportFailures = current.consecutiveTransportFailures + 1;
    if (transportFailures >= current.maxTransportFailures) {
      const paused = params.store.update(current.id, {
        status: "paused",
        iterations: nextIteration,
        consecutiveTransportFailures: transportFailures,
        pauseReason: `Judge transport circuit breaker tripped after ${transportFailures} consecutive failures: ${String(transportErr)}`,
      })!;
      return { action: "pause", contract: paused, reason: paused.pauseReason ?? undefined };
    }
    const updated = params.store.update(current.id, {
      iterations: nextIteration,
      consecutiveTransportFailures: transportFailures,
    })!;
    return {
      action: "continue",
      contract: updated,
      continuationUserMessage: buildGoalContinuationUserMessage({ contract: updated }),
      reason: `Judge transport error (${transportFailures}/${current.maxTransportFailures}); failing open.`,
    };
  }

  let parsed: GoalJudgeVerdict;
  try {
    const maybe = JSON.parse(rawJudgeText) as Partial<GoalJudgeVerdict>;
    if (
      !maybe ||
      (maybe.verdict !== "done" && maybe.verdict !== "continue" && maybe.verdict !== "wait")
    ) {
      throw new Error("Invalid verdict field");
    }
    parsed = {
      verdict: maybe.verdict,
      reason: maybe.reason,
      nextStep: maybe.nextStep,
    };
  } catch {
    const parseFailures = current.consecutiveParseFailures + 1;
    if (parseFailures >= current.maxParseFailures) {
      const paused = params.store.update(current.id, {
        status: "paused",
        iterations: nextIteration,
        consecutiveParseFailures: parseFailures,
        consecutiveTransportFailures: 0,
        pauseReason: `Judge parse circuit breaker tripped after ${parseFailures} consecutive invalid JSON verdicts.`,
      })!;
      return { action: "pause", contract: paused, reason: paused.pauseReason ?? undefined };
    }
    const updated = params.store.update(current.id, {
      iterations: nextIteration,
      consecutiveParseFailures: parseFailures,
      consecutiveTransportFailures: 0,
    })!;
    return {
      action: "continue",
      contract: updated,
      continuationUserMessage: buildGoalContinuationUserMessage({ contract: updated }),
      reason: `Judge parse error (${parseFailures}/${current.maxParseFailures}); failing open.`,
    };
  }

  if (parsed.verdict === "done") {
    const completed = params.store.update(current.id, {
      status: "completed",
      iterations: nextIteration,
      consecutiveParseFailures: 0,
      consecutiveTransportFailures: 0,
    })!;
    return { action: "complete", contract: completed, reason: parsed.reason };
  }

  if (parsed.verdict === "wait") {
    const waiting = params.store.update(current.id, {
      status: "waiting",
      iterations: nextIteration,
      consecutiveParseFailures: 0,
      consecutiveTransportFailures: 0,
    })!;
    return { action: "wait", contract: waiting, reason: parsed.reason };
  }

  const updated = params.store.update(current.id, {
    iterations: nextIteration,
    consecutiveParseFailures: 0,
    consecutiveTransportFailures: 0,
  })!;
  return {
    action: "continue",
    contract: updated,
    continuationUserMessage: buildGoalContinuationUserMessage({
      contract: updated,
      judgeNextStep: parsed.nextStep,
    }),
    reason: parsed.reason,
  };
}
