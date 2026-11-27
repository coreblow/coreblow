import { describe, expect, it, vi } from "vitest";
import {
  classifyExecutionTier,
  CognitiveCoordinator,
} from "./coordinator.js";
import { CoreFlowOrchestratorService, WarRoomOrchestratorService } from "../war-room/index.js";

describe("CoreFlow 3-Tier Auto-Bypass Router", () => {
  it("routes Q&A turns to Tier 0 and skips CoreFlow", () => {
    const decision = classifyExecutionTier({
      isQuestionOnly: true,
      touchedFiles: ["src/security/audit.ts"],
      totalLocChanged: 0,
    });
    expect(decision.tier).toBe(0);
    expect(decision.mode).toBe("auto_bypass_single_agent");
    expect(decision.skipCoreFlow).toBe(true);
    expect(decision.runDeterministicGates).toBe(false);
    expect(decision.runDiffAuditorGate5).toBe(false);
  });

  it("routes lightweight non-sensitive edits (<=2 files, <50 LOC) to Tier 0", () => {
    const decision = classifyExecutionTier({
      touchedFiles: ["src/cli/help.ts", "README.md"],
      totalLocChanged: 24,
    });
    expect(decision.tier).toBe(0);
    expect(decision.mode).toBe("auto_bypass_single_agent");
    expect(decision.skipCoreFlow).toBe(true);
  });

  it("routes medium non-sensitive edits (3-8 files) to Tier 1 verified single-agent", () => {
    const decision = classifyExecutionTier({
      touchedFiles: ["src/a.ts", "src/b.ts", "src/c.ts", "src/d.ts"],
      totalLocChanged: 120,
    });
    expect(decision.tier).toBe(1);
    expect(decision.mode).toBe("verified_single_agent");
    expect(decision.skipCoreFlow).toBe(false);
    expect(decision.runDeterministicGates).toBe(true);
    expect(decision.runDiffAuditorGate5).toBe(false);
  });

  it("escalates sensitive paths, >8 files, or untrusted execution to Tier 2 isolated CoreFlow", () => {
    for (const params of [
      { touchedFiles: ["src/security/audit.ts"], totalLocChanged: 5 },
      { touchedFiles: ["src/auth/tokens.ts"], totalLocChanged: 10 },
      { touchedFiles: [".github/workflows/ci.yml"], totalLocChanged: 2 },
      { touchedFiles: ["package.json"], totalLocChanged: 1 },
      { touchedFiles: Array.from({ length: 9 }, (_, i) => `src/f${i}.ts`), totalLocChanged: 40 },
      { touchedFiles: ["src/a.ts"], totalLocChanged: 5, untrustedExecution: true },
    ]) {
      const decision = classifyExecutionTier(params);
      expect(decision.tier).toBe(2);
      expect(decision.mode).toBe("isolated_coreflow");
      expect(decision.skipCoreFlow).toBe(false);
      expect(decision.runDeterministicGates).toBe(true);
      expect(decision.runDiffAuditorGate5).toBe(true);
    }
  });

  it("exposes CoreFlowOrchestratorService as canonical alias of WarRoomOrchestratorService", () => {
    expect(CoreFlowOrchestratorService).toBe(WarRoomOrchestratorService);
  });

  it("wires tier classification into CognitiveCoordinator.onTurnStart", async () => {
    const coordinator = new CognitiveCoordinator();
    const res = await coordinator.onTurnStart({
      runId: "run-tier0",
      sessionId: "sess-tier0",
      prompt: "Explain how CoreBlow gateway health checks work",
      requestedProvider: "ollama",
      requestedModel: "qwen2.5-coder",
      isQuestionOnly: true,
      touchedFiles: ["src/gateway/server.ts"],
      totalLocChanged: 0,
    });
    expect(res.executionTier).toBe(0);
    expect(res.executionMode).toBe("auto_bypass_single_agent");
    expect(res.coreFlowEscalated).toBeUndefined();
    expect(res.warRoomEscalated).toBeUndefined();
    vi.restoreAllMocks();
  });
});
