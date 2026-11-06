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

describe("Stage 6 R2: Adaptive Decision & Quota-Window Router", () => {
  describe("Task Route Tier Classification (classifyTaskRouteTier)", () => {
    it("classifies local / privacy prompts with highest priority", () => {
      // Tags
      expect(classifyTaskRouteTier("[local] Run this unit test in typescript")).toBe("local");
      expect(classifyTaskRouteTier("[offline] analyze this architecture diagram")).toBe("local");
      expect(classifyTaskRouteTier("[sovereign] classify intent for yes/no question")).toBe("local");
      expect(classifyTaskRouteTier("[privacy] confidential code refactoring")).toBe("local");
      expect(classifyTaskRouteTier("[airgap] review system design")).toBe("local");
      expect(classifyTaskRouteTier("[internal-only] deploy gate check")).toBe("local");

      // Phrases
      expect(classifyTaskRouteTier("Please run locally to protect private data")).toBe("local");
      expect(classifyTaskRouteTier("Execute in offline mode only")).toBe("local");
      expect(classifyTaskRouteTier("Sovereign AI execution required")).toBe("local");
      expect(classifyTaskRouteTier("This contains air-gapped confidential info")).toBe("local");
      expect(classifyTaskRouteTier("Strict constraint: do not send to cloud")).toBe("local");
    });

    it("classifies multimodal / vision prompts with second priority", () => {
      expect(classifyTaskRouteTier("Inspect this screenshot of the dashboard")).toBe("vision");
      expect(classifyTaskRouteTier("Check this diagram image for architectural flaws")).toBe("vision");
      expect(classifyTaskRouteTier("Perform visual inspection on wireframe.png")).toBe("vision");
      expect(classifyTaskRouteTier("OCR the text in this photo")).toBe("vision");
      expect(classifyTaskRouteTier("Render this svg camera picture")).toBe("vision");
    });

    it("local priority overrides vision and code", () => {
      expect(
        classifyTaskRouteTier("[local] Inspect this screenshot image and refactor code"),
      ).toBe("local");
      expect(
        classifyTaskRouteTier("Run locally: check diagram.png for security audit"),
      ).toBe("local");
    });

    it("classifies lightweight binary / routing prompts as decision tier", () => {
      expect(classifyTaskRouteTier("Approve or reject this pull request?")).toBe("decision");
      expect(classifyTaskRouteTier("Allow or deny this tool execution?")).toBe("decision");
      expect(classifyTaskRouteTier("Yes/no is this payload valid?")).toBe("decision");
      expect(classifyTaskRouteTier("Gate check: should we continue?")).toBe("decision");
      expect(classifyTaskRouteTier("Route to specialist member?")).toBe("decision");
      expect(classifyTaskRouteTier("Decision: proceed with release?")).toBe("decision");
      expect(classifyTaskRouteTier("Classify intent for user turn")).toBe("decision");
    });

    it("vision priority overrides decision tier", () => {
      expect(
        classifyTaskRouteTier("Approve or reject this screenshot wireframe?"),
      ).toBe("vision");
    });

    it("does not classify long complex prompts as decision tier even if binary words are present", () => {
      const longPrompt =
        "We are conducting a deep architectural analysis of the distributed consensus protocol. " +
        "We need to evaluate whether to approve or reject the proposal based on a formal verification of safety invariants, " +
        "liveness bounds, Byzantine fault tolerance limits, and operational failover thresholds across heterogeneous nodes. " +
        "Please provide a comprehensive trade-off matrix detailing all threat vectors, failure domains, and performance characteristics.";
      expect(classifyTaskRouteTier(longPrompt)).toBe("deep");
    });

    it("classifies coding, refactoring, and test tasks as coding tier", () => {
      expect(classifyTaskRouteTier("Write a typescript function to parse JSON")).toBe("coding");
      expect(classifyTaskRouteTier("Refactor unit test suite to improve coverage")).toBe("coding");
      expect(classifyTaskRouteTier("Fix this bug in python class definition")).toBe("coding");
      expect(classifyTaskRouteTier("Review git diff for syntax error in SQL query")).toBe("coding");
      expect(
        classifyTaskRouteTier("Implement endpoint handler:\n```const handler = () => {};```"),
      ).toBe("coding");
      expect(classifyTaskRouteTier("import { describe } from 'vitest';")).toBe("coding");
      expect(classifyTaskRouteTier("function evaluatePolicy() { return true; }")).toBe("coding");
    });

    it("coding with moderate tool count triggers coding tier", () => {
      expect(
        classifyTaskRouteTier("Review and update this database query", 3),
      ).toBe("coding");
    });

    it("classifies multi-step architecture and security audits as deep tier", () => {
      expect(
        classifyTaskRouteTier("Perform security audit and threat model on gateway"),
      ).toBe("deep");
      expect(
        classifyTaskRouteTier("Conduct root cause analysis (rca) of system crash"),
      ).toBe("deep");
      expect(
        classifyTaskRouteTier("Architectural trade-off analysis between Paxos and Raft"),
      ).toBe("deep");
      expect(
        classifyTaskRouteTier("Adversarial formal analysis and consensus verification"),
      ).toBe("deep");
      expect(
        classifyTaskRouteTier("Perform comprehensive review of microkernel lifecycle"),
      ).toBe("deep");
    });

    it("triggers deep tier for high tool count or very long prompts", () => {
      expect(classifyTaskRouteTier("Investigate state divergence across nodes", 5)).toBe(
        "deep",
      );

      const massivePrompt = "Analyze the cluster state telemetry. ".repeat(30);
      expect(massivePrompt.length).toBeGreaterThan(800);
      expect(classifyTaskRouteTier(massivePrompt)).toBe("deep");
    });

    it("defaults to fast tier for short conversational prompts or empty inputs", () => {
      expect(classifyTaskRouteTier("Hello there!")).toBe("fast");
      expect(classifyTaskRouteTier("What is the time right now?")).toBe("fast");
      expect(classifyTaskRouteTier("")).toBe("fast");
      expect(classifyTaskRouteTier("   ")).toBe("fast");
    });
  });

  describe("Usage Window Gauge Management", () => {
    const NOW = 1_000_000;

    it("creates immutable usage gauges with default zero usedTokens", () => {
      const gauge = createUsageGauge({
        providerId: "openai",
        windowLimitTokens: 100_000,
        windowResetsAtMs: NOW + 60_000,
      });

      expect(gauge.providerId).toBe("openai");
      expect(gauge.windowLimitTokens).toBe(100_000);
      expect(gauge.usedTokens).toBe(0);
      expect(gauge.windowResetsAtMs).toBe(NOW + 60_000);
      expect(gauge.cooldownUntilMs).toBeUndefined();
      expect(Object.isFrozen(gauge)).toBe(true);
    });

    it("creates gauges with explicit cooldown and used tokens", () => {
      const gauge = createUsageGauge({
        providerId: "anthropic",
        windowLimitTokens: 50_000,
        usedTokens: 25_000,
        windowResetsAtMs: NOW + 120_000,
        cooldownUntilMs: NOW + 30_000,
      });

      expect(gauge.usedTokens).toBe(25_000);
      expect(gauge.cooldownUntilMs).toBe(NOW + 30_000);
      expect(Object.isFrozen(gauge)).toBe(true);
    });

    it("correctly evaluates gauge availability under active and expired cooldowns", () => {
      expect(isGaugeAvailable(undefined, NOW)).toBe(true);

      const coolingGauge = createUsageGauge({
        providerId: "groq",
        windowLimitTokens: 100_000,
        usedTokens: 100,
        windowResetsAtMs: NOW + 60_000,
        cooldownUntilMs: NOW + 10_000,
      });

      // Active cooldown
      expect(isGaugeAvailable(coolingGauge, NOW)).toBe(false);
      expect(isGaugeAvailable(coolingGauge, NOW + 5_000)).toBe(false);

      // Expired cooldown
      expect(isGaugeAvailable(coolingGauge, NOW + 10_001)).toBe(true);
    });

    it("correctly evaluates gauge availability on quota exhaustion and window reset", () => {
      const exhaustedGauge = createUsageGauge({
        providerId: "deepseek",
        windowLimitTokens: 10_000,
        usedTokens: 10_000,
        windowResetsAtMs: NOW + 60_000,
      });

      // Exhausted during active window
      expect(isGaugeAvailable(exhaustedGauge, NOW)).toBe(false);
      expect(isGaugeAvailable(exhaustedGauge, NOW + 30_000)).toBe(false);

      // Available once window resets
      expect(isGaugeAvailable(exhaustedGauge, NOW + 60_000)).toBe(true);
      expect(isGaugeAvailable(exhaustedGauge, NOW + 90_000)).toBe(true);
    });

    it("records tokens used, accumulating during active window and resetting on expired window", () => {
      const initial = createUsageGauge({
        providerId: "openai",
        windowLimitTokens: 100_000,
        usedTokens: 1_000,
        windowResetsAtMs: NOW + 60_000,
      });

      // Accumulation in active window
      const updated = recordTokensUsed(initial, 500, NOW + 1_000);
      expect(updated.usedTokens).toBe(1_500);
      expect(initial.usedTokens).toBe(1_000); // Immutability preserved
      expect(Object.isFrozen(updated)).toBe(true);

      // Reset after window expires
      const resetGauge = recordTokensUsed(updated, 300, NOW + 70_000);
      expect(resetGauge.usedTokens).toBe(300);
    });

    it("sets gauge cooldown immutably", () => {
      const initial = createUsageGauge({
        providerId: "groq",
        windowLimitTokens: 50_000,
        windowResetsAtMs: NOW + 60_000,
      });

      const cooled = setGaugeCooldown(initial, NOW + 45_000);
      expect(cooled.cooldownUntilMs).toBe(NOW + 45_000);
      expect(initial.cooldownUntilMs).toBeUndefined();
      expect(Object.isFrozen(cooled)).toBe(true);
    });
  });

  describe("Adaptive Model Route Resolution (resolveAdaptiveModelRoute)", () => {
    const NOW = 2_000_000;

    it("resolves primary route for known profile when quota is healthy", () => {
      const decision = resolveAdaptiveModelRoute({
        profileId: "lead",
        nowMs: NOW,
      });

      expect(decision.providerId).toBe("anthropic");
      expect(decision.modelId).toBe("claude-3-7-sonnet");
      expect(decision.tier).toBe("deep");
      expect(decision.daybreakSwitched).toBe(false);
      expect(decision.reason).toContain("Primary route selected");
      expect(Object.isFrozen(decision)).toBe(true);
    });

    it("resolves primary route for tier when profileId is not specified", () => {
      const codingDecision = resolveAdaptiveModelRoute({
        tier: "coding",
        nowMs: NOW,
      });

      expect(codingDecision.providerId).toBe("deepseek");
      expect(codingDecision.modelId).toBe("deepseek-chat");
      expect(codingDecision.tier).toBe("coding");
      expect(codingDecision.daybreakSwitched).toBe(false);

      const decisionTier = resolveAdaptiveModelRoute({
        tier: "decision",
        nowMs: NOW,
      });
      expect(decisionTier.providerId).toBe("groq");
      expect(decisionTier.modelId).toBe("llama-3.3-70b-versatile");
      expect(decisionTier.tier).toBe("decision");
      expect(decisionTier.daybreakSwitched).toBe(false);
    });

    it("defaults to fast tier when neither tier nor profileId is specified", () => {
      const defaultDecision = resolveAdaptiveModelRoute({ nowMs: NOW });
      expect(defaultDecision.tier).toBe("fast");
      expect(defaultDecision.daybreakSwitched).toBe(false);
    });

    it("engages Daybreak switch to fallback when primary quota is exhausted", () => {
      const gauges = new Map<string, UsageWindowGauge>([
        [
          "anthropic",
          createUsageGauge({
            providerId: "anthropic",
            windowLimitTokens: 100_000,
            usedTokens: 100_000,
            windowResetsAtMs: NOW + 60_000,
          }),
        ],
      ]);

      const decision = resolveAdaptiveModelRoute({
        profileId: "lead",
        gauges,
        nowMs: NOW,
      });

      // Anthropic fallback is openai / gpt-4o
      expect(decision.daybreakSwitched).toBe(true);
      expect(decision.providerId).toBe("openai");
      expect(decision.modelId).toBe("gpt-4o");
      expect(decision.tier).toBe("deep");
      expect(decision.reason).toContain("quota window exhausted");
      expect(decision.reason).toContain("Daybreak switched to configured fallback 'openai/gpt-4o'");
    });

    it("engages Daybreak switch to fallback when primary is in active cooldown", () => {
      const gauges = new Map<string, UsageWindowGauge>([
        [
          "anthropic",
          createUsageGauge({
            providerId: "anthropic",
            windowLimitTokens: 100_000,
            usedTokens: 1_000,
            windowResetsAtMs: NOW + 60_000,
            cooldownUntilMs: NOW + 15_000,
          }),
        ],
      ]);

      const decision = resolveAdaptiveModelRoute({
        profileId: "lead",
        gauges,
        nowMs: NOW,
      });

      expect(decision.daybreakSwitched).toBe(true);
      expect(decision.providerId).toBe("openai");
      expect(decision.modelId).toBe("gpt-4o");
      expect(decision.reason).toContain("active cooldown until 2015000");
    });

    it("recovers primary route when cooldown expires or quota window resets", () => {
      const gauges = new Map<string, UsageWindowGauge>([
        [
          "anthropic",
          createUsageGauge({
            providerId: "anthropic",
            windowLimitTokens: 100_000,
            usedTokens: 100_000,
            windowResetsAtMs: NOW + 60_000,
            cooldownUntilMs: NOW + 10_000,
          }),
        ],
      ]);

      // At NOW: both cooldown and quota are active -> failover
      const failoverDecision = resolveAdaptiveModelRoute({
        profileId: "lead",
        gauges,
        nowMs: NOW,
      });
      expect(failoverDecision.daybreakSwitched).toBe(true);

      // At NOW + 60_001: both cooldown (expired at 10_000) and window (reset at 60_000) are clear!
      const recoveredDecision = resolveAdaptiveModelRoute({
        profileId: "lead",
        gauges,
        nowMs: NOW + 60_001,
      });
      expect(recoveredDecision.daybreakSwitched).toBe(false);
      expect(recoveredDecision.providerId).toBe("anthropic");
      expect(recoveredDecision.modelId).toBe("claude-3-7-sonnet");
    });

    it("cascades to local sovereign (ollama) when primary and configured fallback are both blocked", () => {
      const gauges = new Map<string, UsageWindowGauge>([
        [
          "anthropic",
          createUsageGauge({
            providerId: "anthropic",
            windowLimitTokens: 100_000,
            usedTokens: 100_000,
            windowResetsAtMs: NOW + 60_000,
          }),
        ],
        [
          "openai",
          createUsageGauge({
            providerId: "openai",
            windowLimitTokens: 50_000,
            usedTokens: 50_000,
            windowResetsAtMs: NOW + 60_000,
          }),
        ],
      ]);

      // Profile: lead (preferredTier: deep)
      const decision = resolveAdaptiveModelRoute({
        profileId: "lead",
        gauges,
        nowMs: NOW,
      });

      expect(decision.daybreakSwitched).toBe(true);
      expect(decision.providerId).toBe("ollama");
      expect(decision.modelId).toBe("deepseek-r1"); // deep tier local model
      expect(decision.reason).toContain("Daybreak switched to local sovereign 'ollama/deepseek-r1'");
    });

    it("selects appropriate local model for coding tier when cascading to ollama", () => {
      const gauges = new Map<string, UsageWindowGauge>([
        [
          "deepseek",
          createUsageGauge({
            providerId: "deepseek",
            windowLimitTokens: 50_000,
            usedTokens: 50_000,
            windowResetsAtMs: NOW + 60_000,
          }),
        ],
      ]);

      // Profile: coder has fallbackProviderId: "ollama" directly
      const decision = resolveAdaptiveModelRoute({
        profileId: "coder",
        gauges,
        nowMs: NOW,
      });

      expect(decision.daybreakSwitched).toBe(true);
      expect(decision.providerId).toBe("ollama");
      expect(decision.modelId).toBe("qwen2.5-coder");
    });

    it("cascades to sovereign edge (vllm/default) when ollama is also exhausted or unavailable", () => {
      const gauges = new Map<string, UsageWindowGauge>([
        [
          "anthropic",
          createUsageGauge({
            providerId: "anthropic",
            windowLimitTokens: 100_000,
            usedTokens: 100_000,
            windowResetsAtMs: NOW + 60_000,
          }),
        ],
        [
          "openai",
          createUsageGauge({
            providerId: "openai",
            windowLimitTokens: 50_000,
            usedTokens: 50_000,
            windowResetsAtMs: NOW + 60_000,
          }),
        ],
        [
          "ollama",
          createUsageGauge({
            providerId: "ollama",
            windowLimitTokens: 20_000,
            usedTokens: 20_000,
            windowResetsAtMs: NOW + 60_000,
          }),
        ],
      ]);

      const decision = resolveAdaptiveModelRoute({
        profileId: "lead",
        gauges,
        nowMs: NOW,
      });

      expect(decision.daybreakSwitched).toBe(true);
      expect(decision.providerId).toBe("vllm");
      expect(decision.modelId).toBe("default");
      expect(decision.reason).toContain("Daybreak switched to sovereign edge 'vllm/default'");
    });

    it("supports custom agent profiles and tiers", () => {
      const customProfiles: readonly AgentProfileRoute[] = Object.freeze([
        Object.freeze({
          profileId: "custom-tester",
          displayName: "Custom QA Specialist",
          preferredTier: "coding" as SubagentRouteTier,
          providerId: "together",
          modelId: "meta-llama/Llama-3-70b-chat-hf",
          fallbackProviderId: "groq",
          fallbackModelId: "llama-3.3-70b-versatile",
          skillIds: Object.freeze(["qa-skill"]),
        }),
      ]);

      const decision = resolveAdaptiveModelRoute({
        profileId: "custom-tester",
        profiles: customProfiles,
        nowMs: NOW,
      });

      expect(decision.providerId).toBe("together");
      expect(decision.modelId).toBe("meta-llama/Llama-3-70b-chat-hf");
      expect(decision.tier).toBe("coding");
      expect(decision.daybreakSwitched).toBe(false);
    });
  });

  describe("Plugin-SDK Re-export Verification", () => {
    it("exports all Stage 6 R2 contracts and routing functions from plugin-sdk/provider", () => {
      expect(PluginSdkProvider.classifyTaskRouteTier).toBe(classifyTaskRouteTier);
      expect(PluginSdkProvider.resolveAdaptiveModelRoute).toBe(resolveAdaptiveModelRoute);
      expect(PluginSdkProvider.createUsageGauge).toBe(createUsageGauge);
      expect(PluginSdkProvider.isGaugeAvailable).toBe(isGaugeAvailable);
      expect(PluginSdkProvider.recordTokensUsed).toBe(recordTokensUsed);
      expect(PluginSdkProvider.setGaugeCooldown).toBe(setGaugeCooldown);
      expect(PluginSdkProvider.DEFAULT_TIER_ROUTES).toBe(DEFAULT_TIER_ROUTES);
      expect(PluginSdkProvider.DEFAULT_AGENT_PROFILE_ROUTES).toBe(DEFAULT_AGENT_PROFILE_ROUTES);
    });
  });

  describe("Pure DOP Immutability Verification", () => {
    it("ensures all returned decisions, gauges, and catalogs are frozen", () => {
      expect(Object.isFrozen(DEFAULT_TIER_ROUTES)).toBe(true);
      expect(Object.isFrozen(DEFAULT_TIER_ROUTES.decision)).toBe(true);
      expect(Object.isFrozen(DEFAULT_TIER_ROUTES.fast)).toBe(true);
      expect(Object.isFrozen(DEFAULT_TIER_ROUTES.coding)).toBe(true);
      expect(Object.isFrozen(DEFAULT_TIER_ROUTES.deep)).toBe(true);
      expect(Object.isFrozen(DEFAULT_TIER_ROUTES.local)).toBe(true);
      expect(Object.isFrozen(DEFAULT_TIER_ROUTES.vision)).toBe(true);

      expect(Object.isFrozen(DEFAULT_AGENT_PROFILE_ROUTES)).toBe(true);
      for (const profile of DEFAULT_AGENT_PROFILE_ROUTES) {
        expect(Object.isFrozen(profile)).toBe(true);
      }

      const gauge = createUsageGauge({
        providerId: "test",
        windowLimitTokens: 100,
        windowResetsAtMs: 200,
      });
      expect(Object.isFrozen(gauge)).toBe(true);

      const decision = resolveAdaptiveModelRoute({ tier: "fast" });
      expect(Object.isFrozen(decision)).toBe(true);
    });
  });
});
