import { describe, expect, it } from "vitest";
import {
  classifyTaskRouteTier,
  createUsageGauge,
  DEFAULT_AGENT_PROFILE_ROUTES,
  DEFAULT_TIER_ROUTES,
  isGaugeAvailable,
  recordTokensUsed,
  resolveAdaptiveModelRoute,
  setGaugeCooldown,
  type AgentProfileRoute,
  type SubagentRouteTier,
  type UsageWindowGauge,
} from "./decision-router.js";
import * as PluginSdkProvider from "../plugin-sdk/provider.js";

describe("Stage 6 R2 Adversarial Stress Test: Adaptive Decision & Quota-Window Router", () => {
  const BASE_TIME = 1_700_000_000_000; // Realistic ms epoch

  // =========================================================================
  // 1. Exact Quota Boundary Conditions
  // =========================================================================
  describe("1. Exact Quota Boundary Conditions", () => {
    it("boundary: usedTokens === windowLimitTokens MUST switch (exhausted)", () => {
      const gauge = createUsageGauge({
        providerId: "anthropic",
        windowLimitTokens: 100_000,
        usedTokens: 100_000,
        windowResetsAtMs: BASE_TIME + 60_000,
      });

      expect(isGaugeAvailable(gauge, BASE_TIME)).toBe(false);

      const decision = resolveAdaptiveModelRoute({
        profileId: "lead",
        gauges: new Map([["anthropic", gauge]]),
        nowMs: BASE_TIME,
      });

      expect(decision.daybreakSwitched).toBe(true);
      expect(decision.providerId).toBe("openai"); // fallback of lead
      expect(decision.reason).toContain("quota window exhausted (100000/100000)");
    });

    it("boundary: usedTokens === windowLimitTokens - 1 MUST NOT switch (healthy)", () => {
      const gauge = createUsageGauge({
        providerId: "anthropic",
        windowLimitTokens: 100_000,
        usedTokens: 99_999,
        windowResetsAtMs: BASE_TIME + 60_000,
      });

      expect(isGaugeAvailable(gauge, BASE_TIME)).toBe(true);

      const decision = resolveAdaptiveModelRoute({
        profileId: "lead",
        gauges: new Map([["anthropic", gauge]]),
        nowMs: BASE_TIME,
      });

      expect(decision.daybreakSwitched).toBe(false);
      expect(decision.providerId).toBe("anthropic");
      expect(decision.modelId).toBe("claude-3-7-sonnet");
      expect(decision.reason).toContain("Primary route selected");
    });

    it("boundary: usedTokens === 0 with 0 windowLimitTokens MUST switch (zero capacity)", () => {
      const zeroGauge = createUsageGauge({
        providerId: "anthropic",
        windowLimitTokens: 0,
        usedTokens: 0,
        windowResetsAtMs: BASE_TIME + 60_000,
      });

      expect(isGaugeAvailable(zeroGauge, BASE_TIME)).toBe(false);

      const decision = resolveAdaptiveModelRoute({
        profileId: "lead",
        gauges: new Map([["anthropic", zeroGauge]]),
        nowMs: BASE_TIME,
      });

      expect(decision.daybreakSwitched).toBe(true);
      expect(decision.providerId).toBe("openai");
      expect(decision.reason).toContain("quota window exhausted (0/0)");
    });

    it("boundary: single token window (limit: 1)", () => {
      const gaugeAvailable = createUsageGauge({
        providerId: "groq",
        windowLimitTokens: 1,
        usedTokens: 0,
        windowResetsAtMs: BASE_TIME + 60_000,
      });
      expect(isGaugeAvailable(gaugeAvailable, BASE_TIME)).toBe(true);

      const gaugeExhausted = createUsageGauge({
        providerId: "groq",
        windowLimitTokens: 1,
        usedTokens: 1,
        windowResetsAtMs: BASE_TIME + 60_000,
      });
      expect(isGaugeAvailable(gaugeExhausted, BASE_TIME)).toBe(false);
    });

    it("boundary: usedTokens exceeding windowLimitTokens MUST switch", () => {
      const overGauge = createUsageGauge({
        providerId: "deepseek",
        windowLimitTokens: 50_000,
        usedTokens: 50_001,
        windowResetsAtMs: BASE_TIME + 60_000,
      });
      expect(isGaugeAvailable(overGauge, BASE_TIME)).toBe(false);

      const decision = resolveAdaptiveModelRoute({
        tier: "coding",
        gauges: new Map([["deepseek", overGauge]]),
        nowMs: BASE_TIME,
      });
      expect(decision.daybreakSwitched).toBe(true);
      expect(decision.providerId).toBe("ollama");
    });
  });

  // =========================================================================
  // 2. Cooldown Boundary Conditions
  // =========================================================================
  describe("2. Cooldown Boundary Conditions", () => {
    it("boundary: nowMs < cooldownUntilMs (even by 1ms) MUST switch (in cooldown)", () => {
      const coolingGauge = createUsageGauge({
        providerId: "anthropic",
        windowLimitTokens: 100_000,
        usedTokens: 0,
        windowResetsAtMs: BASE_TIME + 60_000,
        cooldownUntilMs: BASE_TIME + 5_000,
      });

      // 1ms before cooldown expires
      const beforeNow = BASE_TIME + 4_999;
      expect(isGaugeAvailable(coolingGauge, beforeNow)).toBe(false);

      const decision = resolveAdaptiveModelRoute({
        profileId: "lead",
        gauges: new Map([["anthropic", coolingGauge]]),
        nowMs: beforeNow,
      });

      expect(decision.daybreakSwitched).toBe(true);
      expect(decision.providerId).toBe("openai");
      expect(decision.reason).toContain(`active cooldown until ${BASE_TIME + 5_000}`);
    });

    it("boundary: nowMs === cooldownUntilMs MUST NOT switch (cooldown just ended)", () => {
      const cooldownMs = BASE_TIME + 5_000;
      const cooledGauge = createUsageGauge({
        providerId: "anthropic",
        windowLimitTokens: 100_000,
        usedTokens: 0,
        windowResetsAtMs: BASE_TIME + 60_000,
        cooldownUntilMs: cooldownMs,
      });

      // Exact millisecond cooldown expires
      expect(isGaugeAvailable(cooledGauge, cooldownMs)).toBe(true);

      const decision = resolveAdaptiveModelRoute({
        profileId: "lead",
        gauges: new Map([["anthropic", cooledGauge]]),
        nowMs: cooldownMs,
      });

      expect(decision.daybreakSwitched).toBe(false);
      expect(decision.providerId).toBe("anthropic");
      expect(decision.modelId).toBe("claude-3-7-sonnet");
    });

    it("boundary: nowMs > cooldownUntilMs (1ms after) MUST NOT switch", () => {
      const cooldownMs = BASE_TIME + 5_000;
      const cooledGauge = createUsageGauge({
        providerId: "anthropic",
        windowLimitTokens: 100_000,
        usedTokens: 0,
        windowResetsAtMs: BASE_TIME + 60_000,
        cooldownUntilMs: cooldownMs,
      });

      expect(isGaugeAvailable(cooledGauge, cooldownMs + 1)).toBe(true);
    });

    it("boundary: negative cooldown or zero cooldown value MUST NOT block", () => {
      const zeroCooldownGauge = createUsageGauge({
        providerId: "anthropic",
        windowLimitTokens: 100_000,
        usedTokens: 0,
        windowResetsAtMs: BASE_TIME + 60_000,
        cooldownUntilMs: 0,
      });

      expect(isGaugeAvailable(zeroCooldownGauge, BASE_TIME)).toBe(true);

      const negativeCooldownGauge = createUsageGauge({
        providerId: "anthropic",
        windowLimitTokens: 100_000,
        usedTokens: 0,
        windowResetsAtMs: BASE_TIME + 60_000,
        cooldownUntilMs: -100,
      });

      expect(isGaugeAvailable(negativeCooldownGauge, BASE_TIME)).toBe(true);

      // Even at nowMs = 0 with cooldownUntilMs = 0, (0 > 0 is false)
      expect(isGaugeAvailable(zeroCooldownGauge, 0)).toBe(true);
    });
  });

  // =========================================================================
  // 3. Quota Window Reset
  // =========================================================================
  describe("3. Quota Window Reset", () => {
    it("boundary: nowMs === windowResetsAtMs MUST allow access and reset calculation", () => {
      const resetTime = BASE_TIME + 60_000;
      const gauge = createUsageGauge({
        providerId: "anthropic",
        windowLimitTokens: 100_000,
        usedTokens: 100_000, // previously exhausted
        windowResetsAtMs: resetTime,
      });

      // 1ms before reset: still blocked
      expect(isGaugeAvailable(gauge, resetTime - 1)).toBe(false);

      // Exact millisecond of reset: MUST allow
      expect(isGaugeAvailable(gauge, resetTime)).toBe(true);

      // Routing must not switch
      const decision = resolveAdaptiveModelRoute({
        profileId: "lead",
        gauges: new Map([["anthropic", gauge]]),
        nowMs: resetTime,
      });
      expect(decision.daybreakSwitched).toBe(false);
      expect(decision.providerId).toBe("anthropic");

      // recordTokensUsed at exact reset time resets calculation
      const recorded = recordTokensUsed(gauge, 450, resetTime);
      expect(recorded.usedTokens).toBe(450); // reset to new tokens!
    });

    it("boundary: nowMs > windowResetsAtMs allows and resets token count", () => {
      const resetTime = BASE_TIME + 60_000;
      const gauge = createUsageGauge({
        providerId: "deepseek",
        windowLimitTokens: 50_000,
        usedTokens: 60_000,
        windowResetsAtMs: resetTime,
      });

      const afterReset = resetTime + 10_000;
      expect(isGaugeAvailable(gauge, afterReset)).toBe(true);

      const recorded = recordTokensUsed(gauge, 1_200, afterReset);
      expect(recorded.usedTokens).toBe(1_200);
    });

    it("recordTokensUsed accumulates tokens when nowMs < windowResetsAtMs", () => {
      const resetTime = BASE_TIME + 60_000;
      const gauge = createUsageGauge({
        providerId: "groq",
        windowLimitTokens: 10_000,
        usedTokens: 2_000,
        windowResetsAtMs: resetTime,
      });

      const beforeReset = resetTime - 1;
      const recorded = recordTokensUsed(gauge, 1_500, beforeReset);
      expect(recorded.usedTokens).toBe(3_500);
    });
  });

  // =========================================================================
  // 4. Cascading Failover Under Dual Failure
  // =========================================================================
  describe("4. Cascading Failover Under Dual Failure", () => {
    it("cascades: Primary exhausted AND fallback in cooldown -> local ollama with tier-appropriate models", () => {
      const resetTime = BASE_TIME + 60_000;

      const customProfiles: readonly AgentProfileRoute[] = [
        Object.freeze({
          profileId: "custom-coder",
          displayName: "Coder",
          preferredTier: "coding",
          providerId: "openai",
          modelId: "gpt-4o",
          fallbackProviderId: "anthropic",
          fallbackModelId: "claude-3-7-sonnet",
          skillIds: Object.freeze([]),
        }),
        Object.freeze({
          profileId: "custom-deep",
          displayName: "Deep",
          preferredTier: "deep",
          providerId: "anthropic",
          modelId: "claude-3-7-sonnet",
          fallbackProviderId: "openai",
          fallbackModelId: "o3-mini",
          skillIds: Object.freeze([]),
        }),
        Object.freeze({
          profileId: "custom-fast",
          displayName: "Fast",
          preferredTier: "fast",
          providerId: "groq",
          modelId: "llama-3.3-70b-versatile",
          fallbackProviderId: "openai",
          fallbackModelId: "gpt-4o-mini",
          skillIds: Object.freeze([]),
        }),
      ];

      // Primary exhausted, Fallback in cooldown, Ollama healthy
      const gauges = new Map<string, UsageWindowGauge>([
        [
          "openai",
          createUsageGauge({
            providerId: "openai",
            windowLimitTokens: 50_000,
            usedTokens: 50_000, // Exhausted
            windowResetsAtMs: resetTime,
          }),
        ],
        [
          "anthropic",
          createUsageGauge({
            providerId: "anthropic",
            windowLimitTokens: 50_000,
            usedTokens: 100,
            windowResetsAtMs: resetTime,
            cooldownUntilMs: BASE_TIME + 30_000, // In cooldown
          }),
        ],
        [
          "groq",
          createUsageGauge({
            providerId: "groq",
            windowLimitTokens: 50_000,
            usedTokens: 50_000, // Exhausted
            windowResetsAtMs: resetTime,
          }),
        ],
        [
          "ollama",
          createUsageGauge({
            providerId: "ollama",
            windowLimitTokens: 100_000,
            usedTokens: 0, // Healthy
            windowResetsAtMs: resetTime,
          }),
        ],
      ]);

      // A) Coding tier: Must cascade to ollama with qwen2.5-coder
      const codingDecision = resolveAdaptiveModelRoute({
        profileId: "custom-coder",
        profiles: customProfiles,
        gauges,
        nowMs: BASE_TIME,
      });
      expect(codingDecision.daybreakSwitched).toBe(true);
      expect(codingDecision.providerId).toBe("ollama");
      expect(codingDecision.modelId).toBe("qwen2.5-coder");
      expect(codingDecision.tier).toBe("coding");

      // B) Deep tier: Must cascade to ollama with deepseek-r1
      const deepDecision = resolveAdaptiveModelRoute({
        profileId: "custom-deep",
        profiles: customProfiles,
        gauges,
        nowMs: BASE_TIME,
      });
      expect(deepDecision.daybreakSwitched).toBe(true);
      expect(deepDecision.providerId).toBe("ollama");
      expect(deepDecision.modelId).toBe("deepseek-r1");
      expect(deepDecision.tier).toBe("deep");

      // C) Fast tier: Must cascade to ollama with llama3.3
      const fastDecision = resolveAdaptiveModelRoute({
        profileId: "custom-fast",
        profiles: customProfiles,
        gauges,
        nowMs: BASE_TIME,
      });
      expect(fastDecision.daybreakSwitched).toBe(true);
      expect(fastDecision.providerId).toBe("ollama");
      expect(fastDecision.modelId).toBe("llama3.3");
      expect(fastDecision.tier).toBe("fast");

      // D) Decision tier default: cascades to ollama with llama3.3
      const decisionDecision = resolveAdaptiveModelRoute({
        tier: "decision",
        gauges, // groq exhausted, openai exhausted
        nowMs: BASE_TIME,
      });
      expect(decisionDecision.daybreakSwitched).toBe(true);
      expect(decisionDecision.providerId).toBe("ollama");
      expect(decisionDecision.modelId).toBe("llama3.3");
    });

    it("cascades: Primary exhausted AND fallback exhausted AND ollama exhausted -> sovereign edge vllm/default", () => {
      const resetTime = BASE_TIME + 60_000;
      const tripleExhaustedGauges = new Map<string, UsageWindowGauge>([
        [
          "anthropic",
          createUsageGauge({
            providerId: "anthropic",
            windowLimitTokens: 100_000,
            usedTokens: 100_000,
            windowResetsAtMs: resetTime,
          }),
        ],
        [
          "openai",
          createUsageGauge({
            providerId: "openai",
            windowLimitTokens: 50_000,
            usedTokens: 50_000,
            windowResetsAtMs: resetTime,
          }),
        ],
        [
          "ollama",
          createUsageGauge({
            providerId: "ollama",
            windowLimitTokens: 10_000,
            usedTokens: 10_000,
            windowResetsAtMs: resetTime,
          }),
        ],
      ]);

      const decision = resolveAdaptiveModelRoute({
        profileId: "lead",
        gauges: tripleExhaustedGauges,
        nowMs: BASE_TIME,
      });

      expect(decision.daybreakSwitched).toBe(true);
      expect(decision.providerId).toBe("vllm");
      expect(decision.modelId).toBe("default");
      expect(decision.reason).toContain("Daybreak switched to sovereign edge 'vllm/default'");
    });

    it("cascades: Coding tier when deepseek, ollama, and vllm gauges are checked", () => {
      const resetTime = BASE_TIME + 60_000;
      const allDownGauges = new Map<string, UsageWindowGauge>([
        [
          "deepseek",
          createUsageGauge({
            providerId: "deepseek",
            windowLimitTokens: 10_000,
            usedTokens: 10_000,
            windowResetsAtMs: resetTime,
          }),
        ],
        [
          "ollama",
          createUsageGauge({
            providerId: "ollama",
            windowLimitTokens: 10_000,
            usedTokens: 10_000,
            windowResetsAtMs: resetTime,
          }),
        ],
      ]);

      const decision = resolveAdaptiveModelRoute({
        tier: "coding",
        gauges: allDownGauges,
        nowMs: BASE_TIME,
      });

      expect(decision.daybreakSwitched).toBe(true);
      expect(decision.providerId).toBe("vllm");
      expect(decision.modelId).toBe("default");
    });
  });

  // =========================================================================
  // 5. Task Classifier Priority Overrides
  // =========================================================================
  describe("5. Task Classifier Priority Overrides", () => {
    describe("Privacy tag embedded inside code blocks or prompt", () => {
      it("overrides code when [privacy] is embedded inside a code block", () => {
        const prompt = `Here is the implementation:
\`\`\`typescript
// [privacy] secret customer key logic
export function processCustomer(key: string): void {
  // do something
}
\`\`\``;
        expect(classifyTaskRouteTier(prompt)).toBe("local");
      });

      it("overrides code when [offline] is embedded in code comments", () => {
        const prompt = `\`\`\`python
# [offline] local proprietary neural network
def forward(x):
    return x * 2
\`\`\``;
        expect(classifyTaskRouteTier(prompt)).toBe("local");
      });

      it("overrides code when [sovereign] or [airgap] is inside the prompt", () => {
        expect(
          classifyTaskRouteTier("const x = 1;\n// [sovereign] do not leak"),
        ).toBe("local");
        expect(
          classifyTaskRouteTier("[airgap] refactor this function to improve performance"),
        ).toBe("local");
        expect(
          classifyTaskRouteTier("import { db } from './db';\n// [internal-only] migration script"),
        ).toBe("local");
      });

      it("overrides decision when privacy phrase is present", () => {
        expect(
          classifyTaskRouteTier("Approve or reject this PR? Strict constraint: do not send to cloud"),
        ).toBe("local");
        expect(
          classifyTaskRouteTier("[local] Approve or reject the tool request?"),
        ).toBe("local");
      });

      it("overrides vision when privacy tag is present", () => {
        expect(
          classifyTaskRouteTier("[local] Inspect this screenshot.png and OCR the text"),
        ).toBe("local");
        expect(
          classifyTaskRouteTier("Please run locally to protect private data: check diagram.png"),
        ).toBe("local");
      });
    });

    describe("Code prompt containing words like 'audit' or 'decision'", () => {
      it("routes long code prompt containing 'decision' to coding tier (> 250 chars & >= 40 words)", () => {
        const longCodeWithDecision = `We are implementing an enterprise routing decision matrix for the subagent workflow engine in TypeScript.
This module must evaluate binary gate conditions and determine whether each task card is ready to transition between Kanban DAG states.
\`\`\`typescript
export function evaluateGateDecision(gate: PolicyGate, task: KanbanTaskCard): "approve" | "reject" {
  if (gate.check(task)) {
    return "approve";
  }
  return "reject";
}
\`\`\`
Ensure all unit tests cover boundary conditions and type invariants for this decision pipeline.`;

        expect(longCodeWithDecision.length).toBeGreaterThan(250);
        expect(longCodeWithDecision.split(/\s+/).length).toBeGreaterThanOrEqual(40);
        expect(classifyTaskRouteTier(longCodeWithDecision)).toBe("coding");
      });

      it("routes long code prompt containing 'audit' to coding tier (> 250 chars & >= 40 words)", () => {
        const longCodeWithAudit = `Please conduct a thorough inspection of our cryptographic token generation code for the upcoming security audit.
We must ensure that all tokens are generated with sufficient entropy and that timing attacks are completely prevented.
\`\`\`typescript
export function generateSecureToken(byteLength: number): string {
  const buffer = crypto.randomBytes(byteLength);
  return buffer.toString("hex");
}
\`\`\`
Verify that this implementation satisfies all requirements before we commit to main.`;

        expect(longCodeWithAudit.length).toBeGreaterThan(250);
        expect(longCodeWithAudit.split(/\s+/).length).toBeGreaterThanOrEqual(40);
        expect(classifyTaskRouteTier(longCodeWithAudit)).toBe("coding");
      });

      it("empirical observation: short code snippet containing 'decision' is intercepted by decision tier", () => {
        // When a prompt is short (< 250 chars) and contains 'decision',
        // the decision classifier (Step 3) fires before coding classifier (Step 4).
        const shortCodeWithDecision = `const decision = evaluatePolicy();`;
        expect(classifyTaskRouteTier(shortCodeWithDecision)).toBe("decision");
      });

      it("routes pure security audit WITHOUT code constructs to deep tier", () => {
        const pureAudit = "Perform a security audit and threat model on the gateway microkernel architecture.";
        expect(classifyTaskRouteTier(pureAudit)).toBe("deep");
      });

      it("routes short binary decision WITHOUT code constructs to decision tier", () => {
        const pureDecision = "Approve or reject this deployment request?";
        expect(classifyTaskRouteTier(pureDecision)).toBe("decision");
      });
    });

    describe("Empty, whitespace, and unicode prompts", () => {
      it("handles empty and plain whitespace strings gracefully", () => {
        expect(classifyTaskRouteTier("")).toBe("fast");
        expect(classifyTaskRouteTier("   ")).toBe("fast");
        expect(classifyTaskRouteTier("\t\n\r  ")).toBe("fast");
      });

      it("handles unicode whitespace (e.g. non-breaking space, em quad) gracefully", () => {
        // \u00A0: NO-BREAK SPACE, \u2000: EN QUAD, \u3000: IDEOGRAPHIC SPACE
        expect(classifyTaskRouteTier("\u00A0\u2000\u3000")).toBe("fast");
      });

      it("handles non-English unicode text without crash", () => {
        expect(classifyTaskRouteTier("こんにちは、お元気ですか？")).toBe("fast");
        expect(classifyTaskRouteTier("مرحبا كيف حالك")).toBe("fast");
        expect(classifyTaskRouteTier("你好，请问有什么可以帮助你的？")).toBe("fast");
        expect(classifyTaskRouteTier("Привет, как дела?")).toBe("fast");
      });

      it("detects privacy tags with unicode text", () => {
        expect(classifyTaskRouteTier("[privacy] 秘密のデータセットを处理する")).toBe("local");
        expect(classifyTaskRouteTier("[local] 私有数据处理")).toBe("local");
      });

      it("detects code constructs with unicode comments", () => {
        expect(
          classifyTaskRouteTier("```typescript\n// 用户认证逻辑\nfunction auth() { return true; }\n```"),
        ).toBe("coding");
      });

      it("handles null and undefined input safely without throwing", () => {
        const classifyUnsafe = classifyTaskRouteTier as unknown as (p?: string | null) => SubagentRouteTier;
        expect(classifyUnsafe(null)).toBe("fast");
        expect(classifyUnsafe(undefined)).toBe("fast");
      });
    });
  });

  // =========================================================================
  // 6. DOP Immutability & Input Non-Mutation
  // =========================================================================
  describe("6. DOP Immutability & Input Non-Mutation", () => {
    it("ensures all returned objects from routing and gauge functions are Object.isFrozen", () => {
      const gauge = createUsageGauge({
        providerId: "test",
        windowLimitTokens: 100,
        usedTokens: 10,
        windowResetsAtMs: BASE_TIME + 1000,
        cooldownUntilMs: BASE_TIME + 500,
      });
      expect(Object.isFrozen(gauge)).toBe(true);

      const updated = recordTokensUsed(gauge, 20, BASE_TIME);
      expect(Object.isFrozen(updated)).toBe(true);

      const cooled = setGaugeCooldown(gauge, BASE_TIME + 2000);
      expect(Object.isFrozen(cooled)).toBe(true);

      const decision = resolveAdaptiveModelRoute({
        tier: "coding",
        nowMs: BASE_TIME,
      });
      expect(Object.isFrozen(decision)).toBe(true);
    });

    it("verifies NO mutation occurs on input gauges Map or Gauge objects", () => {
      const originalGauge = createUsageGauge({
        providerId: "anthropic",
        windowLimitTokens: 100_000,
        usedTokens: 50_000,
        windowResetsAtMs: BASE_TIME + 60_000,
        cooldownUntilMs: BASE_TIME + 10_000,
      });

      const inputMap = new Map<string, UsageWindowGauge>([
        ["anthropic", originalGauge],
      ]);

      const mapEntriesBefore = Array.from(inputMap.entries());

      // Execute route resolution
      const decision = resolveAdaptiveModelRoute({
        profileId: "lead",
        gauges: inputMap,
        nowMs: BASE_TIME,
      });

      // Verify input map was NOT mutated
      expect(inputMap.size).toBe(1);
      expect(Array.from(inputMap.entries())).toEqual(mapEntriesBefore);
      expect(inputMap.get("anthropic")).toBe(originalGauge);

      // Verify originalGauge was NOT mutated
      expect(originalGauge.usedTokens).toBe(50_000);
      expect(originalGauge.cooldownUntilMs).toBe(BASE_TIME + 10_000);
      expect(originalGauge.windowLimitTokens).toBe(100_000);
      expect(originalGauge.windowResetsAtMs).toBe(BASE_TIME + 60_000);

      // Verify decision is distinct and frozen
      expect(decision.daybreakSwitched).toBe(true);
    });

    it("verifies NO mutation occurs on input profiles array", () => {
      const customProfiles: readonly AgentProfileRoute[] = Object.freeze([
        Object.freeze({
          profileId: "tester",
          displayName: "Tester",
          preferredTier: "fast",
          providerId: "groq",
          modelId: "llama-3.3-70b-versatile",
          skillIds: Object.freeze(["skill1"]),
        }),
      ]);

      const profilesBefore = [...customProfiles];

      resolveAdaptiveModelRoute({
        profileId: "tester",
        profiles: customProfiles,
        nowMs: BASE_TIME,
      });

      expect(customProfiles).toEqual(profilesBefore);
    });

    it("prevents property mutation on returned decision (strict mode throw)", () => {
      const decision = resolveAdaptiveModelRoute({ tier: "fast", nowMs: BASE_TIME });
      expect(() => {
        // @ts-expect-error mutating frozen object
        decision.providerId = "mutated";
      }).toThrow();
    });
  });
});
