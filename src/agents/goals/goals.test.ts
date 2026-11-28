import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  draftGoalContractText,
  evaluateGoalTurn,
  GOAL_GATE_OUTPUT_TAIL_CHARS,
  GOAL_JUDGE_MAX_TOKENS,
  GoalContractStore,
  parseGoalCommand,
} from "./index.js";

describe("persistent /goal loop (CoreFlow 5-Gate Judge)", () => {
  const tempDirs: string[] = [];

  afterEach(() => {
    while (tempDirs.length > 0) {
      fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
    }
  });

  function makeStore(): { store: GoalContractStore; env: NodeJS.ProcessEnv } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "coreblow-goals-test-"));
    tempDirs.push(dir);
    const env = { ...process.env, COREBLOW_STATE_DIR: dir };
    return { store: new GoalContractStore(env), env };
  }

  it("persists goal contracts in SQLite WAL (0o600) across store reloads", () => {
    const { store, env } = makeStore();
    expect(store.getJournalMode()).toBe("wal");
    expect(fs.statSync(store.dbPath).mode & 0o777).toBe(0o600);

    const created = store.createOrReplaceForSession({
      sessionId: "sess-1",
      objective: "Ship Tool Search",
      acceptanceCriteria: ["tsgo passes", "tests pass"],
      gateCommands: ["pnpm check"],
    });
    store.close();

    const reloaded = new GoalContractStore(env);
    try {
      const loaded = reloaded.getLatestForSession("sess-1");
      expect(loaded?.id).toBe(created.id);
      expect(loaded?.objective).toBe("Ship Tool Search");
      expect(loaded?.status).toBe("active");
    } finally {
      reloaded.close();
    }
  });

  it("short-circuits failing CoreFlow gates (3000-char tail) without calling judge LLM", async () => {
    const { store } = makeStore();
    try {
      const contract = store.createOrReplaceForSession({
        sessionId: "sess-gate",
        objective: "Fix build",
        gateCommands: ["corepack pnpm check"],
      });
      const invokeJudge = vi.fn();
      const hugeOutput = `${"x".repeat(4500)}ERROR_AT_TAIL`;

      const result = await evaluateGoalTurn({
        store,
        contractId: contract.id,
        assistantResponse: "Done",
        runGateCommand: async (command) => ({
          command,
          exitCode: 1,
          output: hugeOutput,
        }),
        invokeJudge,
      });

      expect(result.action).toBe("continue");
      expect(result.bypassedJudgeViaCoreFlowGate).toBe(true);
      expect(invokeJudge).not.toHaveBeenCalled();
      expect(result.continuationUserMessage).toContain("ERROR_AT_TAIL");
      expect(result.contract.lastGateOutput?.length).toBe(GOAL_GATE_OUTPUT_TAIL_CHARS);
    } finally {
      store.close();
    }
  });

  it("enforces separate parse (max 3) and transport (max 5) circuit breakers with 4096 judge budget", async () => {
    const { store } = makeStore();
    try {
      const parseContract = store.createOrReplaceForSession({
        sessionId: "sess-parse",
        objective: "Test parse breaker",
      });
      let observedMaxTokens = 0;
      for (let i = 0; i < 3; i += 1) {
        const res = await evaluateGoalTurn({
          store,
          contractId: parseContract.id,
          assistantResponse: "working",
          invokeJudge: async ({ maxTokens }) => {
            observedMaxTokens = maxTokens;
            return "not-json";
          },
        });
        expect(res.action).toBe(i < 2 ? "continue" : "pause");
      }
      expect(observedMaxTokens).toBe(GOAL_JUDGE_MAX_TOKENS);
      expect(store.getById(parseContract.id)?.consecutiveParseFailures).toBe(3);

      const transportContract = store.createOrReplaceForSession({
        sessionId: "sess-transport",
        objective: "Test transport breaker",
      });
      for (let i = 0; i < 5; i += 1) {
        const res = await evaluateGoalTurn({
          store,
          contractId: transportContract.id,
          assistantResponse: "working",
          invokeJudge: async () => {
            throw new Error("HTTP 503 upstream timeout");
          },
        });
        expect(res.action).toBe(i < 4 ? "continue" : "pause");
      }
      expect(store.getById(transportContract.id)?.consecutiveTransportFailures).toBe(5);
    } finally {
      store.close();
    }
  });

  it("parses /goal subcommands cleanly", () => {
    expect(parseGoalCommand("status")).toEqual({ action: "status" });
    expect(parseGoalCommand("cancel")).toEqual({ action: "cancel" });
    expect(parseGoalCommand("wait 4242")).toEqual({ action: "wait", pid: 4242 });
    expect(parseGoalCommand("draft Build Tool Search")).toEqual({
      action: "draft",
      objective: "Build Tool Search",
    });
    expect(parseGoalCommand("Implement Phase 3")).toEqual({
      action: "set",
      objective: "Implement Phase 3",
    });
    expect(draftGoalContractText("Ship it").gateCommands).toEqual(["corepack pnpm check"]);
  });
});
